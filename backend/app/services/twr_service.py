"""
TWR (Time-Weighted Return) Calculation Service
===============================================
Provides functions for computing and managing TWR data per portfolio/account.
Only tracks _USD accounts (main accounts; other currencies are virtual).
"""

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.portfolio import Portfolio, Account, TWRDaily
from app.models.asset import CashJournal, ETLSyncStatus

logger = logging.getLogger(__name__)

# Cash journal types relevant to TWR external cash flows
TWR_CASH_TYPES = (
    'DEPOSIT', 'WITHDRAWAL', 'TRNSFROUT', 'TRNSFIN',
    'ACATIN', 'ACATOUT', 'ACATOUTCNCL'
)


def _get_usd_account_ids(db: Session, portfolio_id: int) -> List[int]:
    """Get only the _USD account IDs for a portfolio (main accounts for TWR)."""
    accounts = (
        db.query(Account)
        .filter(
            Account.portfolio_id == portfolio_id,
            Account.account_code.like('%_USD'),
        )
        .all()
    )
    return [a.account_id for a in accounts]


def _calculate_twr_for_account(db: Session, account_id: int, cutoff_date: date = None, debug: bool = False):
    """
    Calculate daily HP and cumulative TWR for one account.

    HP = (End_NAV - (Start_NAV + CashFlow)) / (Start_NAV + CashFlow)
    TWR = product(1 + HP_i) - 1
    """
    rows = (
        db.query(TWRDaily)
        .filter(TWRDaily.account_id == account_id)
        .order_by(TWRDaily.date.asc())
        .all()
    )

    if len(rows) < 2:
        if debug:
            logger.info(f"[TWR DEBUG] Account {account_id}: Not enough rows ({len(rows)}) for TWR calculation")
        return

    if cutoff_date is None:
        cutoff_date = rows[0].date

    window = [r for r in rows if r.date >= cutoff_date]
    if len(window) < 2:
        if debug:
            logger.info(f"[TWR DEBUG] Account {account_id}: Not enough rows in window after cutoff {cutoff_date}")
        return

    if debug:
        logger.info(f"[TWR DEBUG] Account {account_id}: Starting calculation from {cutoff_date}, {len(window)} rows in window")

    cumulative_twr = Decimal("1")

    for i, row in enumerate(window):
        row.initial_hp_date = cutoff_date

        if i == 0:
            row.hp = None
            row.twr = Decimal("0")
            if debug:
                logger.info(f"[TWR DEBUG] {row.date}: Initial row - NAV={row.nav}, HP=None, TWR=0.0000%")
            continue

        prev = window[i - 1]
        if prev.nav is None or row.nav is None:
            if debug:
                logger.warning(f"[TWR DEBUG] {row.date}: Skipping - missing NAV data (prev={prev.nav}, current={row.nav})")
            continue

        start_nav = prev.nav
        cash_flow = row.sum_cash_journal or Decimal("0")
        end_nav = row.nav

        denominator = start_nav + cash_flow
        if denominator == 0:
            row.hp = Decimal("0")
            if debug:
                logger.warning(f"[TWR DEBUG] {row.date}: Zero denominator - HP set to 0")
        else:
            row.hp = (end_nav - denominator) / denominator

        cumulative_twr *= (Decimal("1") + row.hp)
        row.twr = cumulative_twr - Decimal("1")

        if debug:
            logger.info(
                f"[TWR DEBUG] {row.date}: "
                f"NAV={float(end_nav):,.2f}, "
                f"PrevNAV={float(start_nav):,.2f}, "
                f"CashFlow={float(cash_flow):,.2f}, "
                f"Denominator={float(denominator):,.2f}, "
                f"HP={float(row.hp)*100:.4f}%, "
                f"CumulativeMultiplier={float(cumulative_twr):.6f}, "
                f"TWR={float(row.twr)*100:.4f}%"
            )

    db.flush()


def upsert_nav_batch(db: Session, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Upsert NAV rows into twr_daily from a batch of
    {account_code: str, date: date, nav: float}.
    Resolves account_code to account_id. Only processes _USD accounts.
    """
    stats = {
        "records_created": 0,
        "records_updated": 0,
        "records_failed": 0,
        "missing_accounts": [],
    }

    # Build account_code → account_id cache
    all_accounts = db.query(Account).filter(Account.account_code.like('%_USD')).all()
    acc_map = {a.account_code: a.account_id for a in all_accounts}

    missing_set = set()

    for entry in rows:
        account_code = entry["account_code"]
        account_id = acc_map.get(account_code)
        if not account_id:
            if account_code not in missing_set:
                missing_set.add(account_code)
            stats["records_failed"] += 1
            continue

        nav_date = entry["date"]
        nav = Decimal(str(entry["nav"]))

        existing = (
            db.query(TWRDaily)
            .filter(
                TWRDaily.account_id == account_id,
                TWRDaily.date == nav_date,
            )
            .first()
        )
        if existing:
            existing.nav = nav
            existing.updated_at = func.now()
            stats["records_updated"] += 1
        else:
            new_row = TWRDaily(
                account_id=account_id,
                date=nav_date,
                nav=nav,
                sum_cash_journal=Decimal("0"),
            )
            db.add(new_row)
            stats["records_created"] += 1

    db.flush()
    db.commit()

    stats["missing_accounts"] = list(missing_set)
    return stats


def fill_cash_and_calculate(db: Session) -> Dict[str, Any]:
    """
    Fill sum_cash_journal from cash_journal table and calculate TWR
    for ALL accounts that have twr_daily rows.
    Called after NAV data has been upserted.
    """
    stats = {"cash_journal_filled": 0, "twr_calculated": 0}

    # Get distinct account IDs that have twr_daily rows (only _USD)
    account_ids = (
        db.query(TWRDaily.account_id)
        .distinct()
        .all()
    )

    for (account_id,) in account_ids:
        # Check this is a _USD account
        acc = db.query(Account).filter(Account.account_id == account_id).first()
        if not acc or not acc.account_code.endswith('_USD'):
            continue

        twr_rows = (
            db.query(TWRDaily)
            .filter(TWRDaily.account_id == account_id)
            .order_by(TWRDaily.date.asc())
            .all()
        )
        dates = [r.date for r in twr_rows]
        if not dates:
            continue

        # Fill cash journal sums
        sums = (
            db.query(
                CashJournal.date,
                func.sum(CashJournal.amount).label("total"),
            )
            .filter(
                CashJournal.account_id == account_id,
                CashJournal.date.in_(dates),
                CashJournal.type.in_(TWR_CASH_TYPES),
            )
            .group_by(CashJournal.date)
            .all()
        )
        sum_map = {s.date: s.total for s in sums}
        for row in twr_rows:
            row.sum_cash_journal = sum_map.get(row.date, Decimal("0"))
            stats["cash_journal_filled"] += 1

        # Calculate TWR (use account's own cutoff date)
        cutoff = acc.twr_cutoff_date

        _calculate_twr_for_account(db, account_id, cutoff_date=cutoff)
        stats["twr_calculated"] += len([r for r in twr_rows if r.twr is not None])

    db.commit()
    return stats


def get_expected_last_business_day(today: date = None) -> date:
    """
    Returns the expected last complete data day:
    - If today is Monday → last Friday
    - Otherwise → yesterday
    """
    today = today or date.today()
    weekday = today.weekday()  # 0=Mon, 6=Sun
    if weekday == 0:  # Monday
        return today - timedelta(days=3)
    elif weekday == 6:  # Sunday
        return today - timedelta(days=2)
    else:
        return today - timedelta(days=1)


def get_twr_sync_status(db: Session, portfolio_id: int) -> Dict[str, Any]:
    """
    Check the TWR sync status for a portfolio.
    Returns:
      - is_synced: True if the latest twr_daily row covers the expected last business day
      - last_complete_date: The most recent date with completed TWR
      - expected_date: The expected last business day
      - missing_etl_jobs: List of jobs that need to run before TWR can be calculated
      - accounts_status: Per-account status
    """
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not portfolio:
        return {"error": "Portfolio not found"}

    account_ids = _get_usd_account_ids(db, portfolio_id)
    if not account_ids:
        return {
            "is_synced": False,
            "last_complete_date": None,
            "expected_date": str(get_expected_last_business_day()),
            "missing_etl_jobs": [],
            "accounts_status": [],
            "message": "No USD accounts in portfolio"
        }

    expected_date = get_expected_last_business_day()

    # Check which ETL jobs have successful runs
    missing_jobs = []
    for job_type in ["TRANSACCIONES", "TRANSFERS", "NLV_HISTORY"]:
        sync = (
            db.query(ETLSyncStatus)
            .filter(ETLSyncStatus.report_type == job_type)
            .first()
        )
        if not sync or sync.last_run_status != "success":
            missing_jobs.append(job_type)

    # Per-account status
    accounts_status = []
    overall_synced = True

    for acc_id in account_ids:
        # Latest row with TWR calculated (not null)
        last_row = (
            db.query(TWRDaily)
            .filter(
                TWRDaily.account_id == acc_id,
                TWRDaily.twr.isnot(None),
            )
            .order_by(TWRDaily.date.desc())
            .first()
        )

        # Latest row with nav filled
        last_nav_row = (
            db.query(TWRDaily)
            .filter(
                TWRDaily.account_id == acc_id,
                TWRDaily.nav.isnot(None),
            )
            .order_by(TWRDaily.date.desc())
            .first()
        )

        last_complete = last_row.date if last_row else None
        last_nav = last_nav_row.date if last_nav_row else None
        is_account_synced = last_complete is not None and last_complete >= expected_date

        if not is_account_synced:
            overall_synced = False

        account = db.query(Account).filter(Account.account_id == acc_id).first()
        accounts_status.append({
            "account_id": acc_id,
            "account_code": account.account_code if account else str(acc_id),
            "last_twr_date": str(last_complete) if last_complete else None,
            "last_nav_date": str(last_nav) if last_nav else None,
            "is_synced": is_account_synced,
        })

    return {
        "is_synced": overall_synced and len(missing_jobs) == 0,
        "last_complete_date": str(
            max((s["last_twr_date"] for s in accounts_status if s["last_twr_date"]), default=None)
        ) if accounts_status else None,
        "expected_date": str(expected_date),
        "missing_etl_jobs": missing_jobs,
        "accounts_status": accounts_status,
        "cutoff_date": str(portfolio.twr_cutoff_date) if portfolio.twr_cutoff_date else None,
    }


def get_twr_series(
    db: Session,
    account_id: int,
    start_date: date = None,
    end_date: date = None,
) -> List[Dict[str, Any]]:
    """
    Get the TWR time series for a single account.
    If account has twr_cutoff_date set, uses it as start.
    """
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        return []

    cutoff = start_date or account.twr_cutoff_date

    query = (
        db.query(TWRDaily)
        .filter(
            TWRDaily.account_id == account_id,
            TWRDaily.twr.isnot(None),
        )
    )
    if cutoff:
        query = query.filter(TWRDaily.date >= cutoff)
    if end_date:
        query = query.filter(TWRDaily.date <= end_date)

    rows = query.order_by(TWRDaily.date.asc()).all()

    series = []
    for r in rows:
        series.append({
            "date": str(r.date),  
            "twr": round(float(r.twr) * 100, 4),  # As percentage
            "nav": round(float(r.nav or 0), 2),
        })

    return series


def get_portfolio_usd_accounts(db: Session, portfolio_id: int) -> List[Dict[str, Any]]:
    """
    Get all USD accounts for a portfolio with their TWR status.
    Used by frontend to render multiple TWR charts/tables.
    """
    accounts = (
        db.query(Account)
        .filter(
            Account.portfolio_id == portfolio_id,
            Account.account_code.like('%_USD'),
        )
        .order_by(Account.account_code.asc())
        .all()
    )

    result = []
    for acc in accounts:
        # Get latest TWR data point
        last_twr_row = (
            db.query(TWRDaily)
            .filter(
                TWRDaily.account_id == acc.account_id,
                TWRDaily.twr.isnot(None),
            )
            .order_by(TWRDaily.date.desc())
            .first()
        )

        result.append({
            "account_id": acc.account_id,
            "account_code": acc.account_code,
            "account_alias": acc.account_alias,
            "currency": acc.currency,
            "twr_cutoff_date": str(acc.twr_cutoff_date) if acc.twr_cutoff_date else None,
            "last_twr_date": str(last_twr_row.date) if last_twr_row else None,
            "last_twr_value": round(float(last_twr_row.twr) * 100, 4) if last_twr_row and last_twr_row.twr else None,
            "last_nav": round(float(last_twr_row.nav), 2) if last_twr_row and last_twr_row.nav else None,
        })

    return result


def recalculate_twr(db: Session, account_id: int, debug: bool = False) -> Dict[str, Any]:
    """
    Recalculate TWR for a single account.
    Uses the account's twr_cutoff_date as the initial HP date.
    Set debug=True to get detailed logging of calculation steps.
    """
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        return {"error": "Account not found"}

    cutoff = account.twr_cutoff_date

    if debug:
        logger.info(f"[TWR DEBUG] ===== Recalculating TWR for account {account_id} ({account.account_code}) =====")
        logger.info(f"[TWR DEBUG] Cutoff date: {cutoff}")

    # First refill cash journal sums for this account
    twr_rows = (
        db.query(TWRDaily)
        .filter(TWRDaily.account_id == account_id)
        .order_by(TWRDaily.date.asc())
        .all()
    )
    dates = [r.date for r in twr_rows]
    
    if debug:
        logger.info(f"[TWR DEBUG] Found {len(twr_rows)} twr_daily rows, date range: {min(dates) if dates else 'N/A'} to {max(dates) if dates else 'N/A'}")
    
    if dates:
        sums = (
            db.query(
                CashJournal.date,
                func.sum(CashJournal.amount).label("total"),
            )
            .filter(
                CashJournal.account_id == account_id,
                CashJournal.date.in_(dates),
                CashJournal.type.in_(TWR_CASH_TYPES),
            )
            .group_by(CashJournal.date)
            .all()
        )
        sum_map = {s.date: s.total for s in sums}
        
        if debug:
            logger.info(f"[TWR DEBUG] Found cash flows for {len(sum_map)} dates")
            for flow_date, flow_amount in sorted(sum_map.items()):
                logger.info(f"[TWR DEBUG] Cash flow on {flow_date}: ${float(flow_amount):,.2f}")
        
        for row in twr_rows:
            old_sum = row.sum_cash_journal
            row.sum_cash_journal = sum_map.get(row.date, Decimal("0"))
            if debug and old_sum != row.sum_cash_journal:
                logger.info(f"[TWR DEBUG] Updated cash flow for {row.date}: ${float(old_sum or 0):,.2f} -> ${float(row.sum_cash_journal):,.2f}")

    # Recalculate TWR with debug logging
    _calculate_twr_for_account(db, account_id, cutoff_date=cutoff, debug=debug)
    total_calculated = len([r for r in twr_rows if r.twr is not None])

    db.commit()

    if debug:
        logger.info(f"[TWR DEBUG] ===== Calculation complete: {total_calculated} rows with TWR calculated =====")

    return {
        "message": "TWR recalculated successfully",
        "twr_calculated": total_calculated,
        "cutoff_date": str(cutoff) if cutoff else None,
    }


def update_cutoff_date(db: Session, account_id: int, new_cutoff: date) -> Dict[str, Any]:
    """
    Update the TWR cutoff date for an account and recalculate
    all twr_daily rows from that date onward.
    """
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        return {"error": "Account not found"}

    account.twr_cutoff_date = new_cutoff
    db.flush()

    # Update initial_hp_date on all affected twr_daily rows
    (
        db.query(TWRDaily)
        .filter(
            TWRDaily.account_id == account_id,
            TWRDaily.date >= new_cutoff,
        )
        .update({"initial_hp_date": new_cutoff}, synchronize_session="fetch")
    )

    # Recalculate TWR
    result = recalculate_twr(db, account_id)
    result["cutoff_date"] = str(new_cutoff)
    return result


def get_twr_table(
    db: Session,
    portfolio_id: int,
    account_id: int = None,
    page: int = 1,
    page_size: int = 50,
) -> Dict[str, Any]:
    """
    Get the TWR daily table data (editable view) for a portfolio or specific account.
    """
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not portfolio:
        return {"error": "Portfolio not found"}

    if account_id:
        target_ids = [account_id]
    else:
        target_ids = _get_usd_account_ids(db, portfolio_id)

    total = (
        db.query(func.count(TWRDaily.twr_daily_id))
        .filter(TWRDaily.account_id.in_(target_ids))
        .scalar()
    )

    rows = (
        db.query(TWRDaily)
        .filter(TWRDaily.account_id.in_(target_ids))
        .order_by(TWRDaily.date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "twr_daily_id": r.twr_daily_id,
                "account_id": r.account_id,
                "date": str(r.date),
                "nav": float(r.nav) if r.nav is not None else None,
                "sum_cash_journal": float(r.sum_cash_journal) if r.sum_cash_journal is not None else None,
                "twr": round(float(r.twr) * 100, 4) if r.twr is not None else None,
                "hp": round(float(r.hp) * 100, 4) if r.hp is not None else None,
                "initial_hp_date": str(r.initial_hp_date) if r.initial_hp_date else None,
                "is_complete": r.nav is not None and r.twr is not None,
            }
            for r in rows
        ],
    }
