"""
NLV History Processor
=====================
Processes NLV_HISTORY reports from IBKR.
Populates twr_daily table with daily NAV values via API,
then triggers cash journal fill and TWR calculation.

Uses APIClient (HTTP) following the same pattern as all other ETL processors.

Flow:
1. Parse NLV_HISTORY CSV → extract ClientAccountID, Total (NAV), ReportDate
2. Filter to CurrencyPrimary = USD only (other currencies are virtual accounts)
3. POST batches to /api/v1/twr/upsert-nav-batch
4. POST to /api/v1/twr/fill-and-calculate
"""

import csv
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

from app.jobs.api_client import APIClient, get_api_client

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


class NLVHistoryProcessor:
    """
    Process NLV_HISTORY CSV from IBKR via API endpoints.
    Only processes USD rows (the main account for each client).
    """

    def __init__(self, api_client: APIClient = None):
        self.api = api_client or get_api_client()
        self._headers_ignored = 0  # internal counter, not exposed to user
        self.stats = {
            "records_processed": 0,
            "records_created": 0,
            "records_updated": 0,
            "records_skipped": 0,
            "records_failed": 0,
            "cash_journal_filled": 0,
            "twr_calculated": 0,
            "errors": [],
            "missing_accounts": [],
            "skipped_records": [],
            "failed_records": [],
        }

    def process_file(self, file_path: Path) -> dict:
        """
        Main entry point. Processes NLV_HISTORY CSV:
          1. Parse CSV and POST NAV batches to API
          2. Call fill-and-calculate to compute cash sums + TWR
        """
        logger.info(f"Processing NLV History file: {file_path}")

        # --- Phase 1: Parse CSV and upsert NAV via API ---
        try:
            self._upload_nav_from_csv(file_path)
        except Exception as e:
            logger.error(f"Error in NAV upload phase: {e}")
            self.stats["errors"].append(f"NAV upload: {e}")

        # --- Phase 2: Fill cash journal sums + calculate TWR ---
        try:
            self._fill_and_calculate()
        except Exception as e:
            logger.error(f"Error in fill-and-calculate phase: {e}")
            self.stats["errors"].append(f"Fill & Calculate: {e}")

        logger.info(
            f"NLV History complete — "
            f"processed={self.stats['records_processed']}, "
            f"created={self.stats['records_created']}, "
            f"updated={self.stats['records_updated']}, "
            f"skipped={self.stats['records_skipped']}, "
            f"failed={self.stats['records_failed']}, "
            f"headers_ignored={self._headers_ignored}, "
            f"twr_calculated={self.stats['twr_calculated']}"
        )

        # Debug: Log array sizes before returning
        logger.info(
            f"Record details — "
            f"skipped_records array: {len(self.stats['skipped_records'])} items, "
            f"failed_records array: {len(self.stats['failed_records'])} items, "
            f"errors array: {len(self.stats['errors'])} items"
        )

        return self.stats

    # ------------------------------------------------------------------
    # PHASE 1: Parse CSV and POST NAV batches
    # ------------------------------------------------------------------

    def _upload_nav_from_csv(self, file_path: Path):
        """Parse NLV_HISTORY CSV and send NAV data to API in batches."""
        batch: List[Dict] = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Silently skip repeated header rows — IBKR multi-account
                # CSVs repeat the header between account sections
                client_id = (row.get("ClientAccountID") or "").strip()
                if client_id in ("ClientAccountID", "Account"):
                    self._headers_ignored += 1
                    continue

                self.stats["records_processed"] += 1
                try:
                    entry = self._parse_nav_row(row)
                    if entry:
                        batch.append(entry)

                    if len(batch) >= BATCH_SIZE:
                        self._flush_batch(batch)
                        batch = []
                except Exception as e:
                    self.stats["records_failed"] += 1
                    if len(self.stats["failed_records"]) < 50:
                        self.stats["failed_records"].append({
                            "reason": f"Unexpected error: {str(e)}",
                            "row_number": self.stats["records_processed"],
                            "row_data": str(row)[:200],
                        })
                    if len(self.stats["errors"]) < 20:
                        self.stats["errors"].append(
                            f"Row {self.stats['records_processed']}: {e}"
                        )

        # Flush remaining
        if batch:
            self._flush_batch(batch)

    def _parse_nav_row(self, row: Dict) -> Optional[Dict]:
        """Parse a single CSV row. Returns dict or None if skipped.
        Header rows are already filtered out in _upload_nav_from_csv."""
        client_id = (row.get("ClientAccountID") or "").strip()
        currency = (row.get("CurrencyPrimary") or "").strip()

        # Only process USD rows
        if currency != "USD":
            self.stats["records_skipped"] += 1
            if len(self.stats["skipped_records"]) < 50:
                self.stats["skipped_records"].append({
                    "reason": f"Non-USD currency: {currency}",
                    "client_id": client_id,
                    "date": row.get("ReportDate", "").strip(),
                    "currency": currency,
                })
            return None

        if not client_id or not currency:
            self.stats["records_skipped"] += 1
            if len(self.stats["skipped_records"]) < 50:
                self.stats["skipped_records"].append({
                    "reason": "Missing ClientAccountID",
                    "data": str(row)[:100],
                })
            return None

        # Parse date — IBKR uses DD/MM/YYYY format
        raw_date = (row.get("ReportDate") or "").strip()
        if not raw_date:
            self.stats["records_skipped"] += 1
            if len(self.stats["skipped_records"]) < 50:
                self.stats["skipped_records"].append({
                    "reason": "Missing ReportDate",
                    "client_id": client_id,
                })
            return None

        report_date = self._parse_date(raw_date)
        if not report_date:
            self.stats["records_failed"] += 1
            if len(self.stats["failed_records"]) < 50:
                self.stats["failed_records"].append({
                    "reason": f"Invalid date format: {raw_date}",
                    "client_id": client_id,
                    "date_raw": raw_date,
                    "row_data": str(row)[:200],
                })
            if len(self.stats["errors"]) < 20:
                self.stats["errors"].append(f"Bad date format: {raw_date} (Account: {client_id})")
            return None

        # Parse NAV (column "Total")
        raw_nav = (row.get("Total") or "").strip()
        if not raw_nav:
            self.stats["records_skipped"] += 1
            if len(self.stats["skipped_records"]) < 50:
                self.stats["skipped_records"].append({
                    "reason": "Missing NAV (Total)",
                    "client_id": client_id,
                    "date": raw_date,
                })
            return None

        try:
            nav = float(raw_nav.replace(",", ""))  # Handle comma-separated numbers
        except (ValueError, TypeError):
            self.stats["records_failed"] += 1
            if len(self.stats["failed_records"]) < 50:
                self.stats["failed_records"].append({
                    "reason": f"Invalid NAV value: {raw_nav}",
                    "client_id": client_id,
                    "date": raw_date,
                    "nav_raw": raw_nav,
                    "row_data": str(row)[:200],
                })
            if len(self.stats["errors"]) < 20:
                self.stats["errors"].append(f"Invalid NAV: {raw_nav} (Account: {client_id}, Date: {raw_date})")
            return None

        # Construct account_code: ClientAccountID + "_USD"
        account_code = f"{client_id}_USD"

        return {
            "account_code": account_code,
            "date": report_date,  # str: YYYY-MM-DD
            "nav": nav,
        }

    def _parse_date(self, raw: str) -> Optional[str]:
        """
        Parse date string from IBKR CSV.
        IBKR uses DD/MM/YYYY for international accounts.
        Returns ISO format string (YYYY-MM-DD) or None.
        """
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return None

    def _flush_batch(self, batch: List[Dict]):
        """POST a batch of NAV rows to the API."""
        payload = {"rows": batch}
        result = self.api._make_request(
            "POST",
            "/api/v1/twr/upsert-nav-batch",
            data=payload,
        )
        if result:
            self.stats["records_created"] += result.get("records_created", 0)
            self.stats["records_updated"] += result.get("records_updated", 0)
            api_failed = result.get("records_failed", 0)
            self.stats["records_failed"] += api_failed
            missing = result.get("missing_accounts", [])
            for m in missing:
                if m not in self.stats["missing_accounts"]:
                    self.stats["missing_accounts"].append(m)

            # Create detailed failed_records entries for missing accounts
            if missing and api_failed > 0:
                missing_set = set(missing)
                for row in batch:
                    if row["account_code"] in missing_set:
                        if len(self.stats["failed_records"]) < 50:
                            # Display account without _USD suffix for cleaner error messages
                            display_account = row["account_code"].replace("_USD", "")
                            self.stats["failed_records"].append({
                                "reason": f"Account not found in DB: {display_account}",
                                "account_code": row["account_code"],
                                "date": row["date"],
                            })
        else:
            logger.error("Failed to upsert NAV batch to API")
            self.stats["records_failed"] += len(batch)
            if len(self.stats["failed_records"]) < 50:
                self.stats["failed_records"].append({
                    "reason": "API batch request failed entirely",
                    "batch_size": len(batch),
                    "first_row": str(batch[0]) if batch else "empty",
                })

    # ------------------------------------------------------------------
    # PHASE 2: Fill cash journal + calculate TWR
    # ------------------------------------------------------------------

    def _fill_and_calculate(self):
        """Call the fill-and-calculate API endpoint."""
        result = self.api._make_request(
            "POST",
            "/api/v1/twr/fill-and-calculate",
        )
        if result:
            self.stats["cash_journal_filled"] = result.get("cash_journal_filled", 0)
            self.stats["twr_calculated"] = result.get("twr_calculated", 0)
            logger.info(
                f"Fill & Calculate: cash_filled={self.stats['cash_journal_filled']}, "
                f"twr_calculated={self.stats['twr_calculated']}"
            )
        else:
            logger.error("Failed to call fill-and-calculate API")
            self.stats["errors"].append("fill-and-calculate API call failed")


def process_nlv_history(api_client: APIClient, file_path: Path) -> dict:
    """Convenience function to process a NLV_HISTORY CSV via API."""
    processor = NLVHistoryProcessor(api_client=api_client)
    return processor.process_file(file_path)
