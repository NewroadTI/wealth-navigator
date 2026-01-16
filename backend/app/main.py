from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router

# Configuración de la App
app = FastAPI(
    title="WealthRoad API",
    description="Backend ERP de Gestión Patrimonial",
    version="1.0.0",
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc"
)

# --- CONFIGURACIÓN DE CORS (Crucial para Frontend React) ---
origins = [
    "http://localhost:5173",  # Vite local
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "*" # (Opcional) Permitir todo durante desarrollo inicial
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permitir GET, POST, DELETE, etc.
    allow_headers=["*"],
)

# --- CONECTAR RUTAS ---
# Toda la lógica de la versión 1 vive bajo /api/v1
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {
        "system": "WealthRoad API", 
        "status": "running 🚀", 
        "docs": "/docs"
    }