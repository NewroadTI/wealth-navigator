from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.models.asset import Trades, CashJournal, FXTransaction, CorporateAction
from app.schemas.asset import (TradeBase, TradeRead, CashJournalBase,CashJournalRead,FXTransactionBase, FXTransactionRead,CorporateActionBase, CorporateActionRead) # Importamos el archivo que creamos arriba

router = APIRouter()

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