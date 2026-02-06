"""
Positions ETL API Endpoints
============================
HTTP endpoints for Positions XLSX conversion and file type detection.
Files are stored in /tmp for processing and cleaned up after use.
"""

import os
import tempfile
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ==========================================================================
# PATHS - Use /tmp for temporary storage
# ==========================================================================

POSITIONS_TMP_DIR = os.path.join(tempfile.gettempdir(), "positions_csv")
os.makedirs(POSITIONS_TMP_DIR, exist_ok=True)

# ==========================================================================
# SCHEMAS
# ==========================================================================

class ConvertPositionsResponse(BaseModel):
    success: bool
    csv_path: str
    detected_type: Optional[str]  # "inviu", "equities", "mutual", "fixed", or None
    header_preview: list[str]
    row_count: int
    message: str


class RemoveCsvRequest(BaseModel):
    csv_path: str


class RemoveCsvResponse(BaseModel):
    success: bool
    message: str


# ==========================================================================
# FILE TYPE DETECTION
# ==========================================================================

INVIU_HEADER = "Cliente,Asesor,Instrumento,Nombre,Tipo,Cuenta,Monto total,Cantidad,Moneda"


def detect_file_type(csv_path: str) -> Optional[str]:
    """
    Detect the type of positions file based on its content.
    
    Returns:
        - "inviu": If header matches Inviu tenencias format
        - "equities": If row 3 contains "Filter By: Equities"
        - "mutual": If row 3 contains "Filter By: Mutual Funds"
        - "fixed": If row 3 contains "Filter By: Fixed Income Securities"
        - None: Unknown format
    """
    try:
        with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = []
            for i in range(5):
                line = f.readline()
                if line:
                    lines.append(line.strip())
                else:
                    break
        
        if not lines:
            return None
        
        # Check for Inviu format (header row)
        first_line = lines[0] if lines else ""
        if first_line.startswith("Cliente,Asesor,Instrumento"):
            return "inviu"
        
        # Check row 3 (index 2) for Position types
        if len(lines) >= 3:
            row3 = lines[2]
            if "Filter By: Equities" in row3:
                return "equities"
            elif "Filter By: Mutual Funds" in row3:
                return "mutual"
            elif "Filter By: Fixed Income Securities" in row3:
                return "fixed"
        
        return None
        
    except Exception as e:
        logger.error(f"Error detecting file type: {e}")
        return None


# ==========================================================================
# ENDPOINTS
# ==========================================================================

@router.post("/convert-xlsx", response_model=ConvertPositionsResponse)
async def convert_positions_xlsx(file: UploadFile = File(...)):
    """
    Convert an uploaded XLSX file to CSV format for positions.
    Detects file type automatically.
    Stores CSV in /tmp (not persistent).
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        logger.warning(f"❌ Invalid file format uploaded: {file.filename}")
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls format")
    
    try:
        logger.info(f"📂 Converting Positions XLSX to CSV: {file.filename}")
        
        # Save uploaded file temporarily
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        temp_xlsx_path = os.path.join(POSITIONS_TMP_DIR, f"{timestamp}_{file.filename}")
        
        with open(temp_xlsx_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Convert to CSV using pandas
        df = pd.read_excel(temp_xlsx_path, header=None)  # No header assumption
        
        # Generate CSV filename
        base_name = os.path.splitext(file.filename)[0]
        csv_filename = f"{timestamp}_{base_name}.csv"
        csv_path = os.path.join(POSITIONS_TMP_DIR, csv_filename)
        
        # Save as CSV (no header, preserve raw structure)
        df.to_csv(csv_path, index=False, header=False)
        
        # Clean up original xlsx
        os.remove(temp_xlsx_path)
        
        # Detect file type
        detected_type = detect_file_type(csv_path)
        
        # Get header preview (first row or row 8 for positions files)
        header_preview = []
        try:
            with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
                first_line = f.readline().strip()
                header_preview = first_line.split(',')[:10]  # First 10 columns
        except:
            pass
        
        type_label = detected_type or "unknown"
        message = f"File converted and detected as: {type_label}"
        if detected_type is None:
            message = "File converted but format not recognized. Please upload a valid positions file."
        
        logger.info(f"✅ Converted {file.filename} -> {csv_filename} (type: {type_label})")
        
        return ConvertPositionsResponse(
            success=True,
            csv_path=csv_path,
            detected_type=detected_type,
            header_preview=header_preview,
            row_count=len(df),
            message=message
        )
        
    except Exception as e:
        logger.error(f"❌ Error converting file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error converting file: {str(e)}")


@router.delete("/remove-csv", response_model=RemoveCsvResponse)
async def remove_csv(request: RemoveCsvRequest):
    """
    Remove a CSV file from temporary storage.
    Used when user removes a file from the upload checklist.
    """
    csv_path = request.csv_path
    
    # Security check: only allow files in our temp directory
    if not csv_path.startswith(POSITIONS_TMP_DIR):
        logger.warning(f"⚠️ Attempted to delete file outside temp dir: {csv_path}")
        raise HTTPException(status_code=400, detail="Invalid file path")
    
    if not os.path.exists(csv_path):
        return RemoveCsvResponse(
            success=True,
            message="File already removed or does not exist"
        )
    
    try:
        os.remove(csv_path)
        logger.info(f"🗑️ Removed CSV file: {csv_path}")
        return RemoveCsvResponse(
            success=True,
            message="File removed successfully"
        )
    except Exception as e:
        logger.error(f"❌ Error removing file {csv_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error removing file: {str(e)}")


# ==========================================================================
# IMPORT POSITIONS ENDPOINT
# ==========================================================================

from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Depends

from app.api.deps import get_db
from app.models.portfolio import Account
from app.models.asset import Asset, Position, ETLJobLog


class ImportPositionsRequest(BaseModel):
    inviu_csv_path: str
    equities_csv_path: str
    mutual_csv_path: str
    fixed_csv_path: str


class ImportPositionsResponse(BaseModel):
    success: bool
    job_id: Optional[int]
    status: str  # "success", "partial", "failed"
    records_processed: int
    records_created: int
    records_skipped: int
    message: str


def clean_nombre(val) -> str:
    """Clean Inviu 'Nombre' field: remove trailing (*) and normalize whitespace."""
    if not isinstance(val, str):
        return str(val)
    val = val.strip()
    if val.endswith("(*)"):
        val = val[:-3].strip()
    val = " ".join(val.split())
    return str(val)


def parse_decimal(val) -> Optional[Decimal]:
    """Parse a value to Decimal, handling various formats."""
    if val is None or str(val).strip() in ["", "-", "nan", "None", "NaN"]:
        return None
    try:
        clean = str(val).replace(",", "").replace("$", "").replace(" ", "").strip()
        return Decimal(clean)
    except:
        return None


def parse_date_from_string(val):
    """Parse date from string like '01/31/2026' or '2026-01-31'."""
    if not val or str(val).strip() in ["", "-", "nan", "NaT"]:
        return None
    val_str = str(val).strip()
    formats = ["%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"]
    for fmt in formats:
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            continue
    return None


def resolve_asset_with_learning(
    db: Session,
    instrumento_inviu: str,
    isin: Optional[str],
    cusip: Optional[str], 
    symbol: Optional[str],
    asset_cache: Dict[str, int]
) -> tuple[Optional[int], str, bool]:
    """
    Resolve asset_id with inviu_code priority and auto-learning.
    
    Returns: (asset_id, matched_by, learned_new_inviu_code)
    """
    instrumento_upper = instrumento_inviu.upper().strip() if instrumento_inviu else ""
    
    # 1️⃣ FIRST: Search by inviu_code (previously learned)
    cache_key = f"INVIU:{instrumento_upper}"
    if cache_key in asset_cache:
        return asset_cache[cache_key], "inviu_code", False
    
    asset = db.query(Asset).filter(Asset.inviu_code == instrumento_upper).first()
    if asset:
        asset_cache[cache_key] = asset.asset_id
        return asset.asset_id, "inviu_code", False
    
    # 2️⃣ Search by ISIN
    isin_clean = isin.strip() if isin and str(isin).strip() not in ["", "-", "nan"] else None
    if isin_clean:
        isin_key = f"ISIN:{isin_clean}"
        if isin_key in asset_cache:
            asset_id = asset_cache[isin_key]
            # Learn inviu_code
            asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
            if asset and not asset.inviu_code and instrumento_upper:
                asset.inviu_code = instrumento_upper
                db.flush()
                return asset_id, "isin", True
            return asset_id, "isin", False
        
        asset = db.query(Asset).filter(Asset.isin == isin_clean).first()
        if asset:
            asset_cache[isin_key] = asset.asset_id
            # Learn inviu_code
            if not asset.inviu_code and instrumento_upper:
                asset.inviu_code = instrumento_upper
                db.flush()
                return asset.asset_id, "isin", True
            return asset.asset_id, "isin", False
    
    # 3️⃣ Search by CUSIP
    cusip_clean = cusip.strip() if cusip and str(cusip).strip() not in ["", "-", "nan"] else None
    if cusip_clean:
        cusip_key = f"CUSIP:{cusip_clean}"
        if cusip_key in asset_cache:
            asset_id = asset_cache[cusip_key]
            asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
            if asset and not asset.inviu_code and instrumento_upper:
                asset.inviu_code = instrumento_upper
                db.flush()
                return asset_id, "cusip", True
            return asset_id, "cusip", False
        
        asset = db.query(Asset).filter(Asset.cusip == cusip_clean).first()
        if asset:
            asset_cache[cusip_key] = asset.asset_id
            if not asset.inviu_code and instrumento_upper:
                asset.inviu_code = instrumento_upper
                db.flush()
                return asset.asset_id, "cusip", True
            return asset.asset_id, "cusip", False
    
    # 4️⃣ Search by Symbol
    symbol_clean = symbol.strip().upper() if symbol and str(symbol).strip() not in ["", "-", "nan"] else None
    if symbol_clean:
        symbol_key = f"SYMBOL:{symbol_clean}"
        if symbol_key in asset_cache:
            asset_id = asset_cache[symbol_key]
            asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
            if asset and not asset.inviu_code and instrumento_upper:
                asset.inviu_code = instrumento_upper
                db.flush()
                return asset_id, "symbol", True
            return asset_id, "symbol", False
        
        asset = db.query(Asset).filter(Asset.symbol == symbol_clean).first()
        if asset:
            asset_cache[symbol_key] = asset.asset_id
            if not asset.inviu_code and instrumento_upper:
                asset.inviu_code = instrumento_upper
                db.flush()
                return asset.asset_id, "symbol", True
            return asset.asset_id, "symbol", False
    
    # 5️⃣ Special case: USD (cash)
    if instrumento_upper == "USD":
        asset = db.query(Asset).filter(
            (Asset.symbol == "USD") | (Asset.symbol == "USD.CASH")
        ).first()
        if asset:
            asset_cache["USD_CASH"] = asset.asset_id
            return asset.asset_id, "usd_cash", False
    
    # ❌ Not found
    return None, "not_found", False


def resolve_account(db: Session, cuenta: str, account_cache: Dict[str, int]) -> Optional[int]:
    """Resolve account_id from Cuenta (interface_code)."""
    if not cuenta:
        return None
    
    cuenta_clean = str(cuenta).strip()
    if cuenta_clean in account_cache:
        return account_cache[cuenta_clean]
    
    account = db.query(Account).filter(Account.interface_code == cuenta_clean).first()
    if account:
        account_cache[cuenta_clean] = account.account_id
        return account.account_id
    
    return None


@router.post("/import-positions", response_model=ImportPositionsResponse)
async def import_positions(request: ImportPositionsRequest, db: Session = Depends(get_db)):
    """
    Import positions from 4 CSV files (Inviu + Equities/Mutual/Fixed).
    
    Matching logic:
    1. Match Inviu Instrumento == Pershing Symbol
    2. Match Inviu Nombre == Pershing Security Description
    3. Extract USD positions from remaining Inviu
    
    Asset resolution priority:
    1. inviu_code (auto-learned from previous imports)
    2. ISIN
    3. CUSIP
    4. Symbol
    
    Creates ETL Job log with missing accounts/assets for review.
    """
    logger.info(f"🚀 Starting positions import")
    
    # Create Job Log
    job = ETLJobLog(
        job_type="PERSHING_POSITIONS",
        job_name="Import Positions",
        file_name="inviu + equities + mutual + fixed",
        status="running",
        started_at=datetime.now()
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    try:
        # Validate files exist
        for path_name, path in [
            ("inviu", request.inviu_csv_path),
            ("equities", request.equities_csv_path),
            ("mutual", request.mutual_csv_path),
            ("fixed", request.fixed_csv_path)
        ]:
            if not os.path.exists(path):
                raise HTTPException(status_code=404, detail=f"{path_name} CSV not found: {path}")
        
        # =================================================================
        # STEP 1: Read and prepare data
        # =================================================================
        logger.info("📖 Reading CSV files...")
        
        # Read Inviu
        df_inviu = pd.read_csv(request.inviu_csv_path)
        
        # Read Pershing files (skip first 7 rows for header)
        dfs_positions = []
        for path in [request.equities_csv_path, request.mutual_csv_path, request.fixed_csv_path]:
            df = pd.read_csv(path, skiprows=7)
            # Clean footer garbage
            df = df.dropna(subset=['Symbol', 'Security Description'])
            df = df[~df['Symbol'].astype(str).str.contains(
                'Disclaimer|Disclosures|Positions are priced|This information', 
                case=False, na=False
            )]
            dfs_positions.append(df)
        
        df_alldata = pd.concat(dfs_positions, ignore_index=True)
        logger.info(f"📊 Inviu rows: {len(df_inviu)}, Pershing rows: {len(df_alldata)}")
        
        # =================================================================
        # STEP 2: Pre-processing
        # =================================================================
        df_inviu['Instrumento'] = df_inviu['Instrumento'].astype(str).str.strip().str.upper()
        df_alldata['Symbol'] = df_alldata['Symbol'].astype(str).str.strip().str.upper()
        
        # Clean Nombre
        df_inviu['Nombre_Clean'] = df_inviu['Nombre'].apply(clean_nombre).str.upper()
        df_alldata['Security Description'] = df_alldata['Security Description'].astype(str).str.strip().str.upper().apply(
            lambda x: " ".join(str(x).split()) if pd.notnull(x) else ""
        )
        
        # Get report_date from first valid Price Date
        report_date = None
        if 'Price Date' in df_alldata.columns:
            first_date = df_alldata['Price Date'].dropna().iloc[0] if len(df_alldata) > 0 else None
            report_date = parse_date_from_string(first_date)
        if not report_date:
            report_date = datetime.now().date()
        
        logger.info(f"📅 Report date: {report_date}")
        
        # =================================================================
        # STEP 3: Matching
        # =================================================================
        
        # Match 1: By Symbol
        merged_symbol = pd.merge(
            df_inviu, df_alldata,
            left_on='Instrumento', right_on='Symbol',
            how='left', indicator=True
        )
        match_symbol = merged_symbol[merged_symbol['_merge'] == 'both'].copy()
        match_symbol['_match_type'] = 'symbol'
        remaining_inviu = merged_symbol[merged_symbol['_merge'] == 'left_only'].copy()
        
        logger.info(f"✅ Match by Symbol: {len(match_symbol)}")
        
        # Prepare remaining for next match
        remaining_inviu = remaining_inviu.drop(columns=['_merge'])
        alldata_cols = [c for c in df_alldata.columns if c in remaining_inviu.columns]
        remaining_inviu = remaining_inviu.drop(columns=alldata_cols, errors='ignore')
        
        # Match 2: By Name
        merged_name = pd.merge(
            remaining_inviu, df_alldata,
            left_on='Nombre_Clean', right_on='Security Description',
            how='left', indicator=True
        )
        match_name = merged_name[merged_name['_merge'] == 'both'].copy()
        match_name['_match_type'] = 'name'
        final_remaining = merged_name[merged_name['_merge'] == 'left_only'].copy()
        
        logger.info(f"✅ Match by Name: {len(match_name)}")
        
        # Extract USD
        usd_items = final_remaining[final_remaining['Instrumento'] == 'USD'].copy()
        usd_items['_match_type'] = 'usd'
        logger.info(f"✅ USD positions: {len(usd_items)}")
        
        # Unmatched (excluding USD)
        unmatched = final_remaining[final_remaining['Instrumento'] != 'USD'].copy()
        logger.info(f"⚠️ Unmatched (not USD): {len(unmatched)}")
        
        # =================================================================
        # STEP 4: Combine and process positions
        # =================================================================
        
        # Build caches
        account_cache = {}
        asset_cache = {}
        
        # Pre-populate asset cache
        all_assets = db.query(Asset).all()
        for asset in all_assets:
            if asset.inviu_code:
                asset_cache[f"INVIU:{asset.inviu_code.upper()}"] = asset.asset_id
            if asset.isin:
                asset_cache[f"ISIN:{asset.isin}"] = asset.asset_id
            if asset.cusip:
                asset_cache[f"CUSIP:{asset.cusip}"] = asset.asset_id
            if asset.symbol:
                asset_cache[f"SYMBOL:{asset.symbol.upper()}"] = asset.asset_id
        
        # Pre-populate account cache
        all_accounts = db.query(Account).all()
        for acc in all_accounts:
            if acc.interface_code:
                account_cache[acc.interface_code] = acc.account_id
        
        # Stats
        records_created = 0
        records_skipped = 0
        records_processed = 0
        
        # Tracking for extra_data
        missing_accounts = {}
        missing_assets = {}
        skipped_records = []
        inviu_codes_learned = []
        
        # Process each match type
        all_matches = pd.concat([match_symbol, match_name, usd_items], ignore_index=True)
        
        for _, row in all_matches.iterrows():
            records_processed += 1
            
            # Extract data
            instrumento = str(row.get('Instrumento', '')).strip()
            cuenta = str(row.get('Cuenta', '')).strip()
            cantidad = parse_decimal(row.get('Cantidad'))
            moneda = str(row.get('Moneda', 'USD'))[:3] if row.get('Moneda') else 'USD'
            monto_total = parse_decimal(row.get('Monto total'))
            match_type = row.get('_match_type', 'unknown')
            
            # Pershing data (may be NaN for USD)
            isin = str(row.get('ISIN', '')) if pd.notna(row.get('ISIN')) else None
            cusip = str(row.get('CUSIP', '')) if pd.notna(row.get('CUSIP')) else None
            symbol = str(row.get('Symbol', '')) if pd.notna(row.get('Symbol')) else None
            market_value = parse_decimal(row.get('Market Value'))
            last_price = parse_decimal(row.get('Last $'))
            
            # Row data for logging
            row_data = {
                'instrumento_inviu': instrumento,
                'cuenta': cuenta,
                'cantidad': str(cantidad) if cantidad else None,
                'monto_total': str(monto_total) if monto_total else None,
                'moneda': moneda,
                'isin': isin,
                'cusip': cusip,
                'symbol': symbol,
                'match_type': match_type
            }
            
            # Resolve account
            account_id = resolve_account(db, cuenta, account_cache)
            if not account_id:
                records_skipped += 1
                if cuenta not in missing_accounts:
                    missing_accounts[cuenta] = {
                        'cuenta': cuenta,
                        'count': 0,
                        'reason': f"Account not found: {cuenta}",
                        'done': False
                    }
                missing_accounts[cuenta]['count'] += 1
                skipped_records.append({
                    'row_data': row_data,
                    'reason': f"Missing Account: {cuenta}",
                    'record_type': 'position'
                })
                continue
            
            # Resolve asset
            asset_id, matched_by, learned = resolve_asset_with_learning(
                db, instrumento, isin, cusip, symbol, asset_cache
            )
            
            if learned:
                inviu_codes_learned.append({
                    'asset_id': asset_id,
                    'inviu_code': instrumento,
                    'matched_by': matched_by
                })
            
            if not asset_id:
                records_skipped += 1
                key = isin or cusip or symbol or instrumento
                if key not in missing_assets:
                    missing_assets[key] = {
                        'instrumento_inviu': instrumento,
                        'isin': isin,
                        'cusip': cusip,
                        'symbol': symbol,
                        'reason': f"Asset not found",
                        'count': 0,
                        'done': False
                    }
                missing_assets[key]['count'] += 1
                skipped_records.append({
                    'row_data': row_data,
                    'reason': f"Missing Asset: {key}",
                    'record_type': 'position'
                })
                continue
            
            # Check for duplicate position
            existing = db.query(Position).filter(
                Position.account_id == account_id,
                Position.asset_id == asset_id,
                Position.report_date == report_date
            ).first()
            
            if existing:
                # Update existing position
                existing.quantity = cantidad or Decimal(0)
                existing.mark_price = last_price if match_type != 'usd' else Decimal(1)
                existing.position_value = market_value if match_type != 'usd' else monto_total
                existing.currency = moneda
            else:
                # Create new position
                position = Position(
                    account_id=account_id,
                    asset_id=asset_id,
                    report_date=report_date,
                    quantity=cantidad or Decimal(0),
                    mark_price=last_price if match_type != 'usd' else Decimal(1),
                    position_value=market_value if match_type != 'usd' else monto_total,
                    side='Long',
                    level_of_detail='SUMMARY',
                    fx_rate_to_base=Decimal(1),
                    currency=moneda
                )
                db.add(position)
                records_created += 1
        
        # Commit all changes
        db.commit()
        
        # =================================================================
        # STEP 5: Update Job Log
        # =================================================================
        
        total_processed = len(match_symbol) + len(match_name) + len(usd_items) + len(unmatched)
        
        # Determine status
        if records_created > 0 and records_skipped == 0:
            job_status = "success"
            job.done = True
        elif records_created > 0 and records_skipped > 0:
            job_status = "partial"
            job.done = False
        elif records_created == 0 and records_skipped > 0:
            job_status = "failed"
            job.done = False
        else:
            job_status = "no_data"
            job.done = True
        
        job.status = job_status
        job.completed_at = datetime.now()
        job.records_processed = total_processed
        job.records_created = records_created
        job.records_skipped = records_skipped
        
        if job.started_at:
            job.execution_time_seconds = Decimal(str((job.completed_at - job.started_at).total_seconds()))
        
        # Build extra_data
        extra_data = {
            'matched_by_symbol': len(match_symbol),
            'matched_by_name': len(match_name),
            'usd_positions': len(usd_items),
            'unmatched': len(unmatched),
            'report_date': str(report_date)
        }
        
        if missing_accounts:
            extra_data['missing_accounts'] = list(missing_accounts.values())
        if missing_assets:
            extra_data['missing_assets'] = list(missing_assets.values())
        if skipped_records:
            extra_data['skipped_records'] = skipped_records
        if inviu_codes_learned:
            extra_data['inviu_codes_learned'] = inviu_codes_learned
        
        job.extra_data = extra_data
        db.commit()
        
        logger.info(f"✅ Import completed: {records_created} created, {records_skipped} skipped")
        
        return ImportPositionsResponse(
            success=True,
            job_id=job.job_id,
            status=job_status,
            records_processed=total_processed,
            records_created=records_created,
            records_skipped=records_skipped,
            message=f"Imported {records_created} positions, skipped {records_skipped}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error importing positions: {str(e)}")
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now()
        db.commit()
        
        raise HTTPException(status_code=500, detail=f"Error importing positions: {str(e)}")

