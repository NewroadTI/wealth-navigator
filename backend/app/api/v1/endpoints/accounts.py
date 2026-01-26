# app/api/v1/endpoints/accounts.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.models.portfolio import Account, Portfolio
from app.schemas import portfolio as schemas

router = APIRouter()

# --------------------------------------------------------------------------
# CREATE
# --------------------------------------------------------------------------
@router.post("/", response_model=schemas.AccountRead, status_code=201)
def create_account(
    account_in: schemas.AccountCreate,
    db: Session = Depends(deps.get_db)
):
    """
    Crear una nueva cuenta.
    Valida que el Portfolio exista y que el account_code no esté duplicado.
    """
    # 1. Validar que el Portfolio existe
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == account_in.portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail=f"Portfolio with ID {account_in.portfolio_id} not found")

    # 2. Validar código único (opcional, pero recomendado)
    existing_acc = db.query(Account).filter(Account.account_code == account_in.account_code).first()
    if existing_acc:
        raise HTTPException(status_code=400, detail="Account code already exists")

    # 3. Crear
    new_account = Account(
        portfolio_id=account_in.portfolio_id,
        institution=account_in.institution,
        account_code=account_in.account_code,
        account_alias=account_in.account_alias,
        account_type=account_in.account_type,
        currency=account_in.currency
    )
    
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account

# --------------------------------------------------------------------------
# READ (List & One)
# --------------------------------------------------------------------------
@router.get("/", response_model=List[schemas.AccountRead])
def read_accounts(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    portfolio_id: Optional[int] = None,
    currency: Optional[str] = None
):
    """
    Obtener lista de cuentas.
    Filtros opcionales: portfolio_id, currency.
    """
    query = db.query(Account)
    
    if portfolio_id:
        query = query.filter(Account.portfolio_id == portfolio_id)
    if currency:
        query = query.filter(Account.currency == currency)
        
    accounts = query.offset(skip).limit(limit).all()
    return accounts

@router.get("/{account_id}", response_model=schemas.AccountRead)
def read_account(
    account_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    Obtener una cuenta por ID.
    """
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

# --------------------------------------------------------------------------
# UPDATE
# --------------------------------------------------------------------------
@router.patch("/{account_id}", response_model=schemas.AccountRead)
def update_account(
    account_id: int,
    account_in: schemas.AccountUpdate,
    db: Session = Depends(deps.get_db)
):
    """
    Actualizar datos de una cuenta (Alias, Tipo, Moneda, etc).
    """
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Actualizar solo los campos enviados
    update_data = account_in.dict(exclude_unset=True)
    
    # Si se intenta cambiar el account_code, verificar duplicados
    if "account_code" in update_data:
        existing = db.query(Account).filter(
            Account.account_code == update_data["account_code"],
            Account.account_id != account_id # Excluirse a sí mismo
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="New account code already in use")

    for field, value in update_data.items():
        setattr(account, field, value)

    db.add(account)
    db.commit()
    db.refresh(account)
    return account

# --------------------------------------------------------------------------
# DELETE
# --------------------------------------------------------------------------
@router.delete("/{account_id}", response_model=schemas.AccountRead)
def delete_account(
    account_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    Eliminar una cuenta.
    Nota: Esto fallará si hay transacciones (trades, cash_journal) ligadas a esta cuenta
    debido a las Foreign Keys, a menos que tengas CASCADE activado.
    """
    account = db.query(Account).filter(Account.account_id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        db.delete(account)
        db.commit()
    except Exception as e:
        db.rollback()
        # Manejo simple de error de integridad referencial
        raise HTTPException(status_code=400, detail=f"Cannot delete account with existing transactions. Error: {str(e)}")
        
    return account