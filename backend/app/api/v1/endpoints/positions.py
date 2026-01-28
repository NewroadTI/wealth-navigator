from typing import List, Any, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api import deps
from app.models.asset import Position
from app.models.portfolio import Account

from app.schemas.asset import PositionRead,AccountBalanceRead
# app/api/v1/endpoints/positions.py

router = APIRouter()
@router.get("/", response_model=List[PositionRead])
def get_positions(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[int] = None
):
    """
    Obtener lista de posiciones.
    Filtro opcional: account_id.
    """
    query = db.query(Position)
    
    if account_id is not None:
        query = query.filter(Position.account_id == account_id)
    
    positions = query.offset(skip).limit(limit).all()
    return positions

@router.get("/account-balances", response_model=List[AccountBalanceRead])
def get_account_balances(
    db: Session = Depends(deps.get_db),
    account_ids: Optional[List[int]] = Query(None)
):
    """
    Obtener el balance agregado por cuenta.
    Balance = SUM(quantity * mark_price) para todas las posiciones de la cuenta.
    
    Si se proporcionan account_ids, solo retorna balances para esas cuentas.
    Si no se proporcionan, retorna balances para todas las cuentas con posiciones.
    """
    # Query base: agrupar por account_id y calcular suma
    query = db.query(
        Position.account_id,
        func.sum(Position.quantity * Position.mark_price).label('balance'),
        func.count(Position.position_id).label('position_count')
    ).group_by(Position.account_id)
    
    # Filtrar por account_ids si se proporcionan
    if account_ids:
        query = query.filter(Position.account_id.in_(account_ids))
    
    results = query.all()
    
    # Convertir a lista de diccionarios
    balances = []
    for row in results:
        balances.append({
            "account_id": row.account_id,
            "balance": row.balance or Decimal(0),
            "position_count": row.position_count
        })
    
    return balances

@router.get("/", response_model=List[PositionRead])
def read_positions(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    account_id: int | None = None  # Filtro opcional por cuenta
) -> Any:
    """
    Recuperar posiciones.
    """
    query = db.query(Position)
    
    # Si quieres filtrar por cuenta específica (útil en el futuro)
    if account_id:
        query = query.filter(Position.account_id == account_id)
        
    positions = query.offset(skip).limit(limit).all()
    return positions

@router.get("/{position_id}", response_model=PositionRead)
def read_position_by_id(
    position_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Obtener una posición específica por ID.
    """
    position = db.query(Position).filter(Position.position_id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    return position







