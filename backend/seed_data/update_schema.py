import sys
import logging
from sqlalchemy import text

# Configuración
sys.path.append(".")
from app.db.session import engine
from app.db.base import Base

# ✅ IMPORTAR TODOS LOS MODELOS (en orden de dependencias)
from app.models.user import User, Role, Permission, RolePermission, AuditLog
from app.models.portfolio import Portfolio, PortfolioAdvisor, Account
from app.models.asset import (
    StockExchange, Industry, AssetClass, AssetSubClass, Asset,
    Trade, CashJournal, FXTransaction, PerformanceAttribution,
    CorporateAction, Position, MarketPrice, MarketIndex,
    Currency, Country
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration():
    logger.info("--- 🔄 Iniciando Actualización de Esquema de Base de Datos ---")
    
    # 1. CREAR LAS TABLAS NUEVAS (Si faltara alguna)
    Base.metadata.create_all(bind=engine)
    
    with engine.connect() as connection:
        try:
            # 2. MIGRACIÓN: ASSETS -> COUNTRIES (Ya la tenías)
            logger.info("2. Verificando FK 'assets.country_code'...")
            sql_fk_country = """
            DO $$ 
            BEGIN 
                -- Agregar constraint si no existe
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_countries') THEN 
                    ALTER TABLE assets 
                    ADD CONSTRAINT fk_assets_countries 
                    FOREIGN KEY (country_code) 
                    REFERENCES countries (iso_code);
                END IF; 
            END $$;
            """
            connection.execute(text(sql_fk_country))
            
            # 3. MIGRACIÓN: ASSETS -> INDUSTRIES (NUEVO)
            logger.info("3. Verificando columna y FK 'assets.industry_code'...")
            
            # A. Agregar columna si no existe
            sql_add_col = """
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='industry_code') THEN 
                    ALTER TABLE assets ADD COLUMN industry_code VARCHAR;
                END IF; 
            END $$;
            """
            connection.execute(text(sql_add_col))
            
            # B. Agregar Constraint FK
            sql_fk_industry = """
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_industries') THEN 
                    ALTER TABLE assets 
                    ADD CONSTRAINT fk_assets_industries 
                    FOREIGN KEY (industry_code) 
                    REFERENCES industries (industry_code);
                END IF; 
            END $$;
            """
            connection.execute(text(sql_fk_industry))
            
            connection.commit()
            logger.info("✅ Esquema actualizado correctamente.")
            
        except Exception as e:
            logger.error(f"⚠️ Error en migración: {e}")

    logger.info("--- 🏁 Migración Completada ---")

if __name__ == "__main__":
    run_migration()