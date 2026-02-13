from fastapi import APIRouter
from app.api.v1.endpoints import utils, users, auth, catalogs, assets, roles, transactions, portfolios, accounts, positions, analytics, etl, persh_etl, persh_accounts, positions_etl, ais_etl, performance, twr

api_router = APIRouter()

# Agrupamos por Tags para que el Swagger se vea ordenado
api_router.include_router(utils.router, prefix="/utils", tags=["Utilidades"])
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(roles.router, prefix="/roles", tags=["Roles"])
api_router.include_router(catalogs.router, prefix="/catalogs", tags=["Catalogs"])
api_router.include_router(assets.router, prefix="/assets", tags=["Assets"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(portfolios.router, prefix="/portfolios", tags=["Portfolios"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
api_router.include_router(positions.router, prefix="/positions", tags=["Positions"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics & Reports"])
api_router.include_router(performance.router, prefix="/performance", tags=["Portfolio Performance"])
api_router.include_router(etl.router, prefix="/etl", tags=["ETL & Data Import"])
api_router.include_router(persh_etl.router, prefix="/persh-etl", tags=["Pershing ETL"])
api_router.include_router(persh_accounts.router, prefix="/persh-accounts", tags=["Pershing Account Resolution"])
api_router.include_router(positions_etl.router, prefix="/positions-etl", tags=["Positions ETL"])
api_router.include_router(ais_etl.router, prefix="/ais-etl", tags=["AIS ETL"])
api_router.include_router(twr.router, prefix="/twr", tags=["TWR Performance"])
# Estas aparecerán apenas crees los archivos correspondientes
# api_router.include_router(portfolios.router, prefix="/portfolios", tags=["Portfolios"])
# api_router.include_router(transactions.router, prefix="/transactions", tags=["Transacciones & ETL"])

