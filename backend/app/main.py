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
# Allow local dev, Cloudflare Pages domains and production domains
# Note: Cloudflare Pages uses dynamic subdomains like wealth-navigator-abc123.pages.dev
# We need to allow all pages.dev subdomains for preview deployments
import re

def is_allowed_origin(origin: str) -> bool:
    """Check if origin is allowed, including dynamic Cloudflare Pages URLs"""
    allowed_patterns = [
        r"^http://localhost:\d+$",
        r"^http://127\.0\.0\.1:\d+$",
        r"^https://.*\.pages\.dev$",  # All Cloudflare Pages subdomains
        r"^https://api\.newroadai\.com$",
        r"^https://(www\.)?newroadai\.com$",
    ]
    return any(re.match(pattern, origin) for pattern in allowed_patterns)

# Use allow_origin_regex for flexible origin matching
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(http://localhost:\d+|http://127\.0\.0\.1:\d+|https://.*\.pages\.dev|https://api\.newroadai\.com|https://(www\.)?newroadai\.com)$",
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