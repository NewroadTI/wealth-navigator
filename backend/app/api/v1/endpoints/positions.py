from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.asset import Position
from app.schemas.asset import PositionRead

router = APIRouter()

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