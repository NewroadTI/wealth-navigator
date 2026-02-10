import pandas as pd
import asyncio
import re
import os
from ib_insync import *

# --- Configuración ---
FILENAME_INPUT = "noisin.csv"
FILENAME_OUTPUT = "assets_final_isin.csv"
IB_PORT = 4001
IB_CLIENT_ID = 10  # ID único

ib = IB()

def reconstruir_occ_exacto(raw_symbol):
    """
    Toma un símbolo sucio y lo reconstruye al formato EXACTO de 21 caracteres
    que exige Interactive Brokers para el 'localSymbol'.
    Formato: Root (6 chars) + YYMMDD + T + Strike (8 chars)
    """
    clean = raw_symbol.replace('"', '').strip()
    match = re.search(r'^([A-Z\.]+)\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})$', clean)
    
    if match:
        root = match.group(1).ljust(6) # Rellena con espacios hasta 6 caracteres
        yy, mm, dd = match.group(2), match.group(3), match.group(4)
        right = match.group(5)
        strike = match.group(6)
        
        # Reconstrucción perfecta
        local_symbol = f"{root}{yy}{mm}{dd}{right}{strike}"
        year_val = int(yy)
        return local_symbol, year_val
    return None, None

async def buscar_contrato(contract):
    """Busca detalles ignorando errores menores."""
    try:
        details = await ib.reqContractDetailsAsync(contract)
        return details[0] if details else None
    except:
        return None

async def procesar():
    # 1. Conexión
    try:
        print(f"🔌 Conectando a IB (Puerto {IB_PORT})...")
        await ib.connectAsync('127.0.0.1', IB_PORT, clientId=IB_CLIENT_ID)
    except Exception as e:
        print(f"❌ Error conexión: {e}")
        return

    # 2. Cargar CSV
    if not os.path.exists(FILENAME_INPUT):
        print("❌ Falta el archivo CSV.")
        return
        
    df = pd.read_csv(FILENAME_INPUT)
    df.columns = df.columns.str.strip().str.replace('"', '')
    print(f"📂 Procesando {len(df)} registros...")

    # 3. Loop
    for index, row in df.iterrows():
        raw_symbol = str(row.get('symbol', '')).strip()
        desc = str(row.get('description', '')).upper()
        
        # Filtros
        ignorar = ["CASH", "PRUEBA", "AJUSTE", "TEST", "FICTICIO", "GANANCIAS"]
        if any(x in desc for x in ignorar) or any(x in raw_symbol.upper() for x in ignorar):
            continue

        contract = None
        
        # --- A) OPCIONES (Vía Local Symbol - Infalible) ---
        occ_symbol, year_val = reconstruir_occ_exacto(raw_symbol)
        
        if occ_symbol:
            if year_val < 25: 
                continue # Filtro de año
            
            # TRUCO MAESTRO: Usar localSymbol en vez de partes sueltas
            # Esto fuerza a IB a buscar exactamente ese string
            contract = Contract()
            contract.symbol = raw_symbol.split()[0] # Símbolo base (SBUX)
            contract.secType = 'OPT'
            contract.exchange = 'SMART'
            contract.currency = 'USD'
            contract.localSymbol = occ_symbol 
            
        # --- B) CRIPTOS ---
        elif "PAXOS" in raw_symbol or "USD-" in raw_symbol:
            base = raw_symbol.replace('.USD-PAXOS', '').replace('-USD', '').replace('BTC.', '')
            contract = Crypto(base, 'PAXOS', 'USD')
            
        # --- C) BONOS / ISIN DIRECTO ---
        elif (raw_symbol.startswith('XS') or raw_symbol.startswith('US')) and len(raw_symbol) > 9 and " " not in raw_symbol:
            contract = Contract()
            contract.secIdType = 'ISIN'
            contract.secId = raw_symbol
            contract.exchange = 'SMART'

        # --- D) STOCKS ---
        else:
            sym = raw_symbol.replace('.', ' ').strip()
            contract = Stock(sym, 'SMART', 'USD')

        # --- BÚSQUEDA Y EXTRACCIÓN DE ID ---
        if contract:
            detail = await buscar_contrato(contract)
            
            # Si falla Stock en SMART, probar PINK (OTC)
            if not detail and isinstance(contract, Stock):
                contract.exchange = 'PINK'
                detail = await buscar_contrato(contract)

            if detail:
                isin = ""
                cusip = ""
                
                # Buscar IDs en la lista
                if detail.secIdList:
                    for tag in detail.secIdList:
                        if tag.tag == 'ISIN':
                            isin = tag.value
                        if tag.tag == 'CUSIP':
                            cusip = tag.value
                
                # LÓGICA DE PRIORIDAD:
                # 1. Si hay ISIN, úsalo.
                # 2. Si es Opción de USA, NO tienen ISIN. Usamos CUSIP si existe.
                # 3. Si no, avisamos.
                
                valor_final = isin if isin else cusip
                
                if valor_final:
                    if not isin and cusip:
                        print(f"✅ {raw_symbol} -> ISIN no existe, usando CUSIP: {valor_final}")
                    else:
                        print(f"✅ {raw_symbol} -> ISIN: {valor_final}")
                    
                    df.at[index, 'isin'] = valor_final
                else:
                    # Último recurso: Usar el Contract ID (ConID) numérico de IB
                    # Esto garantiza que tengas un ID único sí o sí.
                    con_id = str(detail.contract.conId)
                    print(f"⚠️  {raw_symbol} -> Sin ISIN/CUSIP. Usando IB ConID: {con_id}")
                    df.at[index, 'isin'] = f"IB:{con_id}"
            else:
                print(f"❌ No encontrado en IB: {raw_symbol}")

    df.to_csv(FILENAME_OUTPUT, index=False)
    print("\n--- Completado ---")
    ib.disconnect()

if __name__ == '__main__':
    asyncio.run(procesar())