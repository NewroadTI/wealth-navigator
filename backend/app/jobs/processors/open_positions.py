"""
Open Positions Processor
========================
Processes OPENPOSITIONS reports from IBKR and uploads to DB.
"""

import csv
import logging
from pathlib import Path
from datetime import datetime, date
from typing import Dict, Optional
from decimal import Decimal

from app.jobs.db_client import DBClient
from app.models.asset import Position

logger = logging.getLogger(__name__)


class OpenPositionsProcessor:
    """Process Open Positions CSV from IBKR."""
    
    def __init__(self, db_client: DBClient):
        self.db_client = db_client
        self.stats = {
            "records_processed": 0,
            "records_created": 0,
            "records_updated": 0,
            "records_failed": 0,
            "records_skipped": 0,
            "errors": [],
            "missing_assets": [],  # Assets that don't exist in DB
            "missing_accounts": []  # Accounts that don't exist in DB
        }
        # Track unique missing items to avoid duplicates
        self._missing_asset_symbols = set()
        self._missing_account_codes = set()
    
    def process_file(self, file_path: Path) -> dict:
        """
        Process Open Positions CSV file.
        
        Expected CSV columns:
        ClientAccountID, Symbol, ReportDate, Quantity, MarkPrice, PositionValue,
        CostBasisMoney, CostBasisPrice, FifoPnlUnrealized, PercentOfNAV, Side,
        FXRateToBase, CurrencyPrimary, OpenPrice, ...
        """
        logger.info(f"Processing Open Positions file: {file_path}")
        
        try:
            # Pre-load caches using DBClient methods
            logger.info("Loading account cache...")
            self.db_client.preload_accounts()
            
            logger.info("Loading asset cache...")
            self.db_client.preload_assets()
            
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                batch_count = 0
                for row in reader:
                    self.stats["records_processed"] += 1
                    
                    try:
                        self._process_row(row)
                        batch_count += 1
                        
                        # Commit every 100 records
                        if batch_count >= 100:
                            self.db_client.commit()
                            batch_count = 0
                            
                    except Exception as e:
                        self.stats["records_failed"] += 1
                        error_msg = f"Row {self.stats['records_processed']}: {str(e)}"
                        logger.error(error_msg)
                        self.stats["errors"].append(error_msg)
                        
                        if self.stats["records_failed"] > 50:
                            logger.error("Too many errors (>50), stopping processing")
                            break
                
                # Final commit
                self.db_client.commit()
            
            # Calculate total taken into account (created + updated + skipped)
            records_taken = self.stats["records_created"] + self.stats["records_updated"] + self.stats["records_skipped"]
            
            logger.info(
                f"Open Positions processing complete: "
                f"{self.stats['records_created']} created, "
                f"{self.stats['records_updated']} updated, "
                f"{self.stats['records_skipped']} skipped, "
                f"{self.stats['records_failed']} failed, "
                f"{records_taken} total taken into account"
            )
            
            return {
                "status": "success" if self.stats["records_failed"] == 0 else "completed_with_errors",
                **self.stats
            }
            
        except Exception as e:
            logger.error(f"Failed to process Open Positions file: {e}", exc_info=True)
            self.db_client.rollback()
            return {
                "status": "failed",
                "error": str(e),
                **self.stats
            }
    
    def _parse_date(self, date_str: str) -> Optional[date]:
        """
        Parse date from IBKR format to date object.
        Input: 30/01/2026
        Output: date(2026, 1, 30)
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
                return dt.date()
            except ValueError:
                continue

        # Fallback: try ISO parsing (handles timezone offsets)
        try:
            dt = datetime.fromisoformat(s)
            return dt.date()
        except Exception:
            pass

        # Last resort: try to extract the first token that looks like a date
        try:
            token = s.split()[0]
            for pat in ["%d/%m/%Y", "%Y-%m-%d"]:
                try:
                    dt = datetime.strptime(token, pat)
                    return dt.date()
                except Exception:
                    continue
        except Exception:
            pass

        logger.warning(f"Could not parse date: {date_str}")
        return None
    
    def _lookup_account(self, client_account_id: str) -> Optional[int]:
        """Look up account_id from ClientAccountID."""
        if not client_account_id:
            return None
        
        # Try direct lookup via DBClient
        account_id = self.db_client.get_account_id(client_account_id)
        if account_id:
            return account_id
        
        # Try removing currency suffix (e.g., U17124790_USD -> U17124790)
        base_code = client_account_id.split('_')[0]
        if base_code != client_account_id:
            account_id = self.db_client.get_account_id(base_code)
            if account_id:
                return account_id
        
        return None
    
    def _lookup_asset(self, security_id: str, symbol: str = None, description: str = None) -> Optional[int]:
        """
        Look up asset_id using flexible search:
        1. First by SecurityID (ISIN) against assets.isin
        2. If not found, SecurityID against assets.symbol
        3. If not found, SecurityID against assets.description
        
        Args:
            security_id: SecurityID from CSV (usually ISIN)
            symbol: Symbol from CSV (for fallback/logging)
            description: Description from CSV (for logging)
        """
        if not security_id:
            return None
        
        return self.db_client.get_asset_id_flexible(
            security_id=security_id,
            symbol=symbol,
            description=description
        )
    
    def _safe_decimal(self, value: str, default: Decimal = None) -> Optional[Decimal]:
        """Safely convert string to Decimal."""
        if not value or value.strip() == "":
            return default
        try:
            return Decimal(value.replace(',', ''))
        except (ValueError, AttributeError, Exception):
            return default
    
    def _safe_float(self, value: str, default: float = 0.0) -> float:
        """Safely convert string to float."""
        if not value or value.strip() == "":
            return default
        try:
            return float(value.replace(',', ''))
        except (ValueError, AttributeError):
            return default
    
    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """Parse datetime string from IBKR format."""
        if not dt_str or dt_str.strip() == "":
            return None
        try:
            # Try common IBKR formats
            for fmt in ["%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d;%H:%M:%S"]:
                try:
                    return datetime.strptime(dt_str.strip(), fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None
    
    def _get_existing_position(self, account_id: int, asset_id: int, report_date: date) -> Optional[Position]:
        """Check if a position already exists for this account/asset/date."""
        return self.db_client.db.query(Position).filter(
            Position.account_id == account_id,
            Position.asset_id == asset_id,
            Position.report_date == report_date
        ).first()
    
    def _process_row(self, row: Dict[str, str]):
        """Process a single row from CSV."""
        # Extract and validate required fields
        client_account_id = row.get("ClientAccountID", "").strip()
        symbol = row.get("Symbol", "").strip()
        security_id = row.get("SecurityID", "").strip()  # Usually ISIN
        description = row.get("Description", "").strip()
        report_date_str = row.get("ReportDate", "").strip()
        isin = row.get("ISIN", "").strip()  # Also available directly in some cases
        
        if not client_account_id or not report_date_str:
            self.stats["records_skipped"] += 1
            logger.debug(f"Skipping row with missing required fields")
            return
        
        # Use ISIN if available, otherwise use SecurityID, otherwise use Symbol
        lookup_id = isin or security_id or symbol
        
        if not lookup_id:
            self.stats["records_skipped"] += 1
            logger.debug(f"Skipping row with no identifier (ISIN/SecurityID/Symbol)")
            return
        
        # Lookup IDs
        account_id = self._lookup_account(client_account_id)
        if not account_id:
            self.stats["records_skipped"] += 1
            # Track missing account (only once per unique code)
            if client_account_id not in self._missing_account_codes:
                self._missing_account_codes.add(client_account_id)
                self.stats["missing_accounts"].append({
                    "account_code": client_account_id,
                    "reason": "Account not found in database"
                })
            logger.debug(f"Account not found for ClientAccountID: {client_account_id}")
            return
        
        # Look up asset using flexible search: ISIN -> symbol -> description
        asset_id = self._lookup_asset(
            security_id=lookup_id,
            symbol=symbol,
            description=description
        )
        
        if not asset_id:
            self.stats["records_skipped"] += 1
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
                    "currency": row.get("CurrencyPrimary", "").strip() or "USD",
                    "asset_class": row.get("AssetClass", "").strip(),
                    "asset_type": "option" if is_option else "unknown",
                    "quantity": row.get("Quantity", "").strip(),
                    "position_value": row.get("PositionValue", "").strip(),
                    "mark_price": row.get("MarkPrice", "").strip(),
                    "reason": f"Asset not found in database by ISIN ({lookup_id}) - needs to be created"
                })
            logger.debug(f"Asset not found for SecurityID/ISIN: {lookup_id} (Symbol: {symbol})")
            return
        
        # Parse date
        report_date = self._parse_date(report_date_str)
        # Defensive: ensure report_date is a date object (not datetime with tz)
        if isinstance(report_date, datetime):
            report_date = report_date.date()
        if not report_date:
            self.stats["records_skipped"] += 1
            logger.debug(f"Invalid report date: {report_date_str}")
            return
        
        # Build position data
        quantity = self._safe_decimal(row.get("Quantity", "0"), Decimal("0"))
        mark_price = self._safe_decimal(row.get("MarkPrice"))
        position_value = self._safe_decimal(row.get("PositionValue"))
        cost_basis_money = self._safe_decimal(row.get("CostBasisMoney"))
        cost_basis_price = self._safe_decimal(row.get("CostBasisPrice"))
        open_price = self._safe_decimal(row.get("OpenPrice"))
        fifo_pnl_unrealized = self._safe_decimal(row.get("FifoPnlUnrealized"))
        percent_of_nav = self._safe_decimal(row.get("PercentOfNAV"))
        fx_rate = self._safe_decimal(row.get("FXRateToBase"), Decimal("1"))
        accrued_interest = self._safe_decimal(row.get("AccruedInterest"))
        
        side = row.get("Side", "").strip() or None
        level_of_detail = row.get("LevelOfDetail", "").strip() or None
        currency = row.get("CurrencyPrimary", "").strip() or None
        
        open_date_time = self._parse_datetime(row.get("OpenDateTime", ""))
        vesting_date = self._parse_date(row.get("VestingDate", ""))
        
        # Check if position already exists
        existing = self._get_existing_position(account_id, asset_id, report_date)
        
        if existing:
            # Update existing position
            existing.quantity = quantity
            existing.mark_price = mark_price
            existing.position_value = position_value
            existing.cost_basis_money = cost_basis_money
            existing.cost_basis_price = cost_basis_price
            existing.open_price = open_price
            existing.fifo_pnl_unrealized = fifo_pnl_unrealized
            existing.percent_of_nav = percent_of_nav
            existing.side = side
            existing.level_of_detail = level_of_detail
            existing.fx_rate_to_base = fx_rate
            existing.currency = currency
            existing.open_date_time = open_date_time
            existing.vesting_date = vesting_date
            existing.accrued_interest = accrued_interest
            
            self.stats["records_updated"] += 1
            logger.debug(f"Updated position for {symbol} on {report_date}")
        else:
            # Create new position
            new_position = Position(
                account_id=account_id,
                asset_id=asset_id,
                report_date=report_date,
                quantity=quantity,
                mark_price=mark_price,
                position_value=position_value,
                cost_basis_money=cost_basis_money,
                cost_basis_price=cost_basis_price,
                open_price=open_price,
                fifo_pnl_unrealized=fifo_pnl_unrealized,
                percent_of_nav=percent_of_nav,
                side=side,
                level_of_detail=level_of_detail,
                fx_rate_to_base=fx_rate,
                currency=currency,
                open_date_time=open_date_time,
                vesting_date=vesting_date,
                accrued_interest=accrued_interest
            )
            self.db_client.db.add(new_position)
            
            self.stats["records_created"] += 1
            logger.debug(f"Created position for {symbol} on {report_date}")
