from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal
from datetime import date, datetime

from app.api import deps
from app.models.asset import Trades, CashJournal, FXTransaction, CorporateAction, Position
from app.models.portfolio import Account
from app.schemas.asset import (
    TradeBase, TradeRead, TradeCreate,
    CashJournalBase, CashJournalRead,
    FXTransactionBase, FXTransactionRead, FXTransactionCreate,
    CorporateActionBase, CorporateActionRead,
    PositionBase, PositionRead, PositionCreate,
    BulkTradesRequest, BulkFXTransactionsRequest, BulkPositionsRequest,
    BulkResponse
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


# Import CashJournalCreate for POST endpoints
from app.schemas.asset import CashJournalCreate


class BulkCashJournalRequest(BaseModel):
    """Schema for bulk cash journal creation."""
    entries: List[CashJournalCreate]


@router.post("/cash-journal/", response_model=CashJournalRead, status_code=201)
def create_cash_journal_entry(
    entry_in: CashJournalCreate,
    db: Session = Depends(deps.get_db)
):
    """
    Create a single cash journal entry.
    """
    # Validate account exists
    account = db.query(Account).filter(Account.account_id == entry_in.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {entry_in.account_id} not found")
    
    # Check for duplicate by reference_code
    if entry_in.reference_code:
        existing = db.query(CashJournal).filter(
            CashJournal.reference_code == entry_in.reference_code
        ).first()
        if existing:
            return existing
    
    # Create the entry
    try:
        db_entry = CashJournal(
            account_id=entry_in.account_id,
            asset_id=entry_in.asset_id,
            date=entry_in.date,
            ex_date=entry_in.ex_date,
            type=entry_in.type,
            amount=entry_in.amount,
            currency=entry_in.currency,
            quantity=entry_in.quantity,
            rate_per_share=entry_in.rate_per_share,
            description=entry_in.description,
            reference_code=entry_in.reference_code,
            extra_details=entry_in.extra_details,
            external_transaction_id=entry_in.external_transaction_id,
            action_id=entry_in.action_id
        )
        
        db.add(db_entry)
        db.commit()
        db.refresh(db_entry)
        return db_entry
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating cash journal entry: {str(e)}")


@router.post("/cash-journal/bulk", response_model=BulkResponse)
def create_cash_journal_bulk(
    request: BulkCashJournalRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Create multiple cash journal entries in bulk.
    Skips duplicates (based on reference_code) and continues on errors.
    """
    created_count = 0
    skipped_count = 0
    errors = []
    
    # Get existing reference_codes to check for duplicates
    existing_codes = set()
    if any(e.reference_code for e in request.entries):
        existing_entries = db.query(CashJournal.reference_code).filter(
            CashJournal.reference_code.isnot(None)
        ).all()
        existing_codes = {e.reference_code for e in existing_entries}
    
    for idx, entry_in in enumerate(request.entries):
        try:
            # Skip if duplicate
            if entry_in.reference_code and entry_in.reference_code in existing_codes:
                skipped_count += 1
                continue
            
            db_entry = CashJournal(
                account_id=entry_in.account_id,
                asset_id=entry_in.asset_id,
                date=entry_in.date,
                ex_date=entry_in.ex_date,
                type=entry_in.type,
                amount=entry_in.amount,
                currency=entry_in.currency,
                quantity=entry_in.quantity,
                rate_per_share=entry_in.rate_per_share,
                description=entry_in.description,
                reference_code=entry_in.reference_code,
                extra_details=entry_in.extra_details,
                external_transaction_id=entry_in.external_transaction_id,
                action_id=entry_in.action_id
            )
            
            db.add(db_entry)
            created_count += 1
            
            # Add to existing set to prevent duplicates within same batch
            if entry_in.reference_code:
                existing_codes.add(entry_in.reference_code)
                
        except Exception as e:
            errors.append({
                "index": idx,
                "error": str(e),
                "type": entry_in.type,
                "amount": str(entry_in.amount) if entry_in.amount else None
            })
    
    # Commit all at once
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return BulkResponse(
            status="error",
            total=len(request.entries),
            created=0,
            skipped=skipped_count,
            errors=[{"error": f"Commit failed: {str(e)}"}]
        )
    
    return BulkResponse(
        status="success" if not errors else "partial",
        total=len(request.entries),
        created=created_count,
        skipped=skipped_count,
        errors=errors[:10]
    )


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


# --------------------------------------------------------------------------
# TRADES - BULK OPERATIONS
# --------------------------------------------------------------------------

@router.post("/trades/", response_model=TradeRead, status_code=201)
def create_trade(
    trade_in: TradeCreate,
    db: Session = Depends(deps.get_db)
):
    """Create a single trade."""
    # Validate account exists
    account = db.query(Account).filter(Account.account_id == trade_in.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {trade_in.account_id} not found")
    
    # Check for duplicate by ib_transaction_id
    if trade_in.ib_transaction_id:
        existing = db.query(Trades).filter(
            Trades.ib_transaction_id == trade_in.ib_transaction_id
        ).first()
        if existing:
            return existing
    
    try:
        db_trade = Trades(
            account_id=trade_in.account_id,
            asset_id=trade_in.asset_id,
            ib_transaction_id=trade_in.ib_transaction_id,
            ib_exec_id=trade_in.ib_exec_id,
            ib_trade_id=trade_in.ib_trade_id,
            ib_order_id=trade_in.ib_order_id,
            trade_date=trade_in.trade_date,
            settlement_date=trade_in.settlement_date,
            report_date=trade_in.report_date,
            transaction_type=trade_in.transaction_type,
            side=trade_in.side,
            exchange=trade_in.exchange,
            quantity=trade_in.quantity,
            price=trade_in.price,
            gross_amount=trade_in.gross_amount,
            net_amount=trade_in.net_amount,
            proceeds=trade_in.proceeds,
            commission=trade_in.commission,
            tax=trade_in.tax,
            cost_basis=trade_in.cost_basis,
            realized_pnl=trade_in.realized_pnl,
            mtm_pnl=trade_in.mtm_pnl,
            multiplier=trade_in.multiplier,
            strike=trade_in.strike,
            expiry=trade_in.expiry,
            put_call=trade_in.put_call,
            currency=trade_in.currency,
            description=trade_in.description,
            notes=trade_in.notes
        )
        
        db.add(db_trade)
        db.commit()
        db.refresh(db_trade)
        return db_trade
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating trade: {str(e)}")


@router.post("/trades/bulk", response_model=BulkResponse)
def create_trades_bulk(
    request: BulkTradesRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Create multiple trades in bulk.
    Skips duplicates (based on ib_transaction_id) and continues on errors.
    """
    created_count = 0
    skipped_count = 0
    errors = []
    
    # Get existing ib_transaction_ids to check for duplicates
    existing_ids = set()
    if any(t.ib_transaction_id for t in request.trades):
        existing_trades = db.query(Trades.ib_transaction_id).filter(
            Trades.ib_transaction_id.isnot(None)
        ).all()
        existing_ids = {t.ib_transaction_id for t in existing_trades}
    
    for idx, trade_in in enumerate(request.trades):
        try:
            # Skip if duplicate
            if trade_in.ib_transaction_id and trade_in.ib_transaction_id in existing_ids:
                skipped_count += 1
                continue
            
            db_trade = Trades(
                account_id=trade_in.account_id,
                asset_id=trade_in.asset_id,
                ib_transaction_id=trade_in.ib_transaction_id,
                ib_exec_id=trade_in.ib_exec_id,
                ib_trade_id=trade_in.ib_trade_id,
                ib_order_id=trade_in.ib_order_id,
                trade_date=trade_in.trade_date,
                settlement_date=trade_in.settlement_date,
                report_date=trade_in.report_date,
                transaction_type=trade_in.transaction_type,
                side=trade_in.side,
                exchange=trade_in.exchange,
                quantity=trade_in.quantity,
                price=trade_in.price,
                gross_amount=trade_in.gross_amount,
                net_amount=trade_in.net_amount,
                proceeds=trade_in.proceeds,
                commission=trade_in.commission,
                tax=trade_in.tax,
                cost_basis=trade_in.cost_basis,
                realized_pnl=trade_in.realized_pnl,
                mtm_pnl=trade_in.mtm_pnl,
                multiplier=trade_in.multiplier,
                strike=trade_in.strike,
                expiry=trade_in.expiry,
                put_call=trade_in.put_call,
                currency=trade_in.currency,
                description=trade_in.description,
                notes=trade_in.notes
            )
            
            db.add(db_trade)
            created_count += 1
            
            # Add to existing set to prevent duplicates within same batch
            if trade_in.ib_transaction_id:
                existing_ids.add(trade_in.ib_transaction_id)
                
        except Exception as e:
            errors.append({
                "index": idx,
                "error": str(e),
                "ib_transaction_id": trade_in.ib_transaction_id
            })
    
    # Commit all at once
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return BulkResponse(
            status="error",
            total=len(request.trades),
            created=0,
            skipped=skipped_count,
            errors=[{"error": f"Commit failed: {str(e)}"}]
        )
    
    return BulkResponse(
        status="success" if not errors else "partial",
        total=len(request.trades),
        created=created_count,
        skipped=skipped_count,
        errors=errors[:10]
    )


# --------------------------------------------------------------------------
# FX TRANSACTIONS - BULK OPERATIONS  
# --------------------------------------------------------------------------

@router.post("/fx-transactions/", response_model=FXTransactionRead, status_code=201)
def create_fx_transaction(
    fx_in: FXTransactionCreate,
    db: Session = Depends(deps.get_db)
):
    """Create a single FX transaction."""
    # Validate account exists
    account = db.query(Account).filter(Account.account_id == fx_in.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {fx_in.account_id} not found")
    
    # Check for duplicate by ib_transaction_id
    if fx_in.ib_transaction_id:
        existing = db.query(FXTransaction).filter(
            FXTransaction.ib_transaction_id == fx_in.ib_transaction_id
        ).first()
        if existing:
            return existing
    
    try:
        db_fx = FXTransaction(
            account_id=fx_in.account_id,
            target_account_id=fx_in.target_account_id,
            trade_date=fx_in.trade_date,
            source_currency=fx_in.source_currency,
            source_amount=fx_in.source_amount,
            target_currency=fx_in.target_currency,
            target_amount=fx_in.target_amount,
            side=fx_in.side,
            exchange_rate=fx_in.exchange_rate,
            commission=fx_in.commission,
            commission_currency=fx_in.commission_currency,
            ib_transaction_id=fx_in.ib_transaction_id,
            ib_exec_id=fx_in.ib_exec_id,
            ib_order_id=fx_in.ib_order_id,
            exchange=fx_in.exchange,
            transaction_type=fx_in.transaction_type,
            notes=fx_in.notes,
            external_id=fx_in.external_id
        )
        
        db.add(db_fx)
        db.commit()
        db.refresh(db_fx)
        return db_fx
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating FX transaction: {str(e)}")


@router.post("/fx-transactions/bulk", response_model=BulkResponse)
def create_fx_transactions_bulk(
    request: BulkFXTransactionsRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Create multiple FX transactions in bulk.
    Skips duplicates (based on ib_transaction_id) and continues on errors.
    """
    created_count = 0
    skipped_count = 0
    errors = []
    
    # Get existing ib_transaction_ids to check for duplicates
    existing_ids = set()
    if any(f.ib_transaction_id for f in request.transactions):
        existing_fxs = db.query(FXTransaction.ib_transaction_id).filter(
            FXTransaction.ib_transaction_id.isnot(None)
        ).all()
        existing_ids = {f.ib_transaction_id for f in existing_fxs}
    
    for idx, fx_in in enumerate(request.transactions):
        try:
            # Skip if duplicate
            if fx_in.ib_transaction_id and fx_in.ib_transaction_id in existing_ids:
                skipped_count += 1
                continue
            
            db_fx = FXTransaction(
                account_id=fx_in.account_id,
                target_account_id=fx_in.target_account_id,
                trade_date=fx_in.trade_date,
                source_currency=fx_in.source_currency,
                source_amount=fx_in.source_amount,
                target_currency=fx_in.target_currency,
                target_amount=fx_in.target_amount,
                side=fx_in.side,
                exchange_rate=fx_in.exchange_rate,
                commission=fx_in.commission,
                commission_currency=fx_in.commission_currency,
                ib_transaction_id=fx_in.ib_transaction_id,
                ib_exec_id=fx_in.ib_exec_id,
                ib_order_id=fx_in.ib_order_id,
                exchange=fx_in.exchange,
                transaction_type=fx_in.transaction_type,
                notes=fx_in.notes,
                external_id=fx_in.external_id
            )
            
            db.add(db_fx)
            created_count += 1
            
            # Add to existing set to prevent duplicates within same batch
            if fx_in.ib_transaction_id:
                existing_ids.add(fx_in.ib_transaction_id)
                
        except Exception as e:
            errors.append({
                "index": idx,
                "error": str(e),
                "ib_transaction_id": fx_in.ib_transaction_id
            })
    
    # Commit all at once
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return BulkResponse(
            status="error",
            total=len(request.transactions),
            created=0,
            skipped=skipped_count,
            errors=[{"error": f"Commit failed: {str(e)}"}]
        )
    
    return BulkResponse(
        status="success" if not errors else "partial",
        total=len(request.transactions),
        created=created_count,
        skipped=skipped_count,
        errors=errors[:10]
    )


# --------------------------------------------------------------------------
# POSITIONS - BULK OPERATIONS
# --------------------------------------------------------------------------

@router.post("/positions/bulk", response_model=BulkResponse)
def create_positions_bulk(
    request: BulkPositionsRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Create or update multiple positions in bulk.
    Updates existing positions if same account_id/asset_id/report_date exists.
    """
    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []
    
    for idx, pos_in in enumerate(request.positions):
        try:
            # Check for existing position (same account, asset, date)
            existing = db.query(Position).filter(
                Position.account_id == pos_in.account_id,
                Position.asset_id == pos_in.asset_id,
                Position.report_date == pos_in.report_date
            ).first()
            
            if existing:
                # Update existing position
                existing.quantity = pos_in.quantity
                existing.mark_price = pos_in.mark_price
                existing.position_value = pos_in.position_value
                existing.cost_basis_money = pos_in.cost_basis_money
                existing.cost_basis_price = pos_in.cost_basis_price
                existing.open_price = pos_in.open_price
                existing.fifo_pnl_unrealized = pos_in.fifo_pnl_unrealized
                existing.percent_of_nav = pos_in.percent_of_nav
                existing.side = pos_in.side
                existing.level_of_detail = pos_in.level_of_detail
                existing.open_date_time = pos_in.open_date_time
                existing.vesting_date = pos_in.vesting_date
                existing.accrued_interest = pos_in.accrued_interest
                existing.fx_rate_to_base = pos_in.fx_rate_to_base
                
                updated_count += 1
            else:
                # Create new position
                db_position = Position(
                    account_id=pos_in.account_id,
                    asset_id=pos_in.asset_id,
                    report_date=pos_in.report_date,
                    quantity=pos_in.quantity,
                    mark_price=pos_in.mark_price,
                    position_value=pos_in.position_value,
                    cost_basis_money=pos_in.cost_basis_money,
                    cost_basis_price=pos_in.cost_basis_price,
                    open_price=pos_in.open_price,
                    fifo_pnl_unrealized=pos_in.fifo_pnl_unrealized,
                    percent_of_nav=pos_in.percent_of_nav,
                    side=pos_in.side,
                    level_of_detail=pos_in.level_of_detail,
                    open_date_time=pos_in.open_date_time,
                    vesting_date=pos_in.vesting_date,
                    accrued_interest=pos_in.accrued_interest,
                    fx_rate_to_base=pos_in.fx_rate_to_base
                )
                db.add(db_position)
                created_count += 1
                
        except Exception as e:
            errors.append({
                "index": idx,
                "error": str(e),
                "account_id": pos_in.account_id,
                "asset_id": pos_in.asset_id
            })
    
    # Commit all at once
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return BulkResponse(
            status="error",
            total=len(request.positions),
            created=0,
            updated=0,
            skipped=skipped_count,
            errors=[{"error": f"Commit failed: {str(e)}"}]
        )
    
    return BulkResponse(
        status="success" if not errors else "partial",
        total=len(request.positions),
        created=created_count,
        updated=updated_count,
        skipped=skipped_count,
        errors=errors[:10]
    )