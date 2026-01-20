import sys
import logging

# Configuración de ruta
sys.path.append(".")

from app.db.session import SessionLocal
from app.models.asset import AssetClass, AssetSubClass
from app.models.portfolio import Account, Portfolio
from app.models.user import User
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- 1. DEFINICIÓN DE CLASES (AssetType) ---
CLASSES_DATA = [
    {"name": "Equities", "code": "EQUITY", "description": "Stocks, ETFs, ClosedEnd Funds"},
    {"name": "FixedIncome", "code": "FIXED_INCOME", "description": "Bonds, Bond Funds"},
    {"name": "Funds", "code": "FUND", "description": "Mutual Funds, Hedge Funds"},
    {"name": "Futures", "code": "FUTURE", "description": "Futures contracts"},
    {"name": "Options", "code": "OPTION", "description": "Options contracts"},
    {"name": "UserAssets", "code": "USER_ASSET", "description": "Real Estate, Art, Private Equity"},
    # Agregados esenciales para el sistema
    {"name": "Cash", "code": "CASH", "description": "Fiat Currencies, Forex"},
    {"name": "Crypto", "code": "CRYPTO", "description": "Cryptocurrencies (Bitcoin, Eth)"},
]

# --- 2. DEFINICIÓN DE SUBCLASES (AssetSubType) ---
# Format: (SubClassName, ParentClassCode, Code, Description)
SUBCLASSES_DATA = [
    # Equities
    {"name": "CommonStock", "parent": "EQUITY", "code": "COMMON", "desc": "Ordinary/common stocks"},
    {"name": "PreferredStock", "parent": "EQUITY", "code": "PREFERRED", "desc": "Preferred stocks"},
    
    # Fixed Income
    {"name": "GovernmentIssue", "parent": "FIXED_INCOME", "code": "GOVT", "desc": "Treasuries, TIPS, Sovereign Bonds"},
    {"name": "CorporateIssue", "parent": "FIXED_INCOME", "code": "CORP", "desc": "Corporate Bonds"},
    {"name": "Fund", "parent": "FIXED_INCOME", "code": "FI_FUND", "desc": "Bond ETFs/Funds managed as Fixed Income"},
    
    # Funds
    {"name": "OpenEnd", "parent": "FUND", "code": "OPEN_END", "desc": "Open End Fund, not traded in exchanges"},
    {"name": "ClosedEnd", "parent": "FUND", "code": "CLOSED_END", "desc": "Closed End Fund, traded in exchanges"},
    {"name": "ETF", "parent": "FUND", "code": "ETF", "desc": "Exchange Traded Fund"},
    
    # Futures
    {"name": "Cash", "parent": "FUTURE", "code": "FUT_CASH", "desc": "Futures with daily cash adjustment"},
    {"name": "Delivery", "parent": "FUTURE", "code": "FUT_DELIV", "desc": "Futures with commodity final delivery"},
    
    # Options
    {"name": "Call", "parent": "OPTION", "code": "CALL", "desc": "Call Option"},
    {"name": "Put", "parent": "OPTION", "code": "PUT", "desc": "Put Option"},

    # User Assets
    {"name": "RealEstate", "parent": "USER_ASSET", "code": "REAL_ESTATE", "desc": "Properties, Land"},
    {"name": "Vehicle", "parent": "USER_ASSET", "code": "VEHICLE", "desc": "Cars, Boats, Planes"},

    # Crypto
    {"name": "Coin", "parent": "CRYPTO", "code": "COIN", "desc": "Native Layer 1 (BTC, ETH)"},
    {"name": "Token", "parent": "CRYPTO", "code": "TOKEN", "desc": "ERC20, SPL Tokens"},
]

def seed_classes():
    db = SessionLocal()
    try:
        logger.info("--- 🗂️ Iniciando Semilla de Clases y Subclases de Activos ---")
        
        # -----------------------------------------------------
        # PASO 1: Upsert Clases
        # -----------------------------------------------------
        class_map = {} # code -> class_id
        
        for item in CLASSES_DATA:
            code = item["code"]
            
            # Buscar por código
            obj = db.query(AssetClass).filter(AssetClass.code == code).first()
            
            # Si no existe por código, buscar por nombre (para evitar duplicados si ya corriste seeds anteriores)
            if not obj:
                obj = db.query(AssetClass).filter(AssetClass.name == item["name"]).first()

            if not obj:
                obj = AssetClass(code=code, name=item["name"])
                db.add(obj)
                db.commit() # Commit inmediato para obtener ID
                db.refresh(obj)
                logger.info(f"✅ Clase Creada: {item['name']}")
            else:
                # Actualizar si ya existe (para estandarizar nombres/códigos)
                if obj.code != code:
                    logger.info(f"🔄 Actualizando código de {obj.name}: {obj.code} -> {code}")
                    obj.code = code
                obj.name = item["name"] # Asegurar nombre correcto
                db.commit()
            
            class_map[code] = obj.class_id

        # -----------------------------------------------------
        # PASO 2: Upsert SubClases
        # -----------------------------------------------------
        count_sub = 0
        for item in SUBCLASSES_DATA:
            parent_code = item["parent"]
            parent_id = class_map.get(parent_code)
            
            if not parent_id:
                logger.warning(f"⚠️ Clase padre '{parent_code}' no encontrada para subclase '{item['name']}'. Saltando.")
                continue
                
            sub_code = item["code"]
            
            sub = db.query(AssetSubClass).filter(AssetSubClass.code == sub_code).first()
            
            if not sub:
                sub = AssetSubClass(
                    class_id=parent_id,
                    code=sub_code,
                    name=item["name"]
                )
                db.add(sub)
                count_sub += 1
            else:
                # Asegurar que apunta al padre correcto
                sub.class_id = parent_id
                sub.name = item["name"]
            
        db.commit()
        logger.info(f"✅ Subclases procesadas: {count_sub} nuevas.")
        logger.info("--- 🏁 Semilla de Clasificación Completada ---")

    except Exception as e:
        logger.error(f"❌ Error crítico: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_classes()