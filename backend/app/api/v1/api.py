from fastapi import APIRouter
from app.api.v1.endpoints import utils, users, auth, catalogs, assets, roles

api_router = APIRouter()

# Agrupamos por Tags para que el Swagger se vea ordenado
api_router.include_router(utils.router, prefix="/utils", tags=["Utilidades"])
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(roles.router, prefix="/roles", tags=["Roles"])
api_router.include_router(catalogs.router, prefix="/catalogs", tags=["Catalogs"])
api_router.include_router(assets.router, prefix="/assets", tags=["Assets"])
# Estas aparecerán apenas crees los archivos correspondientes
# api_router.include_router(portfolios.router, prefix="/portfolios", tags=["Portfolios"])
# api_router.include_router(transactions.router, prefix="/transactions", tags=["Transacciones & ETL"])