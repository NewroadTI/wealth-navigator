"""
TWR (Time-Weighted Return) API Endpoints
==========================================
Provides endpoints for TWR data, sync status, recalculation, and configuration.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date

from app.api import deps
from app.schemas.twr import (
    TWRSeriesResponse,
    TWRStatusResponse,
    TWRTableResponse,
    TWRRecalculateResponse,
    CutoffDateUpdate,
    CutoffDateResponse,
    TWRDailyUpdate,
    TWRNavUpsertBatch,
    TWRNavUpsertResponse,
    TWRFillAndCalculateResponse,
)
from app.services.twr_service import (
    get_twr_sync_status,
    get_twr_series,
    get_portfolio_usd_accounts,
    recalculate_twr,
    update_cutoff_date,
    get_twr_table,
    upsert_nav_batch,
    fill_cash_and_calculate,
)
from app.models.portfolio import TWRDaily

router = APIRouter()


@router.get("/account/{account_id}/series", response_model=TWRSeriesResponse)
def twr_series(
    account_id: int,
    start_date: Optional[date] = Query(None, description="Override start date"),
    end_date: Optional[date] = Query(None, description="Override end date"),
    db: Session = Depends(deps.get_db),
):
    """Get TWR time series for a single account."""
    data = get_twr_series(db, account_id, start_date=start_date, end_date=end_date)
    from app.models.portfolio import Account
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return TWRSeriesResponse(
        portfolio_id=account.portfolio_id,
        cutoff_date=str(account.twr_cutoff_date) if account.twr_cutoff_date else None,
        data=data,
    )


@router.get("/portfolio/{portfolio_id}/accounts")
def portfolio_accounts(
    portfolio_id: int,
    db: Session = Depends(deps.get_db),
):
    """Get all USD accounts for a portfolio with their TWR info."""
    accounts = get_portfolio_usd_accounts(db, portfolio_id)
    return {"accounts": accounts}


@router.get("/{portfolio_id}/status", response_model=TWRStatusResponse)
def twr_status(
    portfolio_id: int,
    db: Session = Depends(deps.get_db),
):
    """Check TWR sync status for a portfolio."""
    result = get_twr_sync_status(db, portfolio_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/{portfolio_id}/table", response_model=TWRTableResponse)
def twr_table(
    portfolio_id: int,
    account_id: int = Query(..., description="Account ID (required for per-account tables)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(deps.get_db),
):
    """Get paginated TWR daily table for an account."""
    result = get_twr_table(db, portfolio_id, account_id=account_id, page=page, page_size=page_size)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/account/{account_id}/recalculate", response_model=TWRRecalculateResponse)
def twr_recalculate(
    account_id: int,
    debug: bool = Query(False, description="Enable detailed debug logging"),
    db: Session = Depends(deps.get_db),
):
    """
    Recalculate TWR for a single account.
    Set debug=true to get detailed calculation logs in the server output.
    """
    result = recalculate_twr(db, account_id, debug=debug)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.put("/account/{account_id}/cutoff-date", response_model=CutoffDateResponse)
def twr_update_cutoff(
    account_id: int,
    body: CutoffDateUpdate,
    db: Session = Depends(deps.get_db),
):
    """Update the TWR cutoff date (inception/contract date) for an account."""
    result = update_cutoff_date(db, account_id, body.cutoff_date)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    from app.models.portfolio import Account
    account = db.query(Account).filter(Account.account_id == account_id).first()
    portfolio_id = account.portfolio_id if account else None
    
    return CutoffDateResponse(
        portfolio_id=portfolio_id,
        cutoff_date=str(body.cutoff_date),
        message=result.get("message", "Cutoff date updated"),
        twr_calculated=result.get("twr_calculated", 0),
    )


@router.patch("/row/{twr_daily_id}")
def twr_update_row(
    twr_daily_id: int,
    body: TWRDailyUpdate,
    db: Session = Depends(deps.get_db),
):
    """Manually edit a TWR daily row (e.g. override NAV or cash journal)."""
    row = db.query(TWRDaily).filter(TWRDaily.twr_daily_id == twr_daily_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="TWR row not found")

    if body.nav is not None:
        row.nav = body.nav
    if body.sum_cash_journal is not None:
        row.sum_cash_journal = body.sum_cash_journal

    db.commit()
    db.refresh(row)

    return {
        "message": "Row updated. Run recalculate to recompute TWR.",
        "twr_daily_id": row.twr_daily_id,
        "date": str(row.date),
        "nav": float(row.nav) if row.nav else None,
        "sum_cash_journal": float(row.sum_cash_journal) if row.sum_cash_journal else None,
    }


@router.post("/upsert-nav-batch", response_model=TWRNavUpsertResponse)
def twr_upsert_nav_batch_endpoint(
    body: TWRNavUpsertBatch,
    db: Session = Depends(deps.get_db),
):
    """Bulk upsert NAV values into twr_daily. Used by the NLV_HISTORY ETL processor."""
    rows = [
        {"account_code": r.account_code, "date": r.date, "nav": r.nav}
        for r in body.rows
    ]
    return upsert_nav_batch(db, rows)


@router.post("/fill-and-calculate", response_model=TWRFillAndCalculateResponse)
def twr_fill_and_calculate_endpoint(
    db: Session = Depends(deps.get_db),
):
    """
    Fill cash journal sums and calculate TWR for all accounts with twr_daily data.
    Call this after uploading NAV data via upsert-nav-batch.
    """
    result = fill_cash_and_calculate(db)
    return TWRFillAndCalculateResponse(
        message="Fill and calculate completed",
        cash_journal_filled=result["cash_journal_filled"],
        twr_calculated=result["twr_calculated"],
    )
