"""
AIS ETL Endpoint
================
Endpoint to trigger web scraping of AIS products and download Excel export.
Also handles importing structured notes data into the database.
"""

import os
import time
import logging
from pathlib import Path
from datetime import date, datetime
from typing import List, Optional
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_, func as sa_func

import tempfile
import pandas as pd

from app.api import deps
from app.models.asset import Asset, StructuredNote, Position, Currency, ETLJobLog
from app.models.portfolio import Account, Portfolio
from app.models.user import User
from app.schemas.asset import (
    StructuredNoteRead,
    StructuredNoteHolderRead,
    StructuredNoteImportResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# ==========================================================================
# CONFIGURATION
# ==========================================================================

BASE_URL = "https://aisfg.my.site.com/s/"
TARGET_URL = "https://aisfg.my.site.com/s/my-products"

# Use /tmp for temporary storage, organized in its own folder
AIS_TMP_DIR = os.path.join(tempfile.gettempdir(), "ais_scraper")
os.makedirs(AIS_TMP_DIR, exist_ok=True)

STORAGE_FILE = os.path.join(AIS_TMP_DIR, "ais_auth_state.json")
OUTPUT_FILE = os.path.join(AIS_TMP_DIR, "ais_products.xlsx")

# Credentials from environment variables
AIS_USER = os.getenv("AIS_USER", "")
AIS_PASS = os.getenv("AIS_PASS", "")


# ==========================================================================
# SCHEMAS
# ==========================================================================

class AISExportResponse(BaseModel):
    """Response schema for AIS export."""
    success: bool
    message: str
    file_path: str | None = None


# ==========================================================================
# HELPER FUNCTIONS
# ==========================================================================

# Column mapping: CSV column name → DB column name
CSV_TO_DB_MAP = {
    "ISIN": "isin",
    "Bid": "bid",
    "Ask": "ask",
    "Underlyings": "underlyings_label",
    "Final Fixing Date": "final_fixing_date",
    "Initial Fixing Date": "initial_fixing_date",
    "Next Autocall Date": "next_autocall_date",
    "Next Coupon Date": "next_coupon_date",
    "Issuer PCS": "issuer_pcs",
    "Next Observation": "next_observation",
    "Coupon Trigger": "coupon_trigger",
    "Capital Barrier": "capital_barrier",
    "Autocall Trigger": "autocall_trigger",
    "Coupon p.a.": "coupon_pa",
    "Reference Underlying": "reference_underlying",
    "Put Strike": "put_strike",
    "Issue Date": "issue_date",
    "Redemption Date": "redemption_date",
    "Next Autocall Trigger": "next_autocall_trigger",
    "Next Autocall Value": "next_autocall_value",
    "Reference Underlying Initial Fixing Level": "ref_underlying_initial_fixing",
    "Reference Underlying Last Close": "ref_underlying_last_close",
    "Final Client": "final_client",
    "Next Coupon Payment Date": "next_coupon_payment_date",
    "Strike Level": "strike_level",
    "Dist Average": "dist_average",
    "Status": "status",
    "Payoff": "payoff",
    "Paid coupons": "paid_coupons",
    "Store Observations": "store_observations",
    "Coupon Frequency": "coupon_frequency",
    "Callability Frequency": "callability_frequency",
    "Issuer": "issuer",
    "Product": "product",
    "Size": "size",
    "Currency": "currency",
    "Coupon": "coupon",
    "Autocall": "autocall_value",
    "Protection": "protection",
    "Performance": "performance",
}

# Columns that should be parsed as dates
DATE_COLUMNS = {
    "final_fixing_date", "initial_fixing_date", "next_autocall_date",
    "next_coupon_date", "next_observation", "issue_date", "redemption_date",
    "next_coupon_payment_date",
}

# Columns that should be parsed as numerics
NUMERIC_COLUMNS = {
    "bid", "ask", "coupon_trigger", "capital_barrier", "autocall_trigger",
    "coupon_pa", "put_strike", "next_autocall_trigger", "next_autocall_value",
    "ref_underlying_initial_fixing", "ref_underlying_last_close",
    "strike_level", "dist_average", "paid_coupons", "size", "coupon",
    "autocall_value", "protection", "performance",
}


def safe_decimal(value) -> Optional[Decimal]:
    """Convert a value to Decimal, return None for empty/invalid."""
    if pd.isna(value) or value == "" or value == " ":
        return None
    try:
        s = str(value).strip().replace("%", "")
        if not s or s == "-":
            return None
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def safe_date(value) -> Optional[date]:
    """Convert a value to date, return None for empty/invalid."""
    if pd.isna(value) or value == "" or value == " ":
        return None
    try:
        s = str(value).strip()
        if not s or s == "-":
            return None
        # Handle "2026-02-03" and "2026-05-11 00:00:00"
        dt = pd.to_datetime(s, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.date()
    except Exception:
        return None


def safe_string(value) -> Optional[str]:
    """Clean a string value, return None for empty."""
    if pd.isna(value):
        return None
    s = str(value).strip()
    return s if s and s != "-" else None


def build_underlyings(row: pd.Series) -> list:
    """
    Build JSONB underlyings array from CSV row columns.
    Handles dynamic Underlying 1..N, Strike N, Initial Fixing Level N, Spot N.
    """
    underlyings = []
    for i in range(1, 10):  # Support up to 9 underlyings
        underlying_col = f"Underlying {i}"
        strike_col = f"Strike {i}"
        ifl_col = f"Initial Fixing Level {i}"
        spot_col = f"Spot {i}"

        if underlying_col not in row.index:
            break

        ticker = safe_string(row.get(underlying_col))
        if not ticker:
            continue  # Skip empty underlyings

        entry = {
            "ticker": ticker,
            "strike": float(safe_decimal(row.get(strike_col)) or 0),
            "initial_fixing_level": float(safe_decimal(row.get(ifl_col)) or 0),
            "spot": float(safe_decimal(row.get(spot_col)) or 0),
        }
        underlyings.append(entry)

    return underlyings


def run_ais_scraper() -> tuple[bool, str, str | None]:
    """
    Run the AIS scraper to download products Excel.
    
    Returns:
        Tuple of (success: bool, message: str, file_path: str | None)
    """
    from playwright.sync_api import sync_playwright

    if not AIS_USER or not AIS_PASS:
        return False, "AIS_USER or AIS_PASS environment variables not set", None

    try:
        with sync_playwright() as p:
            logger.info("🚀 Launching headless Chromium...")
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-gpu",
                    "--no-sandbox",
                    "--disable-dev-shm-usage"
                ]
            )

            # Context with or without saved session
            if os.path.exists(STORAGE_FILE):
                logger.info("🔐 Using saved session")
                context = browser.new_context(storage_state=STORAGE_FILE)
            else:
                logger.info("🔐 No session, creating new")
                context = browser.new_context()

            page = context.new_page()

            # ─────────────────────────────
            # HOME FIRST STRATEGY
            # ─────────────────────────────
            logger.info(f"🔵 Navigating to Home: {BASE_URL}")
            try:
                page.goto(BASE_URL, wait_until="networkidle", timeout=60000)
            except Exception as e:
                logger.warning(f"⚠️ Timeout loading Home, continuing... {e}")

            time.sleep(5)

            # Check if redirected to login
            if "/login" in page.url:
                logger.info("🔒 Redirected to login. Entering credentials...")
                try:
                    page.wait_for_selector("input:visible", timeout=10000)
                    inputs = page.locator("input:visible")

                    inputs.nth(0).click()
                    inputs.nth(0).fill(AIS_USER)

                    inputs.nth(1).click()
                    inputs.nth(1).fill(AIS_PASS)

                    inputs.nth(1).press("Enter")

                    logger.info("⏳ Waiting for post-login redirects...")
                    page.wait_for_url(
                        lambda url: "/s/" in url and "/login" not in url,
                        timeout=60000,
                        wait_until="domcontentloaded"
                    )

                    logger.info("✅ Login successful, saving session")
                    context.storage_state(path=STORAGE_FILE)

                except Exception as e:
                    logger.error(f"❌ Login error: {e}")
                    browser.close()
                    return False, f"Login failed: {e}", None
            else:
                logger.info("✅ Already logged in (Home loaded)")

            # ─────────────────────────────
            # NAVIGATE TO MY PRODUCTS
            # ─────────────────────────────
            logger.info("➡️ Searching for 'MY PRODUCTS' link...")
            try:
                my_products_link = page.get_by_text("MY PRODUCTS", exact=True)
                if my_products_link.count() == 0:
                    my_products_link = page.get_by_role("link", name="MY PRODUCTS")

                if my_products_link.count() > 0:
                    my_products_link.first.click()
                    logger.info("✅ Clicked 'MY PRODUCTS'")
                else:
                    logger.warning("⚠️ 'MY PRODUCTS' link not found, forcing URL navigation...")
                    page.goto(TARGET_URL, wait_until="domcontentloaded")

                page.wait_for_url(lambda url: "my-products" in url, timeout=30000)
                logger.info("✅ On products page")

                logger.info("⏳ Waiting for table to load...")
                page.wait_for_selector("table, .slds-table", timeout=60000)
                time.sleep(5)

            except Exception as e:
                logger.error(f"❌ Navigation to My Products failed: {e}")
                browser.close()
                return False, f"Navigation failed: {e}", None

            # ─────────────────────────────
            # EXPORT TO EXCEL
            # ─────────────────────────────
            logger.info("🔍 Searching for 'Export table' button...")
            try:
                export_btn = page.get_by_text("Export table", exact=True)
                export_btn.wait_for(state="visible", timeout=30000)
                logger.info("✅ 'Export table' button found, clicking...")
                export_btn.click()

            except Exception as e:
                logger.error(f"❌ 'Export table' button not found: {e}")
                browser.close()
                return False, f"Export button not found: {e}", None

            logger.info("⏳ Waiting for export modal...")
            try:
                export_excel_btn = page.locator("text=Export Excel")
                export_excel_btn.wait_for(state="visible", timeout=10000)
                logger.info("✅ 'Export Excel' button found")

                with page.expect_download(timeout=60000) as download_info:
                    logger.info("⬇️ Starting download...")
                    export_excel_btn.click()

                download = download_info.value
                download.save_as(OUTPUT_FILE)
                logger.info(f"✅ File downloaded to: {OUTPUT_FILE}")

            except Exception as e:
                logger.error(f"❌ Excel export error: {e}")
                browser.close()
                return False, f"Export failed: {e}", None

            browser.close()
            return True, "Export successful", OUTPUT_FILE

    except Exception as e:
        logger.exception(f"❌ Unexpected error in scraper: {e}")
        return False, f"Scraper error: {e}", None


# ==========================================================================
# ENDPOINTS
# ==========================================================================

@router.post("/export-products", response_model=AISExportResponse)
def export_ais_products():
    """
    Trigger AIS web scraping to export products as Excel.
    
    This endpoint:
    1. Launches headless Chromium
    2. Logs into AIS (or uses saved session)
    3. Navigates to My Products
    4. Clicks Export > Export Excel
    5. Saves the file to /tmp/ais_products.xlsx
    
    Returns success status and file path.
    """
    logger.info("📥 AIS Export endpoint triggered")
    
    success, message, file_path = run_ais_scraper()
    
    if not success:
        raise HTTPException(status_code=500, detail=message)
    
    # Verify file exists
    if file_path and Path(file_path).exists():
        return AISExportResponse(
            success=True,
            message=message,
            file_path=file_path
        )
    else:
        raise HTTPException(
            status_code=500, 
            detail="Export completed but file not found"
        )


@router.post("/import-notes", response_model=StructuredNoteImportResponse)
def import_structured_notes(db: Session = Depends(deps.get_db)):
    """
    Import structured notes from the downloaded XLSX file.
    
    This endpoint:
    1. Creates an ETLJobLog for tracking
    2. Reads the XLSX from /tmp/ais_scraper/ais_products.xlsx
    3. Converts to DataFrame in-memory (no separate CSV step)
    4. Resolves ISIN → asset_id from the assets table
    5. Builds JSONB underlyings array dynamically
    6. Upserts into structured_notes by (isin, upload_date=today)
    7. Reports missing assets for manual creation
    8. Updates ETLJobLog with results
    """
    logger.info("📊 Starting structured notes import...")

    # ── Create Job Log ──
    job = ETLJobLog(
        job_type="STRUCTURED_NOTES",
        job_name="Import Structured Notes",
        file_name="ais_products.xlsx",
        status="running",
        started_at=datetime.now()
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        if not Path(OUTPUT_FILE).exists():
            job.status = "failed"
            job.error_message = f"XLSX file not found at {OUTPUT_FILE}. Run /export-products first."
            job.completed_at = datetime.now()
            db.commit()
            raise HTTPException(
                status_code=404,
                detail=f"XLSX file not found at {OUTPUT_FILE}. Run /export-products first."
            )

        # ── Read XLSX into DataFrame ──
        try:
            df = pd.read_excel(OUTPUT_FILE, engine="openpyxl")
            logger.info(f"📄 Read {len(df)} rows from XLSX")
        except Exception as e:
            job.status = "failed"
            job.error_message = f"Failed to read XLSX: {e}"
            job.completed_at = datetime.now()
            db.commit()
            raise HTTPException(status_code=500, detail=f"Failed to read XLSX: {e}")

        if "ISIN" not in df.columns:
            job.status = "failed"
            job.error_message = "XLSX file does not contain an 'ISIN' column"
            job.completed_at = datetime.now()
            db.commit()
            raise HTTPException(status_code=400, detail="XLSX file does not contain an 'ISIN' column")

        # ── Build ISIN → asset_id lookup ──
        all_isins = [str(v).strip() for v in df["ISIN"].dropna().unique()]
        assets_by_isin = {}
        if all_isins:
            found_assets = db.query(Asset.asset_id, Asset.isin).filter(
                Asset.isin.in_(all_isins)
            ).all()
            assets_by_isin = {a.isin: a.asset_id for a in found_assets}

        # ── Validate currencies ──
        valid_currencies = set()
        try:
            currencies = db.query(Currency.code).all()
            valid_currencies = {c.code for c in currencies}
        except Exception:
            logger.warning("⚠️ Could not load currencies catalog, skipping validation")

        today = date.today()
        created = 0
        updated = 0
        skipped = 0
        missing_assets = []
        errors = []

        for idx, row in df.iterrows():
            isin = safe_string(row.get("ISIN"))
            if not isin:
                skipped += 1
                continue

            # ── Resolve asset_id ──
            asset_id = assets_by_isin.get(isin)
            if asset_id is None:
                underlyings_label = safe_string(row.get("Underlyings"))
                missing_assets.append({
                    "isin": isin,
                    "underlyings_label": underlyings_label or "",
                    "product": safe_string(row.get("Product")) or "",
                    "issuer": safe_string(row.get("Issuer")) or "",
                    "done": False,
                })
                skipped += 1
                continue

            # ── Build record data ──
            record_data = {
                "asset_id": asset_id,
                "isin": isin,
                "upload_date": today,
            }

            # Map CSV columns to DB columns
            for csv_col, db_col in CSV_TO_DB_MAP.items():
                if csv_col == "ISIN":
                    continue  # Already handled

                raw_value = row.get(csv_col)

                if db_col in DATE_COLUMNS:
                    record_data[db_col] = safe_date(raw_value)
                elif db_col in NUMERIC_COLUMNS:
                    record_data[db_col] = safe_decimal(raw_value)
                else:
                    record_data[db_col] = safe_string(raw_value)

            # ── Validate currency ──
            if valid_currencies and record_data.get("currency"):
                if record_data["currency"] not in valid_currencies:
                    logger.warning(f"⚠️ Row {idx}: Unknown currency '{record_data['currency']}' for ISIN {isin}")

            # ── Build underlyings JSONB ──
            record_data["underlyings"] = build_underlyings(row)

            # ── Upsert: same ISIN + same day = update ──
            try:
                existing = db.query(StructuredNote).filter(
                    and_(
                        StructuredNote.isin == isin,
                        StructuredNote.upload_date == today,
                    )
                ).first()

                if existing:
                    for key, value in record_data.items():
                        if key != "isin" and key != "upload_date":
                            setattr(existing, key, value)
                    updated += 1
                else:
                    new_note = StructuredNote(**record_data)
                    db.add(new_note)
                    created += 1

            except Exception as e:
                errors.append(f"Row {idx} (ISIN: {isin}): {str(e)}")
                skipped += 1

        try:
            db.commit()
            logger.info(f"Import complete: {created} created, {updated} updated, {skipped} skipped, {len(missing_assets)} missing assets")
        except Exception as e:
            db.rollback()
            job.status = "failed"
            job.error_message = f"Database commit failed: {e}"
            job.completed_at = datetime.now()
            db.commit()
            raise HTTPException(status_code=500, detail=f"Database commit failed: {e}")

        # ── Update Job Log ──
        status = "success" if not missing_assets and not errors else "partial"
        
        job.status = status
        job.completed_at = datetime.now()
        job.records_processed = len(df)
        job.records_created = created
        job.records_updated = updated
        job.records_skipped = skipped
        job.records_failed = len(errors)
        
        if job.started_at and job.completed_at:
            from decimal import Decimal as Dec
            job.execution_time_seconds = Dec(str((job.completed_at - job.started_at).total_seconds()))
        
        # Build extra_data
        extra_data = {
            "report_date": str(today),
        }
        if missing_assets:
            extra_data["missing_assets"] = missing_assets
        if errors:
            extra_data["errors"] = errors
        
        job.extra_data = extra_data
        job.done = (status == "success")
        db.commit()

        return StructuredNoteImportResponse(
            status=status,
            total_rows=len(df),
            created=created,
            updated=updated,
            skipped=skipped,
            missing_assets=missing_assets,
            errors=errors,
            job_id=job.job_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error importing structured notes: {str(e)}")
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now()
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error importing structured notes: {str(e)}")


@router.get("/notes", response_model=List[StructuredNoteRead])
def get_structured_notes(
    upload_date: Optional[date] = Query(None, description="Filter by date (default: latest)"),
    db: Session = Depends(deps.get_db),
):
    """
    Get structured notes for a specific date.
    Defaults to latest available upload_date.
    """
    if upload_date is None:
        # Get the most recent upload_date
        latest = db.query(sa_func.max(StructuredNote.upload_date)).scalar()
        if latest is None:
            return []
        upload_date = latest

    notes = db.query(StructuredNote).filter(
        StructuredNote.upload_date == upload_date
    ).order_by(StructuredNote.isin).all()

    return notes


@router.get("/notes/dates", response_model=List[date])
def get_available_dates(db: Session = Depends(deps.get_db)):
    """
    Get all available upload dates for the date filter dropdown.
    Returns dates in descending order (most recent first).
    """
    dates = db.query(StructuredNote.upload_date).distinct().order_by(
        StructuredNote.upload_date.desc()
    ).all()
    return [d[0] for d in dates]


@router.get("/notes/{isin}/holders", response_model=List[StructuredNoteHolderRead])
def get_note_holders(
    isin: str,
    upload_date: Optional[date] = Query(None, description="Position report date to match"),
    db: Session = Depends(deps.get_db),
):
    """
    Get all clients that hold a structured note in their positions.
    
    Matches by asset_id (resolved from ISIN) and report_date.
    Returns client name, portfolio name, quantity, mark_price, cost_basis_price, and purchase_date.
    """
    # Resolve ISIN → asset_id
    asset = db.query(Asset).filter(Asset.isin == isin).first()
    if not asset:
        return []

    # Determine report_date to query
    if upload_date is None:
        # Use the latest report_date for this asset
        latest = db.query(sa_func.max(Position.report_date)).filter(
            Position.asset_id == asset.asset_id
        ).scalar()
        if latest is None:
            return []
        upload_date = latest

    # Query positions + accounts + portfolios + users
    results = (
        db.query(
            User.full_name,
            Portfolio.name.label("portfolio_name"),
            Position.quantity,
            Position.mark_price,
            Position.cost_basis_price,
            Position.position_value,
            Position.open_date_time,
            Position.report_date,
        )
        .join(Account, Position.account_id == Account.account_id)
        .join(Portfolio, Account.portfolio_id == Portfolio.portfolio_id)
        .join(User, Portfolio.owner_user_id == User.user_id)
        .filter(
            Position.asset_id == asset.asset_id,
            Position.report_date == upload_date,
        )
        .all()
    )

    holders = []
    for r in results:
        holders.append(StructuredNoteHolderRead(
            full_name=r.full_name or "Unknown",
            portfolio_name=r.portfolio_name or "Unknown",
            quantity=float(r.quantity) if r.quantity else 0.0,
            mark_price=float(r.mark_price) if r.mark_price else None,
            cost_basis_price=float(r.cost_basis_price) if r.cost_basis_price else None,
            position_value=float(r.position_value) if r.position_value else None,
            purchase_date=r.open_date_time.date() if r.open_date_time else None,
            report_date=r.report_date,
        ))

    return holders


