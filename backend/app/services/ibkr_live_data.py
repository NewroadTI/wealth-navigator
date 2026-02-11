import logging
import os
import asyncio
import traceback
from typing import Dict, List, Optional, Set
from datetime import datetime
from dataclasses import dataclass
from threading import Lock
import math

from ib_insync import IB, Stock

logger = logging.getLogger(__name__)

# Configuración de rendimiento
BATCH_SIZE = 40  # Aumentado para mayor throughput
BATCH_DELAY = 1.5  # Retraso aumentado para estabilidad del socket

@dataclass
class LivePrice:
    symbol: str
    isin: Optional[str]
    price: float
    bid: Optional[float] = None
    ask: Optional[float] = None
    last: Optional[float] = None
    close: Optional[float] = None
    timestamp: Optional[datetime] = None
    currency: str = "USD"

class IBKRLiveDataService:
    _instance = None
    _lock = Lock()     
    _ib_lock = Lock()  # Lock CRÍTICO
    
    _failed_symbols: Set[str] = set()
    _failed_isins: Set[str] = set()
    _price_cache: Dict[str, tuple] = {}
    _cache_ttl: int = 12  # Ligeramente menor al intervalo de SSE (15s)

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized: return
        self._initialized = True
        
        self.gateway_host = os.getenv("IBKR_GATEWAY_HOST", "host.docker.internal")
        self.gateway_port = int(os.getenv("IBKR_GATEWAY_PORT", "4003")) # Verificar puerto (4003 suele ser paper/live)
        self.client_id = int(os.getenv("IBKR_CLIENT_ID", "10"))
        
        # Instanciar IB dentro del hilo donde se llame por primera vez si es posible
        self.ib = IB() 
        logger.info(f"IBKRLiveDataService inicializado -> {self.gateway_host}:{self.gateway_port}")

    def is_connected(self) -> bool:
        """Check if connected to IB Gateway."""
        return hasattr(self, 'ib') and self.ib and self.ib.isConnected()

    def _ensure_connected(self):
        """Maneja la conexión de forma perezosa pero robusta."""
        if not self.ib.isConnected():
            try:
                # Importante: Fix loop si estamos en un ThreadPoolExecutor
                try:
                    asyncio.get_event_loop()
                except RuntimeError:
                    asyncio.set_event_loop(asyncio.new_event_loop())

                logger.info(f"Conectando IBKR a {self.gateway_host}:{self.gateway_port}...")
                self.ib.connect(
                    host=self.gateway_host, 
                    port=self.gateway_port, 
                    clientId=self.client_id,
                    timeout=10, 
                    readonly=True
                )
                self.ib.reqMarketDataType(3) # Delayed (Free)
            except Exception as e:
                logger.error(f"Fallo conexión IBKR: {e}")
                raise

    def get_live_prices_batch(self, asset_identifiers: List[Dict[str, str]]) -> Dict[str, LivePrice]:
        """
        Método PRINCIPAL. Thread-safe y controlado.
        """
        # Adquirir lock para que solo 1 hilo use el socket a la vez
        if not self._ib_lock.acquire(timeout=5):
            logger.warning("IBKR Lock ocupado, saltando ciclo")
            return {}
        
        try:
            return self._execute_batch_fetch(asset_identifiers)
        finally:
            self._ib_lock.release()

    def _execute_batch_fetch(self, asset_identifiers: List[Dict[str, str]]) -> Dict[str, LivePrice]:
        # [Logica de filtrado de caché idéntica a tu código original...]
        # ... (Omitido por brevedad: lógica de preparación de symbols_to_fetch e isin_map)
        # Asumiremos que tenemos `symbols_to_fetch` limpio aquí.
        
        # REEMPLAZA ESTA PARTE en tu lógica de preparación:
        symbols_to_fetch = []
        isin_to_symbol = {}
        for a in asset_identifiers:
            s = a.get('symbol')
            i = a.get('isin')
            if s and s not in self._failed_symbols: symbols_to_fetch.append(s)
            if i and s: isin_to_symbol[i] = s

        result = {}
        if not symbols_to_fetch: return result

        try:
            self._ensure_connected()
            
            # --- BATCH PROCESSING OPTIMIZADO ---
            contracts = [Stock(s, 'SMART', 'USD') for s in symbols_to_fetch]
            chunks = [contracts[i:i + BATCH_SIZE] for i in range(0, len(contracts), BATCH_SIZE)]
            
            valid_contracts = []
            
            # 1. Calificar Contratos (Qualify)
            for chunk in chunks:
                try:
                    qualified = self.ib.qualifyContracts(*chunk)
                    valid_contracts.extend(qualified)
                    self.ib.sleep(0.2) # Pequeño respiro
                except Exception as e:
                    logger.error(f"Error qualifying chunk: {e}")
                    # No desconectamos inmediatamente, intentamos el siguiente chunk
            
            # 2. Obtener Precios (Tickers)
            if valid_contracts:
                ticker_chunks = [valid_contracts[i:i + BATCH_SIZE] for i in range(0, len(valid_contracts), BATCH_SIZE)]
                
                for chunk in ticker_chunks:
                    try:
                        tickers = self.ib.reqTickers(*chunk)
                        self.ib.sleep(BATCH_DELAY) # Espera crítica para que lleguen datos
                        
                        for t in tickers:
                            symbol = t.contract.symbol
                            price = t.marketPrice()
                            if math.isnan(price): price = t.last or t.close or 0
                            
                            if price > 0:
                                lp = LivePrice(
                                    symbol=symbol,
                                    isin=t.contract.secId if t.contract.secIdType == 'ISIN' else None,
                                    price=float(price),
                                    bid=t.bid, ask=t.ask, last=t.last, close=t.close,
                                    timestamp=datetime.now(), currency=t.contract.currency
                                )
                                result[symbol] = lp
                                # Mapeo inverso ISIN si existe
                                for isin, sym in isin_to_symbol.items():
                                    if sym == symbol: result[isin] = lp

                    except Exception as e:
                        logger.error(f"Error fetching tickers: {e}")
                        # Aquí sí podríamos forzar reconexión si es socket error
                        if "Socket" in str(e) or "Pipe" in str(e):
                            raise e 

            return result

        except Exception as e:
            logger.error(f"IBKR Critical Error: {e}")
            try:
                self.ib.disconnect()
            except: pass
            return {}

# Singleton
_service_instance: Optional[IBKRLiveDataService] = None
def get_ibkr_service() -> IBKRLiveDataService:
    global _service_instance
    if _service_instance is None:
        _service_instance = IBKRLiveDataService()
    return _service_instance