"""
Seed Structured Notes — Inception Data
=======================================
Reads all_notas.csv (Spanish headers), resolves ISIN → asset_id,
builds JSONB underlyings, and inserts into structured_notes table.

Usage:
    cd backend
    python seed_data/structure_notes/seed_structured_notes.py
"""

import sys
import os
import logging
import pandas as pd
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

# Path setup
sys.path.append(".")
sys.path.append("seed_data")

try:
    from app.db.session import SessionLocal
    from app.models.asset import Asset, StructuredNote
    # Import all models so SQLAlchemy can resolve relationships
    from app.models.user import User
    from app.models.portfolio import Portfolio, Account
except ImportError:
    print("⚠️ Error importing models. Run from the backend/ directory.")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CONFIG ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, "all_notas.csv")

# Inception date for all rows
INCEPTION_DATE = date(2026, 2, 12)


# --- HELPERS ---

def parse_decimal(val):
    """Convert value to Decimal, return None for empty/invalid."""
    if pd.isna(val) or str(val).strip() in ["", "-", "nan", "None"]:
        return None
    try:
        clean = str(val).strip().replace(",", "").replace("%", "").replace("$", "")
        if not clean or clean == "-":
            return None
        return Decimal(clean)
    except (InvalidOperation, ValueError):
        return None


def parse_date(val):
    """Convert value to date, return None for empty/invalid."""
    if pd.isna(val) or str(val).strip() in ["", "-", "nan", "None"]:
        return None
    try:
        s = str(val).strip()
        if not s or s == "-":
            return None
        dt = pd.to_datetime(s, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.date()
    except Exception:
        return None


def safe_string(val):
    """Clean string value, return None for empty."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    return s if s and s != "-" and s != "nan" else None


def extract_root_ticker(val):
    """Extract root ticker, e.g. 'XYZ UN Equity' -> 'XYZ'."""
    raw = safe_string(val)
    if not raw:
        return None
    return raw.split()[0]


def compute_underlying_perf(spot_value, strike_value):
    """Compute performance as spot/strike, returning 0.0 when invalid."""
    if spot_value is None or strike_value in (None, Decimal("0")):
        return 0.0
    try:
        if strike_value == 0:
            return 0.0
        return float(spot_value / strike_value)
    except (InvalidOperation, ValueError, TypeError, ZeroDivisionError):
        return 0.0


def normalize_status_to_english(val):
    """Normalize status labels to a consistent English taxonomy."""
    raw = safe_string(val)
    if not raw:
        return None
    key = raw.lower()
    mapping = {
        "vigente": "Active",
        "active": "Active",
        "live": "Active",
        "call": "Call",
        "called": "Call",
        "vencida": "Matured",
        "vencido": "Matured",
        "matured": "Matured",
        "vendida": "Sold",
        "vendido": "Sold",
        "sold": "Sold",
    }
    return mapping.get(key, raw)


def is_empty_row(row):
    """Check if a row is essentially empty (all blank or NaN)."""
    for val in row:
        if pd.notna(val) and str(val).strip() not in ["", "-", "nan"]:
            return False
    return True


def build_underlyings_from_csv(row):
    """
    Build JSONB underlyings array from CSV columns.
    CSV has: Subyacentes, Subyacentes2, Subyacentes3
             Strike, Strike2, Strike3
             Spot, Spot2, Spot3
             Perf (%), Perf (%)2, Perf (%)3
    """
    underlyings = []
    
    # Map index suffix to column names
    suffixes = ["", "2", "3"]
    
    for suffix in suffixes:
        ticker_col = f"Subyacentes{suffix}"
        strike_col = f"Strike{suffix}"
        spot_col = f"Spot{suffix}"
        ticker = extract_root_ticker(row.get(ticker_col))
        if not ticker:
            continue

        strike_value = parse_decimal(row.get(strike_col))
        spot_value = parse_decimal(row.get(spot_col))

        entry = {
            "ticker": ticker,
            "strike": float(strike_value or 0),
            "spot": float(spot_value or 0),
            "perf": compute_underlying_perf(spot_value, strike_value),
        }
        underlyings.append(entry)

    return underlyings if underlyings else None


def main():
    if not os.path.exists(CSV_FILE):
        logger.error(f"❌ CSV file not found: {CSV_FILE}")
        sys.exit(1)

    logger.info(f"📄 Reading CSV: {CSV_FILE}")
    df = pd.read_csv(CSV_FILE)
    # Strip whitespace from column names (CSV has trailing spaces in some headers)
    df.columns = df.columns.str.strip()
    logger.info(f"   Total rows in CSV: {len(df)}")

    db = SessionLocal()

    try:
        # Clear existing data before seeding
        logger.info("🗑️  Clearing existing structured_notes data...")
        deleted = db.query(StructuredNote).delete()
        db.commit()
        logger.info(f"   Deleted {deleted} existing records")
        
        # Build ISIN → asset_id lookup
        all_isins = [str(v).strip() for v in df["ISIN"].dropna().unique()]
        assets_by_isin = {}
        if all_isins:
            found = db.query(Asset.asset_id, Asset.isin).filter(
                Asset.isin.in_(all_isins)
            ).all()
            assets_by_isin = {a.isin: a.asset_id for a in found}
            logger.info(f"   Found {len(assets_by_isin)} assets by ISIN")

        created = 0
        skipped = 0
        missing_isins = set()

        # Group by ISIN  - each note may appear multiple times (different client holdings)
        # We only need ONE record per note in structured_notes table
        unique_isins = df["ISIN"].dropna().unique()
        logger.info(f"   Processing {len(unique_isins)} unique ISINs")

        for isin_value in unique_isins:
            # Get the first row for this ISIN (all rows for same ISIN have same note data)
            # Use original isin_value for DataFrame lookup before conversion
            row = df[df["ISIN"] == isin_value].iloc[0]
            
            isin = safe_string(isin_value)
            if not isin:
                skipped += 1
                continue

            # Resolve asset_id
            asset_id = assets_by_isin.get(isin)
            if asset_id is None:
                missing_isins.add(isin)
                skipped += 1
                continue

            # Build underlyings JSONB
            underlyings = build_underlyings_from_csv(row)

            note = StructuredNote(
                asset_id=asset_id,
                isin=isin,
                upload_date=INCEPTION_DATE,

                dealer=safe_string(row.get("Dealer")),
                code=safe_string(row.get("Code")),
                status=normalize_status_to_english(row.get("Status")),
                product_type=safe_string(row.get("Tipo de producto")),
                issuer=safe_string(row.get("Emisor")),
                custodian=safe_string(row.get("Custodio")),
                advisor=safe_string(row.get("Asesor")),
                nominal=parse_decimal(row.get("Nominal")),

                underlyings=underlyings,

                maturity_date=parse_date(row.get("Vencimiento")),
                issue_date=parse_date(row.get("Fecha de emision")),
                strike_date=parse_date(row.get("Fecha de Strike")),
                last_autocall_obs=parse_date(row.get("Ult. Obs. Autocall")),
                next_autocall_obs=parse_date(row.get("Sgt. Obs. Autocall")),
                next_coupon_obs=parse_date(row.get("Sgt Obs Cupon")),
                next_payment_date=parse_date(row.get("Sgt. Fecha de Pago")),

                coupon_annual_pct=parse_decimal(row.get("Cupon Anual (%)")),
                coupon_periodic_pct=parse_decimal(row.get("Cupon Tri/Men (%)")),
                coupon_annual_amount=parse_decimal(row.get("Cupon Anual ($)")),
                coupon_periodic_amount=parse_decimal(row.get("Cupon Tri/Men ($)")),
                coupon_type=safe_string(row.get("Tipo de cupon")),

                cap_pct=parse_decimal(row.get("%Cap")),
                capital_protected_pct=parse_decimal(row.get("%Capital Protegido")),
                autocall_trigger=parse_decimal(row.get("Autocall Trigger")),
                step_down=parse_decimal(row.get("Step Down")),
                autocall_obs_count=parse_decimal(row.get("# Obs autocall")),
                protection_barrier=parse_decimal(row.get("Barrera de Proteccion")),
                coupon_barrier=parse_decimal(row.get("Barrera Cupon")),

                observation_frequency=safe_string(row.get("Frecuencia de Obs")),

                termsheet=safe_string(row.get("Termsheet")),
                coupons_paid_count=parse_decimal(row.get("# cupones entregados")),
                coupons_paid_amount=parse_decimal(row.get("Cupones entregados ($)")),
                gross_yield_pct=parse_decimal(row.get("Yield Bruto(%)")),
            )

            db.add(note)
            created += 1

        db.commit()
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ Seed complete!")
        logger.info(f"   Created: {created}")
        logger.info(f"   Skipped: {skipped}")
        if missing_isins:
            logger.info(f"   Missing assets ({len(missing_isins)} ISINs):")
            for isin in sorted(missing_isins):
                logger.info(f"      - {isin}")
        logger.info(f"{'='*60}")

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
