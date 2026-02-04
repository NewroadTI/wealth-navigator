from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Usamos la misma URL que tenías en tu main.py original
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:securepassword123@db:5432/wealthroad")

# Configuración del motor de DB
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator:
    """
    Esta función crea una sesión de base de datos para cada petición
    y la cierra automáticamente cuando la petición termina.
    Es vital para que Postgres no se sature de conexiones abiertas.
    """
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

# AQUÍ AGREGAREMOS LUEGO: get_current_user (Para leer el token JWT)