import json
import re
from datetime import datetime
from pathlib import Path

# --- CONFIGURACIÓN ---
INPUT_FILE = "assets.json"
OUTPUT_FILE = "assets_ready_for_db.json"

# --- 1. CATÁLOGO MAESTRO DE INDUSTRIAS (Tu DB) ---
# Copiado tal cual lo enviaste para asegurar consistencia
DB_INDUSTRIES_CATALOG = [
  {"industry_code": "AEROSPACE_DEFENSE", "name": "Aerospace & Defense"},
  {"industry_code": "AIRLINES", "name": "Airlines"},
  {"industry_code": "APPAREL_MANUFACTURING", "name": "Apparel Manufacturing"},
  {"industry_code": "APPAREL_RETAIL", "name": "Apparel Retail"},
  {"industry_code": "ASSET_MANAGEMENT", "name": "Asset Management"},
  {"industry_code": "AUTO_MANUFACTURERS", "name": "Auto Manufacturers"},
  {"industry_code": "AUTO_PARTS", "name": "Auto Parts"},
  {"industry_code": "BANKS_DIVERSIFIED", "name": "Banks-Diversified"},
  {"industry_code": "BANKS_REGIONAL", "name": "Banks-Regional"},
  {"industry_code": "BASIC_MATERIALS", "name": "Basic Materials"},
  {"industry_code": "BASICS", "name": "Basics"},
  {"industry_code": "BEVERAGES_NON_ALCOHOLIC", "name": "Beverages - Non-Alcoholic"},
  {"industry_code": "BEVERAGES_BREWERS", "name": "Beverages-Brewers"},
  {"industry_code": "BIOTECHNOLOGY", "name": "Biotechnology"},
  {"industry_code": "BONDS", "name": "Bonds"},
  {"industry_code": "CAPITAL_MARKETS", "name": "Capital Markets"},
  {"industry_code": "CHEMICAL_PRODUCTS", "name": "Chemical products"},
  {"industry_code": "CHEMICALS", "name": "Chemicals"},
  {"industry_code": "CLOSED_END_FUND_DEBT", "name": "Closed-End Fund-Debt"},
  {"industry_code": "CLOSED_END_FUND_EQUITY", "name": "Closed-End Fund-Equity"},
  {"industry_code": "CLOSED_END_FUND_FOREIGN", "name": "Closed-End Fund-Foreign"},
  {"industry_code": "COMMERCIAL_SUPPLIES_AND_SERVICES", "name": "Commercial Supplies and Services"},
  {"industry_code": "COMMERCIAL_BANKS", "name": "Commercial banks"},
  {"industry_code": "COMMUNICATION_EQUIPMENT", "name": "Communication Equipment"},
  {"industry_code": "COMMUNICATION_SERVICES", "name": "Communication Services"},
  {"industry_code": "COMMUNICATIONS_EQUIPMENT", "name": "Communications Equipment"},
  {"industry_code": "COMPUTER_HARDWARE", "name": "Computer Hardware"},
  {"industry_code": "CONGLOMERATES", "name": "Conglomerates"},
  {"industry_code": "CONSTRUCTION_PRODUCTS", "name": "Construction Products"},
  {"industry_code": "CONSTRUCTION_AND_ENGINEERING", "name": "Construction and Engineering"},
  {"industry_code": "CONSTRUCTION_MATERIALS", "name": "Construction materials"},
  {"industry_code": "CONSULTING_SERVICES", "name": "Consulting Services"},
  {"industry_code": "CONSUMER_CYCLICAL", "name": "Consumer Cyclical"},
  {"industry_code": "CONSUMER_DEFENSIVE", "name": "Consumer Defensive"},
  {"industry_code": "CONSUMER_DISCRETIONARY", "name": "Consumer Discretionary"},
  {"industry_code": "CONSUMER_ELECTRONICS", "name": "Consumer Electronics"},
  {"industry_code": "CONSUMER_STAPLES", "name": "Consumer Staples"},
  {"industry_code": "CONTAINERS_AND_PACKAGING", "name": "Containers and Packaging"},
  {"industry_code": "COPPER", "name": "Copper"},
  {"industry_code": "CREDIT_SERVICES", "name": "Credit Services"},
  {"industry_code": "CRYPTOCURRENCY", "name": "Cryptocurrency"},
  {"industry_code": "DEALERS", "name": "Dealers"},
  {"industry_code": "DEPARTMENT_STORES", "name": "Department Stores"},
  {"industry_code": "DEVELOPMENT_AND_ADMINISTRATION_OF_REAL_ESTATE_ASSE", "name": "Development and Administration of Real Estate Assets"},
  {"industry_code": "DIAGNOSTICS_RESEARCH", "name": "Diagnostics & Research"},
  {"industry_code": "DISCOUNT_STORES", "name": "Discount Stores"},
  {"industry_code": "DISCRETIONARY_UTILITIES", "name": "Discretionary Utilities"},
  {"industry_code": "DIVERSIFIED_CONSUMER_SERVICES", "name": "Diversified Consumer Services"},
  {"industry_code": "DIVERSIFIED_FINANCIAL_SERVICES", "name": "Diversified Financial Services"},
  {"industry_code": "DRUG_MANUFACTURERS_GENERAL", "name": "Drug Manufacturers-General"},
  {"industry_code": "DRUG_MANUFACTURERS_SPECIALTY_GENERIC", "name": "Drug Manufacturers-Specialty & Generic"},
  {"industry_code": "ELECTRIC_EQUIPMENT", "name": "Electric equipment"},
  {"industry_code": "ELECTRIC_SUPPLY", "name": "Electric supply"},
  {"industry_code": "ELECTRONIC_EQUIPMENT_INSTRUMENTS_AND_COMPONENTS", "name": "Electronic Equipment, Instruments and Components"},
  {"industry_code": "ELECTRONIC_GAMING_MULTIMEDIA", "name": "Electronic Gaming & Multimedia"},
  {"industry_code": "ENERGY", "name": "Energy"},
  {"industry_code": "ENERGY_EQUIPMENT_AND_SERVICES", "name": "Energy Equipment and Services"},
  {"industry_code": "ENGINEERING_CONSTRUCTION", "name": "Engineering & Construction"},
  {"industry_code": "ENTERTAINMENT", "name": "Entertainment"},
  {"industry_code": "EXCHANGE_TRADED_FUND", "name": "Exchange Traded Fund"},
  {"industry_code": "FARM_HEAVY_CONSTRUCTION_MACHINERY", "name": "Farm & Heavy Construction Machinery"},
  {"industry_code": "FARM_PRODUCTS", "name": "Farm Products"},
  {"industry_code": "FINANCIAL", "name": "Financial"},
  {"industry_code": "FINANCIAL_CONGLOMERATES", "name": "Financial Conglomerates"},
  {"industry_code": "FINANCIAL_DATA_STOCK_EXCHANGES", "name": "Financial Data & Stock Exchanges"},
  {"industry_code": "FOOD", "name": "Food"},
  {"industry_code": "FOOD_DISTRIBUTION", "name": "Food Distribution"},
  {"industry_code": "FOOTWEAR_ACCESSORIES", "name": "Footwear & Accessories"},
  {"industry_code": "FURNISHINGS_FIXTURES_APPLIANCES", "name": "Furnishings, Fixtures & Appliances"},
  {"industry_code": "GAMBLING", "name": "Gambling"},
  {"industry_code": "GAS_SUPPLY", "name": "Gas supply"},
  {"industry_code": "GOLD", "name": "Gold"},
  {"industry_code": "GOVERNMENT", "name": "Government"},
  {"industry_code": "GROCERY_STORES", "name": "Grocery Stores"},
  {"industry_code": "HEALTH_INFORMATION_SERVICES", "name": "Health Information Services"},
  {"industry_code": "HEALTHCARE", "name": "Healthcare"},
  {"industry_code": "HEALTHCARE_PLANS", "name": "Healthcare Plans"},
  {"industry_code": "HOME_IMPROVEMENT_RETAIL", "name": "Home Improvement Retail"},
  {"industry_code": "HOTELS_RESTAURANTS_AND_RECREATION", "name": "Hotels, Restaurants and Recreation"},
  {"industry_code": "HOUSEHOLD", "name": "Household"},
  {"industry_code": "HOUSEHOLD_PERSONAL_PRODUCTS", "name": "Household & Personal Products"},
  {"industry_code": "HOUSEHOLD_PRODUCTS", "name": "Household products"},
  {"industry_code": "INDEPENDENT_ENERGY_PRODUCERS_AND_RENEWABLE_ELECTRI", "name": "Independent Energy Producers and Renewable Electric Energy"},
  {"industry_code": "INDEX", "name": "Index"},
  {"industry_code": "INDUSTRIAL_CONGLOMERATES", "name": "Industrial Conglomerates"},
  {"industry_code": "INDUSTRIAL_DISTRIBUTION", "name": "Industrial Distribution"},
  {"industry_code": "INDUSTRIALS", "name": "Industrials"},
  {"industry_code": "INFORMATION_TECHNOLOGY_SERVICES", "name": "Information Technology Services"},
  {"industry_code": "INSURANCE", "name": "Insurance"},
  {"industry_code": "INSURANCE_DIVERSIFIED", "name": "Insurance-Diversified"},
  {"industry_code": "INSURANCE_LIFE", "name": "Insurance-Life"},
  {"industry_code": "INSURANCE_PROPERTY_CASUALTY", "name": "Insurance-Property & Casualty"},
  {"industry_code": "INSURANCE_REINSURANCE", "name": "Insurance—Reinsurance"},
  {"industry_code": "INTEGRATED_FREIGHT_LOGISTICS", "name": "Integrated Freight & Logistics"},
  {"industry_code": "INTERACTIVE_MEDIA_AND_SERVICES", "name": "Interactive Media and Services"},
  {"industry_code": "INTERNET_CONTENT_INFORMATION", "name": "Internet Content & Information"},
  {"industry_code": "INTERNET_RETAIL", "name": "Internet Retail"},
  {"industry_code": "INTERNET_SALES_AND_DIRECT_MARKETING", "name": "Internet Sales and Direct Marketing"},
  {"industry_code": "LEISURE", "name": "Leisure"},
  {"industry_code": "LODGING", "name": "Lodging"},
  {"industry_code": "LOGISTICS_AND_AIR_FREIGHT_TRANSPORT_SERVICES", "name": "Logistics and Air Freight Transport Services"},
  {"industry_code": "LUMBER_WOOD_PRODUCTION", "name": "Lumber & Wood Production"},
  {"industry_code": "LUXURY_GOODS", "name": "Luxury Goods"},
  {"industry_code": "MACHINERY", "name": "Machinery"},
  {"industry_code": "MARINE_SHIPPING", "name": "Marine Shipping"},
  {"industry_code": "MARINE_TRANSPORT", "name": "Marine transport"},
  {"industry_code": "MEDIA", "name": "Media"},
  {"industry_code": "MEDICAL_CARE_FACILITIES", "name": "Medical Care Facilities"},
  {"industry_code": "MEDICAL_DEVICES", "name": "Medical Devices"},
  {"industry_code": "MEDICAL_EQUIPMENT_AND_SUPPLIES", "name": "Medical Equipment and Supplies"},
  {"industry_code": "MEDICAL_INSTRUMENTS_SUPPLIES", "name": "Medical Instruments & Supplies"},
  {"industry_code": "MEDICAL_SERVICE_PROVIDERS", "name": "Medical Service Providers"},
  {"industry_code": "METALS_AND_MINING", "name": "Metals and Mining"},
  {"industry_code": "MULTI_LINE_SALES", "name": "Multi-line Sales"},
  {"industry_code": "MULTISERVICES", "name": "Multiservices"},
  {"industry_code": "NOT_APPLICABLE", "name": "Not Applicable"},
  {"industry_code": "OIL_GAS_E_P", "name": "Oil & Gas E&P"},
  {"industry_code": "OIL_GAS_INTEGRATED", "name": "Oil & Gas Integrated"},
  {"industry_code": "OIL_GAS_MIDSTREAM", "name": "Oil & Gas Midstream"},
  {"industry_code": "OIL_GAS_REFINING_MARKETING", "name": "Oil & Gas Refining & Marketing"},
  {"industry_code": "OIL_GAS_AND_FUELS", "name": "Oil, Gas and Fuels"},
  {"industry_code": "OTHER_INDUSTRIAL_METALS_MINING", "name": "Other Industrial Metals & Mining"},
  {"industry_code": "OTHER_PRECIOUS_METALS_MINING", "name": "Other Precious Metals & Mining"},
  {"industry_code": "PACKAGED_FOODS", "name": "Packaged Foods"},
  {"industry_code": "PACKAGING_CONTAINERS", "name": "Packaging & Containers"},
  {"industry_code": "PAPER_PAPER_PRODUCTS", "name": "Paper & Paper Products"},
  {"industry_code": "PERSONAL_FINANCIAL_SERVICES", "name": "Personal Financial Services"},
  {"industry_code": "PERSONAL_PRODUCTS", "name": "Personal Products"},
  {"industry_code": "PHARMACEUTICAL_RETAILERS", "name": "Pharmaceutical Retailers"},
  {"industry_code": "PHARMACEUTICAL_PRODUCTS", "name": "Pharmaceutical products"},
  {"industry_code": "PROFESSIONAL_SERVICES", "name": "Professional services"},
  {"industry_code": "PUBLISHING", "name": "Publishing"},
  {"industry_code": "REIT_DIVERSIFIED", "name": "REIT-Diversified"},
  {"industry_code": "REIT_INDUSTRIAL", "name": "REIT-Industrial"},
  {"industry_code": "REIT_SPECIALTY", "name": "REIT-Specialty"},
  {"industry_code": "RAILROADS", "name": "Railroads"},
  {"industry_code": "REAL_ESTATE", "name": "Real Estate"},
  {"industry_code": "REAL_ESTATE_INVESTMENT_MORTGAGE_TRUST", "name": "Real Estate Investment Mortgage Trust"},
  {"industry_code": "REAL_ESTATE_SERVICES", "name": "Real Estate Services"},
  {"industry_code": "REAL_ESTATE_DEVELOPMENT", "name": "Real Estate—Development"},
  {"industry_code": "RECREATIONAL_PRODUCTS", "name": "Recreational Products"},
  {"industry_code": "RENTAL_LEASING_SERVICES", "name": "Rental & Leasing Services"},
  {"industry_code": "RESIDENTIAL_CONSTRUCTION", "name": "Residential Construction"},
  {"industry_code": "RESORTS_CASINOS", "name": "Resorts & Casinos"},
  {"industry_code": "RESTAURANTS", "name": "Restaurants"},
  {"industry_code": "ROADS_AND_RAILWAYS", "name": "Roads and Railways"},
  {"industry_code": "SALE_OF_FOOD_AND_BASIC_PRODUCTS", "name": "Sale of Food and Basic Products"},
  {"industry_code": "SAVINGS_AND_MORTGAGE_FINANCING", "name": "Savings and Mortgage Financing"},
  {"industry_code": "SECURITY_PROTECTION_SERVICES", "name": "Security & Protection Services"},
  {"industry_code": "SEMICONDUCTOR_EQUIPMENT_MATERIALS", "name": "Semiconductor Equipment & Materials"},
  {"industry_code": "SEMICONDUCTORS", "name": "Semiconductors"},
  {"industry_code": "SEMICONDUCTORS_AND_RELATED_EQUIPMENT", "name": "Semiconductors and Related Equipment"},
  {"industry_code": "SOFTWARE", "name": "Software"},
  {"industry_code": "SOFTWARE_APPLICATION", "name": "Software-Application"},
  {"industry_code": "SOFTWARE_INFRASTRUCTURE", "name": "Software-Infrastructure"},
  {"industry_code": "SPECIALIZED_SALES", "name": "Specialized sales"},
  {"industry_code": "SPECIALTY_BUSINESS_SERVICES", "name": "Specialty Business Services"},
  {"industry_code": "SPECIALTY_CHEMICALS", "name": "Specialty Chemicals"},
  {"industry_code": "SPECIALTY_INDUSTRIAL_MACHINERY", "name": "Specialty Industrial Machinery"},
  {"industry_code": "SPECIALTY_RETAIL", "name": "Specialty Retail"},
  {"industry_code": "STEEL", "name": "Steel"},
  {"industry_code": "STRUCTURED_NOTE", "name": "Structured Note"},
  {"industry_code": "TABACO", "name": "Tabaco"},
  {"industry_code": "TECHNOLOGICAL_EQUIPMENT_ELECTRONIC_STORAGE_AND_PER", "name": "Technological Equipment, Electronic Storage and Peripherals"},
  {"industry_code": "TECHNOLOGICAL_SERVICES_FOR_THE_HEALTH_AREA", "name": "Technological Services for the Health Area"},
  {"industry_code": "TECHNOLOGY", "name": "Technology"},
  {"industry_code": "TELECOM", "name": "Telecom"},
  {"industry_code": "TELECOM_SERVICES", "name": "Telecom Services"},
  {"industry_code": "TEXTILE_CLOTHING_AND_LUXURY", "name": "Textile, Clothing and Luxury"},
  {"industry_code": "TOBACCO", "name": "Tobacco"},
  {"industry_code": "TOOLS_ACCESSORIES", "name": "Tools & Accessories"},
  {"industry_code": "TOOLS_AND_SERVICES_FOR_HEALTH_SCIENCES", "name": "Tools and Services for Health Sciences"},
  {"industry_code": "TRADE_AND_DISTRIBUTION", "name": "Trade and Distribution"},
  {"industry_code": "TRANSPORT_INFRASTRUCTURE", "name": "Transport Infrastructure"},
  {"industry_code": "TRAVEL_SERVICES", "name": "Travel Services"},
  {"industry_code": "UTILITIES", "name": "Utilities"},
  {"industry_code": "UTILITIES_DIVERSIFIED", "name": "Utilities-Diversified"},
  {"industry_code": "UTILITIES_REGULATED_ELECTRIC", "name": "Utilities-Regulated Electric"},
  {"industry_code": "UTILITIES_REGULATED_WATER", "name": "Utilities-Regulated Water"},
  {"industry_code": "VARIOUS_TELECOMMUNICATIONS_SERVICES", "name": "Various Telecommunications Services"},
  {"industry_code": "WASTE_MANAGEMENT", "name": "Waste Management"},
  {"industry_code": "WATER_SUPPLY", "name": "Water supply"},
  {"industry_code": "WIRELESS_TELECOMMUNICATION_SERVICES", "name": "Wireless Telecommunication Services"},
  {"industry_code": "WOOD_AND_PAPER_PRODUCTS", "name": "Wood and Paper Products"}
]

# --- 2. GENERADOR AUTOMÁTICO DE MAPAS ---
INDUSTRY_LOOKUP = {}
VALID_INDUSTRY_CODES = set()

def clean_industry_string(s):
    if not s: return ""
    return s.lower().strip()

for item in DB_INDUSTRIES_CATALOG:
    code = item["industry_code"]
    name = item["name"]
    VALID_INDUSTRY_CODES.add(code)
    INDUSTRY_LOOKUP[clean_industry_string(name)] = code
    INDUSTRY_LOOKUP[clean_industry_string(code)] = code

# --- MAPAS DE CLASES ---
CLASS_MAP = {
    "EQUITY": {"id": 1, "subs": {"COMMON": 1, "PREFERRED": 2, "ETF": 9}},
    "FIXED_INCOME": {"id": 2, "subs": {"GOVT": 3, "CORP": 4, "FI_FUND": 5, "STRUCTURED_NOTES": 6}},
    "FUND": {"id": 3, "subs": {"OPEN_END": 7, "CLOSED_END": 8, "ETF": 9}},
    "FUTURE": {"id": 4, "subs": {"FUT_CASH": 10, "FUT_DELIV": 11}},
    "OPTION": {"id": 5, "subs": {"CALL": 12, "PUT": 13}},
    "CASH": {"id": 7, "subs": {}},
    "CRYPTO": {"id": 8, "subs": {"COIN": 16, "TOKEN": 17}},
}

MONTH_MAP = {
    "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
    "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
}

# --- FUNCIONES DE AYUDA ---

def get_country_from_isin(isin):
    if isin and len(isin) >= 2:
        return isin[:2].upper()
    return None

def normalize_float(val):
    if val is None:
        return 0.0
    return float(val)

def resolve_industry(britech_industry):
    if not britech_industry or britech_industry == "-":
        return None
    
    clean_input = clean_industry_string(britech_industry)
    if clean_input in INDUSTRY_LOOKUP:
        return INDUSTRY_LOOKUP[clean_input]
    
    heuristic_code = britech_industry.upper().replace(" ", "_").replace("-", "_").replace("&", "_")
    heuristic_code = re.sub(r"_+", "_", heuristic_code)
    
    if heuristic_code in VALID_INDUSTRY_CODES:
        return heuristic_code

    print(f"⚠️ Industria no mapeada encontrada: '{britech_industry}'")
    return None

# --- PARSING DE BASKETS DE NOTAS ESTRUCTURADAS ---
def parse_structured_note_basket(desc):
    if not desc:
        return []
    match = re.search(r"\(([\w\s,.-]+)\)", desc)
    if match:
        content = match.group(1)
        tickers = [t.strip().upper() for t in content.split(",") if t.strip()]
        clean_tickers = []
        for t in tickers:
            if len(t) < 12 and not any(x in t for x in ["%", "YEAR", "MONTH", "DAY"]):
                clean_tickers.append(t)
        return clean_tickers
    return []

# --- PARSING DE OPCIONES ---
def parse_option_description(desc, symbol):
    desc = desc.upper().strip()
    match = re.search(r"^(?P<ticker>\w+)\s+(?P<day>\d{1,2})(?P<month>[A-Z]{3})(?P<year>\d{2})\s+(?P<strike>[\d\.]+)\s+(?P<type>[CP])$", desc)
    
    if match:
        data = match.groupdict()
        try:
            month_num = MONTH_MAP.get(data["month"], "01")
            expiry_str = f"20{data['year']}-{month_num}-{data['day'].zfill(2)}"
            expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d").date()
            put_call = "CALL" if data["type"] == "C" else "PUT"
            strike = float(data["strike"])
            underlying = data["ticker"]
            return underlying, strike, expiry_date, put_call
        except Exception:
            pass

    if symbol:
        osi_match = re.search(r"(\d{6})([CP])(\d+)", symbol) 
        if osi_match:
            date_part, type_part, strike_part = osi_match.groups()
            put_call = "CALL" if type_part == "C" else "PUT"
            strike = float(strike_part) / 1000.0
            try:
                expiry_date = datetime.strptime(date_part, "%y%m%d").date()
                underlying = symbol.split(date_part)[0].strip()
                return underlying, strike, expiry_date, put_call
            except:
                pass
    return None, 0.0, None, None

# --- PARSING DE BONOS (FECHA Y CUPÓN) [NUEVO] ---
def parse_bond_description(desc):
    """
    Intenta extraer la fecha de vencimiento y el cupón.
    ESTRATEGIA: 
    1. Extraer y BORRAR la fecha del texto primero. Esto evita que "04/03/27" se confunda con una fracción "4/3".
    2. Buscar decimales (7.051).
    3. Buscar fracciones (7 1/2).
    """
    if not desc:
        return None, 0.0

    maturity_date = None
    coupon_rate = 0.0
    
    # --- PASO 1: ENCONTRAR FECHA Y LIMPIAR TEXTO ---
    # Regex: MM/DD/YY o MM/DD/YYYY
    date_match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", desc)
    
    clean_desc = desc # Usaremos esta variable para buscar el cupón sin la interferencia de la fecha
    
    if date_match:
        m, d, y = date_match.groups()
        # Borramos la fecha encontrada del texto para que no interfiera con los números
        clean_desc = desc.replace(date_match.group(0), "") 
        
        if len(y) == 2:
            y = "20" + y
        try:
            maturity_date = datetime.strptime(f"{y}-{m.zfill(2)}-{d.zfill(2)}", "%Y-%m-%d").date()
        except ValueError:
            pass
    
    # --- PASO 2: BUSCAR CUPÓN EN EL TEXTO LIMPIO ---
    
    # A) Intento Decimal (ej: "7.051")
    # (?:\b|^) asegura que empiece al principio o tras un espacio (evita agarrar .051 de 7.051)
    decimal_match = re.search(r"(?:\b|^)(\d+\.\d+)(?:%|\b)", clean_desc)
    if decimal_match:
        coupon_rate = float(decimal_match.group(1))
    
    # B) Intento Fracción (ej: "7 1/2" o "5 3/8") - Solo si no hallamos decimal
    if coupon_rate == 0.0:
        frac_match = re.search(r"(?:\b|^)(\d+)\s+(\d+)/(\d+)(?:%|\b)", clean_desc)
        if frac_match:
            whole, num, den = map(int, frac_match.groups())
            if den != 0:
                coupon_rate = float(whole) + (float(num) / float(den))
                
    # C) Intento Entero simple (ej: "7.5%" escrito raro o solo "7")
    # A veces viene "GNBSUD 7 04/..." (sin decimales)
    if coupon_rate == 0.0:
        # Buscamos un numero solo, pero con cuidado de no agarrar el año si quedó basura
        # Usamos clean_desc que ya no tiene la fecha
        int_match = re.search(r"(?:\b|^)(\d+)(?:%|\s|$)", clean_desc)
        if int_match:
            # Validación extra: el cupón suele ser menor a 20%
            val = float(int_match.group(1))
            if 0 < val < 25: 
                coupon_rate = val

    return maturity_date, coupon_rate

def detect_asset_class(asset):
    raw_type = asset.get("AssetType", "")
    raw_class = asset.get("AssetClass", "").upper()
    desc = asset.get("Description", "").strip().upper()
    
    is_option_desc = desc.endswith(" C") or desc.endswith(" P")
    if raw_type == "Options" or is_option_desc:
        sub = "CALL" if (desc.endswith(" C") or " CALL " in desc) else "PUT"
        return "OPTION", sub

    if "ACTIVOS DIGITALES" in raw_class or asset.get("Symbol") in ["BTC", "ETH", "USDT"]:
        return "CRYPTO", "COIN"

    if "EFECTIVO" in raw_class or "LIQUIDITY" in desc or "MONEY MARKET" in desc:
        return "CASH", None

    if raw_class == "RENTA FIJA" or raw_type == "FixedIncome":
        if "AUTOCALL" in desc or "PHOENIX" in desc:
            return "FIXED_INCOME", "STRUCTURED_NOTES"
        if "GOV" in desc or "TREASURY" in desc:
            return "FIXED_INCOME", "GOVT"
        return "FIXED_INCOME", "CORP"

    if raw_type == "Funds" or "ETF" in desc or "UCITS" in desc:
        if "ETF" in desc:
            return "FUND", "ETF"
        return "FUND", "OPEN_END"

    return "EQUITY", "COMMON"

# --- TRANSFORMACIÓN PRINCIPAL ---

def transform_asset(raw_asset):
    code_class, code_sub = detect_asset_class(raw_asset)
    class_def = CLASS_MAP.get(code_class, {})
    class_id = class_def.get("id")
    sub_class_id = class_def.get("subs", {}).get(code_sub)

    if not class_id:
        return None

    symbol = raw_asset.get("Symbol")
    desc = raw_asset.get("Description") or ""
    
    # Corrección País
    country_code = raw_asset.get("CountryCode")
    if not country_code:
        country_code = get_country_from_isin(raw_asset.get("ISIN"))
    if country_code == "UnitedStates": country_code = "US"
    if country_code: country_code = country_code.upper()

    # Variables de Opciones
    parsed_strike = 0.0
    parsed_expiry = None
    parsed_put_call = None
    parsed_underlying = None

    if code_class == "OPTION":
        u, s, e, pc = parse_option_description(desc, symbol)
        parsed_underlying = u
        parsed_strike = s
        parsed_expiry = e
        parsed_put_call = pc
        if parsed_put_call:
            sub_class_id = CLASS_MAP["OPTION"]["subs"].get(parsed_put_call)

    # Variables de Renta Fija
    parsed_maturity = None
    parsed_coupon = 0.0
    structured_note_details = None
    
    if code_class == "FIXED_INCOME":
        # 1. Intentar parsear descripción de bono (Fecha y Cupón)
        parsed_maturity, parsed_coupon = parse_bond_description(desc)

        # 2. Detectar Basket (Notas Estructuradas)
        basket_tickers = parse_structured_note_basket(desc)
        if basket_tickers or "GARANTIZADO" in desc.upper() or "AUTOCALL" in desc.upper():
            sub_class_id = 6 
            structured_note_details = {
                "basket_detected": True,
                "underlyings": basket_tickers,
                "original_text": desc
            }
            if basket_tickers:
                parsed_underlying = basket_tickers[0]

    industry_code_result = resolve_industry(raw_asset.get("Industry"))

    # LÓGICA DE PRIORIDAD PARA FECHAS Y CUPONES
    # Usamos el dato parseado SOLO si el original es nulo/cero
    
    final_maturity = raw_asset.get("MaturityDate")
    if final_maturity == "0001-01-01T00:00:00" or not final_maturity:
        final_maturity = parsed_maturity

    final_coupon = normalize_float(raw_asset.get("FixedRate"))
    if final_coupon == 0.0 and parsed_coupon > 0:
        final_coupon = parsed_coupon

    transformed = {
        "class_id": class_id,
        "sub_class_id": sub_class_id,
        "symbol": symbol,
        "description": desc,
        "isin": raw_asset.get("ISIN"),
        "cusip": raw_asset.get("CUSIP"),
        "ib_conid": None, 
        
        "industry_code": industry_code_result,
        "country_code": country_code,
        "currency": raw_asset.get("Currency"),
        
        "multiplier": normalize_float(raw_asset.get("PriceFactor")),
        "contract_size": normalize_float(raw_asset.get("ContractSize")),
        
        # Opciones
        "strike_price": parsed_strike if parsed_strike > 0 else normalize_float(raw_asset.get("StrikePrice")),
        "expiry_date": parsed_expiry if parsed_expiry else (raw_asset.get("ExpiryDate") if raw_asset.get("ExpiryDate") != "0001-01-01T00:00:00" else None),
        "put_call": parsed_put_call, 
        "underlying_symbol": parsed_underlying,
        
        # Renta Fija
        "maturity_date": final_maturity,
        "coupon_rate": final_coupon,
        
        "structured_note_details": structured_note_details,
        "is_active": True
    }
    
    return transformed

def main():
    try:
        content = Path(INPUT_FILE).read_text(encoding='utf-8')
        raw_data = json.loads(content)
    except Exception as e:
        print(f"Error leyendo archivo: {e}")
        return

    assets_list = raw_data if isinstance(raw_data, list) else raw_data.get("Results", [])
    ready_assets = []
    skipped_assets = []

    print(f"Procesando {len(assets_list)} activos...")

    for asset in assets_list:
        try:
            t_asset = transform_asset(asset)
            if t_asset:
                ready_assets.append(t_asset)
            else:
                skipped_assets.append(asset)
        except Exception as e:
            print(f"Error procesando {asset.get('Symbol')}: {e}")
            skipped_assets.append(asset)

    Path(OUTPUT_FILE).write_text(json.dumps(ready_assets, indent=2, default=str), encoding='utf-8')
    print("-" * 30)
    print(f"✅ Assets procesados: {len(ready_assets)}")
    print(f"⚠️ Saltados: {len(skipped_assets)}")
    print(f"📁 Salida: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()