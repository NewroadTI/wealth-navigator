from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any
from app.api.deps import get_db

router = APIRouter()

@router.get("/test-db")
def test_db_connection(db: Session = Depends(get_db)) -> Any:
    """
    Prueba de conectividad a la base de datos (Migrado de tu código original).
    """
    try:
        # Usamos la sesión inyectada 'db', ya no creamos el engine aquí
        result = db.execute(text("SELECT * FROM users"))
        # Mapeamos el resultado a dict (igual que tu código original)
        users = [dict(row._mapping) for row in result]
        
        return {
            "status": "success", 
            "message": "Conexión exitosa a WealthRoad DB", 
            "users_count": len(users),
            "sample_data": users
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}