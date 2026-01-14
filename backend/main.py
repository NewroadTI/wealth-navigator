from fastapi import FastAPI
from sqlalchemy import create_engine, text
import os

app = FastAPI(title="WealthRoad API")

# Obtener URL de la DB desde variables de entorno
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/wealthroad")

@app.get("/")
def read_root():
    return {"status": "WealthRoad API is running 🚀"}

@app.get("/test-db")
def test_db():
    try:
        # Prueba de conexión simple
        engine = create_engine(DATABASE_URL)
        with engine.connect() as connection:
            result = connection.execute(text("SELECT * FROM users"))
            users = [dict(row._mapping) for row in result]
        return {"status": "success", "users_found": users}
    except Exception as e:
        return {"status": "error", "message": str(e)}
