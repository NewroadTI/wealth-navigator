import sys
import os
import re
import json
import logging
import pandas as pd
import uuid
from datetime import datetime
from decimal import Decimal

# Configuración de ruta
sys.path.append("/app")
sys.path.append(".")

try:
    from app.db.session import SessionLocal
    from app.models.user import User
    from app.models.portfolio import Portfolio, Account, AccountReturnSeries
    # Ajusta 'Trades' si tu modelo se llama 'Trade'
    from app.models.asset import Asset, Trades, CashJournal, CorporateAction, PerformanceAttribution
except ImportError:
    print("⚠️ Error importando modelos. Ejecuta desde la raíz del proyecto.")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SPLIT_DIR = os.path.join(BASE_DIR, "inceptioncsvs")
if not os.path.exists(SPLIT_DIR):
    SPLIT_DIR = "/app/seed_data/inceptioncsvs"

JSON_OUTPUT_FILE = os.path.join(BASE_DIR, "insertion_summary.json")

# --- DATOS DEL USUARIO ---
USER_DATA = {
    "username": "Daniel E Cicirello Cook",
    "email": "daniel@gmail.com",
    "password": "usuario_daniel",
    "full_name": "Daniel E Cicirello Cook",
    "phone": "999999999"
}

PORTFOLIO_DATA = {
    "interface_code": "port_daniel_cicirello",
    "name": "Portafolio Daniel Cicirello",
    "type": "risk portfolio",
    "main_currency": "USD",
    "residence_country": "PE",
    "inception_date": datetime.today().date()
}

IBKR_ACCOUNT_CODE = "U6177570"
CURRENCY_MAP = {
    "United States Dollar": "USD", "Hong Kong Dollar": "HKD", "Great British Pound": "GBP",
    "Euro": "EUR", "Canadian Dollar": "CAD", "Swiss Franc": "CHF",
    "Japanese Yen": "JPY", "Australian Dollar": "AUD", "Chinese Renminbi": "CNH",
    "USD": "USD", "HKD": "HKD", "GBP": "GBP", "EUR": "EUR"
}
MONEDAS = list(set(CURRENCY_MAP.values()))

# --- ACUMULADOR DE DATOS PARA JSON ---
inserted_records = {
    "Trades": [],
    "CashJournal": [],
    "CorporateActions": [],
    "Performance": [],
    "History": []
}

stats = {"CSV_Rows": 0, "DB_Inserted": 0}

# --- HELPERS ---
def parse_decimal(val):
    if pd.isna(val) or str(val).strip() in ["", "-", "nan", "None"]: return None
    try:
        clean = str(val).replace(",", "").replace("$", "").replace(" ", "").strip()
        if clean.startswith("<"): return None 
        return Decimal(clean)
    except: return None

def validate_numeric_limit(val, precision=10, scale=6):
    """
    Evita el error 'NumericValueOutOfRange'.
    Para Numeric(10,6), el valor abs debe ser < 10000.
    """
    if val is None: return None
    limit = Decimal(10**(precision - scale)) # 10000
    if abs(val) >= limit:
        return None # Retornamos None si excede
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

# Cache para assets
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

def setup_user_and_accounts(db):
    logger.info("👤 Configurando Usuario y Cuentas...")
    user = db.query(User).filter(User.username == USER_DATA["username"]).first()
    if not user:
        u_data = USER_DATA.copy()
        pwd = u_data.pop("password")
        user = User(**u_data, password_hash=pwd, is_active=True)
        db.add(user)
        db.commit()
        db.refresh(user)

    port = db.query(Portfolio).filter(Portfolio.interface_code == PORTFOLIO_DATA["interface_code"]).first()
    if not port:
        port = Portfolio(owner_user_id=user.user_id, **PORTFOLIO_DATA)
        db.add(port)
        db.commit()
        db.refresh(port)

    acct_map = {}
    for curr in MONEDAS:
        code = f"{IBKR_ACCOUNT_CODE}_{curr}"
        acc = db.query(Account).filter(Account.account_code == code).first()
        if not acc:
            acc = Account(portfolio_id=port.portfolio_id, account_code=code, currency=curr, institution="IBKR")
            db.add(acc)
            db.commit()
            db.refresh(acc)
        acct_map[curr] = acc.account_id
    
    return acct_map

def import_trades(db, acct_map):
    fpath = os.path.join(SPLIT_DIR, "Trade_Summary_0.csv")
    if not os.path.exists(fpath): return

    logger.info(f"🛒 Importando Trades...")
    df = pd.read_csv(fpath)
    count = 0
    stats["CSV_Rows"] += len(df)

    for _, row in df.iterrows():
        qty_buy = parse_decimal(row.get('Quantity Bought'))
        qty_sell = parse_decimal(row.get('Quantity Sold'))
        final_qty = qty_buy if qty_buy else (qty_sell if qty_sell else 0)
        is_buy = True if qty_buy else False
        
        price = parse_decimal(row.get('Average Price Bought')) if is_buy else parse_decimal(row.get('Average Price Sold'))
        proceeds = parse_decimal(row.get('Proceeds Bought')) if is_buy else parse_decimal(row.get('Proceeds Sold'))
        
        curr_code = get_currency_code(row.get('Currency'))
        acct_id = acct_map.get(curr_code, acct_map['USD'])
        
        symbol = row.get('Symbol')
        t = Trades(
            account_id=acct_id,
            asset_id=get_asset_id(db, symbol),
            trade_date=datetime.now(),
            quantity=abs(final_qty),
            price=abs(price) if price else 0,
            gross_amount=proceeds,
            currency=curr_code,
            transaction_type="BUY" if is_buy else "SELL",
            description=row.get('Description'),
            ib_order_id=f"LOAD_{uuid.uuid4().hex[:8]}"
        )
        db.add(t)
        count += 1
        
        # Guardar para JSON
        inserted_records["Trades"].append({
            "Symbol": symbol, "Type": "BUY" if is_buy else "SELL", 
            "Qty": float(final_qty), "Price": float(price) if price else 0
        })

    db.commit()
    stats["DB_Inserted"] += count
    logger.info(f"✅ {count} Trades insertados.")

def import_cash_journal(db, acct_map):
    files = [
        ("Dividends_0.csv", "DIVIDEND", "PayDate", "Amount", "Note"),
        ("Deposits_And_Withdrawals_0.csv", "TRANSFER", "Date", "Amount", "Description"),
        ("Interest_Details_0.csv", "INTEREST", "Date", "Amount", "Description"),
        ("Fee_Summary_0.csv", "FEE", "Date", "Amount", "Description")
    ]
    total = 0
    for fname, t_def, d_col, a_col, desc_col in files:
        fpath = os.path.join(SPLIT_DIR, fname)
        if not os.path.exists(fpath): continue
        
        logger.info(f"💰 Procesando {fname}...")
        df = pd.read_csv(fpath)
        stats["CSV_Rows"] += len(df)
        
        for _, row in df.iterrows():
            d = parse_date(row.get(d_col))
            if not d: continue

            desc = str(row.get(desc_col, ""))
            final_type = t_def
            if fname == "Interest_Details_0.csv":
                if "Accrued" in desc: final_type = "ACCRUED_INTEREST"
                elif "Debit" in desc: final_type = "DEBIT_INTEREST"
            if fname == "Deposits_And_Withdrawals_0.csv":
                raw_t = row.get('Type')
                if pd.notna(raw_t): final_type = str(raw_t).upper()

            curr_code = "USD"
            if "HKD" in desc: curr_code = "HKD"
            if "GBP" in desc: curr_code = "GBP"
            if "EUR" in desc: curr_code = "EUR"

            asset_id = None
            if 'Symbol' in row: asset_id = get_asset_id(db, row['Symbol'])
            
            amount = parse_decimal(row.get(a_col)) or 0
            
            cj = CashJournal(
                account_id=acct_map.get(curr_code, acct_map["USD"]),
                asset_id=asset_id,
                date=d,
                type=final_type,
                amount=amount,
                currency=curr_code,
                description=desc,
                reference_code=f"{final_type[:3]}_{uuid.uuid4().hex[:8]}"
            )
            db.add(cj)
            total += 1
            
            inserted_records["CashJournal"].append({
                "Date": str(d), "Type": final_type, "Amount": float(amount), "Desc": desc
            })
            
        db.commit()
    stats["DB_Inserted"] += total
    logger.info(f"✅ {total} movimientos de caja insertados.")

def import_corporate_actions(db, acct_map):
    fpath = os.path.join(SPLIT_DIR, "Corporate_Actions_0.csv")
    if not os.path.exists(fpath): return
    
    logger.info(f"📢 Importando Corporate Actions...")
    df = pd.read_csv(fpath)
    stats["CSV_Rows"] += len(df)
    count = 0
    
    for _, row in df.iterrows():
        d = parse_date(row.get('Date'))
        if not d: continue

        desc = str(row.get('Description', ""))
        r_new, r_old = None, None
        match = re.search(r'(\d+(?:\.\d+)?)\s+FOR\s+(\d+(?:\.\d+)?)', desc)
        if match:
            # --- CORRECCIÓN CRÍTICA: Validar límites numéricos ---
            r_new = validate_numeric_limit(Decimal(match.group(1)))
            r_old = validate_numeric_limit(Decimal(match.group(2)))

        ca = CorporateAction(
            account_id=acct_map["USD"],
            report_date=d,
            execution_date=d,
            action_type=row.get('Type'),
            description=desc,
            quantity_adjustment=parse_decimal(row.get('Quantity')),
            ratio_old=r_old, # Ahora será None si es gigante
            ratio_new=r_new,
            ib_action_id=f"CA_{uuid.uuid4().hex[:8]}"
        )
        db.add(ca)
        count += 1
        inserted_records["CorporateActions"].append({
            "Date": str(d), "Type": row.get('Type'), "Desc": desc
        })

    db.commit()
    stats["DB_Inserted"] += count
    logger.info(f"✅ {count} Corporate Actions insertadas.")

def import_history(db, acct_map):
    hist_files = [f for f in os.listdir(SPLIT_DIR) if f.startswith("Historical_Performance")]
    count = 0
    for fname in hist_files:
        fpath = os.path.join(SPLIT_DIR, fname)
        try: df = pd.read_csv(fpath)
        except: continue
        stats["CSV_Rows"] += len(df)
        
        for _, row in df.iterrows():
            label, p_type = None, 'M'
            for col in ['Month', 'Quarter', 'Year']:
                if col in row and pd.notna(row[col]):
                    label = str(row[col])
                    if col == 'Quarter': p_type = 'Q'
                    if col == 'Year': p_type = 'Y'
                    break
            
            if not label or label == "YTD": continue
            
            ret = parse_decimal(row.get('AccountReturn'))
            if ret is None: continue

            # Fecha fin
            end_d = datetime.today().date()
            try:
                if p_type == 'M': 
                    dt = datetime.strptime(label, "%Y%m")
                    nxt = dt.replace(year=dt.year+1, month=1) if dt.month==12 else dt.replace(month=dt.month+1)
                    end_d = (nxt - pd.Timedelta(days=1)).date()
                elif p_type == 'Q': 
                    y, q = label.split(' Q')
                    m = int(q)*3
                    end_d = datetime(int(y), m, 1) 
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

def import_performance(db, acct_map):
    fpath = os.path.join(SPLIT_DIR, "Performance_by_Symbol_0.csv")
    if not os.path.exists(fpath): return
    
    logger.info("📈 Importando Performance Attribution...")
    df = pd.read_csv(fpath)
    stats["CSV_Rows"] += len(df)
    count = 0

    for _, row in df.iterrows():
        sym = row.get('Symbol')
        is_total = pd.isna(sym) or "Total" in str(sym) or "Cash" in str(sym)
        
        asset_id = get_asset_id(db, sym) if not is_total else None
        label = str(sym) if is_total or not asset_id else None
        
        pa = PerformanceAttribution(
            account_id=acct_map["USD"],
            asset_id=asset_id,
            category_label=label,
            avg_weight=parse_decimal(row.get('AvgWeight')),
            return_pct=parse_decimal(row.get('Return')),
            contribution_pct=parse_decimal(row.get('Contribution')),
            realized_pnl=parse_decimal(row.get('Realized_P&L')),
            unrealized_pnl=parse_decimal(row.get('Unrealized_P&L')),
            is_open_position=(str(row.get('Open')).lower() == 'yes')
        )
        db.add(pa)
        count += 1
        inserted_records["Performance"].append({
            "Symbol": str(sym), "PnL": float(parse_decimal(row.get('Realized_P&L')) or 0)
        })

    db.commit()
    stats["DB_Inserted"] += count
    logger.info(f"✅ {count} Performance rows insertadas.")

class DateTimeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (datetime, Decimal)):
            return str(o)
        return super().default(o)

def run_all():
    db = SessionLocal()
    try:
        acct_map = setup_user_and_accounts(db)
        
        import_trades(db, acct_map)
        import_cash_journal(db, acct_map)
        import_corporate_actions(db, acct_map)
        import_history(db, acct_map)
        import_performance(db, acct_map) # <--- Módulo Agregado
        
        # --- REPORTE FINAL ---
        print("\n" + "="*50)
        print("📊 RESUMEN DE IMPORTACIÓN")
        print("="*50)
        print(f"📄 Total Filas Leídas (CSV): {stats['CSV_Rows']}")
        print(f"💾 Total Insertado en DB:  {stats['DB_Inserted']}")
        print("="*50)
        
        # Guardar JSON
        with open(JSON_OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(inserted_records, f, indent=2, cls=DateTimeEncoder)
        
        print(f"📝 Detalle guardado en: {JSON_OUTPUT_FILE}")
        logger.info("🚀 --- PROCESO COMPLETADO EXITOSAMENTE ---")

    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_all()