"""
Transfers Processor (ACATS)
============================
Processes TRANSFERS reports from IBKR and uploads via API.
Handles: Asset transfers IN/OUT between accounts (ACATS)

REFACTORED: Now uses APIClient instead of direct DB access.
"""

import csv
import logging
from pathlib import Path
from datetime import datetime, date
from typing import Dict, Optional, List
from decimal import Decimal, InvalidOperation

from app.jobs.api_client import APIClient, get_api_client

logger = logging.getLogger(__name__)


class TransfersProcessor:
    """Process Transfers (ACATS) CSV from IBKR for Cash Journal entries via API."""
    
    def __init__(self, api_client: APIClient = None):
        self.api = api_client or get_api_client()
        self.stats = {
            "records_processed": 0,
            "records_created": 0,
            "records_updated": 0,
            "records_skipped": 0,
            "records_failed": 0,
            "errors": [],
            "missing_assets": [],
            "missing_accounts": [],
            "missing_transfer_accounts": [],  # Transfer accounts that don't exist
            "skipped_records": [],
            "failed_records": []
        }
        # Track unique missing items
        self._missing_asset_symbols = set()
        self._missing_account_codes = set()
        self._missing_transfer_accounts = set()
        # Track processed reference codes within batch
        self._batch_reference_codes = set()
    
    def process_file(self, file_path: Path) -> dict:
        """
        Process Transfers CSV file via API bulk endpoint.
        
        Expected CSV columns from IBKR:
        ClientAccountID, AccountAlias, CurrencyPrimary, Symbol, Description, ISIN,
        ReportDate, Date, DateTime, SettleDate, Type, Direction, TransferCompany,
        TransferAccount, TransferAccountName, DeliveringBroker, Quantity, TransferPrice,
        PositionAmount, PositionAmountInBase, TransactionID, etc.
        """
        logger.info(f"Processing Transfers file: {file_path}")
        
        try:
            # Pre-load caches via API
            logger.info("Loading account cache...")
            self.api.preload_accounts()
            
            logger.info("Loading asset cache...")
            self.api.preload_assets()
            
            # Collect entries for bulk insert
            entries_to_create: List[Dict] = []
            
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    self.stats["records_processed"] += 1
                    
                    try:
                        result = self._process_row(row)
                        
                        # Check if result is an error dict (skipped record)
                        if isinstance(result, dict) and "error" in result:
                            self.stats["records_skipped"] += 1
                            self.stats["skipped_records"].append({
                                "row_data": dict(row),
                                "reason": result["error"]
                            })
                        elif result:
                            # Valid entry data
                            entries_to_create.append(result)
                        
                        # Send batch every 500 records
                        if len(entries_to_create) >= 500:
                            self._send_batch(entries_to_create)
                            entries_to_create = []
                            
                    except Exception as e:
                        self.stats["records_failed"] += 1
                        error_msg = f"Row {self.stats['records_processed']}: {str(e)}"
                        logger.error(error_msg)
                        self.stats["errors"].append(error_msg)
                        
                        if self.stats["records_failed"] > 50:
                            logger.error("Too many errors (>50), stopping processing")
                            break
                
                # Send remaining entries
                if entries_to_create:
                    self._send_batch(entries_to_create)
            
            logger.info(
                f"Transfers processing complete: "
                f"{self.stats['records_created']} created, "
                f"{self.stats['records_updated']} updated (duplicates), "
                f"{self.stats['records_skipped']} skipped (ignored), "
                f"{self.stats['records_failed']} failed"
            )
            
            return {
                "status": "success" if self.stats["records_failed"] == 0 else "completed_with_errors",
                **self.stats
            }
            
        except Exception as e:
            logger.error(f"Failed to process Transfers file: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                **self.stats
            }
    
    def _send_batch(self, entries: List[Dict]):
        """Send a batch of entries to the API bulk endpoint."""
        if not entries:
            return
        
        logger.info(f"Sending batch of {len(entries)} transfer entries to API...")
        
        result = self.api.create_cash_journal_bulk(entries)
        
        if result.get("status") == "success":
            self.stats["records_created"] += result.get("created", 0)
            self.stats["records_updated"] += result.get("skipped", 0)  # skipped = duplicates = updated
            logger.info(f"Batch successful: {result.get('created')} created, {result.get('skipped')} updated (duplicates)")
        elif result.get("status") == "partial":
            self.stats["records_created"] += result.get("created", 0)
            self.stats["records_updated"] += result.get("skipped", 0)
            self.stats["records_failed"] += len(result.get("errors", []))
            for err in result.get("errors", [])[:5]:
                self.stats["errors"].append(str(err))
            logger.warning(f"Batch partial: {result.get('created')} created, errors: {len(result.get('errors', []))}")
        else:
            self.stats["records_failed"] += len(entries)
            error_msg = result.get("errors") or result.get("error") or "Unknown error"
            logger.error(f"Batch failed: {error_msg}")
            self.stats["errors"].append(str(error_msg)[:200])
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse date from IBKR format, return as ISO string for JSON."""
        if not date_str or date_str.strip() == "":
            return None
        s = date_str.strip()
        
        patterns = [
            "%d/%m/%Y",
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%m/%d/%Y",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
        ]
        
        for pat in patterns:
            try:
                dt = datetime.strptime(s, pat)
                return dt.date().isoformat()
            except ValueError:
                continue
        
        # Try ISO format
        try:
            dt = datetime.fromisoformat(s)
            return dt.date().isoformat()
        except Exception:
            pass
        
        logger.warning(f"Could not parse date: {date_str}")
        return None
    
    def _safe_decimal(self, value: str, default: str = None) -> Optional[str]:
        """Safely convert string to Decimal string for JSON serialization."""
        if not value or value.strip() == "":
            return default
        try:
            dec = Decimal(value.replace(',', ''))
            return str(dec)
        except (InvalidOperation, ValueError, AttributeError):
            return default
    
    def _lookup_account(self, client_account_id: str, currency: str = None) -> Optional[int]:
        """Look up account_id from ClientAccountID via API cache."""
        if not client_account_id:
            return None
        
        # Try with currency suffix first
        if currency:
            account_code = f"{client_account_id}_{currency}"
            account_id = self.api.get_account_id(account_code)
            if account_id:
                return account_id
        
        # Try without suffix
        account_id = self.api.get_account_id(client_account_id)
        if account_id:
            return account_id
        
        # Try removing currency suffix from input
        base_code = client_account_id.split('_')[0]
        if base_code != client_account_id:
            account_id = self.api.get_account_id(base_code)
            if account_id:
                return account_id
        
        return None
    
    def _lookup_account_by_alias(self, account_alias: str) -> Optional[int]:
        """Look up account_id by account_alias via API."""
        if not account_alias or account_alias.strip() in ["", "--"]:
            return None
        
        # Get all accounts and search by alias
        # Note: This is inefficient but works with current API structure
        # In production, you'd want an API endpoint to search by alias
        try:
            result = self.api._make_request("GET", "/api/v1/accounts/", params={"limit": 10000})
            if result and isinstance(result, list):
                for acc in result:
                    if acc.get("account_alias") == account_alias:
                        return acc.get("account_id")
        except Exception as e:
            logger.debug(f"Error looking up account by alias {account_alias}: {e}")
        
        return None
    
    def _lookup_asset(self, isin: str = None, symbol: str = None) -> Optional[int]:
        """
        Look up asset_id using ISIN or symbol via API cache.
        Priority: ISIN first, then symbol
        """
        # Try ISIN first
        if isin and isin.strip() and isin.strip() != "":
            asset_id = self.api.get_asset_id_by_isin(isin.strip())
            if asset_id:
                return asset_id
        
        # Fallback to symbol
        if symbol and symbol.strip() and symbol.strip() != "":
            asset_id = self.api.get_asset_id_by_symbol(symbol.strip())
            if asset_id:
                return asset_id
        
        return None
    
    def _track_missing_asset(self, row: Dict, reason: str):
        """Track a missing asset for notification."""
        symbol = row.get("Symbol", "").strip()
        isin = row.get("ISIN", "").strip()
        security_id = row.get("SecurityID", "").strip()
        
        unique_key = isin or security_id or symbol
        if unique_key and unique_key not in self._missing_asset_symbols:
            self._missing_asset_symbols.add(unique_key)
            self.stats["missing_assets"].append({
                "symbol": symbol,
                "security_id": security_id,
                "isin": isin,
                "description": row.get("Description", "").strip(),
                "currency": row.get("CurrencyPrimary", "").strip(),
                "asset_class": row.get("AssetClass", "").strip(),
                "quantity": row.get("Quantity", "").strip(),
                "position_amount": row.get("PositionAmount", "").strip(),
                "reason": reason
            })
    
    def _track_missing_account(self, client_account_id: str):
        """Track a missing account for notification."""
        if client_account_id and client_account_id not in self._missing_account_codes:
            self._missing_account_codes.add(client_account_id)
            self.stats["missing_accounts"].append({
                "account_code": client_account_id,
                "reason": "Account not found in database"
            })
    
    def _track_missing_transfer_account(self, transfer_account: str):
        """Track a missing transfer account for notification."""
        if transfer_account and transfer_account not in self._missing_transfer_accounts:
            self._missing_transfer_accounts.add(transfer_account)
            self.stats["missing_transfer_accounts"].append({
                "transfer_account": transfer_account,
                "reason": "Transfer account alias not found in database"
            })
    
    def _process_row(self, row: Dict[str, str]) -> Optional[Dict]:
        """Process a single row from CSV. Returns entry data dict for API or error dict."""
        # Get direction to determine type
        direction = row.get("Direction", "").strip().upper()
        
        # Skip if no direction
        if not direction:
            return {"error": "Missing Direction field"}
        
        # Map direction to type
        if direction == "IN":
            entry_type = "ACATIN"
        elif direction == "OUT":
            entry_type = "ACATOUT"
        else:
            return {"error": f"Unknown Direction: {direction}"}
        
        # Extract common fields
        client_account_id = row.get("ClientAccountID", "").strip()
        currency = row.get("CurrencyPrimary", "").strip() or "USD"
        reference_code = row.get("TransactionID", "").strip() or None
        
        # Skip if already processed in this batch (duplicate check)
        if reference_code and reference_code in self._batch_reference_codes:
            return {"error": f"Duplicate reference code in batch: {reference_code}"}
        
        # Lookup account
        account_id = self._lookup_account(client_account_id, currency)
        if not account_id:
            self._track_missing_account(client_account_id)
            logger.debug(f"Account not found: {client_account_id}")
            return {"error": f"Account not found: {client_account_id} (currency: {currency})"}
        
        # Parse dates
        report_date = self._parse_date(row.get("ReportDate", ""))
        
        if not report_date:
            logger.debug("Missing report date")
            return {"error": f"Invalid or missing report date: {row.get('ReportDate', '')}"}
        
        # Parse amount
        amount = self._safe_decimal(row.get("PositionAmount", "0"))
        if amount is None:
            amount = "0"
        
        # Parse quantity
        quantity = self._safe_decimal(row.get("Quantity", "0"))
        
        # Get description
        description = row.get("Description", "").strip()
        
        # Lookup asset (can be null for transfers)
        isin = row.get("ISIN", "").strip()
        symbol = row.get("Symbol", "").strip()
        
        asset_id = self._lookup_asset(isin=isin, symbol=symbol) if (isin or symbol) else None
        
        if not asset_id and (isin or symbol):
            # Track missing asset but DON'T skip - insert with null asset_id
            self._track_missing_asset(row, f"Asset not found for transfer")
            logger.debug(f"Asset not found for transfer: ISIN={isin}, Symbol={symbol}")
        
        # Lookup transfer account by alias
        transfer_account = row.get("TransferAccount", "").strip()
        transfer_account_id = None
        
        if transfer_account and transfer_account != "--":
            transfer_account_id = self._lookup_account_by_alias(transfer_account)
            if not transfer_account_id:
                # Track missing transfer account for notification
                self._track_missing_transfer_account(transfer_account)
                logger.debug(f"Transfer account not found: {transfer_account}")
        
        # Track reference code for batch dedup
        if reference_code:
            self._batch_reference_codes.add(reference_code)
        
        # Build entry dict for API
        entry_data = {
            "account_id": account_id,
            "asset_id": asset_id,
            "date": report_date,
            "type": entry_type,
            "amount": amount,
            "currency": currency,
            "quantity": quantity,
            "rate_per_share": None,
            "description": description,
            "reference_code": reference_code,
            "external_transaction_id": reference_code,
            "transfer_account_id": transfer_account_id
        }
        
        return entry_data
