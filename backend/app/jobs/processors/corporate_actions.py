"""
Corporate Actions Processor
============================
Processes IBKR Corporate Actions CSV and imports to database directly.

CSV Format (CORPORATES.csv):
- ClientAccountID: Account identifier (e.g., U16337121)
- Symbol: Asset symbol
- Description: Full description with action details
- ActionDescription: Brief action description
- SecurityID: ISIN or other identifier
- SecurityIDType: Type of security ID (ISIN, CUSIP, etc.)
- Report Date: Date of report
- Date/Time: Execution datetime
- Amount, Proceeds, Value: Financial values
- Quantity: Quantity adjustment
- TransactionID: IBKR transaction ID
- ActionID: IBKR action ID
- CurrencyPrimary: Currency
- Type: Action type code (FS, RS, SO, etc.)
"""

import logging
import pandas as pd
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import date

from app.jobs.config import DOWNLOAD_DIR, DEFAULT_EQUITY_CLASS_ID
from app.jobs.utils import (
    parse_decimal,
    parse_date,
    parse_datetime,
    parse_ratio_from_description,
    normalize_action_type,
    extract_symbol_from_description,
    clean_isin,
    clean_cusip,
    get_account_code_from_currency,
    safe_get
)
from app.jobs.db_client import DBClient, get_db_client

logger = logging.getLogger("ETL.corporate_actions")


class CorporateActionsProcessor:
    """
    Processes IBKR Corporate Actions CSV files.
    Uses direct database access to avoid HTTP deadlocks.
    """
    
    def __init__(self, db_client: DBClient = None):
        self.db = db_client or get_db_client()
        self.processed_count = 0
        self.skipped_count = 0
        self.error_count = 0
        self.errors: List[Dict] = []
        self.created_assets: List[str] = []
    
    def process_file(self, file_path: Path) -> Dict[str, Any]:
        """
        Process a Corporate Actions CSV file.
        
        Args:
            file_path: Path to the CSV file
            
        Returns:
            Summary of processing results
        """
        logger.info(f"Processing Corporate Actions from: {file_path}")
        
        if not file_path.exists():
            logger.error(f"File not found: {file_path}")
            return {"status": "error", "message": "File not found"}
        
        # Read CSV
        try:
            df = pd.read_csv(file_path)
            total_rows = len(df)
            logger.info(f"Loaded {total_rows} rows from CSV")
            logger.info(f"Columns: {df.columns.tolist()}")
        except Exception as e:
            logger.error(f"Failed to read CSV: {e}")
            return {"status": "error", "message": str(e)}
        
        # Check if file has only headers (no data rows)
        if total_rows == 0:
            logger.info("CSV file has no data rows (only headers)")
            return {
                "status": "success",
                "message": "No records to process (empty file)",
                "records_processed": 0,
                "records_created": 0,
                "records_skipped": 0,
                "records_failed": 0,
                "errors": []
            }
        
        # Filter only DETAIL rows (skip headers, footers, summary)
        level_col = None
        for col in df.columns:
            if 'levelofdetail' in col.lower().replace(' ', ''):
                level_col = col
                break
        
        if level_col:
            try:
                level_values = df[level_col].fillna('').astype(str).str.strip().str.upper()
                logger.info(f"Found level of detail column: '{level_col}', unique values: {level_values.unique()}")
                
                df_filtered = df[level_values == "DETAIL"]
                logger.info(f"Filtered to {len(df_filtered)} DETAIL rows")
                
                if len(df_filtered) == 0:
                    logger.info("No DETAIL rows found - file may have only headers")
                    return {
                        "status": "success",
                        "message": "No DETAIL records to process",
                        "records_processed": 0,
                        "records_created": 0,
                        "records_skipped": 0,
                        "records_failed": 0,
                        "errors": []
                    }
                df = df_filtered
            except Exception as e:
                logger.warning(f"Failed to filter by LevelOfDetail: {e}, processing all rows")
        
        # Preload caches for efficiency
        self.db.preload_accounts()
        self.db.preload_assets()
        
        # Process each row
        actions_to_create = []
        
        for idx, row in df.iterrows():
            try:
                action_data = self._process_row(row, idx)
                if action_data:
                    actions_to_create.append(action_data)
                    self.processed_count += 1
                else:
                    self.skipped_count += 1
            except Exception as e:
                logger.error(f"Error processing row {idx}: {e}")
                self.errors.append({
                    "row": idx,
                    "error": str(e),
                    "data": row.to_dict() if hasattr(row, 'to_dict') else str(row)
                })
                self.error_count += 1
        
        # Insert in batches
        if actions_to_create:
            self._insert_actions(actions_to_create)
        
        return self._get_summary()
    
    def _process_row(self, row: pd.Series, row_idx: int) -> Optional[Dict]:
        """
        Process a single CSV row into a corporate action record.
        """
        # 1. Get Client Account ID and Currency
        client_account_id = safe_get(row, "ClientAccountID")
        currency = safe_get(row, "CurrencyPrimary", "USD")
        
        if not client_account_id:
            logger.warning(f"Row {row_idx}: Missing ClientAccountID, skipping")
            return None
        
        # Ensure client_account_id is a string
        client_account_id = str(client_account_id).strip()
        currency = str(currency).strip() if currency else "USD"
        
        # 2. Get account_id from our system
        account_code = get_account_code_from_currency(client_account_id, currency)
        account_id = self.db.get_account_id(account_code)
        
        if not account_id:
            logger.warning(f"Row {row_idx}: Account {account_code} not found, skipping")
            self.errors.append({
                "row": row_idx,
                "error": f"Account not found: {account_code}",
                "client_account_id": client_account_id
            })
            return None
        
        # 3. Parse dates - try multiple columns
        report_date = parse_date(safe_get(row, "Report Date"))
        # In some CSVs "Report Date" is in a different column
        if not report_date:
            report_date = parse_date(safe_get(row, "PrincipalAdjustFactor"))
        
        execution_date = parse_date(safe_get(row, "Date/Time"))
        # In some CSVs execution date might be in Report Date column
        if not execution_date:
            execution_date = parse_date(safe_get(row, "Report Date"))
        
        if not report_date and not execution_date:
            logger.warning(f"Row {row_idx}: No valid date found, skipping")
            return None
        
        # 4. Get description and parse ratio
        # Try multiple columns for description
        description = safe_get(row, "ActionDescription")
        if not description or (isinstance(description, (int, float)) and not pd.isna(description)):
            description = safe_get(row, "Description", "")
        if not description or pd.isna(description):
            description = safe_get(row, "Date/Time", "")  # Sometimes description ends up here
        description = str(description) if description else ""
        
        ratio_new, ratio_old = parse_ratio_from_description(description)
        
        # 5. Normalize action type - try multiple columns
        # Look for Type column first, then Code column (which might have FS, RS, etc.)
        raw_type = safe_get(row, "Type")
        if raw_type and isinstance(raw_type, (int, float)):
            # Type column has wrong data, try Code column
            raw_type = safe_get(row, "Code", "")
        raw_type = str(raw_type) if raw_type and not pd.isna(raw_type) else ""
        action_type = normalize_action_type(raw_type, description)
        
        # 6. Get symbol and look up asset
        symbol = safe_get(row, "Symbol")
        if not symbol:
            symbol = extract_symbol_from_description(description)
        
        asset_id = None
        if symbol:
            asset_id = self.db.get_asset_id(symbol)
            
            # Auto-create asset if not found
            if not asset_id:
                logger.info(f"Asset {symbol} not found, creating...")
                isin = clean_isin(safe_get(row, "ISIN") or safe_get(row, "SecurityID"))
                cusip = clean_cusip(safe_get(row, "CUSIP"))
                
                asset_id = self.db.get_or_create_asset(
                    symbol=symbol,
                    description=safe_get(row, "Description"),
                    isin=isin,
                    cusip=cusip,
                    currency=currency,
                    class_id=DEFAULT_EQUITY_CLASS_ID
                )
                
                if asset_id:
                    self.created_assets.append(symbol)
        
        # 7. Parse numeric fields
        quantity_adjustment = parse_decimal(safe_get(row, "Quantity"))
        amount = parse_decimal(safe_get(row, "Amount"))
        proceeds = parse_decimal(safe_get(row, "Proceeds"))
        value = parse_decimal(safe_get(row, "Value"))
        fifo_pnl_realized = parse_decimal(safe_get(row, "FifoPnlRealized"))
        mtm_pnl = parse_decimal(safe_get(row, "MtmPnl"))
        
        # 8. Get identifiers
        ib_action_id = safe_get(row, "ActionID")
        transaction_id = safe_get(row, "TransactionID")
        security_id = safe_get(row, "SecurityID")
        security_id_type = safe_get(row, "SecurityIDType")
        isin = clean_isin(safe_get(row, "ISIN"))
        cusip = clean_cusip(safe_get(row, "CUSIP"))
        
        # 9. Build the corporate action record
        action_data = {
            "account_id": account_id,
            "asset_id": asset_id,
            "ib_action_id": str(ib_action_id) if ib_action_id else None,
            "transaction_id": str(transaction_id) if transaction_id else None,
            "action_type": action_type,
            "report_date": report_date.isoformat() if report_date else None,
            "execution_date": execution_date.isoformat() if execution_date else None,
            "description": description,
            "ratio_old": str(ratio_old) if ratio_old else None,
            "ratio_new": str(ratio_new) if ratio_new else None,
            "quantity_adjustment": str(quantity_adjustment) if quantity_adjustment else None,
            "symbol": symbol,
            "isin": isin,
            "cusip": cusip,
            "security_id": security_id,
            "security_id_type": security_id_type,
            "amount": str(amount) if amount else None,
            "proceeds": str(proceeds) if proceeds else None,
            "value": str(value) if value else None,
            "fifo_pnl_realized": str(fifo_pnl_realized) if fifo_pnl_realized else None,
            "mtm_pnl": str(mtm_pnl) if mtm_pnl else None,
            "currency": currency
        }
        
        return action_data
    
    def _insert_actions(self, actions: List[Dict]):
        """
        Insert corporate actions directly to database.
        """
        logger.info(f"Inserting {len(actions)} corporate actions...")
        
        result = self.db.create_corporate_actions_bulk(actions)
        
        if result.get("status") == "success":
            logger.info(f"Bulk insert successful: {result.get('created')} created")
        elif result.get("status") == "partial":
            logger.warning(f"Partial insert: {result.get('created')} created, {result.get('skipped')} failed")
            self.error_count += result.get('skipped', 0)
            for err in result.get('errors', []):
                self.errors.append(err)
        else:
            logger.error(f"Insert failed: {result.get('errors')}")
            self.error_count += len(actions)
            for err in result.get('errors', []):
                self.errors.append(err)
    
    def _get_summary(self) -> Dict[str, Any]:
        """Get processing summary."""
        return {
            "status": "success" if self.error_count == 0 else "partial",
            "records_processed": self.processed_count,
            "records_created": self.processed_count - self.error_count,
            "records_skipped": self.skipped_count,
            "records_failed": self.error_count,
            "created_assets": self.created_assets,
            "errors": self.errors[:10] if self.errors else []
        }


def process_corporate_actions(file_path: Path = None) -> Dict[str, Any]:
    """
    Convenience function to process corporate actions.
    
    Args:
        file_path: Path to CSV file (defaults to DOWNLOAD_DIR/CORPORATES.csv)
    
    Returns:
        Processing summary
    """
    if file_path is None:
        file_path = DOWNLOAD_DIR / "CORPORATES.csv"
    
    processor = CorporateActionsProcessor()
    return processor.process_file(file_path)


if __name__ == "__main__":
    import sys
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Allow passing file path as argument
    if len(sys.argv) > 1:
        file_path = Path(sys.argv[1])
    else:
        file_path = DOWNLOAD_DIR / "CORPORATES.csv"
    
    result = process_corporate_actions(file_path)
    print(f"\nResults: {result}")
