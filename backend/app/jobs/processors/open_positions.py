"""
Open Positions Processor
========================
Processes OPENPOSITIONS reports from IBKR and uploads via API.

REFACTORED: Now uses APIClient instead of direct DB access.
"""

import csv
import logging
from pathlib import Path
from datetime import datetime, date
from typing import Dict, Optional, List
from decimal import Decimal

from app.jobs.api_client import APIClient, get_api_client

logger = logging.getLogger(__name__)


class OpenPositionsProcessor:
    """Process Open Positions CSV from IBKR via API."""
    
    def __init__(self, api_client: APIClient = None):
        self.api = api_client or get_api_client()
        self.stats = {
            "records_processed": 0,
            "records_created": 0,
            "records_updated": 0,
            "records_skipped": 0,
            "records_failed": 0,
            "errors": [],
            "missing_assets": [],  # Assets that don't exist in DB
            "missing_accounts": [],  # Accounts that don't exist in DB
            "skipped_records": [],  # Full data of skipped records
            "failed_records": []  # Full data of failed records
        }
        # Track unique missing items to avoid duplicates
        self._missing_asset_symbols = set()
        self._missing_account_codes = set()
    
    def process_file(self, file_path: Path) -> dict:
        """
        Process Open Positions CSV file via API bulk endpoint.
        
        Expected CSV columns:
        ClientAccountID, Symbol, ReportDate, Quantity, MarkPrice, PositionValue,
        CostBasisMoney, CostBasisPrice, FifoPnlUnrealized, PercentOfNAV, Side,
        FXRateToBase, CurrencyPrimary, OpenPrice, ...
        """
        logger.info(f"Processing Open Positions file: {file_path}")
        
        try:
            # Pre-load caches via API
            logger.info("Loading account cache...")
            self.api.preload_accounts()
            
            logger.info("Loading asset cache...")
            self.api.preload_assets()
            
            # Collect positions for bulk insert
            positions_to_create: List[Dict] = []
            
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    self.stats["records_processed"] += 1
                    
                    try:
                        # Process all rows regardless of LevelOfDetail
                        # (DETAIL and SUMMARY rows are both valid position data)

                        
                        result = self._process_row(row)
                        
                        # Check if result is an error dict (skipped record)
                        if isinstance(result, dict) and "error" in result:
                            self.stats["records_skipped"] += 1
                            self.stats["skipped_records"].append({
                                "row_data": dict(row),
                                "reason": result["error"]
                            })
                        elif result:
                            # Valid position data
                            positions_to_create.append(result)
                        
                        # Send batch every 500 records
                        if len(positions_to_create) >= 500:
                            self._send_batch(positions_to_create)
                            positions_to_create = []
                            
                    except Exception as e:
                        self.stats["records_failed"] += 1
                        error_msg = f"Row {self.stats['records_processed']}: {str(e)}"
                        logger.error(error_msg)
                        self.stats["errors"].append(error_msg)
                        
                        if self.stats["records_failed"] > 50:
                            logger.error("Too many errors (>50), stopping processing")
                            break
                
                # Send remaining positions
                if positions_to_create:
                    self._send_batch(positions_to_create)
            
            # Calculate total taken into account (created + updated)
            records_taken = self.stats["records_created"] + self.stats["records_updated"]
            
            logger.info(
                f"Open Positions processing complete: "
                f"{self.stats['records_created']} created, "
                f"{self.stats['records_updated']} updated (duplicates), "
                f"{self.stats['records_skipped']} skipped (ignored), "
                f"{self.stats['records_failed']} failed, "
                f"{records_taken} total taken into account"
            )
            
            return {
                "status": "success" if self.stats["records_failed"] == 0 else "completed_with_errors",
                **self.stats
            }
            
        except Exception as e:
            logger.error(f"Failed to process Open Positions file: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                **self.stats
            }
    
    def _send_batch(self, positions: List[Dict]):
        """Send a batch of positions to the API bulk endpoint."""
        if not positions:
            return
        
        logger.info(f"Sending batch of {len(positions)} positions to API...")
        
        result = self.api.create_positions_bulk(positions)
        
        if result.get("status") == "success":
            self.stats["records_created"] += result.get("created", 0)
            self.stats["records_updated"] += result.get("updated", 0) + result.get("skipped", 0)  # updated + duplicates
            logger.info(f"Batch successful: {result.get('created')} created, {result.get('updated')} updated")
        elif result.get("status") == "partial":
            self.stats["records_created"] += result.get("created", 0)
            self.stats["records_updated"] += result.get("updated", 0)
            self.stats["records_failed"] += len(result.get("errors", []))
            for err in result.get("errors", [])[:5]:
                self.stats["errors"].append(str(err))
            logger.warning(f"Batch partial: {result.get('created')} created, errors: {len(result.get('errors', []))}")
        else:
            self.stats["records_failed"] += len(positions)
            error_msg = result.get("errors") or result.get("error") or "Unknown error"
            logger.error(f"Batch failed: {error_msg}")
            self.stats["errors"].append(str(error_msg)[:200])
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """
        Parse date from IBKR format to ISO string.
        Input: 30/01/2026
        Output: "2026-01-30"
        """
        if not date_str or date_str.strip() == "":
            return None
        s = date_str.strip()
        # Try common date-only formats first
        patterns = [
            "%d/%m/%Y",
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S%z",
        ]

        for pat in patterns:
            try:
                dt = datetime.strptime(s, pat)
                return dt.date().isoformat()
            except ValueError:
                continue

        # Fallback: try ISO parsing (handles timezone offsets)
        try:
            dt = datetime.fromisoformat(s)
            return dt.date().isoformat()
        except Exception:
            pass

        # Last resort: try to extract the first token that looks like a date
        try:
            token = s.split()[0]
            for pat in ["%d/%m/%Y", "%Y-%m-%d"]:
                try:
                    dt = datetime.strptime(token, pat)
                    return dt.date().isoformat()
                except Exception:
                    continue
        except Exception:
            pass

        logger.warning(f"Could not parse date: {date_str}")
        return None
    
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
        
        # Try removing currency suffix (e.g., U17124790_USD -> U17124790)
        base_code = client_account_id.split('_')[0]
        if base_code != client_account_id:
            account_id = self.api.get_account_id(base_code)
            if account_id:
                return account_id
        
        return None
    
    def _lookup_asset(self, security_id: str, symbol: str = None) -> Optional[int]:
        """
        Look up asset_id via API cache.
        
        Args:
            security_id: SecurityID from CSV (usually ISIN)
            symbol: Symbol from CSV (for fallback)
        """
        # Try ISIN first (security_id is usually ISIN)
        if security_id:
            # ISINs are typically 12 characters starting with 2 letters
            if len(security_id) == 12 and security_id[:2].isalpha():
                asset_id = self.api.get_asset_id_by_isin(security_id)
                if asset_id:
                    return asset_id
            
            # Try as symbol if not a standard ISIN format
            asset_id = self.api.get_asset_id_by_symbol(security_id)
            if asset_id:
                return asset_id
        
        # Fallback to symbol
        if symbol:
            asset_id = self.api.get_asset_id_by_symbol(symbol)
            if asset_id:
                return asset_id
        
        return None
    
    def _safe_float(self, value: str, default: float = None) -> Optional[float]:
        """Safely convert string to float for JSON serialization."""
        if not value or value.strip() == "":
            return default
        try:
            return float(value.replace(',', ''))
        except (ValueError, AttributeError):
            return default
    
    def _parse_datetime(self, dt_str: str) -> Optional[str]:
        """Parse datetime string from IBKR format, return ISO string."""
        if not dt_str or dt_str.strip() == "":
            return None
        try:
            # Try common IBKR formats
            for fmt in ["%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d;%H:%M:%S"]:
                try:
                    dt = datetime.strptime(dt_str.strip(), fmt)
                    return dt.isoformat()
                except ValueError:
                    continue
            return None
        except Exception:
            return None
    
    def _process_row(self, row: Dict[str, str]) -> Optional[Dict]:
        """Process a single row from CSV. Returns position data dict for API or None."""
        # Extract and validate required fields
        client_account_id = row.get("ClientAccountID", "").strip()
        symbol = row.get("Symbol", "").strip()
        security_id = row.get("SecurityID", "").strip()  # Usually ISIN
        description = row.get("Description", "").strip()
        report_date_str = row.get("ReportDate", "").strip()
        isin = row.get("ISIN", "").strip()  # Also available directly in some cases
        currency = row.get("CurrencyPrimary", "").strip() or "USD"
        
        if not client_account_id or not report_date_str:
            logger.debug(f"Skipping row with missing required fields")
            return {"error": f"Missing required fields (ClientAccountID: {bool(client_account_id)}, ReportDate: {bool(report_date_str)})"}
        
        # Use ISIN if available, otherwise use SecurityID, otherwise use Symbol
        lookup_id = isin or security_id or symbol
        
        if not lookup_id:
            logger.debug(f"Skipping row with no identifier (ISIN/SecurityID/Symbol)")
            return {"error": "Missing identifier (no ISIN/SecurityID/Symbol)"}
        
        # Lookup IDs via API cache
        account_id = self._lookup_account(client_account_id, currency)
        if not account_id:
            # Track missing account (only once per unique code)
            if client_account_id not in self._missing_account_codes:
                self._missing_account_codes.add(client_account_id)
                self.stats["missing_accounts"].append({
                    "account_code": client_account_id,
                    "reason": "Account not found in database"
                })
            logger.debug(f"Account not found for ClientAccountID: {client_account_id}")
            return {"error": f"Account not found: {client_account_id} (currency: {currency})"}
        
        # Look up asset using flexible search: ISIN -> symbol
        asset_id = self._lookup_asset(security_id=lookup_id, symbol=symbol)
        
        if not asset_id:
            # Track missing asset with details (only once per unique security_id)
            unique_key = lookup_id or symbol
            if unique_key not in self._missing_asset_symbols:
                self._missing_asset_symbols.add(unique_key)
                # Determine asset type based on symbol format
                is_option = (
                    (len(symbol.split()) > 1) or 
                    (len(symbol) > 8 and any(c.isdigit() for c in symbol[-8:]))
                ) if symbol else False
                
                self.stats["missing_assets"].append({
                    "symbol": symbol,
                    "security_id": security_id,
                    "isin": isin,
                    "description": description,
                    "currency": currency,
                    "asset_class": row.get("AssetClass", "").strip(),
                    "asset_type": "option" if is_option else "unknown",
                    "quantity": row.get("Quantity", "").strip(),
                    "position_value": row.get("PositionValue", "").strip(),
                    "mark_price": row.get("MarkPrice", "").strip(),
                    "reason": f"Asset not found in database by ISIN ({lookup_id}) - needs to be created"
                })
            logger.debug(f"Asset not found for SecurityID/ISIN: {lookup_id} (Symbol: {symbol})")
            return {"error": f"Asset not found: {symbol} (SecurityID: {lookup_id}, ISIN: {isin})"}
        
        # Parse date
        report_date = self._parse_date(report_date_str)
        if not report_date:
            logger.debug(f"Invalid report date: {report_date_str}")
            return {"error": f"Invalid report date: {report_date_str}"}
        
        # Build position data (all values as floats for JSON)
        quantity = self._safe_float(row.get("Quantity", "0"), 0.0)
        mark_price = self._safe_float(row.get("MarkPrice"))
        position_value = self._safe_float(row.get("PositionValue"))
        cost_basis_money = self._safe_float(row.get("CostBasisMoney"))
        cost_basis_price = self._safe_float(row.get("CostBasisPrice"))
        open_price = self._safe_float(row.get("OpenPrice"))
        fifo_pnl_unrealized = self._safe_float(row.get("FifoPnlUnrealized"))
        percent_of_nav = self._safe_float(row.get("PercentOfNAV"))
        fx_rate = self._safe_float(row.get("FXRateToBase"), 1.0)
        accrued_interest = self._safe_float(row.get("AccruedInterest"))
        
        side = row.get("Side", "").strip() or None
        level_of_detail = row.get("LevelOfDetail", "").strip() or None
        
        open_date_time = self._parse_datetime(row.get("OpenDateTime", ""))
        vesting_date = self._parse_date(row.get("VestingDate", ""))
        
        # Build position dict for API
        position_data = {
            "account_id": account_id,
            "asset_id": asset_id,
            "report_date": report_date,
            "quantity": quantity,
            "mark_price": mark_price,
            "position_value": position_value,
            "cost_basis_money": cost_basis_money,
            "cost_basis_price": cost_basis_price,
            "open_price": open_price,
            "fifo_pnl_unrealized": fifo_pnl_unrealized,
            "percent_of_nav": percent_of_nav,
            "side": side,
            "level_of_detail": level_of_detail,
            "open_date_time": open_date_time,
            "vesting_date": vesting_date,
            "accrued_interest": accrued_interest,
            "fx_rate_to_base": fx_rate
        }
        
        return position_data

