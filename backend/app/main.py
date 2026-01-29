import time
from sqlalchemy.exc import OperationalError
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from sqlalchemy import text  <-- YA NO ES NECESARIO
from app.api.v1.api import api_router
from app.db.base import Base
from app.api.deps import engine

# Importar modelos para que Base.metadata los reconozca y se registren los eventos
from app.models import user, portfolio, asset 

app = FastAPI(
    title="WealthRoad API",
    description="Backend ERP de Gestión Patrimonial",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ... Configuración de CORS ...
# Allow local dev, Cloudflare Pages preview domain and the API hostname handled by Caddy
origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://wealth-navigator.pages.dev",
    "https://api.newroadai.com",
    "https://newroadai.com",
    "https://www.newroadai.com",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INICIO ROBUSTO DE BASE DE DATOS ---
@app.on_event("startup")
def startup_event():
    max_retries = 10
    wait_seconds = 2
    
    print("--- 🚀 Intentando conectar a la Base de Datos... ---")
    for i in range(max_retries):
        try:
            # 1. Crear tablas (y disparar eventos automáticos)
            # Al crear la tabla 'market_prices', el evento en 'asset.py' 
            # ejecutará automáticamente el create_hypertable.
            Base.metadata.create_all(bind=engine)
            
            print("--- ✅ ¡Conexión Exitosa! Tablas e Hypertables listas. ---")
            break 
            
        except OperationalError as e:
            print(f"--- ⏳ DB no lista, reintentando en {wait_seconds}s ({i+1}/{max_retries})... ---")
            time.sleep(wait_seconds)
    else:
        print("--- ❌ ERROR CRÍTICO: No se pudo conectar a la DB ---")

# ... Conectar Rutas ...
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"status": "running 🚀"}