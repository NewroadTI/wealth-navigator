import sys
import logging

# Configuración de ruta
sys.path.append(".")

from app.db.session import SessionLocal

# --- IMPORTACIONES COMPLETAS (Crucial para evitar errores de SQLAlchemy) ---
from app.models.asset import Currency
# Importamos Portfolio y User para que el ORM conozca todas las tablas relacionadas
from app.models.portfolio import Account, Portfolio
from app.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Datos proporcionados
RAW_DATA = {
  "Results": [
    {"CurrencyId": 1, "Symbol": "AUD", "Description": "Australian Dollar", "Order": 101},
    {"CurrencyId": 34, "Symbol": "BRL", "Description": "Brazilian Real", "Order": 134},
    {"CurrencyId": 4, "Symbol": "CAD", "Description": "Canadian Dollar", "Order": 104},
    {"CurrencyId": 28, "Symbol": "CHF", "Description": "Swiss Franc", "Order": 4},
    {"CurrencyId": 5, "Symbol": "CLP", "Description": "Chilean Peso", "Order": 105},
    {"CurrencyId": 53, "Symbol": "CNH", "Description": "Chinese Renminbi (Offshore)", "Order": 35},
    {"CurrencyId": 6, "Symbol": "CNY", "Description": "Chinese Renminbi", "Order": 106},
    {"CurrencyId": 7, "Symbol": "CZK", "Description": "Czech Koruna", "Order": 107},
    {"CurrencyId": 8, "Symbol": "DKK", "Description": "Danish Krone", "Order": 108},
    {"CurrencyId": 39, "Symbol": "EUR", "Description": "Euro", "Order": 1},
    {"CurrencyId": 48, "Symbol": "GBP", "Description": "British Pound", "Order": 3},
    {"CurrencyId": 10, "Symbol": "HKD", "Description": "Hong Kong Dollar", "Order": 110},
    {"CurrencyId": 11, "Symbol": "HUF", "Description": "Hungarian Forint", "Order": 111},
    {"CurrencyId": 13, "Symbol": "IDR", "Description": "Indonesian Rupiah", "Order": 113},
    {"CurrencyId": 14, "Symbol": "ILS", "Description": "Israeli Shekel", "Order": 114},
    {"CurrencyId": 12, "Symbol": "INR", "Description": "Indian Rupee", "Order": 112},
    {"CurrencyId": 15, "Symbol": "JPY", "Description": "Japanese Yen", "Order": 7},
    {"CurrencyId": 16, "Symbol": "KRW", "Description": "South Korean Won", "Order": 116},
    {"CurrencyId": 18, "Symbol": "MXN", "Description": "Mexican Peso", "Order": 118},
    {"CurrencyId": 17, "Symbol": "MYR", "Description": "Malaysian Ringgit", "Order": 117},
    {"CurrencyId": 20, "Symbol": "NOK", "Description": "Norwegian Krone", "Order": 120},
    {"CurrencyId": 19, "Symbol": "NZD", "Description": "New Zealand Dollar", "Order": 119},
    {"CurrencyId": 51, "Symbol": "PEN", "Description": "Peruvian Sol", "Order": 137},
    {"CurrencyId": 22, "Symbol": "PHP", "Description": "Philippine Peso", "Order": 122},
    {"CurrencyId": 21, "Symbol": "PKR", "Description": "Pakistani Rupee", "Order": 121},
    {"CurrencyId": 23, "Symbol": "PLN", "Description": "Polish Zloty", "Order": 123},
    {"CurrencyId": 24, "Symbol": "RUB", "Description": "Russian Ruble", "Order": 124},
    {"CurrencyId": 27, "Symbol": "SEK", "Description": "Swedish Krona", "Order": 127},
    {"CurrencyId": 25, "Symbol": "SGD", "Description": "Singapore Dollar", "Order": 125},
    {"CurrencyId": 30, "Symbol": "THB", "Description": "Thai Baht", "Order": 130},
    {"CurrencyId": 31, "Symbol": "TRY", "Description": "Turkish Lira", "Order": 131},
    {"CurrencyId": 29, "Symbol": "TWD", "Description": "New Taiwan Dollar", "Order": 129},
    {"CurrencyId": 32, "Symbol": "USD", "Description": "US Dollar", "Order": 2},
    {"CurrencyId": 26, "Symbol": "ZAR", "Description": "South African Rand", "Order": 126}
  ]
}

def seed_currencies():
    db = SessionLocal()
    try:
        logger.info(f"--- 💱 Iniciando Semilla de Monedas ({len(RAW_DATA['Results'])} registros) ---")
        
        count_new = 0
        count_updated = 0
        
        for item in RAW_DATA["Results"]:
            # Usamos 'Symbol' como PK (code)
            code = item["Symbol"]
            
            # Nota: En tu JSON la descripción es igual al código (ej: AUD -> AUD).
            # He actualizado manualmente el diccionario arriba con nombres reales (Australian Dollar)
            # para que tu catálogo se vea más profesional. Si prefieres los códigos, cambia esto.
            name = item["Description"] 
            
            # Upsert Logic
            currency = db.query(Currency).filter(Currency.code == code).first()
            
            if not currency:
                currency = Currency(code=code, name=name)
                db.add(currency)
                count_new += 1
            else:
                if currency.name != name:
                    currency.name = name
                    count_updated += 1
        
        db.commit()
        logger.info(f"✅ Monedas procesadas: {count_new} creadas, {count_updated} actualizadas.")
        logger.info("--- 🏁 Semilla de Monedas Completada ---")

    except Exception as e:
        logger.error(f"❌ Error insertando monedas: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_currencies()