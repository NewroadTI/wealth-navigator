from fastapi import APIRouter
from app.api.v1.endpoints import utils, users, auth, catalogs, assets  # <--- 1. Importar assets
# NOTA: Crearemos estos archivos en un momento para que no den error
# from app.api.v1.endpoints import portfolios, transactions, assets

api_router = APIRouter()

# Agrupamos por Tags para que el Swagger se vea ordenado
api_router.include_router(utils.router, prefix="/utils", tags=["Utilidades"])
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(catalogs.router, prefix="/catalogs", tags=["catalogs"])
api_router.include_router(assets.router, prefix="/assets", tags=["Assets"]) # <--- 2. Agregar esto
# Estas aparecerán apenas crees los archivos correspondientes
# api_router.include_router(portfolios.router, prefix="/portfolios", tags=["Portfolios"])
# api_router.include_router(transactions.router, prefix="/transactions", tags=["Transacciones & ETL"])
# api_router.include_router(assets.router, prefix="/assets", tags=["Activos (Master Data)"])