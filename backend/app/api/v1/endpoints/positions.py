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
    limit: int = Query(100, le=50000, description="Maximum 50000 records per request"),
    account_id: Optional[int] = None
):
    """
    Obtener lista de posiciones.
    Filtro opcional: account_id.
    Límite máximo: 50000 registros por request.
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


@router.get("/check")
def check_position_exists(
    account_id: int = Query(...),
    asset_id: int = Query(...),
    report_date: str = Query(...),
    db: Session = Depends(deps.get_db)
):
    """
    Check if a position exists for the given account, asset, and report date.
    Returns {"exists": bool, "position_id": int | None}
    """
    position = db.query(Position).filter(
        Position.account_id == account_id,
        Position.asset_id == asset_id,
        Position.report_date == report_date
    ).first()
    
    if position:
        return {"exists": True, "position_id": position.position_id}
    return {"exists": False, "position_id": None}


@router.post("/", response_model=PositionRead)
def create_position(
    position_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    Create a new position.
    """
    position = Position(**position_data)
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


@router.put("/{position_id}", response_model=PositionRead)
def update_position(
    position_id: int,
    position_data: dict,
    db: Session = Depends(deps.get_db)
):
    """
    Update an existing position.
    """
    position = db.query(Position).filter(Position.position_id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    
    for key, value in position_data.items():
        setattr(position, key, value)
    
    db.commit()
    db.refresh(position)
    return position








