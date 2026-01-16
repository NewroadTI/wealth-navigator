from fastapi import APIRouter
from app.api.v1.endpoints import utils

api_router = APIRouter()

# Registramos el router de utilidades
api_router.include_router(utils.router, prefix="/utils", tags=["Utilidades"])

# NOTA: Cuando crees 'portfolios.py' o 'transactions.py', los agregarás aquí:
# from app.api.v1.endpoints import portfolios
# api_router.include_router(portfolios.router, prefix="/portfolios", tags=["Portfolios"])