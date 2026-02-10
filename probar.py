import asyncio
import pandas as pd
import json
from io import StringIO
from ib_async import *
from datetime import datetime

# --- 1. TU DATA (Tal cual la enviaste) ---
csv_payload = """
"description","symbol","isin","position_id","account_id","asset_id","report_date","quantity","mark_price","position_value","cost_basis_money","cost_basis_price","open_price","fifo_pnl_unrealized","percent_of_nav","side","level_of_detail","open_date_time","vesting_date","accrued_interest","fx_rate_to_base","currency"
"SPDR S&P 500 ETF TRUST","SPY","US78462F1030",2192,85,1432,"2026-02-04","18.8606","686.19","12941.96","10975.697922","581.937898158","581.937898158","1966.262078","100.0","Long","SUMMARY","","","","1.0","USD"
"NVIDIA CORP","NVDA","US67066G1040",2193,729,1107,"2026-02-04","1.0","174.19","174.19","123.544892","123.544892","123.544892","50.645108","1.92","Long","SUMMARY","","","","1.0","USD"
"SPDR S&P 500 ETF TRUST","SPY","US78462F1030",2194,729,1432,"2026-02-04","13.0","686.19","8920.47","7235.948212","556.611400923","556.611400923","1684.521788","98.08","Long","SUMMARY","","","","1.0","USD"
"BLACKROCK CAPITAL ALLOCATION","BCAT","US09260U1097",2195,631,307,"2026-02-04","1712.0","14.73","25217.76","25046.580468","14.630011956","14.630011956","171.179532","10.4","Long","SUMMARY","","","","1.0","USD"
"BlackRock Core Bond Trust","BHK","",2196,631,316,"2026-02-04","2050.0","9.52","19516.0","19971.313371","9.742104083","9.742104083","-455.313371","8.05","Long","SUMMARY","","","","1.0","USD"
"DOUBLELINE INCOME SOLUTIONS","DSL","",2197,631,528,"2026-02-04","1562.0","11.49","17947.38","20023.524882","12.819158055","12.819158055","-2076.144882","7.4","Long","SUMMARY","","","","1.0","USD"
"ALLSPRING INCOME OPPORTUNITI","EAD","US94987B1052",2198,631,534,"2026-02-04","2846.0","6.87","19552.02","19707.578434","6.924658621","6.924658621","-155.558434","8.06","Long","SUMMARY","","","","1.0","USD"
"EATON VANCE TAX-MANAGED DIVE","ETY","",2199,631,560,"2026-02-04","1300.0","14.9","19370.0","19520.034544","15.015411188","15.015411188","-150.034544","7.99","Long","SUMMARY","","","","1.0","USD"
"""

def clean_dict(obj):
    """Convierte objetos complejos de IBKR a diccionarios limpios para JSON"""
    if hasattr(obj, '__dict__'):
        return {k: str(v) for k, v in obj.__dict__.items() if not k.startswith('_')}
    return str(obj)

async def main():
    # 1. Conexión (Usando tu túnel SSH local en puerto 4001)
    ib = IB()
    try:
        print("🚀 Conectando a Hetzner Gateway...")
        await ib.connectAsync('127.0.0.1', 4001, clientId=55)
    except Exception as e:
        print(f"❌ Error: {e}. ¿Tienes el túnel abierto? ssh -L 4001:127.0.0.1:4001 ...")
        return

    # 2. Procesar CSV
    df = pd.read_csv(StringIO(csv_payload))
    df['isin'] = df['isin'].fillna('') # Limpiar ISINs vacíos
    unique_assets = df.drop_duplicates(subset=['symbol']).to_dict('records')

    print(f"🔍 Analizando {len(unique_assets)} activos únicos con profundidad máxima...")
    
    full_data = []

    for asset in unique_assets:
        symbol = asset['symbol']
        isin = asset['isin']
        print(f"\n--- Procesando: {symbol} ---")

        # --- A. Creación Inteligente del Contrato ---
        contract = Contract()
        contract.currency = 'USD'
        
        # Lógica: Si hay ISIN, úsalo (es infalible). Si no, usa el Símbolo.
        # NOTA: BHK, DSL, etc son "Closed-End Funds", pero en IBKR se tratan como STK (Stocks).
        if isin and len(isin) > 5:
            contract.secIdType = 'ISIN'
            contract.secId = isin
            contract.exchange = 'SMART' # Deja que IB encuentre el mejor mercado
        else:
            contract.symbol = symbol
            contract.secType = 'STK'    # Asumimos STK/ETF por defecto
            contract.exchange = 'SMART'

        # --- B. Cualificación (Convertir nuestra idea en un contrato real) ---
        try:
            await ib.qualifyContractsAsync(contract)
            print(f"✅ Identificado: {contract.localSymbol} | ID: {contract.conId} | Tipo: {contract.secType}")
        except Exception as e:
            print(f"⚠️ No se pudo identificar {symbol}: {e}")
            continue

        # --- C. EXTRACCIÓN PROFUNDA ---
        asset_dump = {
            "my_db_data": asset,
            "ib_contract_details": {},
            "ib_market_snapshot": {},
            "ib_fundamental": "N/A"
        }

        # 1. Detalles del Contrato (Sector, Industria, Categoría, Horarios)
        try:
            details = await ib.reqContractDetailsAsync(contract)
            if details:
                d = details[0]
                asset_dump['ib_contract_details'] = {
                    "official_name": d.longName,
                    "industry": d.industry,
                    "category": d.category,
                    "subcategory": d.subcategory,
                    "market_name": d.marketName,
                    "stock_type": d.stockType, # Ej: 'COMMON', 'ETF', 'CEF'
                    "contract_month": d.contractMonth, # Importante para Futuros/Opciones
                    "min_tick": d.minTick,
                    "trading_hours": d.tradingHours.split(';')[0] if d.tradingHours else "N/A"
                }
        except Exception:
            pass

        # 2. Market Data Snapshot (Precios, Dividendos proyectados si hay)
        try:
            # Pedimos Snapshot (True) para no saturar líneas de datos
            tickers = await ib.reqTickersAsync(contract)
            if tickers:
                t = tickers[0]
                asset_dump['ib_market_snapshot'] = {
                    "market_price": t.marketPrice(),
                    "close_price": t.close,
                    "bid": t.bid,
                    "ask": t.ask,
                    "volume": t.volume,
                    "high_52week": t.high, # A veces requiere suscripción extra
                    "low_52week": t.low,
                    # Si fuera opción, aquí vendrían las griegas:
                    "greeks": str(t.modelGreeks) if t.modelGreeks else "N/A"
                }
        except Exception:
            pass
        
        full_data.append(asset_dump)

    # --- 3. Guardar el Tesoro ---
    filename = "asset_deep_dive.json"
    with open(filename, "w", encoding='utf-8') as f:
        json.dump(full_data, f, indent=4, ensure_ascii=False)
    
    print(f"\n💾 REPORTE GUARDADO: {filename}")
    ib.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
