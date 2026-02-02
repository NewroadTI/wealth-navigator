import sys
import os
import re
import json
import logging
import pandas as pd
import uuid
from datetime import datetime
from decimal import Decimal
from difflib import SequenceMatcher

# Configuración de ruta
sys.path.append("seed_data")
sys.path.append(".")

try:
    # Asegúrate de importar Industry
    from app.db.session import SessionLocal
    from app.models.user import User, Role
    from app.core.security import get_password_hash
    # ... otros imports ...
    from app.models.portfolio import Portfolio, Account, AccountReturnSeries
    from app.models.asset import Asset, Trades, CashJournal, CorporateAction, PerformanceAttribution, Position, Industry, FXTransaction, IncomeProjection
except ImportError:
    print("⚠️ Error importando modelos. Ejecuta desde la raíz del proyecto.")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SPLIT_DIR = os.path.join(BASE_DIR, "inceptioncsvs")
if not os.path.exists(SPLIT_DIR):
    SPLIT_DIR = "seed_data/inceptioncsvs"

JSON_OUTPUT_FILE = os.path.join(BASE_DIR, "insertion_summary.json")

# Institución para este importador (solo IBKR)
INSTITUTION = "IBKR"

# Umbral de similaridad para matching de usuarios (0.0 a 1.0)
SIMILARITY_THRESHOLD = 0.65

CURRENCY_MAP = {
    "United States Dollar": "USD", "Hong Kong Dollar": "HKD", "Great British Pound": "GBP",
    "Euro": "EUR", "Canadian Dollar": "CAD", "Swiss Franc": "CHF",
    "Japanese Yen": "JPY", "Australian Dollar": "AUD", "Chinese Renminbi": "CNH",
    "Taiwan Dollar": "TWD", "New Taiwan Dollar": "TWD", "Singapore Dollar": "SGD",
    "Mexican Peso": "MXN", "South Korean Won": "KRW", "Indian Rupee": "INR",
    "USD": "USD", "HKD": "HKD", "GBP": "GBP", "EUR": "EUR", "TWD": "TWD",
    "SGD": "SGD", "MXN": "MXN", "KRW": "KRW", "INR": "INR"
}
# Mapa de monedas global - incluyendo monedas adicionales para FX
MONEDAS_SUPPORTED = [
    "USD", "HKD", "GBP", "EUR", "CAD", "CHF", "JPY", "AUD", "CNH",
    "TWD", "SGD", "MXN", "KRW", "INR"  # Monedas adicionales para FX
]

# --- ERROR TRACKING ---
import_errors = []

def log_error(error_type, message, details=None):
    """Registra un error para el reporte final."""
    error_entry = {
        "type": error_type,
        "message": message,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    import_errors.append(error_entry)
    logger.error(f"❌ [{error_type}] {message}")
    if details:
        logger.error(f"   Detalles: {details}")

def print_error_summary():
    """Imprime un resumen de todos los errores al final."""
    if not import_errors:
        logger.info("✅ No se registraron errores durante la importación.")
        return
    
    print("\n" + "="*60)
    print("📋 RESUMEN DE ERRORES")
    print("="*60)
    
    # Agrupar por tipo
    errors_by_type = {}
    for err in import_errors:
        t = err["type"]
        if t not in errors_by_type:
            errors_by_type[t] = []
        errors_by_type[t].append(err)
    
    for error_type, errors in errors_by_type.items():
        print(f"\n🔴 {error_type}: {len(errors)} errores")
        for err in errors[:5]:  # Mostrar solo los primeros 5 de cada tipo
            print(f"   - {err['message']}")
        if len(errors) > 5:
            print(f"   ... y {len(errors) - 5} más")
    
    print(f"\n📊 Total de errores: {len(import_errors)}")
    print("="*60)

# --- FUNCIONES DE NORMALIZACIÓN Y SIMILARIDAD ---

def normalize_name(name):
    """
    Normaliza un nombre para comparación:
    - Convierte a minúsculas
    - Remueve acentos/tildes
    - Remueve caracteres especiales
    - Normaliza espacios
    """
    if not name:
        return ""
    
    # Convertir a minúsculas
    name = name.lower()
    
    # Mapeo de acentos
    accent_map = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ñ': 'n', 'ü': 'u', 'à': 'a', 'è': 'e', 'ì': 'i',
        'ò': 'o', 'ù': 'u', 'ä': 'a', 'ë': 'e', 'ï': 'i',
        'ö': 'o', 'ç': 'c'
    }
    for accent, replacement in accent_map.items():
        name = name.replace(accent, replacement)
    
    # Remover "and" y conectores comunes (para cuentas conjuntas)
    name = re.sub(r'\band\b', ' ', name)
    name = re.sub(r'\by\b', ' ', name)
    name = re.sub(r'\b(sr|jr|sra|de|la|del|vda|los|las)\b', ' ', name)
    
    # Remover puntuación y caracteres especiales
    name = re.sub(r'[^a-z0-9\s]', ' ', name)
    
    # Normalizar espacios múltiples
    name = re.sub(r'\s+', ' ', name).strip()
    
    return name

def extract_primary_name(full_name):
    """
    Extrae el nombre principal de una cuenta (primer titular).
    Para "Santiago C Pardo Barrena and Rocio Diaz Garcia" -> "Santiago C Pardo Barrena"
    """
    if not full_name:
        return ""
    
    # Separar por "and" o "&"
    parts = re.split(r'\s+and\s+|\s*&\s*', full_name, flags=re.IGNORECASE)
    return parts[0].strip() if parts else full_name

def calculate_name_similarity(name1, name2):
    """
    Calcula la similaridad entre dos nombres usando múltiples estrategias.
    Retorna un score de 0.0 a 1.0
    """
    # Normalizar ambos nombres
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)
    
    if not norm1 or not norm2:
        return 0.0
    
    # Estrategia 1: SequenceMatcher directo
    direct_ratio = SequenceMatcher(None, norm1, norm2).ratio()
    
    # Estrategia 2: Comparación de tokens (palabras)
    tokens1 = set(norm1.split())
    tokens2 = set(norm2.split())
    
    if not tokens1 or not tokens2:
        return direct_ratio
    
    # Jaccard similarity de tokens
    intersection = len(tokens1 & tokens2)
    union = len(tokens1 | tokens2)
    token_ratio = intersection / union if union > 0 else 0
    
    # Estrategia 3: Tokens ordenados
    sorted1 = ' '.join(sorted(tokens1))
    sorted2 = ' '.join(sorted(tokens2))
    sorted_ratio = SequenceMatcher(None, sorted1, sorted2).ratio()
    
    # Combinar scores (dar más peso a token matching)
    final_score = (direct_ratio * 0.3) + (token_ratio * 0.4) + (sorted_ratio * 0.3)
    
    return final_score

def find_existing_user(db, raw_name):
    """
    Busca un usuario existente en la DB por similaridad de nombre.
    Retorna (user, match_score, match_type) o (None, 0, None) si no encuentra.
    """
    if not raw_name:
        return None, 0, None
    
    # Extraer nombre principal (primer titular)
    primary_name = extract_primary_name(raw_name)
    normalized_input = normalize_name(primary_name)
    
    # Obtener todos los usuarios de la DB
    all_users = db.query(User).all()
    
    best_match = None
    best_score = 0
    match_type = None
    
    for user in all_users:
        # Comparar con full_name
        if user.full_name:
            score_full = calculate_name_similarity(primary_name, user.full_name)
            if score_full > best_score:
                best_score = score_full
                best_match = user
                match_type = "full_name"
        
        # Comparar con username
        if user.username:
            score_user = calculate_name_similarity(primary_name, user.username)
            if score_user > best_score:
                best_score = score_user
                best_match = user
                match_type = "username"
    
    # Solo retornar si supera el umbral
    if best_score >= SIMILARITY_THRESHOLD:
        return best_match, best_score, match_type
    
    return None, best_score, None

def setup_dynamic_user_from_csv(db, folder_path):
    """
    Lee Introduction_0.csv de la carpeta dada, busca o crea Usuario, 
    Portafolio y Cuentas IBKR.
    
    LÓGICA:
    1. Buscar usuario existente por similaridad de nombre
    2. Si existe, usar ese usuario
    3. Buscar si ya tiene un portfolio
    4. Si tiene portfolio, añadir las cuentas IBKR a ese portfolio
    5. Si no tiene portfolio, crear uno nuevo
    6. Crear sub-cuentas por cada moneda soportada
    
    Retorna el mapa de IDs de cuentas { 'USD': 1, 'EUR': 2 ... } o None si hay error.
    """
    intro_file = os.path.join(folder_path, "Introduction_0.csv")
    
    # 1. Validar existencia del archivo
    if not os.path.exists(intro_file):
        log_error("FILE_NOT_FOUND", f"No se encontró Introduction_0.csv en: {folder_path}")
        return None

    try:
        df = pd.read_csv(intro_file)
        if df.empty:
            log_error("EMPTY_FILE", f"El archivo Introduction_0.csv está vacío en: {folder_path}")
            return None
            
        # Tomamos la primera fila de datos
        row = df.iloc[0]
        
        # Extraer datos con valores por defecto seguros
        raw_name = str(row.get("Name", "Unknown User")).strip()
        account_code_base = str(row.get("Account", "U0000000")).strip()
        base_currency = str(row.get("BaseCurrency", "USD")).strip()
        alias = str(row.get("Alias", "")).strip()
        if alias == "nan": alias = ""

    except Exception as e:
        log_error("CSV_READ_ERROR", f"Error leyendo Introduction_0.csv: {e}", {"folder": folder_path})
        return None

    logger.info(f"\n{'='*60}")
    logger.info(f"👤 Procesando: {raw_name}")
    logger.info(f"📋 Cuenta IBKR: {account_code_base}")
    logger.info(f"💰 Moneda Base: {base_currency}")
    logger.info(f"{'='*60}")

    # ---------------------------------------------------------
    # 2. OBTENER ROL INVESTOR (REQUERIDO)
    # ---------------------------------------------------------
    investor_role = db.query(Role).filter(Role.name == "INVESTOR").first()
    if not investor_role:
        log_error("MISSING_ROLE", "No existe el rol INVESTOR. Ejecuta seed_roles.py primero.")
        return None
    
    # ---------------------------------------------------------
    # 3. BUSCAR USUARIO EXISTENTE POR SIMILARIDAD
    # ---------------------------------------------------------
    existing_user, match_score, match_type = find_existing_user(db, raw_name)
    
    if existing_user:
        user = existing_user
        logger.info(f"   🔍 Usuario encontrado por similaridad:")
        logger.info(f"      - ID: {user.user_id}")
        logger.info(f"      - Nombre DB: {user.full_name}")
        logger.info(f"      - Score: {match_score:.2%}")
        logger.info(f"      - Match por: {match_type}")
    else:
        # No se encontró usuario similar, crear uno nuevo
        primary_name = extract_primary_name(raw_name)
        
        # Generar username y email únicos
        clean_username = re.sub(r'[^a-zA-Z0-9]', '.', primary_name.lower()).strip('.')
        clean_email_name = clean_username.replace('.', '')
        
        # Verificar unicidad de username
        base_username = clean_username
        counter = 1
        while db.query(User).filter(User.username == clean_username).first():
            clean_username = f"{base_username}_{counter}"
            counter += 1
        
        # Verificar unicidad de email
        dummy_email = f"{clean_email_name}@example.com"
        base_email = dummy_email
        counter = 1
        while db.query(User).filter(User.email == dummy_email).first():
            dummy_email = f"{clean_email_name}_{counter}@example.com"
            counter += 1
        
        user = User(
            username=clean_username,
            email=dummy_email,
            password_hash=get_password_hash("password123"),
            full_name=primary_name,
            phone="000000000",
            is_active=True,
            role_id=investor_role.role_id
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
            logger.info(f"   ✅ Usuario NUEVO creado:")
            logger.info(f"      - ID: {user.user_id}")
            logger.info(f"      - Username: {user.username}")
            logger.info(f"      - Full Name: {user.full_name}")
        except Exception as e:
            db.rollback()
            log_error("USER_CREATE_ERROR", f"Error creando usuario: {e}", {"name": raw_name})
            return None

    # ---------------------------------------------------------
    # 4. BUSCAR O CREAR PORTAFOLIO
    # ---------------------------------------------------------
    # Buscar si el usuario ya tiene un portfolio
    existing_portfolio = db.query(Portfolio).filter(Portfolio.owner_user_id == user.user_id).first()
    
    if existing_portfolio:
        port = existing_portfolio
        logger.info(f"   📂 Portfolio existente encontrado:")
        logger.info(f"      - ID: {port.portfolio_id}")
        logger.info(f"      - Nombre: {port.name}")
    else:
        # Crear nuevo portfolio
        port_interface_code = f"port_{user.user_id}_{account_code_base.lower()}"
        
        port = Portfolio(
            owner_user_id=user.user_id,
            interface_code=port_interface_code,
            name=f"Portfolio {user.full_name or user.username}",
            main_currency=base_currency, 
            residence_country="PE",
            inception_date=datetime.today().date()
        )
        db.add(port)
        try:
            db.commit()
            db.refresh(port)
            logger.info(f"   ✅ Portfolio NUEVO creado:")
            logger.info(f"      - ID: {port.portfolio_id}")
            logger.info(f"      - Nombre: {port.name}")
        except Exception as e:
            db.rollback()
            log_error("PORTFOLIO_CREATE_ERROR", f"Error creando portfolio: {e}", {"user_id": user.user_id})
            return None

    # ---------------------------------------------------------
    # 5. CREAR / OBTENER CUENTAS IBKR (Multi-Moneda)
    # ---------------------------------------------------------
    acct_map = {}
    accounts_created = 0
    accounts_existing = 0
    
    for currency in MONEDAS_SUPPORTED:
        # Formato estándar: U6177570_USD, U6177570_EUR, etc.
        sub_account_code = f"{account_code_base}_{currency}"
        
        # Buscar si ya existe esta cuenta específica
        acc = db.query(Account).filter(Account.account_code == sub_account_code).first()
        
        if acc:
            accounts_existing += 1
        else:
            acc = Account(
                portfolio_id=port.portfolio_id,
                account_code=sub_account_code,
                currency=currency,
                institution=INSTITUTION,  # Siempre IBKR para este importador
                account_alias=account_code_base,
                account_type="Individual"
            )
            db.add(acc)
            try:
                db.commit()
                db.refresh(acc)
                accounts_created += 1
            except Exception as e:
                db.rollback()
                log_error("ACCOUNT_CREATE_ERROR", f"Error creando cuenta {sub_account_code}: {e}")
                continue
        
        acct_map[currency] = acc.account_id

    logger.info(f"   💳 Cuentas IBKR configuradas:")
    logger.info(f"      - Nuevas: {accounts_created}")
    logger.info(f"      - Existentes: {accounts_existing}")
    logger.info(f"      - Total monedas: {len(acct_map)}")
    
    return acct_map
# --- ACUMULADORES ---
inserted_records = {
    "Trades": [],
    "CashJournal": [],
    "CorporateActions": [],
    "Performance": [],
    "History": [],
    "IncomeProjections": []  
}

stats = {"CSV_Rows": 0, "DB_Inserted": 0}

# LISTA PARA GUARDAR ERRORES/SKIPS
skipped_log = []

# --- HELPERS ---
def parse_decimal(val):
    if pd.isna(val) or str(val).strip() in ["", "-", "nan", "None"]: return None
    try:
        clean = str(val).replace(",", "").replace("$", "").replace(" ", "").strip()
        if clean.startswith("<"): return None 
        return Decimal(clean)
    except: return None

def validate_numeric_limit(val, precision=10, scale=6):
    if val is None: return None
    limit = Decimal(10**(precision - scale)) 
    if abs(val) >= limit:
        return None 
    return val

def parse_date(val):
    if pd.isna(val) or str(val).strip() == "": return None
    s = str(val).strip()
    try:
        if re.match(r"^\d{8}$", s): return datetime.strptime(s, "%Y%m%d").date()
        if "/" in s:
            try: return datetime.strptime(s, "%m/%d/%y").date()
            except: return datetime.strptime(s, "%m/%d/%Y").date()
        if "-" in s: return datetime.strptime(s, "%Y-%m-%d").date()
    except: pass
    return None

def get_currency_code(raw_val):
    if not raw_val or pd.isna(raw_val): return "USD"
    clean = str(raw_val).strip()
    return CURRENCY_MAP.get(clean, "USD")

asset_cache = {}
def get_asset_id(db, symbol):
    if not symbol or pd.isna(symbol): return None
    s = str(symbol).strip()
    if s in asset_cache: return asset_cache[s]
    asset = db.query(Asset).filter(Asset.symbol == s).first()
    if not asset:
        clean = s.split()[0].strip()
        asset = db.query(Asset).filter(Asset.symbol == clean).first()
    aid = asset.asset_id if asset else None
    if aid: asset_cache[s] = aid
    return aid

# --- MÓDULOS ---


def import_trades(db, acct_map, folder_path):
    fpath = os.path.join(folder_path, "Trade_Summary_0.csv")
    if not os.path.exists(fpath): return

    logger.info(f"🛒 Importando Trades y FX...")
    df = pd.read_csv(fpath)
    count = 0
    fx_count = 0
    stats["CSV_Rows"] += len(df)

    for i, row in df.iterrows():
        # 1. Extracción de Datos Crudos
        raw_qty_buy = parse_decimal(row.get('Quantity Bought'))
        raw_qty_sell = parse_decimal(row.get('Quantity Sold'))
        financial_instrument = str(row.get('Financial Instrument', '')).strip()
        csv_symbol = str(row.get('Symbol', '')).strip()
        
        # Si no hay movimiento en ninguna dirección, saltamos
        if (not raw_qty_buy or raw_qty_buy == 0) and (not raw_qty_sell or raw_qty_sell == 0):
            continue

        fixed_date = datetime(2025, 12, 1) # Fecha dummy

        # ===================================================
        # CASO A: TRANSACCIONES FOREX (FX)
        # ===================================================
        if financial_instrument == "Forex":
            parts = csv_symbol.split('.')
            if len(parts) == 2:
                base_curr, quote_curr = parts[0], parts[1]
            else:
                base_curr, quote_curr = "USD", "not_found"

            # --- SUB-BLOQUE 1: COMPRA (BUY) ---
            if raw_qty_buy and raw_qty_buy != 0:
                proceeds_buy = parse_decimal(row.get('Proceeds Bought'))
                
                # Dinero que SALE (Source): Quote Currency (HKD en USD.HKD)
                source_curr = quote_curr
                source_amt = proceeds_buy 
                
                # Dinero que ENTRA (Target): Base Currency (USD en USD.HKD)
                target_curr = base_curr
                target_amt = raw_qty_buy
                
                # Buscamos los IDs de ambas cuentas en tu acct_map
                s_acct_id = acct_map.get(source_curr)
                t_acct_id = acct_map.get(target_curr)

                fx_buy = FXTransaction(
                    trade_date=fixed_date,
                    account_id=s_acct_id,        # Cuenta HKD
                    target_account_id=t_acct_id, # Cuenta USD
                    source_currency=source_curr,
                    source_amount=source_amt,
                    target_currency=target_curr,
                    target_amount=target_amt,
                    exchange_rate=parse_decimal(row.get('Average Price Bought')),
                    side="BUY",
                    external_id=f"FX_B_{uuid.uuid4().hex[:8]}"
                )
                db.add(fx_buy)
                fx_count += 1

            # --- SUB-BLOQUE 2: VENTA (SELL) ---
            if raw_qty_sell and raw_qty_sell != 0:
                proceeds_sell = parse_decimal(row.get('Proceeds Sold'))
                
                # Dinero que SALE (Source): Base Currency (USD en USD.HKD)
                source_curr = base_curr
                source_amt = raw_qty_sell
                
                # Dinero que ENTRA (Target): Quote Currency (HKD en USD.HKD)
                target_curr = quote_curr
                target_amt = proceeds_sell
                
                s_acct_id = acct_map.get(source_curr)
                t_acct_id = acct_map.get(target_curr)

                fx_sell = FXTransaction(
                    trade_date=fixed_date,
                    account_id=s_acct_id,        # Cuenta USD
                    target_account_id=t_acct_id, # Cuenta HKD
                    source_currency=source_curr,
                    source_amount=source_amt,
                    target_currency=target_curr,
                    target_amount=target_amt,
                    exchange_rate=parse_decimal(row.get('Average Price Sold')),
                    side="SELL",
                    #external_id=f"FX_S_{uuid.uuid4().hex[:8]}"
                )
                db.add(fx_sell)
                fx_count += 1
            
            continue

        # ===================================================
        # CASO B: TRADES NORMALES (Stocks, Bonds, ETFs)
        # ===================================================
        curr_code = get_currency_code(row.get('Currency'))
        acct_id = acct_map.get(curr_code, acct_map['USD'])
        
        # Búsqueda de Asset
        asset_id = None
        if csv_symbol: asset_id = get_asset_id(db, csv_symbol)

        if not asset_id and csv_symbol:
            asset_obj = db.query(Asset).filter(Asset.description == csv_symbol).first()
            if not asset_obj:
                tokens = csv_symbol.split()
                if len(tokens) > 1:
                    clean_desc = " ".join(tokens[:-1])
                    asset_obj = db.query(Asset).filter(Asset.description == clean_desc).first()
            if not asset_obj:
                 asset_obj = db.query(Asset).filter(Asset.description.ilike(f"{csv_symbol}%")).first()
            if asset_obj: asset_id = asset_obj.asset_id

        desc = row.get('Description')

        # --- SUB-BLOQUE 1: COMPRA (BUY) ---
        if raw_qty_buy and raw_qty_buy != 0:
            db.add(Trades(
                account_id=acct_id, asset_id=asset_id, trade_date=fixed_date,
                quantity=abs(raw_qty_buy), 
                price=abs(parse_decimal(row.get('Average Price Bought')) or 0),
                gross_amount=parse_decimal(row.get('Proceeds Bought')), 
                currency=curr_code, side="BUY", description=desc
            ))
            count += 1

        # --- SUB-BLOQUE 2: VENTA (SELL) ---
        if raw_qty_sell and raw_qty_sell != 0:
            db.add(Trades(
                account_id=acct_id, asset_id=asset_id, trade_date=fixed_date,
                quantity=abs(raw_qty_sell), 
                price=abs(parse_decimal(row.get('Average Price Sold')) or 0),
                gross_amount=parse_decimal(row.get('Proceeds Sold')), 
                currency=curr_code, side="SELL", description=desc
            ))
            count += 1

    db.commit()
    stats["DB_Inserted"] += (count + fx_count)
    logger.info(f"✅ {count} Trades y {fx_count} FX insertados.")

def import_cash_journal(db, acct_map, folder_path):
    # Definición de archivos y columnas base
    files = [
        ("Dividends_0.csv", "DIVIDEND", "PayDate", "Amount", "Note"),
        ("Deposits_And_Withdrawals_0.csv", "TRANSFER", "Date", "Amount", "Description"),
        ("Interest_Details_0.csv", "INTEREST", "Date", "Amount", "Description"),
        ("Fee_Summary_0.csv", "FEE", "Date", "Amount", "Description")
    ]
    
    total = 0
    usd_asset_id = get_asset_id(db, "USD") or get_asset_id(db, "CASH") #agregar asset cash o usd
    if not usd_asset_id:
        logger.warning("⚠️ No se encontró el Asset 'USD' o 'CASH' en la DB. Los intereses en efectivo quedarán sin Asset ID.")


    for fname, t_def, d_col, a_col, desc_col in files:
        fpath = os.path.join(folder_path, fname)
        if not os.path.exists(fpath): continue
        
        logger.info(f"💰 Procesando {fname}...")
        df = pd.read_csv(fpath)
        stats["CSV_Rows"] += len(df)
        
        for i, row in df.iterrows():
            d = parse_date(row.get(d_col))
            
            # --- DETECCIÓN DE ERROR DE FECHA ---
            if not d:
                skipped_log.append({
                    "File": fname, 
                    "Row": i + 2, 
                    "Reason": f"Fecha inválida o vacía en columna '{d_col}'", 
                    "Data": row.to_dict()
                })
                continue

            desc = str(row.get(desc_col, ""))
            final_type = t_def
            
            # Inicializamos variables opcionales en None para esta fila
            ex_date = None
            quantity = None
            rate_per_share = None
            asset_id = None  # <--- IMPORTANTE: Inicializar aquí para poder modificarlo en los bloques

            # ==========================================
            # 1. LÓGICA PARA DIVIDENDOS
            # ==========================================
            if fname == "Dividends_0.csv":
                # Captura de campos adicionales específicos de Dividendos
                ex_date = parse_date(row.get('Ex-Date'))
                quantity = parse_decimal(row.get('Quantity'))
                rate_per_share = parse_decimal(row.get('DividendPerShare'))


            # ==========================================
            # 2. LÓGICA PARA INTERESES
            # ==========================================

            elif fname == "Interest_Details_0.csv":
                final_type = "INTEREST"
                
                # A. CASH / USD
                if "USD" in desc or "HKD" in desc or "Stock Interest" in desc:
                    asset_id = usd_asset_id
                
                # B. BONOS (Búsqueda inteligente)
                else:
                    ignore_words = [
                        "BOND", "COUPON", "PAYMENT", "ACCRUED", "INTEREST", 
                        "RECEIVED", "PAID", "FOR", "OF", "WITHHOLDING", "TAX"
                    ]
                    
                    tokens = desc.split()
                    for token in tokens:
                        clean_token = token.strip().upper()
                        
                        # Filtros para ignorar basura:
                        if len(clean_token) < 3: continue          # Ignorar palabras de 1 o 2 letras
                        if clean_token in ignore_words: continue   # Ignorar palabras clave
                        # Ignorar si tiene números (ej: "2021", "6.65", "3/8")
                        if any(char.isdigit() for char in clean_token): continue 

                        # 1. Intento Exacto (usando tu cache)
                        found = get_asset_id(db, clean_token)

                        # 2. Intento "Empieza con" (Directo a DB)
                        # Esto encuentra el asset "HNTOIL 6 3/8..." buscando solo "HNTOIL"
                        if not found:
                            # Buscamos en la DB un asset que EMPIECE por esta palabra
                            # Importante: 'Asset' debe estar importado de tus modelos
                            potential = db.query(Asset).filter(Asset.symbol.ilike(f"{clean_token}%")).first()
                            if potential:
                                found = potential.asset_id
                        
                        if found:
                            asset_id = found
                            break
            
            # ==========================================
            # 3. LÓGICA PARA DEPÓSITOS/RETIROS (TRANSFERS)
            # ==========================================
            elif fname == "Deposits_And_Withdrawals_0.csv":
                raw_t = row.get('Type')
                
                # Verificamos si es un valor nulo/NA de Pandas o la cadena "NA"
                is_na = pd.isna(raw_t) or str(raw_t).strip().upper() in ['NA', 'NAN', '']
                
                if is_na:
                    # Si el CSV dice NA, guardamos como NA o ADJUSTMENT según prefieras
                    final_type = "NA" 
                elif raw_t:
                    final_type = str(raw_t).upper()

            # ==========================================
            # LÓGICA COMÚN (Moneda, Assets, Amount)
            # ==========================================
            
            # Moneda
            curr_code = "USD"
            if "HKD" in desc: curr_code = "HKD"
            if "GBP" in desc: curr_code = "GBP"
            if "EUR" in desc: curr_code = "EUR"

            # Búsqueda de Asset ID
            asset_id = None
            if 'Symbol' in row and pd.notna(row['Symbol']):
                asset_id = get_asset_id(db, row['Symbol'])
            
            # Fallback de búsqueda en descripción si no hay Symbol directo
            if not asset_id and desc:
                matches = re.findall(r'\((.*?)\)', desc)
                for candidate in matches:
                    candidate = candidate.strip()
                    found = get_asset_id(db, candidate)
                    if found:
                        asset_id = found
                        break
                    first_word = candidate.split(' ')[0]
                    if first_word and first_word != candidate:
                        found = get_asset_id(db, first_word)
                        if found:
                            asset_id = found
                            break

            amount = parse_decimal(row.get(a_col)) or 0
            
            # Creación del objeto
            cj = CashJournal(
                account_id=acct_map.get(curr_code, acct_map["USD"]),
                asset_id=asset_id,
                date=d,
                type=final_type,
                amount=amount,
                currency=curr_code,
                description=desc,
                
                # --- NUEVOS CAMPOS ---
                ex_date=ex_date,            # Fecha Ex-Dividendo
                quantity=quantity,          # Cantidad de acciones
                rate_per_share=rate_per_share, # Dividendo por acción
                # ---------------------
                
                #reference_code=f"{final_type[:3]}_{uuid.uuid4().hex[:8]}"
            )
            db.add(cj)
            total += 1
            inserted_records["CashJournal"].append({"Date": str(d), "Type": final_type, "Amount": float(amount)})
            
        db.commit()
    
    stats["DB_Inserted"] += total
    logger.info(f"✅ {total} movimientos de caja insertados.")

def import_corporate_actions(db, acct_map,folder_path):
    fpath = os.path.join(folder_path, "Corporate_Actions_0.csv")
    if not os.path.exists(fpath): return
    
    logger.info(f"📢 Importando Corporate Actions...")
    df = pd.read_csv(fpath)
    stats["CSV_Rows"] += len(df)
    count = 0
    
    for i, row in df.iterrows():
        d = parse_date(row.get('Date'))
        
        # --- DETECCIÓN DE ERROR DE FECHA ---
        if not d: 
            skipped_log.append({
                "File": "Corporate_Actions_0.csv", 
                "Row": i + 2, 
                "Reason": "Fecha inválida", 
                "Data": row.to_dict()
            })
            continue
        # -----------------------------------

        desc = str(row.get('Description', ""))
        r_new, r_old = None, None
        match = re.search(r'(\d+(?:\.\d+)?)\s+FOR\s+(\d+(?:\.\d+)?)', desc)
        if match:
            r_new = validate_numeric_limit(Decimal(match.group(1)))
            r_old = validate_numeric_limit(Decimal(match.group(2)))

        ca = CorporateAction(
            account_id=acct_map["USD"],
            report_date=d,
            execution_date=d,
            action_type=row.get('Type'),
            description=desc,
            quantity_adjustment=parse_decimal(row.get('Quantity')),
            ratio_old=r_old,
            ratio_new=r_new,
            #ib_action_id=f"CA_{uuid.uuid4().hex[:8]}"
        )
        db.add(ca)
        count += 1
        inserted_records["CorporateActions"].append({"Date": str(d), "Type": row.get('Type')})

    db.commit()
    stats["DB_Inserted"] += count
    logger.info(f"✅ {count} Corporate Actions insertadas.")

def import_history(db, acct_map,folder_path):
    hist_files = [f for f in os.listdir(folder_path) if f.startswith("Historical_Performance")]
    count = 0
    
    for fname in hist_files:
        fpath = os.path.join(folder_path, fname)
        try: df = pd.read_csv(fpath)
        except: continue
        stats["CSV_Rows"] += len(df)
        
        # -----------------------------------------------------------
        # CASO 1: FORMATO HORIZONTAL (MTD, QTD, YTD en columnas)
        # -----------------------------------------------------------
        if 'YTD' in df.columns or 'MTD' in df.columns:
            logger.info(f"📊 Procesando formato horizontal (YTD/MTD) en {fname}")
            
            # Mapeo de Columna CSV -> (Period Type, Label)
            # Puedes ajustar los labels según prefieras
            col_map = {
                'MTD': ('M', 'MTD'),
                'QTD': ('Q', 'QTD'),
                'YTD': ('YTD', 'YTD'),
                '1 Year': ('1Y', '1 Year'),
                '3 Year': ('3Y', '3 Year'),
                'Since Inception': ('INC', 'Since Inception')
            }

            for i, row in df.iterrows():
                # Iteramos sobre las columnas definidas en el mapa
                for col_name, (p_type, p_label) in col_map.items():
                    val = row.get(col_name)
                    
                    # Si la columna no existe o el valor es nulo, saltamos esa métrica
                    if pd.isna(val) or val == "": 
                        continue

                    ret = parse_decimal(val)
                    if ret is None: continue

                    # Para métricas acumuladas (YTD, MTD, Inception), 
                    # la fecha fin suele ser la fecha actual (o la del reporte)
                    end_d = datetime.today().date()

                    ars = AccountReturnSeries(
                        account_id=acct_map["USD"],
                        period_type=p_type,
                        period_label=p_label,
                        end_date=end_d,
                        return_pct=ret
                    )
                    db.add(ars)
                    count += 1
                    inserted_records["History"].append({"Label": p_label, "Return": float(ret)})

        # -----------------------------------------------------------
        # CASO 2: FORMATO VERTICAL (Month, Quarter, Year en filas)
        # -----------------------------------------------------------
        else:
            logger.info(f"📅 Procesando formato vertical (Series de Tiempo) en {fname}")
            
            for i, row in df.iterrows():
                label, p_type = None, 'M'
                
                # Buscamos qué columna define la fecha
                for col in ['Month', 'Quarter', 'Year']:
                    if col in row and pd.notna(row[col]):
                        label = str(row[col])
                        if col == 'Quarter': p_type = 'Q'
                        if col == 'Year': p_type = 'Y'
                        break
                
                # Validación
                if not label or label == "YTD": 
                    # Nota: Si el archivo vertical tiene una fila "YTD", la saltamos aquí
                    # porque probablemente ya la capturamos en el archivo horizontal, 
                    # o puedes agregar lógica especial aquí si lo prefieres.
                    skipped_log.append({
                        "File": fname, "Row": i + 2, 
                        "Reason": f"Registro Ignorado (Label: {label})", "Data": row.to_dict()
                    })
                    continue
                
                ret = parse_decimal(row.get('AccountReturn'))
                if ret is None:
                    skipped_log.append({
                        "File": fname, "Row": i + 2, 
                        "Reason": "Valor de Retorno Nulo", "Data": row.to_dict()
                    })
                    continue

                # Cálculo de fecha fin para series históricas
                end_d = datetime.today().date()
                try:
                    if p_type == 'M': 
                        dt = datetime.strptime(label, "%Y%m")
                        # Último día del mes
                        nxt = dt.replace(year=dt.year+1, month=1) if dt.month==12 else dt.replace(month=dt.month+1)
                        end_d = (nxt - pd.Timedelta(days=1)).date()
                    elif p_type == 'Q': 
                        y, q = label.split(' Q')
                        m = int(q)*3
                        end_d = datetime(int(y), m, 1) 
                        # Ajuste a fin de mes si fuera necesario, o día 1
                    elif p_type == 'Y': 
                        end_d = datetime(int(label), 12, 31).date()
                except: pass

                ars = AccountReturnSeries(
                    account_id=acct_map["USD"],
                    period_type=p_type,
                    period_label=label,
                    end_date=end_d,
                    return_pct=ret
                )
                db.add(ars)
                count += 1
                inserted_records["History"].append({"Label": label, "Return": float(ret)})
            
    db.commit()
    stats["DB_Inserted"] += count
    logger.info(f"✅ {count} registros históricos insertados.")

def import_performance(db, acct_map,folder_path):
    fpath = os.path.join(folder_path, "Performance_by_Symbol_0.csv")
    if not os.path.exists(fpath): return
    
    logger.info("📈 Importando Performance Attribution...")
    df = pd.read_csv(fpath)
    stats["CSV_Rows"] += len(df)
    count = 0

    # Cache local para no consultar la DB en cada fila si el sector ya lo creamos
    known_sectors = set()

    # Pre-cargar sectores existentes para eficiencia
    existing_inds = db.query(Industry).all()
    for ind in existing_inds:
        known_sectors.add(ind.industry_code)

    ignored_currencies = ["USD", "HKD", "GBP", "EUR"]

    for i, row in df.iterrows():
        raw_sym = row.get('Symbol')
        
        if pd.isna(raw_sym):
            desc_check = str(row.get('Description', ''))
            if "Total" in desc_check: continue
            sym = ""
        else:
            sym = str(raw_sym).strip()

        # 1. FILTROS
        if "Total" in sym: continue
        if "Fees" in sym: continue
        if sym in ignored_currencies: continue

        # 2. BUSQUEDA ASSET
        asset_id = None
        if sym:
            asset_id = get_asset_id(db, sym)

        if not asset_id and sym:
            # Intento A: Match exacto Descripción
            asset_obj = db.query(Asset).filter(Asset.description == sym).first()
            # Intento B: Match bono (sin código final)
            if not asset_obj:
                tokens = sym.split()
                if len(tokens) > 1:
                    clean_desc = " ".join(tokens[:-1])
                    asset_obj = db.query(Asset).filter(Asset.description == clean_desc).first()
            # Intento C: Prefijo
            if not asset_obj:
                 asset_obj = db.query(Asset).filter(Asset.description.ilike(f"{sym}%")).first()
            
            if asset_obj:
                asset_id = asset_obj.asset_id

        # 3. DATOS
        cat_label = None if asset_id else sym
        
        avg_weight = parse_decimal(row.get('AvgWeight'))
        ret_pct = parse_decimal(row.get('Return'))
        contrib = parse_decimal(row.get('Contribution'))
        real_pnl = parse_decimal(row.get('Realized_P&L'))
        unreal_pnl = parse_decimal(row.get('Unrealized_P&L'))
        
        # ==========================================
        # 4. LÓGICA DE SECTOR (SOLUCIÓN AL ERROR)
        # ==========================================
        sector_code = None
        raw_sector = row.get('Sector')
        
        if pd.notna(raw_sector) and str(raw_sector).strip():
            sector_name = str(raw_sector).strip()
            
            # Si el sector no está en nuestro cache de conocidos
            if sector_name not in known_sectors:
                # Verificamos DB (por si acaso)
                ind = db.query(Industry).filter(Industry.industry_code == sector_name).first()
                if not ind:
                    # CREAR EL SECTOR SI NO EXISTE
                    try:
                        logger.info(f"🆕 Creando sector faltante: {sector_name}")
                        # Asumo que tu modelo Industry tiene industry_code y name
                        new_ind = Industry(industry_code=sector_name, name=sector_name)
                        db.add(new_ind)
                        db.commit() # Commit inmediato necesario para la FK
                        db.refresh(new_ind)
                    except Exception as e:
                        db.rollback()
                        logger.error(f"Error creando sector {sector_name}: {e}")
                
                # Agregamos al cache para no intentar crearlo de nuevo
                known_sectors.add(sector_name)
            
            sector_code = sector_name

        # ==========================================
        
        pa = PerformanceAttribution(
            account_id=acct_map["USD"],
            asset_id=asset_id,
            category_label=cat_label,
            avg_weight=avg_weight,
            return_pct=ret_pct,
            contribution_pct=contrib,
            realized_pnl=real_pnl,
            unrealized_pnl=unreal_pnl,
            sector_snapshot=sector_code, # Usamos el sector validado/creado
            is_open_position=(str(row.get('Open')).strip().lower() == 'yes')
        )
        
        db.add(pa)
        count += 1
        inserted_records["Performance"].append({"Symbol": sym, "PnL": float(real_pnl) if real_pnl else 0})

    db.commit()
    stats["DB_Inserted"] += count
    logger.info(f"✅ {count} Performance rows insertadas.")

def import_positions(db, acct_map,folder_path):
    fpath = os.path.join(folder_path, "Open_Position_Summary_0.csv") # Asegúrate que el nombre coincida
    if not os.path.exists(fpath): return

    logger.info("📍 Importando Open Positions...")
    df = pd.read_csv(fpath)
    stats["CSV_Rows"] += len(df)
    count = 0

    # Cache de USD Asset
    usd_asset_id = get_asset_id(db, "USD") or get_asset_id(db, "CASH")

    for i, row in df.iterrows():
        raw_date = row.get('Date')
        
        # 1. Filtro de Totales y Fechas
        # Si la columna Date dice "Total" o está vacía, saltamos
        if str(raw_date).startswith("Total") or pd.isna(raw_date):
            continue
            
        report_d = parse_date(raw_date)
        if not report_d:
            skipped_log.append({"File": "Open_Positions", "Row": i+2, "Reason": "Fecha inválida", "Data": row.to_dict()})
            continue

        raw_sym = row.get('Symbol')
        sym = str(raw_sym).strip() if pd.notna(raw_sym) else ""
        desc = str(row.get('Description', '')).strip()
        fin_instr = str(row.get('FinancialInstrument', ''))

        # 2. Búsqueda de Asset
        asset_id = None

        # A. Caso Cash / USD
        if sym == 'USD' or fin_instr == 'Cash' or 'Cash' in desc:
            asset_id = usd_asset_id
        
        # B. Caso General (Lógica robusta)
        else:
            # Intento 1: Symbol Exacto
            if sym: asset_id = get_asset_id(db, sym)
            
            # Intento 2: Descripción Exacta o Parcial
            if not asset_id and desc:
                # Búsqueda exacta descripción
                asset_obj = db.query(Asset).filter(Asset.description == desc).first()
                
                # Búsqueda por token (para bonos con códigos al final)
                if not asset_obj:
                    tokens = sym.split() # Usamos symbol del CSV que a veces trae basura al final
                    if len(tokens) > 1:
                        clean_sym = " ".join(tokens[:-1])
                        asset_obj = db.query(Asset).filter(Asset.description == clean_sym).first()
                
                # Búsqueda startswith
                if not asset_obj:
                    asset_obj = db.query(Asset).filter(Asset.description.ilike(f"{sym}%")).first()
                
                if asset_obj:
                    asset_id = asset_obj.asset_id

        # Si después de todo no hay asset_id, saltamos (o creamos dummy si quisieras)
        if not asset_id:
            skipped_log.append({"File": "Open_Positions", "Row": i+2, "Reason": f"Asset no encontrado: {sym}", "Data": row.to_dict()})
            continue

        # 3. Mapeo de Datos
        qty = parse_decimal(row.get('Quantity')) or 0
        mark_price = parse_decimal(row.get('ClosePrice'))
        val = parse_decimal(row.get('Value'))
        cost_basis = parse_decimal(row.get('Cost Basis'))
        unrealized = parse_decimal(row.get('UnrealizedP&L'))
        fx_rate = parse_decimal(row.get('FXRateToBase')) or 1

        # Calcular Precio Base (Cost Basis Price) si no viene en el CSV
        # Cost Basis Total / Cantidad
        cost_basis_px = None
        if cost_basis and qty and qty != 0:
            cost_basis_px = cost_basis / qty

        # 4. Crear Objeto
        pos = Position(
            account_id=acct_map.get("USD", 1), # Asumimos cuenta USD base, ajustar si el CSV trae columna Account
            asset_id=asset_id,
            report_date=report_d,
            quantity=qty,
            
            mark_price=mark_price,
            position_value=val,
            
            cost_basis_money=cost_basis,
            cost_basis_price=cost_basis_px,
            
            fifo_pnl_unrealized=unrealized,
            fx_rate_to_base=fx_rate,
            
            # Datos extra que podríamos inferir

            
        )
        db.add(pos)
        count += 1

    db.commit()
    stats["DB_Inserted"] += count
    logger.info(f"✅ {count} Positions insertadas.")

def import_income_projections(db, acct_map,folder_path):
    fpath = os.path.join(folder_path, "Projected_Income_0.csv")
    if not os.path.exists(fpath): return

    logger.info("📅 Importando Proyecciones de Ingresos...")
    df = pd.read_csv(fpath)
    stats["CSV_Rows"] += len(df)
    count = 0

    # Cache de USD Asset
    usd_asset_id = get_asset_id(db, "USD") or get_asset_id(db, "CASH")

    for i, row in df.iterrows():
        raw_sym = row.get('Symbol')
        
        # 1. FILTROS: Ignorar filas vacías o que son Totales
        if pd.isna(raw_sym) or "Total" in str(raw_sym):
            continue
            
        sym = str(raw_sym).strip()
        desc_original = str(row.get('Description', '')).strip()
        fin_instr = str(row.get('Financial Instrument', '')).strip()

        # 2. PARSEAR DESCRIPCIÓN A TIPO (Normalización)
        type_mapped = desc_original
        desc_lower = desc_original.lower()
        
        if "ordinary dividend" in desc_lower:
            type_mapped = "DIVIDEND"
        elif "credit interest" in desc_lower or "interest" in desc_lower:
            type_mapped = "INTEREST"
        elif "fee" in desc_lower:
            type_mapped = "FEE"

        # 3. BÚSQUEDA DE ASSET
        asset_id = None
        # Caso especial para Cash USD
        if fin_instr == "Cash" and sym == "USD":
            asset_id = usd_asset_id
        else:
            # Búsqueda estándar por símbolo
            asset_id = get_asset_id(db, sym)

        # 4. OBTENER FECHA DEL REPORTE
        # Usamos la columna 'reportdate' del CSV
        report_d = parse_date(row.get('reportdate')) 
        if not report_d:
            report_d = datetime.today().date() # Fallback

        # 5. CREAR REGISTRO
        proj = IncomeProjection(
            account_id=acct_map.get("USD", 1), # Asumimos cuenta USD
            asset_id=asset_id,
            report_date=report_d,
            
            # Datos descriptivos
            symbol=sym,
            description=type_mapped, # Ej: DIVIDEND
            
            # Valores numéricos
            quantity=parse_decimal(row.get('Quantity')),
            price=parse_decimal(row.get('Price')),
            market_value=parse_decimal(row.get('Value')),
            yield_pct=parse_decimal(row.get('Current Yield %')),
            
            estimated_annual_income=parse_decimal(row.get('Estimated Annual Income')),
            estimated_remaining_income=parse_decimal(row.get('Estimated 2026 Remaining Income')),
            
            frequency=int(row.get('Frequency')) if pd.notna(row.get('Frequency')) else None,
            currency="USD" # Asumido por el reporte, podrías extraerlo si existiera columna
        )
        
        db.add(proj)
        count += 1
        inserted_records["IncomeProjections"].append({"Symbol": sym, "Income": float(proj.estimated_annual_income or 0)})

    db.commit()
    stats["DB_Inserted"] += count
    logger.info(f"✅ {count} Proyecciones de ingresos insertadas.")

class DateTimeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (datetime, Decimal)):
            return str(o)
        return super().default(o)

def run_all():
    # Limpiar errores de ejecuciones anteriores
    global import_errors
    import_errors = []
    
    db = SessionLocal()
    try:
        # Definir ruta base
        base_folders_path = os.path.join(BASE_DIR, "inceptioncsvs")
        if not os.path.exists(base_folders_path):
             base_folders_path = "seed_data/inceptioncsvs" # Fallback por si ejecutas desde otro lado

        # Listar directorios (usuarios) - Filtrar solo carpetas de usuarios (empiezan con U)
        subfolders = [
            f.path for f in os.scandir(base_folders_path) 
            if f.is_dir() and f.name.startswith('U') and f.name != "example"
        ]

        logger.info(f"📂 Carpetas de usuarios encontradas: {len(subfolders)}")
        
        if not subfolders:
            logger.warning("⚠️ No se encontraron carpetas de usuarios (deben comenzar con 'U')")
            return

        processed_count = 0
        error_count = 0

        # --- BUCLE PRINCIPAL POR USUARIO ---
        for folder in subfolders:
            folder_name = os.path.basename(folder)
            print(f"\n🚀 --- INICIANDO PROCESO PARA: {folder_name} ---")
            
            # 1. Crear Usuario/Cuentas dinámicamente leyendo Introduction_0.csv de ESTA carpeta
            # Nota: Asegúrate de tener la función setup_dynamic_user_from_csv definida arriba
            acct_map = setup_dynamic_user_from_csv(db, folder)
            
            if not acct_map:
                log_error("USER_SETUP_FAILED", f"Saltando carpeta {folder_name} por error en configuración de usuario.")
                error_count += 1
                continue

            # 2. Ejecutar importaciones PARA ESTE USUARIO (Pasando 'folder' como ruta)
            # Es vital pasar 'folder' para que lea los CSVs de U6177570 y no los generales
            import_trades(db, acct_map, folder)
            import_cash_journal(db, acct_map, folder)
            import_corporate_actions(db, acct_map, folder)
            import_history(db, acct_map, folder)
            import_performance(db, acct_map, folder)
            import_positions(db, acct_map, folder) 
            
            processed_count += 1
            #import_income_projections(db, acct_map, folder)

        # --- REPORTE FINAL (Al terminar todos los usuarios) ---
        print("\n" + "="*60)
        print("📊 RESUMEN GLOBAL DE IMPORTACIÓN")
        print("="*60)
        print(f"👥 Usuarios procesados:    {processed_count}")
        print(f"❌ Usuarios con errores:   {error_count}")
        print(f"📄 Total Filas Leídas (CSV): {stats['CSV_Rows']}")
        print(f"💾 Total Insertado en DB:  {stats['DB_Inserted']}")
        print(f"🗑️  Total Ignorado:        {len(skipped_log)}")
        print("="*60)
        
        # Mostrar resumen de errores estructurados
        print_error_summary()
        
        if skipped_log:
            print("\n🔍 DETALLE DE FILAS IGNORADAS (Muestra):")
            # Mostramos solo los primeros 15 errores para no saturar
            for item in skipped_log[:15]:
                print(f"❌ [{item['File']} | Fila {item['Row']}] -> {item['Reason']}")
                # print(f"   Data: {item['Data']}")
                print("-" * 30)
            if len(skipped_log) > 15:
                print(f"... y {len(skipped_log) - 15} más.")

        # Guardar JSON
        with open(JSON_OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(inserted_records, f, indent=2, cls=DateTimeEncoder)
        
        print(f"\n📝 Detalle guardado en: {JSON_OUTPUT_FILE}")
        logger.info("🚀 --- PROCESO COMPLETADO EXITOSAMENTE ---")

    except Exception as e:
        logger.error(f"❌ Error General: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def run_full_pipeline():
    """
    Ejecuta el pipeline completo:
    1. Primero procesa los CSVs crudos de all_data_users con createscvsuser.py
    2. Luego importa los datos procesados a la DB
    """
    import subprocess
    
    print("="*60)
    print("🚀 PIPELINE COMPLETO DE IMPORTACIÓN IBKR")
    print("="*60)
    
    # Paso 1: Ejecutar createscvsuser.py para procesar los CSVs crudos
    print("\n📋 PASO 1: Procesando archivos CSV crudos...")
    createcsv_path = os.path.join(BASE_DIR, "createscvsuser.py")
    
    if os.path.exists(createcsv_path):
        try:
            result = subprocess.run(
                [sys.executable, createcsv_path],
                cwd=BASE_DIR,
                capture_output=True,
                text=True
            )
            print(result.stdout)
            if result.stderr:
                print(f"⚠️ Warnings: {result.stderr}")
        except Exception as e:
            print(f"❌ Error ejecutando createscvsuser.py: {e}")
            return
    else:
        print(f"⚠️ No se encontró createscvsuser.py en {BASE_DIR}")
        print("   Continuando con los CSVs ya procesados...")
    
    # Paso 2: Ejecutar la importación a DB
    print("\n📋 PASO 2: Importando datos a la base de datos...")
    run_all()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Importador de datos IBKR')
    parser.add_argument('--full', action='store_true', 
                        help='Ejecutar pipeline completo (procesar CSVs + importar)')
    parser.add_argument('--import-only', action='store_true', 
                        help='Solo importar (CSVs ya procesados)')
    
    args = parser.parse_args()
    
    if args.full:
        run_full_pipeline()
    else:
        # Por defecto, solo importar
        run_all()