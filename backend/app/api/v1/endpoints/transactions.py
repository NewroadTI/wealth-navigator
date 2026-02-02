from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal
from datetime import date

from app.api import deps
from app.models.asset import Trades, CashJournal, FXTransaction, CorporateAction
from app.models.portfolio import Account
from app.schemas.asset import (
    TradeBase, TradeRead, 
    CashJournalBase, CashJournalRead,
    FXTransactionBase, FXTransactionRead,
    CorporateActionBase, CorporateActionRead
)

router = APIRouter()


# ==========================================================================
# SCHEMAS FOR CREATE OPERATIONS
# ==========================================================================

class CorporateActionCreate(BaseModel):
    """Schema for creating a corporate action."""
    account_id: int
    asset_id: Optional[int] = None
    ib_action_id: Optional[str] = None
    transaction_id: Optional[str] = None
    action_type: Optional[str] = None
    report_date: Optional[date] = None
    execution_date: Optional[date] = None
    description: Optional[str] = None
    ratio_old: Optional[Decimal] = None
    ratio_new: Optional[Decimal] = None
    quantity_adjustment: Optional[Decimal] = None
    symbol: Optional[str] = None
    isin: Optional[str] = None
    cusip: Optional[str] = None
    security_id: Optional[str] = None
    security_id_type: Optional[str] = None
    amount: Optional[Decimal] = None
    proceeds: Optional[Decimal] = None
    value: Optional[Decimal] = None
    fifo_pnl_realized: Optional[Decimal] = None
    mtm_pnl: Optional[Decimal] = None
    currency: Optional[str] = None


class BulkCorporateActionsRequest(BaseModel):
    """Schema for bulk corporate actions creation."""
    actions: List[CorporateActionCreate]


class BulkResponse(BaseModel):
    """Response for bulk operations."""
    status: str
    total: int
    created: int
    skipped: int
    errors: List[dict] = []

# --------------------------------------------------------------------------
# TRADES
# --------------------------------------------------------------------------
@router.get("/trades", response_model=List[TradeRead])
def read_trades(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[int] = None,
    symbol: Optional[str] = None
):
    """
    Obtener lista de Trades. 
    Opcional: filtrar por cuenta o asset symbol.
    """
    query = db.query(Trades)
    
    if account_id:
        query = query.filter(Trades.account_id == account_id)
    
    # Si quieres filtrar por símbolo, necesitas un join o subquery, 
    # pero para mantenerlo simple y rápido, filtramos por asset_id si lo tienes, 
    # o hacemos el join:
    if symbol:
        from app.models.asset import Asset
        query = query.join(Asset).filter(Asset.symbol == symbol)

    # Ordenar por fecha descendente
    trades = query.order_by(Trades.trade_date.desc()).offset(skip).limit(limit).all()
    return trades

@router.get("/trades/{trade_id}", response_model=TradeRead)
def read_trade_by_id(trade_id: int, db: Session = Depends(deps.get_db)):
    trade = db.query(Trades).filter(Trades.transaction_id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade

# --------------------------------------------------------------------------
# CASH JOURNAL
# --------------------------------------------------------------------------
@router.get("/cash-journal", response_model=List[CashJournalRead])
def read_cash_journal(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[int] = None,
    type: Optional[str] = None
):
    """
    Obtener movimientos de caja (Dividendos, Intereses, Fees).
    """
    query = db.query(CashJournal)
    
    if account_id:
        query = query.filter(CashJournal.account_id == account_id)
    if type:
        query = query.filter(CashJournal.type == type)
        
    records = query.order_by(CashJournal.date.desc()).offset(skip).limit(limit).all()
    return records

# --------------------------------------------------------------------------
# FX TRANSACTIONS
# --------------------------------------------------------------------------
@router.get("/fx-transactions", response_model=List[FXTransactionRead])
def read_fx_transactions(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[int] = None
):
    """
    Obtener transacciones de Forex.
    Si se pasa account_id, busca tanto en source como en target.
    """
    query = db.query(FXTransaction)
    
    if account_id:
        # Buscar donde la cuenta sea origen O destino
        from sqlalchemy import or_
        query = query.filter(
            or_(
                FXTransaction.account_id == account_id,
                FXTransaction.target_account_id == account_id
            )
        )
        
    fxs = query.order_by(FXTransaction.trade_date.desc()).offset(skip).limit(limit).all()
    return fxs

# --------------------------------------------------------------------------
# CORPORATE ACTIONS
# --------------------------------------------------------------------------
@router.get("/corporate-actions", response_model=List[CorporateActionRead])
def read_corporate_actions(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[int] = None
):
    """
    Obtener acciones corporativas (Splits, Spinoffs, Mergers).
    """
    query = db.query(CorporateAction)
    
    if account_id:
        query = query.filter(CorporateAction.account_id == account_id)
        
    actions = query.order_by(CorporateAction.report_date.desc()).offset(skip).limit(limit).all()
    return actions


@router.post("/corporate-actions/", response_model=CorporateActionRead, status_code=201)
def create_corporate_action(
    action_in: CorporateActionCreate,
    db: Session = Depends(deps.get_db)
):
    """
    Create a single corporate action.
    """
    # Validate account exists
    account = db.query(Account).filter(Account.account_id == action_in.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {action_in.account_id} not found")
    
    # Check for duplicate (by ib_action_id if provided)
    if action_in.ib_action_id:
        existing = db.query(CorporateAction).filter(
            CorporateAction.ib_action_id == action_in.ib_action_id
        ).first()
        if existing:
            # Return existing record instead of creating duplicate
            return existing
    
    # Create the corporate action
    try:
        db_action = CorporateAction(
            account_id=action_in.account_id,
            asset_id=action_in.asset_id,
            ib_action_id=action_in.ib_action_id,
            transaction_id=action_in.transaction_id,
            action_type=action_in.action_type,
            report_date=action_in.report_date,
            execution_date=action_in.execution_date,
            description=action_in.description,
            ratio_old=action_in.ratio_old,
            ratio_new=action_in.ratio_new,
            quantity_adjustment=action_in.quantity_adjustment,
            symbol=action_in.symbol,
            isin=action_in.isin,
            cusip=action_in.cusip,
            security_id=action_in.security_id,
            security_id_type=action_in.security_id_type,
            amount=action_in.amount,
            proceeds=action_in.proceeds,
            value=action_in.value,
            fifo_pnl_realized=action_in.fifo_pnl_realized,
            mtm_pnl=action_in.mtm_pnl,
            currency=action_in.currency
        )
        
        db.add(db_action)
        db.commit()
        db.refresh(db_action)
        return db_action
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating corporate action: {str(e)}")


@router.post("/corporate-actions/bulk", response_model=BulkResponse)
def create_corporate_actions_bulk(
    request: BulkCorporateActionsRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Create multiple corporate actions in bulk.
    Skips duplicates (based on ib_action_id) and continues on errors.
    """
    created_count = 0
    skipped_count = 0
    errors = []
    
    # Get existing ib_action_ids to check for duplicates
    existing_ids = set()
    if any(a.ib_action_id for a in request.actions):
        existing_actions = db.query(CorporateAction.ib_action_id).filter(
            CorporateAction.ib_action_id.isnot(None)
        ).all()
        existing_ids = {a.ib_action_id for a in existing_actions}
    
    for idx, action_in in enumerate(request.actions):
        try:
            # Skip if duplicate
            if action_in.ib_action_id and action_in.ib_action_id in existing_ids:
                skipped_count += 1
                continue
            
            # Validate account exists (batch validate for efficiency)
            db_action = CorporateAction(
                account_id=action_in.account_id,
                asset_id=action_in.asset_id,
                ib_action_id=action_in.ib_action_id,
                transaction_id=action_in.transaction_id,
                action_type=action_in.action_type,
                report_date=action_in.report_date,
                execution_date=action_in.execution_date,
                description=action_in.description,
                ratio_old=action_in.ratio_old,
                ratio_new=action_in.ratio_new,
                quantity_adjustment=action_in.quantity_adjustment,
                symbol=action_in.symbol,
                isin=action_in.isin,
                cusip=action_in.cusip,
                security_id=action_in.security_id,
                security_id_type=action_in.security_id_type,
                amount=action_in.amount,
                proceeds=action_in.proceeds,
                value=action_in.value,
                fifo_pnl_realized=action_in.fifo_pnl_realized,
                mtm_pnl=action_in.mtm_pnl,
                currency=action_in.currency
            )
            
            db.add(db_action)
            created_count += 1
            
            # Add to existing set to prevent duplicates within same batch
            if action_in.ib_action_id:
                existing_ids.add(action_in.ib_action_id)
                
        except Exception as e:
            errors.append({
                "index": idx,
                "error": str(e),
                "description": action_in.description[:100] if action_in.description else None
            })
    
    # Commit all at once
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return BulkResponse(
            status="error",
            total=len(request.actions),
            created=0,
            skipped=skipped_count,
            errors=[{"error": f"Commit failed: {str(e)}"}]
        )
    
    return BulkResponse(
        status="success" if not errors else "partial",
        total=len(request.actions),
        created=created_count,
        skipped=skipped_count,
        errors=errors[:10]  # Limit errors in response
    )