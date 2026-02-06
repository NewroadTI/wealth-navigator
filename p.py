import asyncio
from ib_async import *

async def main():
    ib = IB()
    try:
        print("🏠 Conectando al Gateway Local...")
        # Conexión asíncrona (Correcto)
        await ib.connectAsync('127.0.0.1', 4001, clientId=999)
        print("✅ ¡Conexión Local Exitosa!")
        
        print("Obteniendo la hora del servidor...")
        
        # --- ERROR ANTERIOR ---
        # print(ib.reqCurrentTime())  <-- Esto choca porque intenta pausar el loop
        
        # --- CORRECCIÓN ---
        # Usamos la versión Async y esperamos la respuesta con 'await'
        current_time = await ib.reqCurrentTimeAsync()
        print(f"🕒 Hora del servidor: {current_time}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("Tip: Verifica en el VNC (localhost:5900) que la sesión esté iniciada.")
    finally:
        ib.disconnect()

if __name__ == '__main__':
    asyncio.run(main())