try:
    from ib_insync import *
except ImportError:
    print("Error: No tienes instalada la librería 'ib_insync'.")
    print("Ejecuta: pip install ib_insync")
    exit()

import time

# 1. Configuración
ib = IB()
# Asegúrate de que TWS o Gateway esté abierto en el puerto 7497 (o 4002 para Gateway)
ib.connect('127.0.0.1', 4001, clientId=1)

# 2. Lista de 200 símbolos (S&P 500 y Tech)
simbolos = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BRK.B', 'UNH', 'LLY',
    'JPM', 'JNJ', 'V', 'XOM', 'MA', 'AVGO', 'HD', 'PG', 'COST', 'ABBV',
    'ADBE', 'CRM', 'ORCL', 'NFLX', 'AMD', 'PEP', 'CVX', 'KO', 'TMO', 'BAC',
    'CSCO', 'ACN', 'ABT', 'LIN', 'MCD', 'DIS', 'WMT', 'INTU', 'WFC', 'DHR',
    'VZ', 'PM', 'TXN', 'INTC', 'COP', 'UNP', 'NEE', 'IBM', 'AMAT', 'GE',
    'LOW', 'AMGN', 'AXP', 'RTX', 'SPGI', 'CAT', 'HON', 'GS', 'MS', 'PFE',
    'PLD', 'LMT', 'SYK', 'BLK', 'SBUX', 'DE', 'TJX', 'ADP', 'BA', 'MDLZ',
    'GILD', 'MMC', 'ADI', 'AMT', 'LRCX', 'ETN', 'NOW', 'VRTX', 'MU', 'T',
    'REGN', 'CDE', 'CB', 'CI', 'BSX', 'ZTS', 'MO', 'ISRG', 'SLB', 'FI',
    'LRCX', 'BMY', 'PANW', 'SNPS', 'KLAC', 'CDNS', 'EQIX', 'PGR', 'ITW', 'WM',
    'EOG', 'MPC', 'CVS', 'USB', 'BDX', 'GD', 'MCK', 'MCO', 'ORLY', 'APH',
    'HCA', 'ICE', 'AIG', 'SO', 'WELL', 'D', 'CMG', 'MAR', 'TEL', 'PSX',
    'CTAS', 'ECL', 'NSC', 'NOC', 'C', 'MET', 'EW', 'O', 'FDX', 'ADSK',
    'DLR', 'PH', 'AEP', 'CME', 'EMR', 'RCL', 'PAYX', 'AZO', 'TGT', 'DXCM',
    'MCHP', 'EL', 'GEHC', 'MSI', 'SYY', 'IDXX', 'A', 'STZ', 'AJG', 'OAK',
    'HUM', 'KVUE', 'ROST', 'NEM', 'KMB', 'MNST', 'CNC', 'MDT', 'VLO', 'KDP',
    'BKR', 'CCI', 'TRV', 'OKE', 'PCAR', 'PRU', 'DOW', 'WBD', 'AON', 'ALL',
    'OTIS', 'EXC', 'LEN', 'DHI', 'CTSH', 'GPN', 'HPQ', 'HAL', 'FIS', 'SRE',
    'DRE', 'ANSS', 'KMI', 'ROK', 'CRWD', 'EBAY', 'F', 'GM', 'UAL', 'DAL'
]

# Convertir a objetos Stock de IB
print("Validando 200 contratos... esto tarda un poco la primera vez.")
contratos = [Stock(s, 'SMART', 'USD') for s in simbolos]
contratos = ib.qualifyContracts(*contratos)

def fetch_data():
    print(f"\n--- Actualización: {time.strftime('%H:%M:%S')} ---")
    start_time = time.time()
    
    # Usamos reqTickers para obtener una foto instantánea de todos
    # Dividimos en 2 lotes de 100 para ser amigables con la API
    lote1 = contratos[:100]
    lote2 = contratos[100:]
    
    tickers = ib.reqTickers(*lote1) + ib.reqTickers(*lote2)
    
    for t in tickers:
        # Mostramos solo si el precio es válido
        precio = t.marketPrice()
        if precio > 0:
            print(f"{t.contract.symbol}: {precio:.2f}", end=" | ")
    
    return time.time() - start_time

# 3. Bucle infinito cada 20 segundos
try:
    # Activa datos diferidos por si no tienes suscripciones pagas
    ib.reqMarketDataType(3) 
    
    while True:
        duracion = fetch_data()
        espera = max(0, 20 - duracion)
        print(f"\n\nCiclo completado en {duracion:.2f}s. Esperando {espera:.2f}s...")
        ib.sleep(espera)

except KeyboardInterrupt:
    print("\nCerrando conexión...")
    ib.disconnect()