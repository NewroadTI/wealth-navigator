#!/usr/bin/env python3
"""
Import Pershing transactions from inviu_fulldata.csv into the database.

Usage:
    python import_persh_transactions.py           # Interactive mode
    python import_persh_transactions.py --dry-run # Preview without inserting

This script:
1. Matches accounts by exact 'Cuenta' code (e.g., NVI014629)
2. Looks up assets by ISIN or CUSIP
3. Imports transactions into Trades and CashJournal tables
4. Skips transactions for non-existent accounts or assets (with logging)
"""

import sys
import os
import csv
import re
import argparse
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Optional, Dict, List, Tuple

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User  # Required for relationship resolution
from app.models.portfolio import Portfolio, Account
from app.models.asset import Asset, Trades, CashJournal

# Constants
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'inviu_fulldata.csv')

# ============================================================================
# OPERATION MAPPING
# ============================================================================
# Maps Spanish "Operación" to (TargetTable, TypeValue)
# TypeValue is used for CashJournal.type or Trades.side

OPERATION_MAP = {
    "Compra": ("Trades", "BUY"),
    "Venta": ("Trades", "SELL"),
    "Ingreso dividendo": ("CashJournal", "DIVIDEND"),
    "Intereses": ("CashJournal", "INTEREST"),
    "Comisiones": ("CashJournal", "FEE"),
    "Impuestos": ("CashJournal", "TAX"),
    "Ingreso": ("CashJournal", "DEPOSIT"),
    "Rescate": ("CashJournal", "FEE"),  # Custody fee per user feedback
    "Otros": ("CashJournal", None),     # Type determined by ACTIVITY_TYPE_MAP
}

# Sub-mapping for "Otros" ONLY - based on "Tipo de actividad" column
ACTIVITY_TYPE_MAP = {
    "FEDERAL FUNDS SENT": "WITHDRAWAL",
    "FEDERAL FUNDS RECEIVED": "DEPOSIT",
    "SECURITY REDEEMED": "REDEMPTION",
    "SECURITY DELIVERED": "TRANSFER_OUT",
    "SECURITY RECEIVED": "TRANSFER_IN",
    "YOUR ASSET TRANSFERRED": "TRANSFER",
    "ACTIVITY WITHIN YOUR ACCT": "ADJUSTMENT",
    "REORGANIZATION INSTRUCTION": "ADJUSTMENT",
    "SECURITY TENDERED": "ADJUSTMENT",
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_decimal(val) -> Optional[Decimal]:
    """Parse string to Decimal, handling various formats."""
    if val is None or str(val).strip() in ["", "-", "nan", "None"]:
        return None
    try:
        clean = str(val).replace(",", "").replace("$", "").replace(" ", "").strip()
        return Decimal(clean)
    except (InvalidOperation, ValueError):
        return None

def parse_date(val) -> Optional[date]:
    """Parse date string in YYYY-MM-DD format."""
    if not val or str(val).strip() == "":
        return None
    try:
        return datetime.strptime(str(val).strip(), "%Y-%m-%d").date()
    except ValueError:
        return None

def parse_datetime(val) -> Optional[datetime]:
    """Parse date string to datetime."""
    d = parse_date(val)
    return datetime.combine(d, datetime.min.time()) if d else None

def extract_cusip_from_description(description: str) -> Optional[str]:
    """Extract CUSIP code from description text like 'CUSIP: N1108N-BF-9'"""
    if not description:
        return None
    match = re.search(r'CUSIP:\s*([A-Z0-9-]+)', description, re.IGNORECASE)
    if match:
        return match.group(1).replace("-", "")
    return None

# ============================================================================
# CACHE BUILDERS
# ============================================================================

def build_account_cache(db: Session) -> Dict[str, Dict]:
    """
    Build cache of accounts with their portfolio and user info.
    Returns: {account_code: {account_id, portfolio_id, user_id, currency}}
    """
    cache = {}
    accounts = db.query(Account).all()
    
    for acc in accounts:
        # Get portfolio to find user_id
        portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == acc.portfolio_id).first()
        user_id = portfolio.owner_user_id if portfolio else None
        
        cache[acc.account_code] = {
            "account_id": acc.account_id,
            "portfolio_id": acc.portfolio_id,
            "user_id": user_id,
            "currency": acc.currency,
        }
    
    return cache

def build_asset_cache(db: Session) -> Dict[str, int]:
    """
    Build cache of assets by ISIN.
    Returns: {isin: asset_id}
    """
    cache = {}
    assets = db.query(Asset).filter(Asset.isin.isnot(None)).all()
    
    for asset in assets:
        if asset.isin:
            cache[asset.isin] = asset.asset_id
    
    return cache

def get_asset_id(db: Session, isin: str, description: str, asset_cache: Dict[str, int]) -> Optional[int]:
    """
    Look up asset by ISIN or CUSIP.
    Returns asset_id or None if not found.
    """
    # 1. Try ISIN from cache
    if isin and isin in asset_cache:
        return asset_cache[isin]
    
    # 2. Try ISIN direct query (in case asset was added after cache build)
    if isin:
        asset = db.query(Asset).filter(Asset.isin == isin).first()
        if asset:
            asset_cache[isin] = asset.asset_id  # Update cache
            return asset.asset_id
    
    # 3. Try CUSIP from description
    cusip = extract_cusip_from_description(description)
    if cusip:
        asset = db.query(Asset).filter(Asset.cusip == cusip).first()
        if asset:
            return asset.asset_id
    
    return None

# ============================================================================
# TRANSACTION PROCESSORS
# ============================================================================

def create_trade(db: Session, row: dict, account_info: dict, asset_id: Optional[int], side: str, dry_run: bool) -> bool:
    """Create a Trades record."""
    trade = Trades(
        account_id=account_info["account_id"],
        asset_id=asset_id,
        trade_date=parse_datetime(row.get("Concertación")),
        settlement_date=parse_date(row.get("Liquidación")),
        quantity=abs(parse_decimal(row.get("Cantidad")) or Decimal(0)),
        price=parse_decimal(row.get("Precio")) or Decimal(0),
        gross_amount=parse_decimal(row.get("Monto Operado")),
        net_amount=parse_decimal(row.get("Monto")),
        commission=abs((parse_decimal(row.get("Comisiones")) or Decimal(0)) + 
                       (parse_decimal(row.get("Fee")) or Decimal(0))),
        currency=row.get("Moneda", "USD")[:3],
        side=side,
        description=row.get("Descripción", "")[:500],  # Truncate if too long
    )
    
    if not dry_run:
        db.add(trade)
    
    return True

def create_cash_journal(db: Session, row: dict, account_info: dict, asset_id: Optional[int], 
                        cj_type: str, dry_run: bool) -> bool:
    """Create a CashJournal record."""
    cj = CashJournal(
        account_id=account_info["account_id"],
        asset_id=asset_id,
        date=parse_date(row.get("Liquidación")),
        type=cj_type,
        amount=parse_decimal(row.get("Monto")) or Decimal(0),
        currency=row.get("Moneda", "USD")[:3],
        description=row.get("Descripción de actividad", row.get("Descripción", ""))[:500],
    )
    
    if not dry_run:
        db.add(cj)
    
    return True

# ============================================================================
# MAIN PROCESSING
# ============================================================================

def process_row(db: Session, row: dict, account_cache: Dict, asset_cache: Dict, 
                dry_run: bool, stats: dict, errors: list) -> None:
    """Process a single CSV row."""
    cuenta = row.get("Cuenta", "").strip()
    operacion = row.get("Operación", "").strip()
    isin = row.get("ISIN", "").strip()
    activity_type = row.get("Tipo de actividad", "").strip()
    description = row.get("Descripción de actividad", "")
    
    # 1. Validate operation type
    if operacion not in OPERATION_MAP:
        errors.append(f"Unknown operation '{operacion}' for account {cuenta}")
        stats["skipped"] += 1
        return
    
    # 2. Check account exists
    if cuenta not in account_cache:
        errors.append(f"Account '{cuenta}' not found in database - skipping row")
        stats["skipped_no_account"] += 1
        return
    
    account_info = account_cache[cuenta]
    
    # 3. Determine target table and type
    target_table, type_value = OPERATION_MAP[operacion]
    
    # For "Otros", determine type from activity
    if operacion == "Otros" and type_value is None:
        type_value = ACTIVITY_TYPE_MAP.get(activity_type, "OTHER")
    
    # 4. Look up asset (optional for CashJournal, REQUIRED for Trades with ISIN)
    asset_id = None
    if isin:
        asset_id = get_asset_id(db, isin, description, asset_cache)
    
    # For trades with ISIN: skip if asset not found
    if target_table == "Trades" and isin and not asset_id:
        errors.append(f"Asset with ISIN '{isin}' not found - skipping trade")
        stats["skipped_no_asset"] += 1
        return
    
    # 5. Create the transaction
    if target_table == "Trades":
        success = create_trade(db, row, account_info, asset_id, type_value, dry_run)
        if success:
            stats["trades"] += 1
    else:
        success = create_cash_journal(db, row, account_info, asset_id, type_value, dry_run)
        if success:
            stats["cash_journal"] += 1

def load_csv() -> List[dict]:
    """Load CSV file and return list of row dictionaries."""
    if not os.path.exists(DATA_FILE):
        print(f"ERROR: File not found: {DATA_FILE}")
        sys.exit(1)
    
    rows = []
    with open(DATA_FILE, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    
    return rows

def print_summary(stats: dict, errors: list):
    """Print import summary."""
    print("\n" + "=" * 60)
    print(" IMPORT SUMMARY")
    print("=" * 60)
    print(f"  Trades created:       {stats['trades']}")
    print(f"  CashJournal created:  {stats['cash_journal']}")
    print(f"  Skipped (no account): {stats['skipped_no_account']}")
    print(f"  Skipped (no asset):   {stats['skipped_no_asset']}")
    print(f"  Skipped (other):      {stats['skipped']}")
    print(f"  TOTAL processed:      {stats['total']}")
    print("=" * 60)
    
    if errors:
        print("\n⚠️  WARNINGS/ERRORS (first 20):")
        for err in errors[:20]:
            print(f"    • {err}")
        if len(errors) > 20:
            print(f"    ... and {len(errors) - 20} more")

def main():
    parser = argparse.ArgumentParser(description="Import Pershing transactions")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    args = parser.parse_args()
    
    print("=" * 60)
    print(" PERSHING TRANSACTION IMPORT")
    print("=" * 60)
    print(f"Data file: {DATA_FILE}")
    print(f"Mode: {'DRY RUN (no changes)' if args.dry_run else 'LIVE (will insert data)'}")
    print()
    
    # 1. Load CSV
    print("Loading CSV...")
    rows = load_csv()
    print(f"  Found {len(rows)} rows")
    
    # 2. Connect to database
    print("Connecting to database...")
    db = SessionLocal()
    
    try:
        # 3. Build caches
        print("Building account cache...")
        account_cache = build_account_cache(db)
        print(f"  Found {len(account_cache)} accounts")
        
        print("Building asset cache...")
        asset_cache = build_asset_cache(db)
        print(f"  Found {len(asset_cache)} assets with ISIN")
        
        # 4. Process rows
        print("\nProcessing transactions...")
        stats = {
            "trades": 0,
            "cash_journal": 0,
            "skipped": 0,
            "skipped_no_account": 0,
            "skipped_no_asset": 0,
            "total": len(rows),
        }
        errors = []
        
        for i, row in enumerate(rows):
            process_row(db, row, account_cache, asset_cache, args.dry_run, stats, errors)
            if (i + 1) % 100 == 0:
                print(f"  Processed {i + 1}/{len(rows)} rows...")
        
        # 5. Show summary
        print_summary(stats, errors)
        
        # 6. Confirm and commit (if not dry run)
        if not args.dry_run:
            print("\n" + "-" * 60)
            confirm = input("Proceed with import? Type 'yes' to confirm: ")
            
            if confirm.strip().lower() == "yes":
                db.commit()
                print("\n✅ Import completed successfully!")
            else:
                db.rollback()
                print("\n❌ Import cancelled. No changes made.")
        else:
            print("\n📋 Dry run complete. No changes made.")
    
    except Exception as e:
        db.rollback()
        print(f"\n❌ ERROR: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
