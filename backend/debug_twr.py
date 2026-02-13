"""
TWR Diagnostic Script
=====================
Run this script to diagnose TWR calculation issues.
Compares calculated TWR against IBKR reported values.

Usage:
    python debug_twr.py --account-code "U1234567_USD" --start-date "2025-02-11" --end-date "2026-02-11"
"""

import sys
import os
from datetime import datetime
from decimal import Decimal

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import get_db
from app.models.portfolio import Account, TWRDaily
from app.models.asset import CashJournal
from sqlalchemy import func
import argparse


def analyze_twr_calculation(account_code: str, start_date: str, end_date: str):
    """Analyze TWR calculation for a specific account and date range."""
    
    db = next(get_db())
    
    print("\n" + "="*80)
    print("TWR CALCULATION DIAGNOSTIC REPORT")
    print("="*80)
    
    # 1. Find the account
    account = db.query(Account).filter(Account.account_code == account_code).first()
    if not account:
        print(f"\n❌ ERROR: Account '{account_code}' not found")
        return
    
    print(f"\n✓ Account Found:")
    print(f"  - Account ID: {account.account_id}")
    print(f"  - Account Code: {account.account_code}")
    print(f"  - Account Alias: {account.account_alias or 'N/A'}")
    print(f"  - Currency: {account.currency}")
    print(f"  - TWR Cutoff Date: {account.twr_cutoff_date or 'Not set'}")
    
    # 2. Get TWR daily rows for the date range
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    twr_rows = (
        db.query(TWRDaily)
        .filter(
            TWRDaily.account_id == account.account_id,
            TWRDaily.date.between(start, end)
        )
        .order_by(TWRDaily.date)
        .all()
    )
    
    print(f"\n✓ TWR Daily Rows in Date Range ({start_date} to {end_date}):")
    print(f"  - Total rows: {len(twr_rows)}")
    
    if not twr_rows:
        print("\n❌ ERROR: No TWR daily rows found for this date range")
        return
    
    print("\n" + "-"*80)
    print("TWR DAILY DATA:")
    print("-"*80)
    print(f"{'Date':<12} {'NAV':>15} {'Cash Flow':>15} {'HP %':>12} {'TWR %':>12}")
    print("-"*80)
    
    for row in twr_rows:
        nav_str = f"{float(row.nav):,.2f}" if row.nav else "N/A"
        cf_str = f"{float(row.sum_cash_journal):,.2f}" if row.sum_cash_journal else "0.00"
        hp_str = f"{float(row.hp)*100:.4f}" if row.hp else "—"
        twr_str = f"{float(row.twr)*100:.4f}" if row.twr else "—"
        print(f"{row.date} {nav_str:>15} {cf_str:>15} {hp_str:>12} {twr_str:>12}")
    
    # 3. Check cash journal entries for this period
    print("\n" + "-"*80)
    print("CASH JOURNAL ENTRIES (TWR-relevant types):")
    print("-"*80)
    
    TWR_CASH_TYPES = (
        'DEPOSIT', 'WITHDRAWAL', 'TRNSFROUT', 'TRNSFIN',
        'ACATIN', 'ACATOUT', 'ACATOUTCNCL'
    )
    
    cash_flows = (
        db.query(CashJournal)
        .filter(
            CashJournal.account_id == account.account_id,
            CashJournal.date.between(start, end),
            CashJournal.type.in_(TWR_CASH_TYPES)
        )
        .order_by(CashJournal.date)
        .all()
    )
    
    if not cash_flows:
        print("  No cash flows found for this period")
    else:
        print(f"{'Date':<12} {'Type':<15} {'Amount':>15} {'Description':<40}")
        print("-"*80)
        total_flows = Decimal("0")
        for cf in cash_flows:
            print(f"{cf.date} {cf.type:<15} {float(cf.amount):>15,.2f} {(cf.description or '')[:40]}")
            total_flows += cf.amount
        print("-"*80)
        print(f"{'TOTAL CASH FLOWS:':<27} {float(total_flows):>15,.2f}")
    
    # 4. Daily cash flow aggregates
    print("\n" + "-"*80)
    print("DAILY CASH FLOW AGGREGATES:")
    print("-"*80)
    
    daily_sums = (
        db.query(
            CashJournal.date,
            func.sum(CashJournal.amount).label("total"),
            func.count(CashJournal.cash_journal_id).label("count")
        )
        .filter(
            CashJournal.account_id == account.account_id,
            CashJournal.date.between(start, end),
            CashJournal.type.in_(TWR_CASH_TYPES)
        )
        .group_by(CashJournal.date)
        .order_by(CashJournal.date)
        .all()
    )
    
    if not daily_sums:
        print("  No daily aggregates found")
    else:
        print(f"{'Date':<12} {'# Transactions':>15} {'Total Amount':>15}")
        print("-"*80)
        for ds in daily_sums:
            print(f"{ds.date} {ds.count:>15} {float(ds.total):>15,.2f}")
    
    # 5. Manual TWR calculation verification
    print("\n" + "-"*80)
    print("MANUAL TWR CALCULATION VERIFICATION:")
    print("-"*80)
    
    if len(twr_rows) >= 2:
        first_row = twr_rows[0]
        last_row = twr_rows[-1]
        
        print(f"\nStart Date: {first_row.date}")
        print(f"  NAV: ${float(first_row.nav):,.2f}" if first_row.nav else "  NAV: N/A")
        
        print(f"\nEnd Date: {last_row.date}")
        print(f"  NAV: ${float(last_row.nav):,.2f}" if last_row.nav else "  NAV: N/A")
        print(f"  Cumulative TWR: {float(last_row.twr)*100:.4f}%" if last_row.twr else "  Cumulative TWR: N/A")
        
        # Calculate step-by-step
        print("\n" + "-"*80)
        print("STEP-BY-STEP HP CALCULATION:")
        print("-"*80)
        print(f"{'Date':<12} {'Formula':<60} {'HP %':>12}")
        print("-"*80)
        
        cumulative = Decimal("1")
        for i in range(1, len(twr_rows)):
            prev = twr_rows[i-1]
            curr = twr_rows[i]
            
            if prev.nav and curr.nav:
                start_nav = prev.nav
                cash_flow = curr.sum_cash_journal or Decimal("0")
                end_nav = curr.nav
                denominator = start_nav + cash_flow
                
                if denominator != 0:
                    hp = (end_nav - denominator) / denominator
                    cumulative *= (Decimal("1") + hp)
                    
                    formula = f"({float(end_nav):,.2f} - ({float(start_nav):,.2f} + {float(cash_flow):,.2f})) / {float(denominator):,.2f}"
                    print(f"{curr.date} {formula:<60} {float(hp)*100:>12.4f}")
        
        print("-"*80)
        print(f"Cumulative TWR Multiplier: {float(cumulative):.6f}")
        print(f"Cumulative TWR %: {float(cumulative - 1)*100:.4f}%")
    
    # 6. Expected vs Actual comparison
    print("\n" + "="*80)
    print("COMPARISON WITH IBKR REPORT:")
    print("="*80)
    print("\nFrom your IBKR report:")
    print("  Start NAV (2025-02-11): $293,781.60")
    print("  End NAV (2026-02-11): $277,276.31")
    print("  IBKR TWR: -32.98%")
    print("  Net Cash Flows: $124,400 deposits - $50,500 withdrawals = $73,900 net")
    
    if len(twr_rows) >= 2:
        calc_twr = float(twr_rows[-1].twr) * 100 if twr_rows[-1].twr else 0
        ibkr_twr = -32.98
        difference = calc_twr - ibkr_twr
        
        print(f"\nYour Calculated TWR: {calc_twr:.4f}%")
        print(f"Difference: {difference:.4f}%")
        
        if abs(difference) > 0.1:
            print("\n⚠️  SIGNIFICANT DISCREPANCY DETECTED")
            print("\nPossible causes:")
            print("  1. Missing cash flows in cash_journal table")
            print("  2. Incorrect cash flow types being counted")
            print("  3. Missing intermediate NAV data points")
            print("  4. Cash flows not assigned to correct dates")
            print("  5. Different calculation methodology than IBKR")
        else:
            print("\n✓ TWR calculation is within acceptable range")
    
    print("\n" + "="*80)
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Diagnose TWR calculation issues")
    parser.add_argument("--account-code", required=True, help="Account code (e.g., U1234567_USD)")
    parser.add_argument("--start-date", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", required=True, help="End date (YYYY-MM-DD)")
    
    args = parser.parse_args()
    
    analyze_twr_calculation(args.account_code, args.start_date, args.end_date)
