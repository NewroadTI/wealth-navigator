import json
import requests
import time
import sys
from decimal import Decimal

# --- CONFIGURACIÓN ---
# NOTA: Agregué el "/" al final para evitar redirecciones 307 de FastAPI
API_URL = "http://localhost:8000/api/v1/assets/" 
INPUT_FILE = "assets_ready_for_db.json"
ERROR_LOG_FILE = "upload_errors.json"

def load_json_data(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Error: No se encuentra el archivo {filename}")
        sys.exit(1)

def upload_assets():
    print(f"📂 Cargando datos de {INPUT_FILE}...")
    assets = load_json_data(INPUT_FILE)
    total = len(assets)
    print(f"🚀 Iniciando carga de {total} activos a {API_URL}...")

    success_count = 0
    errors = []

    headers = {
        "Content-Type": "application/json",
    }

    start_time = time.time()

    for i, asset in enumerate(assets):
        try:
            # --- 1. ADAPTACIÓN DE DATOS ---
            # El API requiere 'name', usamos description o symbol
            asset_name = asset.get("description")
            if not asset_name or asset_name.strip() == "":
                asset_name = asset.get("symbol")
            
            payload = asset.copy()
            payload["name"] = asset_name
            
            # --- 2. LIMPIEZA DE DATOS ---
            # Convertir strings vacíos a None para evitar errores de validación de Pydantic (especialmente en fechas)
            for key, value in payload.items():
                if isinstance(value, str) and value.strip() == "":
                    payload[key] = None

            # --- 3. PETICIÓN POST ---
            response = requests.post(API_URL, json=payload, headers=headers)

            if response.status_code in [200, 201]:
                success_count += 1
                # Barra de progreso visual
                if success_count % 50 == 0:
                    elapsed = time.time() - start_time
                    print(f"   ✅ Progreso: {success_count}/{total} ({elapsed:.1f}s)")
            else:
                # Error de validación o servidor
                error_msg = response.text
                try:
                    # Intenta formatear el error si es JSON
                    error_msg = response.json()
                except:
                    pass

                error_detail = {
                    "symbol": asset.get("symbol"),
                    "status_code": response.status_code,
                    "error_response": error_msg,
                    "payload_sent": payload
                }
                errors.append(error_detail)
                print(f"   ❌ Falló {asset.get('symbol')}: {response.status_code}")

        except requests.exceptions.ConnectionError:
            print("   ⛔ Error Crítico: No se puede conectar a la API. ¿Está corriendo el servidor?")
            sys.exit(1)
        except Exception as e:
            error_detail = {
                "symbol": asset.get("symbol"),
                "error": str(e)
            }
            errors.append(error_detail)
            print(f"   ❌ Excepción en {asset.get('symbol')}: {e}")

    # --- RESULTADOS ---
    total_time = time.time() - start_time
    print("\n" + "="*40)
    print(f"🏁 Finalizado en {total_time:.2f} segundos.")
    print(f"✅ Exitosos: {success_count}")
    print(f"❌ Fallidos: {len(errors)}")
    
    if errors:
        with open(ERROR_LOG_FILE, 'w', encoding='utf-8') as f:
            json.dump(errors, f, indent=2, default=str)
        print(f"📁 Detalles de errores guardados en: {ERROR_LOG_FILE}")
        print("   TIP: Si el error es 400/500, verifica que Countries, Currencies y Classes estén cargados en la DB.")

if __name__ == "__main__":
    print("⚠️  IMPORTANTE: Asegúrate de haber cargado primero:")
    print("    1. Asset Classes")
    print("    2. Countries")
    print("    3. Currencies")
    print("    4. Industries")
    confirm = input(f"\n¿Continuar con la carga a {API_URL}? (y/n): ")
    if confirm.lower() == 'y':
        upload_assets()
    else:
        print("Operación cancelada.")