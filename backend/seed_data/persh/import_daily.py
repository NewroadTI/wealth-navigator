#!/usr/bin/env python3
"""
Import daily Pershing transactions from English-formatted CSV files.

Usage:
    python import_daily.py --file=Transactions_NVINVI159.csv           # Interactive
    python import_daily.py --file=Transactions_NVINVI159_90days.csv --dry-run # Preview

This script:
1. Reads a single CSV file from daily_transactions_csv/ directory
2. Extracts account code from Column 3 (Account Number) for each row
3. Matches accounts by exact code (e.g., NVI003648)
4. Imports transactions into Trades, CashJournal, and CorporateAction tables
5. Handles Cancel/Correct trade logic (only imports valid trades)
6. Shows warnings for duplicates, missing ISINs, and missing accounts
"""

import sys
import os
import csv
import re
import argparse
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Optional, Dict, List, Tuple
from collections import defaultdict

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User
from app.models.portfolio import Portfolio, Account
from app.models.asset import Asset, Trades, CashJournal, CorporateAction

# Constants
CSV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'daily_transactions_csv')

# Import mapping and helper functions from existing script
# We'll reuse the logic from import_persh_transactions_en.py

# ============================================================================
# TRANSACTION TYPE MAPPINGS (Same as import_persh_transactions_en.py)
# ============================================================================

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

FEE_PARTIAL_MATCHES = [
    "ASSET MANAGEMENT ACCOUNT",
    "ANNUAL FEE",
    "SPECIAL HANDLING FEE",
]

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

# ============================================================================
# HELPER FUNCTIONS (Reused from import_persh_transactions_en.py)
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
    """Parse date string in various formats."""
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

def parse_datetime(val) -> Optional[datetime]:
    """Parse date string to datetime."""
    d = parse_date(val)
    return datetime.combine(d, datetime.min.time()) if d else None

def build_account_cache(db: Session) -> Dict[str, Dict]:
    """Build cache of accounts with their portfolio and user info."""
    cache = {}
    accounts = db.query(Account).all()
    
    for acc in accounts:
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
    """Build cache of assets by ISIN and CUSIP."""
    cache = {}
    assets = db.query(Asset).all()
    
    for asset in assets:
        if asset.isin:
            cache[f"ISIN:{asset.isin}"] = asset.asset_id
        if asset.cusip:
            cache[f"CUSIP:{asset.cusip}"] = asset.asset_id
        if asset.symbol:
            cache[f"SYMBOL:{asset.symbol}"] = asset.asset_id
    
    return cache

def get_asset_id(db: Session, row: dict, asset_cache: Dict[str, int]) -> Optional[int]:
    """Look up asset by ISIN, CUSIP, or SYMBOL (in order of priority)."""
    # 1. Try ISIN
    isin = row.get("ISIN", "").strip()
    if isin and isin != "-":
        key = f"ISIN:{isin}"
        if key in asset_cache:
            return asset_cache[key]
        asset = db.query(Asset).filter(Asset.isin == isin).first()
        if asset:
            asset_cache[key] = asset.asset_id
            return asset.asset_id
    
    # 2. Try CUSIP
    cusip = row.get("CUSIP", "").strip()
    if cusip and cusip != "-":
        key = f"CUSIP:{cusip}"
        if key in asset_cache:
            return asset_cache[key]
        asset = db.query(Asset).filter(Asset.cusip == cusip).first()
        if asset:
            asset_cache[key] = asset.asset_id
            return asset.asset_id
    
    # 3. Try SYMBOL
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

def classify_transaction(tx_type: str) -> Tuple[str, Optional[str]]:
    """Classify transaction type."""
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
    """Check if transaction is a Correct Buy/Sell."""
    return tx_type.strip().lower().startswith("correct")

def is_cancel_trade(tx_type: str) -> bool:
    """Check if transaction is a Cancel Buy/Sell."""
    return CANCEL_PATTERN.match(tx_type.strip()) is not None

def process_trades_with_cancel_correct(trades: List[dict]) -> List[dict]:
    """Group trades by Reference Number and apply Cancel/Correct logic."""
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

# ============================================================================
# RECORD CREATION (Same as import_persh_transactions_en.py)
# ============================================================================

def create_trade(db: Session, row: dict, account_id: int, account_code: str,
                 asset_id: Optional[int], side: str, dry_run: bool,
                 seen_refs: set) -> bool:
    """Create a Trades record."""
    ref_num = row.get("Reference Number", "").strip()
    tx_date = row.get("Trade Date", row.get("Process Date", "")).strip()
    isin = row.get("ISIN", "").strip()
    
    if ref_num:
        composite_ref = f"{account_code}_{ref_num}_{tx_date}_{isin}"
    else:
        composite_ref = None
    
    if composite_ref and composite_ref in seen_refs:
        return False
    
    if composite_ref:
        existing = db.query(Trades).filter(Trades.ib_exec_id == composite_ref).first()
        if existing:
            return False
        seen_refs.add(composite_ref)
    
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
        side=side,
        description=row.get("Security Description", "")[:500] if row.get("Security Description") else None,
        ib_exec_id=composite_ref,
    )
    
    if not dry_run:
        db.add(trade)
    
    return True

def create_cash_journal(db: Session, row: dict, account_id: int, account_code: str, 
                        asset_id: Optional[int], cj_type: str, dry_run: bool,
                        seen_refs: set) -> bool:
    """Create a CashJournal record."""
    ref_num = row.get("Reference Number", "").strip()
    tx_date = row.get("Process Date", row.get("Settlement Date", "")).strip()
    isin = row.get("ISIN", "").strip()
    
    if ref_num:
        composite_ref = f"{account_code}_{ref_num}_{tx_date}_{isin}"
    else:
        composite_ref = None
    
    if composite_ref and composite_ref in seen_refs:
        return False
    
    if composite_ref:
        existing = db.query(CashJournal).filter(CashJournal.reference_code == composite_ref).first()
        if existing:
            return False
        seen_refs.add(composite_ref)
    
    cj = CashJournal(
        account_id=account_id,
        asset_id=asset_id,
        date=parse_date(row.get("Process Date") or row.get("Settlement Date")),
        type=cj_type,
        amount=parse_decimal(row.get("Net Amount (Base Currency)")) or Decimal(0),
        currency=(row.get("Transaction Currency", "USD") or "USD")[:3],
        description=row.get("Transaction Description", row.get("Security Description", ""))[:500] if row.get("Transaction Description") or row.get("Security Description") else None,
        reference_code=composite_ref,
    )
    
    if not dry_run:
        db.add(cj)
    
    return True

def create_corporate_action(db: Session, row: dict, account_id: int, account_code: str,
                            asset_id: Optional[int], action_type: str, dry_run: bool,
                            seen_refs: set) -> bool:
    """Create a CorporateAction record."""
    ref_num = row.get("Reference Number", "").strip()
    tx_date = row.get("Process Date", "").strip()
    isin = row.get("ISIN", "").strip()
    
    if ref_num:
        composite_ref = f"{account_code}_{ref_num}_{tx_date}_{isin}"
    else:
        composite_ref = None
    
    if composite_ref and composite_ref in seen_refs:
        return False
    
    if composite_ref:
        existing = db.query(CorporateAction).filter(CorporateAction.transaction_id == composite_ref).first()
        if existing:
            return False
        seen_refs.add(composite_ref)
    
    ca = CorporateAction(
        account_id=account_id,
        asset_id=asset_id,
        action_type=action_type,
        execution_date=parse_date(row.get("Process Date")),
        description=row.get("Transaction Description", row.get("Security Description", ""))[:500] if row.get("Transaction Description") or row.get("Security Description") else None,
        quantity_adjustment=parse_decimal(row.get("Quantity")),
        symbol=row.get("SYMBOL", "").strip() if row.get("SYMBOL") else None,
        isin=row.get("ISIN", "").strip() if row.get("ISIN") and row.get("ISIN") != "-" else None,
        cusip=row.get("CUSIP", "").strip() if row.get("CUSIP") and row.get("CUSIP") != "-" else None,
        currency=(row.get("Transaction Currency", "USD") or "USD")[:3],
        transaction_id=composite_ref,
    )
    
    if not dry_run:
        db.add(ca)
    
    return True

# ============================================================================
# CSV LOADING (Modified for daily CSVs)
# ============================================================================

def load_daily_csv(csv_path: str) -> List[dict]:
    """
    Load daily CSV file, skipping 9 metadata rows.
    Returns list of row dicts.
    """
    rows = []
    try:
        with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
            # Skip first 9 rows (metadata)
            for _ in range(9):
                f.readline()
            
            # Row 10 is header
            reader = csv.DictReader(f)
            for row in reader:
                # Skip empty rows or disclaimer rows
                tx_type = row.get("Transaction Type", "").strip()
                if tx_type and not tx_type.startswith("This information"):
                    rows.append(row)
    except Exception as e:
        print(f"  Error reading {csv_path}: {e}")
    
    return rows

# ============================================================================
# MAIN PROCESSING
# ============================================================================

def process_file(db: Session, csv_path: str, account_cache: Dict, asset_cache: Dict,
                 dry_run: bool, stats: dict, errors: list):
    """Process a single daily CSV file."""
    filename = os.path.basename(csv_path)
    
    # Load CSV
    rows = load_daily_csv(csv_path)
    
    if not rows:
        errors.append(f"No data rows found in {filename}")
        return
    
    # Group rows by account (Column 3: Account Number)
    account_rows = defaultdict(list)
    for row in rows:
        account_code = row.get("Account Number", "").strip()
        if not account_code:
            errors.append(f"Missing Account Number in row: {row.get('Transaction Type', 'Unknown')}")
            continue
        account_rows[account_code].append(row)
    
    # Process each account
    for account_code, acct_rows in account_rows.items():
        if account_code not in account_cache:
            errors.append(f"Account '{account_code}' not found in database - skipping {len(acct_rows)} transactions")
            stats["skipped_no_account"] += len(acct_rows)
            continue
        
        account_id = account_cache[account_code]["account_id"]
        
        # Track seen references per account
        seen_trade_refs = set()
        seen_cj_refs = set()
        seen_ca_refs = set()
        
        # Separate transactions by type
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
        
        # Apply Cancel/Correct logic to trades
        valid_trades = process_trades_with_cancel_correct(trades)
        stats["trades_cancelled"] += len(trades) - len(valid_trades)
        
        # Process valid trades
        for row in valid_trades:
            asset_id = get_asset_id(db, row, asset_cache)
            
            isin = row.get("ISIN", "").strip()
            if isin and isin != "-" and not asset_id:
                errors.append(f"Asset with ISIN '{isin}' not found - skipping trade")
                stats["skipped_no_asset"] += 1
                continue
            
            if create_trade(db, row, account_id, account_code, asset_id, row["_side"], dry_run, seen_trade_refs):
                stats["trades"] += 1
            else:
                stats["duplicates"] += 1
        
        # Process CashJournal entries
        for row in cash_journals:
            asset_id = get_asset_id(db, row, asset_cache)
            
            if create_cash_journal(db, row, account_id, account_code, asset_id, row["_cj_type"], dry_run, seen_cj_refs):
                stats["cash_journal"] += 1
            else:
                stats["duplicates"] += 1
        
        # Process Corporate Actions
        for row in corporate_actions:
            asset_id = get_asset_id(db, row, asset_cache)
            
            if create_corporate_action(db, row, account_id, account_code, asset_id, row["_action_type"], dry_run, seen_ca_refs):
                stats["corporate_actions"] += 1
            else:
                stats["duplicates"] += 1

def print_summary(stats: dict, errors: list):
    """Print import summary."""
    print("\n" + "=" * 60)
    print(" IMPORT SUMMARY")
    print("=" * 60)
    print(f"  Trades created:          {stats['trades']}")
    print(f"  CashJournal created:     {stats['cash_journal']}")
    print(f"  CorporateAction created: {stats['corporate_actions']}")
    print(f"  Trades cancelled/void:   {stats['trades_cancelled']}")
    print(f"  Duplicates skipped:      {stats['duplicates']}")
    print(f"  Skipped (no account):    {stats['skipped_no_account']}")
    print(f"  Skipped (no asset):      {stats['skipped_no_asset']}")
    print("=" * 60)
    
    if errors:
        print("\n⚠️  WARNINGS/ERRORS (first 20):")
        for err in errors[:20]:
            print(f"    • {err}")
        if len(errors) > 20:
            print(f"    ... and {len(errors) - 20} more")

def main():
    parser = argparse.ArgumentParser(description="Import daily Pershing transactions (English CSVs)")
    parser.add_argument("--file", required=True, help="CSV filename (e.g., Transactions_NVINVI159.csv)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    args = parser.parse_args()
    
    csv_path = os.path.join(CSV_DIR, args.file)
    
    if not os.path.exists(csv_path):
        print(f"ERROR: File not found: {csv_path}")
        sys.exit(1)
    
    print("=" * 60)
    print(" PERSHING DAILY TRANSACTION IMPORT")
    print("=" * 60)
    print(f"File: {args.file}")
    print(f"Mode: {'DRY RUN (no changes)' if args.dry_run else 'LIVE (will insert data)'}")
    print()
    
    # Connect to database
    print("Connecting to database...")
    db = SessionLocal()
    
    try:
        # Build caches
        print("Building account cache...")
        account_cache = build_account_cache(db)
        print(f"  Found {len(account_cache)} accounts")
        
        print("Building asset cache...")
        asset_cache = build_asset_cache(db)
        print(f"  Found {len(asset_cache)} asset identifiers")
        
        # Process file
        print("\nProcessing transactions...")
        stats = {
            "trades": 0,
            "cash_journal": 0,
            "corporate_actions": 0,
            "trades_cancelled": 0,
            "duplicates": 0,
            "skipped_no_account": 0,
            "skipped_no_asset": 0,
        }
        errors = []
        
        process_file(db, csv_path, account_cache, asset_cache, args.dry_run, stats, errors)
        
        # Show summary
        print_summary(stats, errors)
        
        # Confirm and commit
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
