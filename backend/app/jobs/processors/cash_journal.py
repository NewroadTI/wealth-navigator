"""
Cash Journal Processor
======================
Processes STATEMENTFUNDS reports from IBKR and uploads via API.
Handles: Dividends, Interest, Deposits, Withdrawals, Taxes, Fees, etc.

REFACTORED: Now uses APIClient instead of direct DB access.
"""

import csv
import re
import logging
from pathlib import Path
from datetime import datetime, date
from typing import Dict, Optional, List
from decimal import Decimal, InvalidOperation

from app.jobs.api_client import APIClient, get_api_client

logger = logging.getLogger(__name__)


# Activity Code to Type Mapping
ACTIVITY_CODE_MAP = {
    "DIV": "DIVIDEND",
    "DINT": "INTEREST",
    "DEP": "DEPOSIT",
    "WITH": "WITHDRAWAL",
    "FRTAX": "TAX",
    "OFEE": "FEE",
    "ADJ": "FEE ADJ",
    "PIL": "DIVIDEND PIL",
}

# Activity codes to ignore (handled elsewhere)
IGNORED_ACTIVITY_CODES = {
    "BUYSELL",  # Trades - handled by trades processor
    "BUY",      # Trades - handled by trades processor
    "SELL",     # Trades - handled by trades processor
    "FXSELL",   # Forex - handled by fx processor
    "FXBUY",    # Forex - handled by fx processor
    "CA",       # Corporate Actions - handled by corporate actions processor
}


class CashJournalProcessor:
    """Process Statement Funds CSV from IBKR for Cash Journal entries via API."""
    
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
            "skipped_records": [],
            "failed_records": []
        }
        # Track unique missing items
        self._missing_asset_symbols = set()
        self._missing_account_codes = set()
        # Track processed reference codes within batch
        self._batch_reference_codes = set()
    
    def process_file(self, file_path: Path) -> dict:
        """
        Process Statement Funds CSV file via API bulk endpoint.
        
        Expected CSV columns from IBKR:
        ClientAccountID, AccountAlias, Model, CurrencyPrimary, FXRateToBase, AssetClass, SubCategory,
        Symbol, Description, Conid, SecurityID, SecurityIDType, CUSIP, ISIN, FIGI, ListingExchange,
        UnderlyingConid, UnderlyingSymbol, UnderlyingSecurityID, UnderlyingListingExchange, Issuer,
        IssuerCountryCode, Multiplier, Strike, Expiry, Put/Call, PrincipalAdjustFactor, ReportDate,
        Date, SettleDate, ActivityCode, ActivityDescription, TradeID, RelatedTradeID, OrderID,
        Buy/Sell, TradeQuantity, TradePrice, TradeGross, TradeCommission, TradeTax, Debit, Credit,
        Amount, TradeCode, Balance, LevelOfDetail, TransactionID, OrigTransactionID, RelatedTransactionID,
        ActionID, SerialNumber, DeliveryType, CommodityType, Fineness, Weight
        """
        logger.info(f"Processing Cash Journal file: {file_path}")
        
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
                f"Cash Journal processing complete: "
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
            logger.error(f"Failed to process Cash Journal file: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                **self.stats
            }
    
    def _send_batch(self, entries: List[Dict]):
        """Send a batch of entries to the API bulk endpoint."""
        if not entries:
            return
        
        logger.info(f"Sending batch of {len(entries)} cash journal entries to API...")
        
        result = self.api.create_cash_journal_bulk(entries)
        
        if result.get("status") == "success":
            self.stats["records_created"] += result.get("created", 0)
            self.stats["records_updated"] += result.get("skipped", 0)  # skipped = duplicates = updated
            logger.info(f"Batch successful: {result.get('created')} created, {result.get('skipped')} updated (duplicates)")
        elif result.get("status") == "partial":
            self.stats["records_created"] += result.get("created", 0)
            self.stats["records_updated"] += result.get("skipped", 0)  # skipped = duplicates = updated
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
    
    def _extract_rate_per_share(self, description: str) -> Optional[str]:
        """
        Extract rate per share from activity description.
        Examples:
        - "EAD(US94987B1052) Cash Dividend USD 0.05349 per Share (Ordinary Dividend)"
        - "Cash Dividend EUR 1.23 per Share"
        """
        if not description:
            return None
        
        # Pattern: currency code followed by amount followed by "per Share"
        # Matches: USD 0.05349 per Share, EUR 1.23 per Share, etc.
        pattern = r'(?:USD|EUR|GBP|CHF|CAD|HKD|JPY|AUD|CNH|SGD|MXN)\s+([0-9]+\.?[0-9]*)\s+per\s+[Ss]hare'
        match = re.search(pattern, description)
        
        if match:
            try:
                return str(Decimal(match.group(1)))
            except (InvalidOperation, ValueError):
                pass
        
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
        
        # Try removing currency suffix from input
        base_code = client_account_id.split('_')[0]
        if base_code != client_account_id:
            account_id = self.api.get_account_id(base_code)
            if account_id:
                return account_id
        
        return None
    
    def _lookup_asset(self, isin: str = None, symbol: str = None) -> Optional[int]:
        """
        Look up asset_id using ISIN or symbol via API cache.
        """
        # Try ISIN first
        if isin:
            asset_id = self.api.get_asset_id(isin)
            if asset_id:
                return asset_id
        
        # Fallback to symbol
        if symbol:
            asset_id = self.api.get_asset_id(symbol)
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
                "activity_code": row.get("ActivityCode", "").strip(),
                "amount": row.get("Amount", "").strip(),
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
    
    def _process_row(self, row: Dict[str, str]) -> Optional[Dict]:
        """Process a single row from CSV. Returns entry data dict for API or None."""
        # Get activity code
        activity_code = row.get("ActivityCode", "").strip().upper()
        
        # Skip ignored activity codes
        if activity_code in IGNORED_ACTIVITY_CODES or not activity_code:
            return {"error": f"Ignored activity code: {activity_code or 'empty'}"}
        
        # Get mapped type
        entry_type = ACTIVITY_CODE_MAP.get(activity_code)
        if not entry_type:
            # Unknown activity code - skip
            logger.debug(f"Skipping unknown activity code: {activity_code}")
            return {"error": f"Unmapped activity code: {activity_code}"}
        
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
        settle_date = self._parse_date(row.get("SettleDate", ""))
        
        if not report_date:
            logger.debug("Missing report date")
            return {"error": f"Invalid or missing report date: {row.get('ReportDate', '')}"}
        
        # Parse amount
        amount = self._safe_decimal(row.get("Amount", "0"))
        if amount is None:
            amount = "0"
        
        # Common fields
        description = row.get("ActivityDescription", "").strip()
        trade_id = row.get("TradeID", "").strip() or None
        action_id = row.get("ActionID", "").strip() or None
        
        # Determine asset_id and other fields based on type
        asset_id = None
        quantity = None
        rate_per_share = None
        
        if entry_type in ("DIVIDEND", "DIVIDEND PIL", "TAX"):
            # Look up asset using ISIN/Symbol
            isin = row.get("ISIN", "").strip()
            symbol = row.get("Symbol", "").strip()
            
            asset_id = self._lookup_asset(isin=isin, symbol=symbol)
            
            if not asset_id:
                # Track missing asset but DON'T skip - insert with null asset_id
                self._track_missing_asset(row, f"Asset not found for {entry_type}")
                logger.debug(f"Asset not found for {entry_type}: ISIN={isin}, Symbol={symbol}")
            
            # Extract rate per share from description
            rate_per_share = self._extract_rate_per_share(description)
            
            # Calculate quantity if we have rate_per_share (only for DIVIDEND types)
            if entry_type in ("DIVIDEND", "DIVIDEND PIL") and rate_per_share:
                try:
                    rate_dec = Decimal(rate_per_share)
                    amount_dec = Decimal(amount)
                    if rate_dec != Decimal("0"):
                        quantity = str(amount_dec / rate_dec)
                except Exception:
                    quantity = None
        
        # Track reference code for batch dedup
        if reference_code:
            self._batch_reference_codes.add(reference_code)
        
        # Build entry dict for API
        entry_data = {
            "account_id": account_id,
            "asset_id": asset_id,
            "date": report_date,
            "ex_date": settle_date,
            "type": entry_type,
            "amount": amount,
            "currency": currency,
            "quantity": quantity,
            "rate_per_share": rate_per_share,
            "description": description,
            "reference_code": reference_code,
            "external_transaction_id": trade_id,
            "action_id": action_id
        }
        
        return entry_data
