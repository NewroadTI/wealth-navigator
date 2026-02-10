import asyncio
from ib_async import *

async def main():
    ib = IB()
    try:
        # Conectamos a localhost:4001. 
        # El túnel SSH enviará esto a Hetzner -> Docker -> Puerto 4003 (Socat) -> Gateway
        print("🚀 Conectando a tu cuenta en Hetzner...")
        await ib.connectAsync('127.0.0.1', 4001, clientId=1)
        print("✅ ¡LOGRADO! Estás conectado.")
        
        # Prueba real: Traer tu resumen de cuenta
        print("\n--- Resumen de Cuenta ---")
        account_summary = await ib.accountSummaryAsync()
        for item in account_summary:
            if item.tag == 'NetLiquidation':
                print(f"💰 Valor Neto: {item.value} {item.currency}")
                
        # Prueba real: Traer precio de NVIDIA (NVDA)
        print("\n--- Consultando Mercado (NVDA) ---")
        contract = Stock('NVDA', 'SMART', 'USD')
        await ib.qualifyContractsAsync(contract)
        
        # Pedimos precio en vivo (snapshot)
        ticker = await ib.reqTickersAsync(contract)
        print(f"📈 NVIDIA Precio Actual: {ticker[0].marketPrice()}")

    except Exception as e:
        print(f"❌ Error: {e}")
        print("Tip: Verifica que el túnel SSH esté abierto en otra ventana.")
    finally:
        ib.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
