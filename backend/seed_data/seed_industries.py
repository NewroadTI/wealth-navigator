import sys
import logging
import re

# Configuración de ruta
sys.path.append(".")

from app.db.session import SessionLocal
from app.models.asset import Industry , Country, CorporateAction, Trades
from app.models.portfolio import Account, Portfolio
from app.models.user import User
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- RAW DATA ---
RAW_LIST = """
Energy Equipment and Services
Oil, Gas and Fuels
Chemical products
Construction materials
Containers and Packaging
Metals and Mining
Wood and Paper Products
Construction Products
Construction and Engineering
Electric equipment
Industrial Conglomerates
Machinery
Trade and Distribution
Commercial Supplies and Services
Professional services
Logistics and Air Freight Transport Services
Marine transport
Roads and Railways
Transport Infrastructure
Household
Recreational Products
Textile, Clothing and Luxury
Hotels, Restaurants and Recreation
Diversified Consumer Services
Media
Dealers
Internet Sales and Direct Marketing
Multi-line Sales
Specialized sales
Sale of Food and Basic Products
Food
Tabaco
Household products
Personal Products
Medical Equipment and Supplies
Medical Service Providers
Technological Services for the Health Area
Biotechnology
Pharmaceutical products
Tools and Services for Health Sciences
Commercial banks
Savings and Mortgage Financing
Diversified Financial Services
Personal Financial Services
Capital Markets
Real Estate Investment Mortgage Trust
Insurance
Information Technology Services
Software
Communications Equipment
Technological Equipment, Electronic Storage and Peripherals
Electronic Equipment, Instruments and Components
Semiconductors and Related Equipment
Various Telecommunications Services
Wireless Telecommunication Services
Entertainment
Interactive Media and Services
Electric supply
Gas supply
Multiservices
Water supply
Independent Energy Producers and Renewable Electric Energy
Development and Administration of Real Estate Assets
Insurance-Property & Casualty
Other Industrial Metals & Mining
Copper
Rental & Leasing Services
Drug Manufacturers-General
Internet Content & Information
Software-Application
Insurance-Diversified
Residential Construction
Oil & Gas Integrated
Tobacco
Real Estate
Telecom Services
Food Distribution
Luxury Goods
Leisure
Restaurants
Specialty Chemicals
Oil & Gas Refining & Marketing
Consulting Services
Industrial Distribution
Gambling
Other Precious Metals & Mining
Conglomerates
Drug Manufacturers-Specialty & Generic
Publishing
Lodging
Specialty Business Services
Specialty Retail
Home Improvement Retail
REIT-Diversified
Financial Data & Stock Exchanges
Specialty Industrial Machinery
Paper & Paper Products
Grocery Stores
Insurance-Life
Industrials
REIT-Industrial
Medical Devices
Packaging & Containers
Travel Services
Household & Personal Products
Telecom Services
Lodging
Drug Manufacturers—General
Chemicals
Medical Instruments & Supplies
Insurance—Diversified
Software—Application
Engineering & Construction
Packaged Foods
Waste Management
Insurance—Life
Diagnostics & Research
Credit Services
Software—Infrastructure
Drug Manufacturers—Specialty & Generic
Railroads
Oil & Gas Midstream
Oil & Gas E&P
Gold
Insurance—Property & Casualty
Discount Stores
Marine Shipping
Integrated Freight & Logistics
Footwear & Accessories
Semiconductors
Insurance—Reinsurance
Real Estate Services
Medical Care Facilities
Farm & Heavy Construction Machinery
Real Estate—Development
Internet Retail
Consumer Electronics
Financial Conglomerates
Healthcare Plans
Communication Equipment
Security & Protection Services
Lumber & Wood Production
Tools & Accessories
Steel
Not Applicable
Beverages-Brewers
Software-Infrastructure
Exchange Traded Fund
Electronic Gaming & Multimedia
Banks-Regional
Aerospace & Defense
Banks-Diversified
Closed-End Fund-Debt
Closed-End Fund-Equity
Apparel Retail
Department Stores
Utilities-Diversified
Computer Hardware
Airlines
Utilities-Regulated Electric
Closed-End Fund-Foreign
Auto Manufacturers
Resorts & Casinos
Conglomerates
Pharmaceutical Retailers
Auto Parts
Utilities-Regulated Water
Health Information Services
Asset Management
Farm Products
Index
Cryptocurrency
Beverages - Non-Alcoholic
REIT-Specialty
Semiconductor Equipment & Materials
Apparel Manufacturing
Furnishings, Fixtures & Appliances
Energy
Basic Materials
Discretionary Utilities
Basics
Healthcare
Financial
Technology
Telecom
Utilities
Real Estate
Government
Consumer Defensive
Consumer Cyclical
Industrials
Communication Services
Consumer Discretionary
Consumer Staples
Bonds
Structured Note
Broad
Consumer Non-Cyc
Consumer Cyclicals
Telecomm
Financials
"""

# Mapa heurístico para asignar sectores automáticamente
SECTOR_KEYWORDS = {
    "Energy": "Energy", "Oil": "Energy", "Gas": "Energy", "Fuel": "Energy",
    "Bank": "Financial", "Insurance": "Financial", "Capital": "Financial", "Credit": "Financial", "Financial": "Financial", "REIT": "Real Estate",
    "Health": "Healthcare", "Medical": "Healthcare", "Drug": "Healthcare", "Pharma": "Healthcare", "Biotech": "Healthcare",
    "Tech": "Technology", "Software": "Technology", "Semiconductor": "Technology", "Computer": "Technology", "Internet": "Technology", "Electronic": "Technology",
    "Food": "Consumer Staples", "Beverage": "Consumer Staples", "Grocery": "Consumer Staples", "Tobacco": "Consumer Staples",
    "Retail": "Consumer Discretionary", "Auto": "Consumer Discretionary", "Apparel": "Consumer Discretionary", "Hotel": "Consumer Discretionary", "Leisure": "Consumer Discretionary",
    "Utility": "Utilities", "Electric": "Utilities", "Water": "Utilities",
    "Construction": "Industrials", "Machinery": "Industrials", "Airline": "Industrials", "Transport": "Industrials", "Aerospace": "Industrials",
    "Telecom": "Communication Services", "Media": "Communication Services", "Communication": "Communication Services",
    "Real Estate": "Real Estate"
}

def generate_code(name: str) -> str:
    # 1. Reemplazar caracteres especiales por espacios (incluyendo guiones largos)
    clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', name)
    # 2. Convertir a mayúsculas y unir con guiones bajos
    code = "_".join(clean.split()).upper()
    return code[:50]

def guess_sector(name: str) -> str:
    for keyword, sector in SECTOR_KEYWORDS.items():
        if keyword.lower() in name.lower():
            return sector
    return "Unclassified"

def seed_industries():
    db = SessionLocal()
    try:
        lines = [line.strip() for line in RAW_LIST.split('\n') if line.strip() and line.strip() != "-"]
        unique_names = sorted(list(set(lines))) 
        
        logger.info(f"--- 🏭 Iniciando Semilla de Industrias ({len(unique_names)} registros crudos) ---")
        
        count_new = 0
        count_updated = 0
        
        # --- SOLUCIÓN AL ERROR: SET DE CÓDIGOS PROCESADOS ---
        seen_codes = set()

        # ==============================================================================
        # INICIO AGREGADO MANUAL
        # ==============================================================================
        cash_data = {"industry_code": "CASH", "name": "Cash", "sector": "Financial"}
        
        # 1. Bloqueamos el código en seen_codes para evitar duplicados en el bucle siguiente
        seen_codes.add(cash_data["industry_code"])

        # 2. Upsert manual
        obj_cash = db.query(Industry).filter(Industry.industry_code == cash_data["industry_code"]).first()
        if not obj_cash:
            obj_cash = Industry(**cash_data)
            db.add(obj_cash)
            count_new += 1
        else:
            obj_cash.name = cash_data["name"]
            obj_cash.sector = cash_data["sector"]
            count_updated += 1
        # ==============================================================================
        # FIN AGREGADO MANUAL
        # ==============================================================================
        
        for name in unique_names:
            code = generate_code(name)
            
            # Si ya procesamos este código (incluyendo el CASH manual), saltar
            if code in seen_codes:
                continue
            
            seen_codes.add(code)
            
            sector_val = name if name in SECTOR_KEYWORDS.values() else guess_sector(name)
            
            # Upsert
            obj = db.query(Industry).filter(Industry.industry_code == code).first()
            if not obj:
                obj = Industry(
                    industry_code=code,
                    name=name,
                    sector=sector_val
                )
                db.add(obj)
                count_new += 1
            else:
                if not obj.sector or obj.sector == "Unclassified":
                    obj.sector = sector_val
                    count_updated += 1
        
        db.commit()
        logger.info(f"✅ Industrias procesadas: {count_new} nuevas, {count_updated} actualizadas.")
        logger.info("--- 🏁 Semilla de Industrias Completada ---")

    except Exception as e:
        logger.error(f"❌ Error insertando industrias: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_industries()