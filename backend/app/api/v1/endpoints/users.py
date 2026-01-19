from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps

router = APIRouter()

@router.get("/")
def get_investors_list(db: Session = Depends(deps.get_db)):
    """Lista de clientes (Investors) para el módulo CRM"""
    return [{"id": 1, "full_name": "Cliente de Prueba", "status": "Activo"}]

@router.post("/")
def create_user_or_advisor():
    """Registro de nuevos usuarios o asesores"""
    return {"message": "Usuario registrado exitosamente"}