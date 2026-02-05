"""
Pershing ETL API Endpoints
===========================
HTTP endpoints for Pershing XLSX conversion and transaction import.
"""

import os
import shutil
import tempfile
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
import logging

from app.api.deps import get_db
from app.models.portfolio import Account
from app.models.asset import Asset, Trades, CashJournal, CorporateAction

logger = logging.getLogger(__name__)

router = APIRouter()

# ==========================================================================
# PATHS
# ==========================================================================

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../../seed_data/persh/uploads")
CSV_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../../seed_data/persh/daily_transactions_csv")

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CSV_OUTPUT_DIR, exist_ok=True)

# ==========================================================================
# SCHEMAS
# ==========================================================================

class ConvertResponse(BaseModel):
    success: bool
    csv_filename: str
    row_count: int
    preview: List[dict]
    message: str

class ImportWarning(BaseModel):
    type: str  # "missing_account", "missing_asset", "duplicate"
    count: int
    details: List[str]

class ImportStats(BaseModel):
    trades: int
    cash_journal: int
    corporate_actions: int
    trades_cancelled: int
    duplicates: int
    skipped_no_account: int
    skipped_no_asset: int

class ImportRequest(BaseModel):
    csv_filename: str

class ImportResponse(BaseModel):
    success: bool
    job_id: Optional[int]
    status: str  # "success", "partial", "failed"
    stats: ImportStats
    warnings: List[ImportWarning]
    errors: List[str]
    message: str

# ==========================================================================
# IMPORT LOGIC (Extracted from import_daily.py)
# ==========================================================================

import re
import csv
from collections import defaultdict
from typing import Dict, Tuple

# Transaction type mappings
CASH_JOURNAL_TYPES = {
    "CASH DIVIDEND RECEIVED": "DIVIDEND",
    "FOREIGN BOND INTEREST": "INTEREST",
    "BOND INTEREST ADJUSTMENT": "INTEREST",
    "NON-RESIDENT ALIEN TAX": "TAX",
    "NON-RESIDENT ALIEN TAX    PRIOR YEAR ADJUSTMENT": "TAX_REFUND",
    "FOREIGN CUSTODY FEE": "FEE",
    "WIRED FUNDS FEE": "FEE",
    "BOND REDEMPTION/CALL FEE": "FEE",
    "MANAGEMENT FEE PAID": "FEE",
    "NON-U.S. ACCOUNT FEE": "FEE",
    "PES BILLING FEE": "FEE",
    "OUTGOING ACCOUNT TRANSFER FEE": "FEE",
    "VOLUNTARY REORGANIZATION  FEE": "FEE",
    "FEDERAL FUNDS SENT": "WITHDRAWAL",
    "FEDERAL FUNDS RECEIVED": "DEPOSIT",
    "RECEIVE FED WIRE": "DEPOSIT",
    "YOUR ASSET TRANSFERRED": "TRANSFER",
    "ACTIVITY WITHIN YOUR ACCT": "ADJUSTMENT",
    "SECURITY DELIVERED": "TRANSFER_OUT",
    "SECURITY RECEIVED": "TRANSFER_IN",
    "INT. CHARGED ON DEBIT     BALANCES": "INTEREST_EXPENSE",
}

FEE_PARTIAL_MATCHES = ["ASSET MANAGEMENT ACCOUNT", "ANNUAL FEE", "SPECIAL HANDLING FEE"]

CORPORATE_ACTION_TYPES = {
    "SECURITY REDEEMED": "MATURITY",
    "CUSIP CHANGE": "SYMBOL_CHANGE",
    "REORGANIZATION INSTRUCTION": "REORGANIZATION",
    "SECURITY TENDERED": "TENDER",
}

TRADE_PATTERNS = [
    (re.compile(r'^(Correct\s+)?Buy\s+[\d,.]+\s+share\(s\)\s+of\s+(\w+)', re.IGNORECASE), "BUY"),
    (re.compile(r'^(Correct\s+)?Sell\s+-?[\d,.]+\s+share\(s\)\s+of\s+(\w+)', re.IGNORECASE), "SELL"),
    (re.compile(r'^(Correct\s+)?Buy\s+[\d,.]+\s+parValue\s+of\s+(\w+)', re.IGNORECASE), "BUY"),
    (re.compile(r'^(Correct\s+)?Sell\s+-?[\d,.]+\s+parValue\s+of\s+(\w+)', re.IGNORECASE), "SELL"),
]

CANCEL_PATTERN = re.compile(r'^Cancel\s+(Buy|Sell)', re.IGNORECASE)


def parse_decimal(val) -> Optional[Decimal]:
    if val is None or str(val).strip() in ["", "-", "nan", "None"]:
        return None
    try:
        clean = str(val).replace(",", "").replace("$", "").replace(" ", "").strip()
        return Decimal(clean)
    except:
        return None


def parse_date(val):
    if not val or str(val).strip() in ["", "-"]:
        return None
    val_str = str(val).strip()
    formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"]
    for fmt in formats:
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            continue
    return None


def parse_datetime(val):
    d = parse_date(val)
    return datetime.combine(d, datetime.min.time()) if d else None


def classify_transaction(tx_type: str) -> Tuple[str, Optional[str]]:
    tx_type_clean = tx_type.strip()
    if CANCEL_PATTERN.match(tx_type_clean):
        return ("Skip", None)
    for pattern, side in TRADE_PATTERNS:
        if pattern.match(tx_type_clean):
            return ("Trade", side)
    for ca_type, action_type in CORPORATE_ACTION_TYPES.items():
        if tx_type_clean == ca_type:
            return ("CorporateAction", action_type)
    if tx_type_clean in CASH_JOURNAL_TYPES:
        return ("CashJournal", CASH_JOURNAL_TYPES[tx_type_clean])
    for partial in FEE_PARTIAL_MATCHES:
        if partial in tx_type_clean:
            return ("CashJournal", "FEE")
    return ("Skip", None)


def is_correct_trade(tx_type: str) -> bool:
    return tx_type.strip().lower().startswith("correct")


def is_cancel_trade(tx_type: str) -> bool:
    return CANCEL_PATTERN.match(tx_type.strip()) is not None


def process_trades_with_cancel_correct(trades: List[dict]) -> List[dict]:
    ref_groups = defaultdict(list)
    for tx in trades:
        ref_num = tx.get('Reference Number', '').strip()
        if ref_num:
            ref_groups[ref_num].append(tx)
        else:
            ref_groups[f"__no_ref_{id(tx)}"].append(tx)
    
    valid_trades = []
    for ref_num, group in ref_groups.items():
        has_correct = any(is_correct_trade(t['Transaction Type']) for t in group)
        has_cancel = any(is_cancel_trade(t['Transaction Type']) for t in group)
        
        if has_correct:
            correct_txs = [t for t in group if is_correct_trade(t['Transaction Type'])]
            valid_trades.extend(correct_txs)
        elif has_cancel:
            continue
        else:
            valid_trades.extend(group)
    
    return valid_trades


def get_asset_id(db: Session, row: dict, asset_cache: Dict[str, int]) -> Optional[int]:
    isin = row.get("ISIN", "").strip()
    if isin and isin != "-":
        key = f"ISIN:{isin}"
        if key in asset_cache:
            return asset_cache[key]
        asset = db.query(Asset).filter(Asset.isin == isin).first()
        if asset:
            asset_cache[key] = asset.asset_id
            return asset.asset_id
    
    cusip = row.get("CUSIP", "").strip()
    if cusip and cusip != "-":
        key = f"CUSIP:{cusip}"
        if key in asset_cache:
            return asset_cache[key]
        asset = db.query(Asset).filter(Asset.cusip == cusip).first()
        if asset:
            asset_cache[key] = asset.asset_id
            return asset.asset_id
    
    symbol = row.get("SYMBOL", "").strip()
    if symbol and symbol != "-":
        key = f"SYMBOL:{symbol}"
        if key in asset_cache:
            return asset_cache[key]
        asset = db.query(Asset).filter(Asset.symbol == symbol).first()
        if asset:
            asset_cache[key] = asset.asset_id
            return asset.asset_id
    
    return None


# ==========================================================================
# ENDPOINTS
# ==========================================================================

@router.post("/convert-xlsx", response_model=ConvertResponse)
async def convert_xlsx_to_csv(file: UploadFile = File(...)):
    """
    Convert an uploaded XLSX file to CSV format.
    Returns preview of first 10 rows.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        logger.warning(f"❌ Invalid file format uploaded: {file.filename}")
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls format")
    
    try:
        logger.info(f"📂 Converting XLSX to CSV: {file.filename}")
        # Save uploaded file temporarily
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_xlsx_path = os.path.join(UPLOAD_DIR, f"{timestamp}_{file.filename}")
        
        with open(temp_xlsx_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Convert to CSV using pandas
        df = pd.read_excel(temp_xlsx_path)
        
        # Generate CSV filename
        base_name = os.path.splitext(file.filename)[0]
        csv_filename = f"{timestamp}_{base_name}.csv"
        csv_path = os.path.join(CSV_OUTPUT_DIR, csv_filename)
        
        # Save as CSV
        df.to_csv(csv_path, index=False)
        
        # Generate preview (first 10 rows)
        preview_df = df.head(10)
        preview = preview_df.fillna("").to_dict(orient="records")
        
        # Clean up original xlsx
        os.remove(temp_xlsx_path)
        
        return ConvertResponse(
            success=True,
            csv_filename=csv_filename,
            row_count=len(df),
            preview=preview,
            message=f"Successfully converted to {csv_filename}"
        )
        
    except Exception as e:
        logger.error(f"❌ Error converting file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error converting file: {str(e)}")


@router.post("/import-transactions", response_model=ImportResponse)
async def import_transactions(request: ImportRequest, db: Session = Depends(get_db)):
    """
    Import transactions from a CSV file that was previously converted.
    """
    from app.models.asset import ETLJobLog
    
    csv_path = os.path.join(CSV_OUTPUT_DIR, request.csv_filename)
    logger.info(f"🚀 Starting transaction import for {request.csv_filename}")
    
    # 1. Create Job Log immediately
    job = ETLJobLog(
        job_type="PERSHING",
        job_name="Import Transactions",
        file_name=request.csv_filename,
        status="running",
        started_at=datetime.now()
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    if not os.path.exists(csv_path):
        job.completed_at = datetime.now()
        db.commit()
        
        logger.error(f"❌ CSV file not found: {request.csv_filename}")
        raise HTTPException(status_code=404, detail=f"CSV file not found: {request.csv_filename}")
    
    try:
        job.file_size_bytes = os.path.getsize(csv_path)
    except:
        pass
    
    # Build caches
    account_cache = {}
    accounts = db.query(Account).all()
    for acc in accounts:
        account_cache[acc.account_code] = {"account_id": acc.account_id}
    
    asset_cache = {}
    assets = db.query(Asset).all()
    for asset in assets:
        if asset.isin:
            asset_cache[f"ISIN:{asset.isin}"] = asset.asset_id
        if asset.cusip:
            asset_cache[f"CUSIP:{asset.cusip}"] = asset.asset_id
        if asset.symbol:
            asset_cache[f"SYMBOL:{asset.symbol}"] = asset.asset_id
    
    # Parse CSV
    rows = []
    logger.info(f"READING CSV: {csv_path}")
    try:
        with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
            # Skip first 9 rows (metadata for daily CSVs)
            for _ in range(9):
                f.readline()
            
            reader = csv.DictReader(f)
            for row in reader:
                tx_type = row.get("Transaction Type", "").strip()
                if tx_type and not tx_type.startswith("This information"):
                    rows.append(row)
    except Exception as e:
        job.status = "failed"
        job.error_message = f"Error reading CSV: {str(e)}"
        job.completed_at = datetime.now()
        db.commit()
        
        return ImportResponse(
            success=False,
            job_id=job.job_id,
            status="failed",
            stats=ImportStats(trades=0, cash_journal=0, corporate_actions=0, trades_cancelled=0, duplicates=0, skipped_no_account=0, skipped_no_asset=0),
            warnings=[],
            errors=[f"Error reading CSV: {str(e)}"],
            message="Failed to read CSV file"
        )
    
    # Process transactions
    stats = {
        "trades": 0,
        "cash_journal": 0,
        "corporate_actions": 0,
        "trades_cancelled": 0,
        "duplicates": 0,
        "skipped_no_account": 0,
        "skipped_no_asset": 0,
    }
    
    warnings_dict = {
        "missing_account": defaultdict(int),
        "missing_asset": defaultdict(int),
    }
    
    # Detailed missing items for extra_data
    missing_accounts_details = {}
    missing_assets_details = {}
    skipped_records_details = [] # List to store full row data for skipped items
    
    errors = []
    
    # Group by account
    account_rows = defaultdict(list)
    for row in rows:
        account_code = row.get("Account Number", "").strip()
        if account_code:
            account_rows[account_code].append(row)
    
    # Process each account
    for account_code, acct_rows in account_rows.items():
        if account_code not in account_cache:
            warnings_dict["missing_account"][account_code] += len(acct_rows)
            stats["skipped_no_account"] += len(acct_rows)
            
            if account_code not in missing_accounts_details:
                missing_accounts_details[account_code] = {
                    "account_code": account_code,
                    "reason": f"Account not found in database: {account_code}",
                    "count": 0,
                    "done": False  # Track resolution status
                }
            missing_accounts_details[account_code]["count"] += len(acct_rows)
            
            # Add all rows to skipped_records
            for r in acct_rows:
                 skipped_records_details.append({
                     "row_data": r,
                     "reason": f"Missing Account: {account_code}",
                     "record_type": "transaction"
                 })
            continue
        
        account_id = account_cache[account_code]["account_id"]
        
        seen_trade_refs = set()
        seen_cj_refs = set()
        seen_ca_refs = set()
        
        trades = []
        cash_journals = []
        corporate_actions = []
        
        for row in acct_rows:
            tx_type = row.get("Transaction Type", "").strip()
            if not tx_type:
                continue
            
            table, type_val = classify_transaction(tx_type)
            
            if table == "Trade":
                row["_side"] = type_val
                trades.append(row)
            elif table == "CashJournal":
                row["_cj_type"] = type_val
                cash_journals.append(row)
            elif table == "CorporateAction":
                row["_action_type"] = type_val
                corporate_actions.append(row)
        
        # Cancel/Correct logic
        valid_trades = process_trades_with_cancel_correct(trades)
        stats["trades_cancelled"] += len(trades) - len(valid_trades)
        
        # Process trades
        for row in valid_trades:
            asset_id = get_asset_id(db, row, asset_cache)
            isin = row.get("ISIN", "").strip()
            symbol = row.get("SYMBOL", "").strip()
            
            if not asset_id and ((isin and isin != "-") or (symbol and symbol != "-")):
                stats["skipped_no_asset"] += 1
                
                # Use ISIN as key if available, else Symbol
                key = isin if (isin and isin != "-") else f"SYMBOL:{symbol}"
                
                if key not in missing_assets_details:
                    # Determine asset type based on symbol format
                    is_option = (
                        (len(symbol.split()) > 1) or 
                        (len(symbol) > 8 and any(c.isdigit() for c in symbol[-8:]))
                    ) if symbol else False
                    
                    missing_assets_details[key] = {
                        "isin": isin if isin != "-" else None,
                        "symbol": symbol if symbol != "-" else None,
                        "description": row.get("Security Description", ""),
                        "currency": row.get("Transaction Currency", ""),
                        "asset_type": "option" if is_option else "unknown",
                        "reason": f"Asset not found in database by {'ISIN (' + isin + ')' if isin and isin != '-' else 'Symbol (' + symbol + ')'}",
                        "count": 0,
                        "done": False  # Track resolution status
                    }
                missing_assets_details[key]["count"] += 1
                
                skipped_records_details.append({
                     "row_data": row,
                     "reason": f"Missing Asset: {key}",
                     "record_type": "transaction"
                 })
                continue
            
            ref_num = row.get("Reference Number", "").strip()
            tx_date = row.get("Trade Date", row.get("Process Date", "")).strip()
            
            if ref_num:
                composite_ref = f"{account_code}_{ref_num}_{tx_date}_{isin}_{row['_side']}"
            else:
                composite_ref = None
            
            if composite_ref and composite_ref in seen_trade_refs:
                stats["duplicates"] += 1
                continue
            
            if composite_ref:
                existing = db.query(Trades).filter(Trades.ib_exec_id == composite_ref).first()
                if existing:
                    stats["duplicates"] += 1
                    continue
                seen_trade_refs.add(composite_ref)
            
            trade = Trades(
                account_id=account_id,
                asset_id=asset_id,
                trade_date=parse_datetime(row.get("Trade Date") or row.get("Process Date")),
                settlement_date=parse_date(row.get("Settlement Date")),
                quantity=abs(parse_decimal(row.get("Quantity")) or Decimal(0)),
                price=parse_decimal(row.get("Price")) or Decimal(0),
                gross_amount=parse_decimal(row.get("Principal")),
                net_amount=parse_decimal(row.get("Net Amount (Base Currency)")),
                commission=parse_decimal(row.get("Commission")) or Decimal(0),
                tax=parse_decimal(row.get("Fees")) or Decimal(0),
                currency=(row.get("Transaction Currency", "USD") or "USD")[:3],
                side=row["_side"],
                description=row.get("Security Description", "")[:500] if row.get("Security Description") else None,
                ib_exec_id=composite_ref,
            )
            db.add(trade)
            stats["trades"] += 1
        
        # Process CashJournal
        for row in cash_journals:
            asset_id = get_asset_id(db, row, asset_cache)
            ref_num = row.get("Reference Number", "").strip()
            tx_date = row.get("Process Date", row.get("Settlement Date", "")).strip()
            isin = row.get("ISIN", "").strip()
            
            if ref_num:
                composite_ref = f"{account_code}_{ref_num}_{tx_date}_{isin}_{row['_cj_type']}"
            else:
                composite_ref = None
            
            if composite_ref and composite_ref in seen_cj_refs:
                stats["duplicates"] += 1
                continue
            
            if composite_ref:
                existing = db.query(CashJournal).filter(CashJournal.reference_code == composite_ref).first()
                if existing:
                    stats["duplicates"] += 1
                    continue
                seen_cj_refs.add(composite_ref)
            
            cj = CashJournal(
                account_id=account_id,
                asset_id=asset_id,
                date=parse_date(row.get("Process Date") or row.get("Settlement Date")),
                type=row["_cj_type"],
                amount=parse_decimal(row.get("Net Amount (Base Currency)")) or Decimal(0),
                currency=(row.get("Transaction Currency", "USD") or "USD")[:3],
                description=row.get("Transaction Description", row.get("Security Description", ""))[:500] if row.get("Transaction Description") or row.get("Security Description") else None,
                reference_code=composite_ref,
            )
            db.add(cj)
            stats["cash_journal"] += 1
        
        # Process Corporate Actions
        for row in corporate_actions:
            asset_id = get_asset_id(db, row, asset_cache)
            ref_num = row.get("Reference Number", "").strip()
            tx_date = row.get("Process Date", "").strip()
            isin = row.get("ISIN", "").strip()
            
            if ref_num:
                composite_ref = f"{account_code}_{ref_num}_{tx_date}_{isin}_{row['_action_type']}"
            else:
                composite_ref = None
            
            if composite_ref and composite_ref in seen_ca_refs:
                stats["duplicates"] += 1
                continue
            
            if composite_ref:
                existing = db.query(CorporateAction).filter(CorporateAction.transaction_id == composite_ref).first()
                if existing:
                    stats["duplicates"] += 1
                    continue
                seen_ca_refs.add(composite_ref)
            
            ca = CorporateAction(
                account_id=account_id,
                asset_id=asset_id,
                action_type=row["_action_type"],
                execution_date=parse_date(row.get("Process Date")),
                description=row.get("Transaction Description", row.get("Security Description", ""))[:500] if row.get("Transaction Description") or row.get("Security Description") else None,
                quantity_adjustment=parse_decimal(row.get("Quantity")),
                symbol=row.get("SYMBOL", "").strip() if row.get("SYMBOL") else None,
                isin=isin if isin and isin != "-" else None,
                cusip=row.get("CUSIP", "").strip() if row.get("CUSIP") and row.get("CUSIP") != "-" else None,
                currency=(row.get("Transaction Currency", "USD") or "USD")[:3],
                transaction_id=composite_ref,
            )
            db.add(ca)
            stats["corporate_actions"] += 1
    
    # Commit all changes
    job_status = "success"
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        job.status = "failed"
        job.error_message = f"Database error: {str(e)}"
        job.completed_at = datetime.now()
        db.commit()
        
        return ImportResponse(
            success=False,
            job_id=job.job_id,
            status="failed",
            stats=ImportStats(**stats),
            warnings=[],
            errors=[f"Database error: {str(e)}"],
            message="Failed to save transactions"
        )
    
    logger.info(f"✅ Import completed. Status: {job_status}. Stats: {stats}")
    
    # Build warnings list
    warnings = []
    for acc, count in warnings_dict["missing_account"].items():
        warnings.append(ImportWarning(
            type="missing_account",
            count=count,
            details=[f"Account '{acc}' not found"]
        ))
    for isin, count in warnings_dict["missing_asset"].items():
        warnings.append(ImportWarning(
            type="missing_asset",
            count=count,
            details=[f"Asset ISIN '{isin}' not found"]
        ))
    
    # Determine status
    total_created = stats["trades"] + stats["cash_journal"] + stats["corporate_actions"]
    # Only count missing accounts and assets as skipped records (errors), effectively ignoring duplicates in this metric
    total_skipped = stats["skipped_no_account"] + stats["skipped_no_asset"]
    
    if total_created == 0 and total_skipped > 0:
        job_status = "no_new_data" # Or partial
        if len(warnings) > 0:
             job_status = "partial"
    elif len(warnings) > 0:
        job_status = "partial"
    else:
        job_status = "success"
        
    # Update Job Log
    job.status = job_status
    job.completed_at = datetime.now()
    job.records_processed = len(rows)
    job.records_created = total_created
    job.records_skipped = total_skipped
    job.records_failed = len(errors) # Should be 0 if we reached here
    
    # Auto-mark successful jobs as done, failed/partial jobs need user review
    if job_status == "success":
        job.done = True
    else:
        job.done = False
    
    extra_data = {}
    if missing_accounts_details:
        extra_data["missing_accounts"] = list(missing_accounts_details.values())
    if missing_assets_details:
        extra_data["missing_assets"] = list(missing_assets_details.values())
    
    
    # Store skipped records details in extra_data as expected by frontend/etl.py
    if skipped_records_details:
        extra_data["skipped_records"] = skipped_records_details
    
    if extra_data:
        job.extra_data = extra_data
        
    if job.started_at:
        job.execution_time_seconds = Decimal(str((job.completed_at - job.started_at).total_seconds()))
        
    db.commit()
    
    return ImportResponse(
        success=True,
        job_id=job.job_id,
        status=job_status,
        stats=ImportStats(**stats),
        warnings=warnings,
        errors=errors,
        message=f"Imported {total_created} records, skipped {total_skipped}"
    )
