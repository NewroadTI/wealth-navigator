from typing import List, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps

# Importamos el Modelo (DB) y el Schema (Datos de salida)
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter()

# 1. Agregamos response_model=List[UserRead]
# Esto es CRUCIAL: Filtra los datos sensibles (password) y formatea la fecha automáticamente
@router.get("/", response_model=List[UserRead])
def get_users_list(
    db: Session = Depends(deps.get_db),
    skip: int = 0,   # Paginación: saltar los primeros X
    limit: int = 100 # Paginación: traer máximo X
) -> Any:
    """
    Lista todos los usuarios registrados en la base de datos.
    Soporta paginación básica.
    """
    # 2. Hacemos la consulta a la DB
    users = db.query(User).offset(skip).limit(limit).all()
    
    return users

@router.post("/")
def create_user_or_advisor():
    """Registro de nuevos usuarios o asesores"""
    # TODO: Implementar lógica de creación usando UserCreate
    return {"message": "Endpoint en construcción"}