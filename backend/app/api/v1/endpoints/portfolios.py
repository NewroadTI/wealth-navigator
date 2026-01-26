from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.api import deps

from app.models.portfolio import Portfolio, Account
from app.models.user import User
from app.schemas.portfolio import PortfolioRead, PortfolioCreate, PortfolioUpdate, PortfolioSimpleRead

router = APIRouter()


@router.get("/", response_model=List[PortfolioRead])
def get_portfolios(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True
) -> Any:
    """
    Lista todos los portfolios con sus cuentas y advisors.
    """
    query = db.query(Portfolio).options(
        joinedload(Portfolio.accounts),
        joinedload(Portfolio.advisors),
        joinedload(Portfolio.owner)
    )
    
    if active_only:
        query = query.filter(Portfolio.active_status == True)
    
    portfolios = query.order_by(Portfolio.name).offset(skip).limit(limit).all()
    return portfolios

@router.get("/simple", response_model=List[PortfolioSimpleRead])
def get_portfolios_simple(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True
) -> Any:
    """
    Lista portfolios SOLO con información básica.
    Ideal para dropdowns, selectores o tablas resumen.
    """
    # No usamos joinedload porque no queremos traer las relaciones pesadas
    query = db.query(Portfolio)
    
    if active_only:
        query = query.filter(Portfolio.active_status == True)
    
    portfolios = query.order_by(Portfolio.portfolio_id).offset(skip).limit(limit).all()
    return portfolios

@router.get("/{portfolio_id}", response_model=PortfolioRead)
def get_portfolio_by_id(
    portfolio_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Obtiene un portfolio específico por su ID.
    """
    portfolio = db.query(Portfolio).options(
        joinedload(Portfolio.accounts),
        joinedload(Portfolio.advisors),
        joinedload(Portfolio.owner)
    ).filter(Portfolio.portfolio_id == portfolio_id).first()
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio con ID {portfolio_id} no encontrado"
        )
    return portfolio


@router.post("/", response_model=PortfolioRead, status_code=status.HTTP_201_CREATED)
def create_portfolio(
    payload: PortfolioCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea un nuevo portfolio.
    """
    # Verificar que el owner existe
    owner = db.query(User).filter(User.user_id == payload.owner_user_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Usuario con ID {payload.owner_user_id} no existe"
        )
    
    # Verificar que el interface_code no exista
    existing = db.query(Portfolio).filter(Portfolio.interface_code == payload.interface_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un portfolio con interface_code '{payload.interface_code}'"
        )
    
    # Crear portfolio
    portfolio = Portfolio(
        owner_user_id=payload.owner_user_id,
        interface_code=payload.interface_code,
        name=payload.name,
        main_currency=payload.main_currency,
        residence_country=payload.residence_country,
        inception_date=payload.inception_date,
        active_status=payload.active_status
    )
    
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    
    return portfolio


@router.put("/{portfolio_id}", response_model=PortfolioRead)
def update_portfolio(
    portfolio_id: int,
    payload: PortfolioUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza un portfolio existente.
    """
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio con ID {portfolio_id} no encontrado"
        )
    
    # Actualizar campos proporcionados
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(portfolio, field, value)
    
    db.commit()
    db.refresh(portfolio)
    
    return portfolio


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
    portfolio_id: int,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Elimina un portfolio (soft delete - marca como inactive).
    """
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Portfolio con ID {portfolio_id} no encontrado"
        )
    
    # Soft delete
    portfolio.active_status = False
    db.commit()