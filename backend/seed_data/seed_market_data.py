import sys
import logging

# Configuración de ruta
sys.path.append(".")

from app.db.session import SessionLocal
from app.models.asset import StockExchange, MarketIndex, Country
from app.models.portfolio import Account, Portfolio # <--- ESTO SOLUCIONA EL ERROR
from app.models.user import User  # <--- ¡ESTA LÍNEA FALTABA!

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- MAPAS DE CONVERSIÓN ---

# Mapa CountryId (JSON) -> ISO Code (DB)
ID_TO_ISO = {
    724: "ES", 826: "GB", 76: "BR", 840: "US", 372: "IE", 
    276: "DE", 442: "LU", 528: "NL", 56: "BE", 620: "PT", 
    250: "FR", 344: "HK", 380: "IT", 208: "DK", 752: "SE", 
    246: "FI", 578: "NO", 702: "SG", 392: "JP", 124: "CA", 
    40: "AT", 756: "CH", 158: "TW"
}

# Mapa Nombre País (Texto) -> ISO Code (DB)
NAME_TO_ISO = {
    "United States": "US", "China": "CN", "Taiwan": "TW", 
    "Japan": "JP", "Peru": "PE", "Default": "XX", "0": "XX",
    "China": "CN"
}

# --- DATA RAW ---

EXCHANGES_DATA = [
    {"ExchangeCode": "MARF", "Description": "ALTERNATIVE FIXED INCOME MARKET", "CountryId": 724},
    {"ExchangeCode": "MABX", "Description": "ALTERNATIVE STOCK EXCHANGE", "CountryId": 724},
    {"ExchangeCode": "BMTF", "Description": "BLOOMBERG TRADING FACILITY LIMITED", "CountryId": 826},
    {"ExchangeCode": "BVMF", "Description": "BM&FBOVESPA S.A.", "CountryId": 76},
    {"ExchangeCode": "XCBO", "Description": "CBOE GLOBAL MARKETS INC.", "CountryId": 840},
    {"ExchangeCode": "XCBT", "Description": "CHICAGO BOARD OF TRADE", "CountryId": 840},
    {"ExchangeCode": "XCME", "Description": "CHICAGO STOCK EXCHANGE", "CountryId": 840},
    {"ExchangeCode": "XDUB", "Description": "DUBLIN STOCK EXCHANGE", "CountryId": 372},
    {"ExchangeCode": "XEUR", "Description": "EUREX GERMANY", "CountryId": 276},
    {"ExchangeCode": "EMTF", "Description": "EURO MTF", "CountryId": 442},
    {"ExchangeCode": "XAMS", "Description": "EURONEXT AMSTERDAM", "CountryId": 528},
    {"ExchangeCode": "XBRU", "Description": "EURONEXT BRUSELAS", "CountryId": 56},
    {"ExchangeCode": "XLIS", "Description": "EURONEXT LISBON", "CountryId": 620},
    {"ExchangeCode": "XPAR", "Description": "EURONEXT PARIS", "CountryId": 250},
    {"ExchangeCode": "XFRA", "Description": "FRANKFURT STOCK EXCHANGE", "CountryId": 276},
    {"ExchangeCode": "XHKG", "Description": "HONG KONG STOCK EXCHANGE", "CountryId": 344},
    {"ExchangeCode": "XLON", "Description": "LONDON STOCK EXCHANGE", "CountryId": 826},
    {"ExchangeCode": "XMAD", "Description": "MADRID STOCK EXCHANGE", "CountryId": 724},
    {"ExchangeCode": "XMIL", "Description": "MILAN STOCK EXCHANGE", "CountryId": 380},
    {"ExchangeCode": "XMRV", "Description": "MOFEX (MEFF)", "CountryId": 724},
    {"ExchangeCode": "XNAS", "Description": "NASDAQ - ALL MARKETS", "CountryId": 840},
    {"ExchangeCode": "XCSE", "Description": "NASDAQ COPENAGUE A/S", "CountryId": 208},
    {"ExchangeCode": "XSTO", "Description": "NASDAQ ESTOCOLMO AB", "CountryId": 752},
    {"ExchangeCode": "XHEL", "Description": "NASDAQ HELSINKI LTD", "CountryId": 246},
    {"ExchangeCode": "XNGS", "Description": "NASDAQ/NGS (GLOBAL SELECT MARKET)", "CountryId": 840},
    {"ExchangeCode": "XNMS", "Description": "NASDAQ/NMS (GLOBAL MARKET)", "CountryId": 840},
    {"ExchangeCode": "XNYS", "Description": "NEW YORK STOCK EXCHANGE", "CountryId": 840},
    {"ExchangeCode": "XOSL", "Description": "OSLO STOCK EXCHANGE", "CountryId": 578},
    {"ExchangeCode": "XSES", "Description": "SINGAPORE STOCK EXCHANGE", "CountryId": 702},
    {"ExchangeCode": "XTKS", "Description": "TOKIO STOCK EXCHANGE", "CountryId": 392},
    {"ExchangeCode": "XTSX", "Description": "TSX VENTURE (CANADA)", "CountryId": 124},
    {"ExchangeCode": "XWBO", "Description": "VIENNA STOCK EXCHANGE", "CountryId": 40},
    {"ExchangeCode": "XETR", "Description": "XETRA", "CountryId": 276},
    {"ExchangeCode": "XSWX", "Description": "ZURICH STOCK EXCHANGE", "CountryId": 756},
    {"ExchangeCode": "XVTX", "Description": "ZURICH STOCK EXCHANGE - BLUE CHIPS", "CountryId": 756}
]

INDICES_DATA = [
    {"Description": "EURO STOXX 50 PRICE EUR", "Country": "0", "Symbol": "SX5E"},
    {"Description": "S&P 500 NET TOTAL RETURN INDEX", "Country": "0", "Symbol": "SPTR500N"},
    {"Description": "TOPIX TOTAL RETURN INDEX JPY", "Country": "0", "Symbol": "TPXDDVD"},
    {"Description": "STOXX EUROPE 600 (NET RETURN)", "Country": "0", "Symbol": "SXXR"},
    {"Description": "MSCI EMERGING MARKETS DAILY NET TR EUR", "Country": "0", "Symbol": "MSCIEF.INDX"},
    {"Description": "BLOOMBERG BARCLAYS EURO AGG CORP", "Country": "0", "Symbol": "LECPTREU"},
    {"Description": "BLOOMBERG BARCLAYS PAN-EURO HY", "Country": "0", "Symbol": "LP02TREU"},
    {"Description": "EXANE EUROPE CONVERTIBLE BOND", "Country": "0", "Symbol": "EECIEECI"},
    {"Description": "BLOOMBERG BARCLAYS EM SOVEREIGN", "Country": "0", "Symbol": "BSSUTRUU"},
    {"Description": "BLOOMBERG BARCLAYS EURO GOVT INFLATION", "Country": "0", "Symbol": "BEIG1T"},
    {"Description": "ALERIAN MLP INFRASTRUCTURE INDEX", "Country": "0", "Symbol": "AMZI"},
    {"Description": "FTSE EPRA NAREIT DEVELOPED EUROPE", "Country": "0", "Symbol": "NEPRA"},
    {"Description": "SG TREND INDEX", "Country": "0", "Symbol": "NEIXCTAT"},
    {"Description": "LPX50 LISTED PRIVATE EQUITY INDEX TR", "Country": "0", "Symbol": "LPX50TR"},
    {"Description": "HEDGE FUND RESEARCH HFRX GLOBAL", "Country": "0", "Symbol": "HFRXGLE"},
    {"Description": "EURIBOR 3 MONTH", "Country": "0", "Symbol": "EUR003M"},
    {"Description": "USD LIBOR 3 MONTH", "Country": "0", "Symbol": "US0003M"},
    {"Description": "NETHERLANDS GOVERNMENT 10YR BOND", "Country": "0", "Symbol": "GNTH10YR"},
    {"Description": "CNH/USD", "Country": "China", "Symbol": "CNH/USD"},
    {"Description": "TWD/USD", "Country": "Taiwan", "Symbol": "TWD/USD"},
    {"Description": "JPY/USD", "Country": "Japan", "Symbol": "JPY/USD"},
    {"Description": "HKD/USD", "Country": "Peru", "Symbol": "HKD/USD"},
    {"Description": "EUR/USD", "Country": "Peru", "Symbol": "EUR/USD"},
    {"Description": "S&P 500 INDEX", "Country": "United States", "Symbol": "SPX"},
    {"Description": "S&P 500", "Country": "United States", "Symbol": "S&P500"},
    {"Description": "iShares Core Conservative Allocation ETF", "Country": "United States", "Symbol": "AOK"},
    {"Description": "iShares Core Aggressive Allocation ETF", "Country": "United States", "Symbol": "BND_AGG"}, # Fix duplicate BND
    {"Description": "iShares Core Moderate Allocation ETF", "Country": "United States", "Symbol": "AOM"},
    {"Description": "Vanguard Total Bond Market ETF", "Country": "United States", "Symbol": "BND"},
    {"Description": "iShares iBoxx USD Inv Grade Corp Bond", "Country": "United States", "Symbol": "LQD"},
    {"Description": "iShares 20+ Year Treasury Bond ETF", "Country": "United States", "Symbol": "TLT"},
    {"Description": "S&P 500 ETF", "Country": "United States", "Symbol": "SPY"},
    {"Description": "MSCI WORLD NET TOTAL RETURN EUR", "Country": "Default", "Symbol": "MSCIWORLD.INDX"},
    {"Description": "BLOOMBERG BARCLAYS EUROAGG TREASURY", "Country": "Default", "Symbol": "LEATTREU"},
    {"Description": "EONIA TOTAL RETURN INDEX", "Country": "Default", "Symbol": "DBDCONIA"},
    {"Description": "USD/EUR", "Country": "Default", "Symbol": "USD/EUR"},
    {"Description": "GBP/EUR", "Country": "Default", "Symbol": "GBP/EUR"},
    {"Description": "CHF/EUR", "Country": "Default", "Symbol": "CHF/EUR"},
    {"Description": "JPY/EUR", "Country": "Default", "Symbol": "JPY/EUR"},
    {"Description": "SEK/EUR", "Country": "Default", "Symbol": "SEK/EUR"},
    {"Description": "MXN/EUR", "Country": "Default", "Symbol": "MXN/EUR"},
    {"Description": "NOK/EUR", "Country": "Default", "Symbol": "NOK/EUR"},
    {"Description": "BRL/EUR", "Country": "Default", "Symbol": "BRL/EUR"},
    {"Description": "DKK/EUR", "Country": "Default", "Symbol": "DKK/EUR"},
    {"Description": "SGD/EUR", "Country": "Default", "Symbol": "SGD/EUR"},
    {"Description": "TRY/EUR", "Country": "Default", "Symbol": "TRY/EUR"},
    {"Description": "IDR/EUR", "Country": "Default", "Symbol": "IDR/EUR"},
    {"Description": "HKD/EUR", "Country": "Default", "Symbol": "HKD/EUR"},
    {"Description": "RiskFree", "Country": "Default", "Symbol": "RiskFree"},
    {"Description": "LOW BMARK", "Country": "Default", "Symbol": "VB"},
    {"Description": "MEDIUM BMARK", "Country": "Default", "Symbol": "VM"},
    {"Description": "HIGH BMARK", "Country": "Default", "Symbol": "VA"},
    {"Description": "EQUITIES", "Country": "Default", "Symbol": "RV"},
    {"Description": "CAD/EUR", "Country": "Default", "Symbol": "CAD/EUR"},
    {"Description": "AUD/EUR", "Country": "Default", "Symbol": "AUD/EUR"},
    {"Description": "MSCI EUROPE NET TOTAL RETURN INDEX", "Country": "Default", "Symbol": "MSCIEU.INDX"},
    {"Description": "EURIBOR 1 WEEK ACT/360", "Country": "Default", "Symbol": "EUR001W"},
    {"Description": "GBP/USD", "Country": "Default", "Symbol": "GBP/USD"},
    {"Description": "CNY/USD", "Country": "Default", "Symbol": "CNY/USD"},
    {"Description": "CHF/USD", "Country": "Default", "Symbol": "CHF/USD"}
]

def seed_market_data():
    db = SessionLocal()
    try:
        # 1. EXCHANGES
        logger.info(f"--- 🏛️ Iniciando Semilla de Exchanges ({len(EXCHANGES_DATA)} registros) ---")
        count_ex = 0
        
        for item in EXCHANGES_DATA:
            code = item["ExchangeCode"]
            country_id = item["CountryId"]
            
            # Convertir ID numérico a ISO
            country_iso = ID_TO_ISO.get(country_id, "XX") # Fallback a XX si no encuentra
            
            obj = db.query(StockExchange).filter(StockExchange.exchange_code == code).first()
            if not obj:
                obj = StockExchange(
                    exchange_code=code,
                    name=item["Description"],
                    country_code=country_iso
                )
                db.add(obj)
                count_ex += 1
            else:
                obj.name = item["Description"]
                obj.country_code = country_iso
        
        db.commit()
        logger.info(f"✅ Exchanges creados/actualizados: {count_ex}")

        # 2. INDICES
        logger.info(f"--- 📈 Iniciando Semilla de Indices ({len(INDICES_DATA)} registros) ---")
        count_idx = 0
        
        for item in INDICES_DATA:
            symbol = item["Symbol"]
            country_name = item.get("Country", "Default").strip()
            
            # Convertir Nombre a ISO
            country_iso = NAME_TO_ISO.get(country_name, "XX")
            
            obj = db.query(MarketIndex).filter(MarketIndex.index_code == symbol).first()
            if not obj:
                obj = MarketIndex(
                    index_code=symbol,
                    name=item["Description"],
                    country_code=country_iso,
                    exchange_code=None # No tenemos el exchange en la data raw
                )
                db.add(obj)
                count_idx += 1
            else:
                obj.name = item["Description"]
                obj.country_code = country_iso
        
        db.commit()
        logger.info(f"✅ Indices creados/actualizados: {count_idx}")
        logger.info("--- 🏁 Semilla de Mercado Completada ---")

    except Exception as e:
        logger.error(f"❌ Error insertando datos de mercado: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_market_data()