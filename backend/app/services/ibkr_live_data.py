import logging
import os
import asyncio
from typing import Dict, List, Optional, Set
from datetime import datetime
from dataclasses import dataclass
from threading import Lock
import traceback

# Importamos las clases necesarias de ib_insync
from ib_insync import IB, Stock, util

logger = logging.getLogger(__name__)

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
    """
    Servicio robusto para IBKR.
    Maneja la conexión síncrona y la creación de Event Loops para hilos de FastAPI.
    """
    _instance = None
    _lock = Lock()     # Lock para el patrón Singleton
    _ib_lock = Lock()  # Lock CRÍTICO para operaciones con IB
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self._initialized = True
        
        # IMPORTANTE: IB() necesita un loop. Lo instanciamos de forma segura.
        # Si falla aquí, se intentará recrear en la conexión.
        try:
            self._fix_event_loop()
            self.ib = IB()
        except Exception as e:
            logger.warning(f"Advertencia al instanciar IB: {e}")
            self.ib = IB() # Reintento simple
        
        # Configuración de red
        self.gateway_host = os.getenv("IBKR_GATEWAY_HOST", "host.docker.internal")
        self.gateway_port = int(os.getenv("IBKR_GATEWAY_PORT", "4001"))
        self.client_id = int(os.getenv("IBKR_CLIENT_ID", "10"))
        
        # Tipo de datos: 3 (Delayed) por defecto
        self.market_data_type = int(os.getenv("IBKR_MARKET_DATA_TYPE", "3"))
        
        logger.info(f"IBKRLiveDataService inicializado -> {self.gateway_host}:{self.gateway_port}")

    def _fix_event_loop(self):
        """Asegura que existe un Event Loop en el hilo actual."""
        try:
            asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

    def is_connected(self) -> bool:
        """Método helper para compatibilidad con la API."""
        return self.ib.isConnected() if hasattr(self, 'ib') and self.ib else False

    def disconnect(self):
        """Desconecta limpiamente."""
        if self.is_connected():
            try:
                self.ib.disconnect()
            except Exception as e:
                logger.error(f"Error al desconectar: {e}")

    def _ensure_connected(self):
        """Revisa la conexión y reconecta si es necesario (Dentro del Lock)."""
        # Paso crítico: Asegurar que el hilo tiene un Loop antes de que IB intente nada
        self._fix_event_loop()

        if not self.ib.isConnected():
            logger.info(f"Conectando a {self.gateway_host}:{self.gateway_port}...")
            try:
                # Conexión Síncrona Bloqueante
                self.ib.connect(
                    host=self.gateway_host, 
                    port=self.gateway_port, 
                    clientId=self.client_id,
                    timeout=10,
                    readonly=True
                )
                self.ib.reqMarketDataType(self.market_data_type)
                logger.info(f"Conectado. MarketDataType: {self.market_data_type}")
            except Exception as e:
                logger.error(f"Error de conexión IBKR: {e}")
                # Si falla, a veces ayuda limpiar la instancia
                try:
                    self.ib.disconnect()
                except:
                    pass
                raise

    def get_live_prices(
        self, 
        symbols: Optional[List[str]] = None,
        isins: Optional[List[str]] = None,
        isin_symbol_map: Optional[Dict[str, str]] = None
    ) -> Dict[str, LivePrice]:
        
        targets = set()
        if symbols: targets.update(symbols)
        
        isin_map = isin_symbol_map or {}
        if isins and isin_symbol_map:
            for isin in isins:
                if isin in isin_map:
                    targets.add(isin_map[isin])

        if not targets:
            return {}

        result = {}

        # SECCIÓN CRÍTICA
        with self._ib_lock:
            try:
                self._ensure_connected()
                
                contracts = [Stock(s, 'SMART', 'USD') for s in targets]
                
                logger.info(f"Validando {len(contracts)} contratos...")
                qualified_contracts = self.ib.qualifyContracts(*contracts)
                
                if not qualified_contracts:
                    logger.warning("Ningún contrato pudo ser validado.")
                    return {}

                logger.info(f"Solicitando precios para {len(qualified_contracts)} activos...")
                tickers = self.ib.reqTickers(*qualified_contracts)
                
                for ticker in tickers:
                    symbol = ticker.contract.symbol
                    price = ticker.marketPrice()
                    
                    # Fallback de precio
                    if not price or str(price) == 'nan' or price <= 0:
                        price = ticker.last if ticker.last else ticker.close
                        
                    if not price or str(price) == 'nan' or price <= 0:
                        continue

                    live_price = LivePrice(
                        symbol=symbol,
                        isin=None,
                        price=float(price),
                        bid=ticker.bid if ticker.bid else None,
                        ask=ticker.ask if ticker.ask else None,
                        last=ticker.last,
                        close=ticker.close,
                        timestamp=datetime.now(),
                        currency="USD"
                    )
                    
                    result[symbol] = live_price
                    for isin, sym in isin_map.items():
                        if sym == symbol:
                            result[isin] = live_price
                            live_price.isin = isin
                            
                return result

            except Exception as e:
                logger.error(f"Error obteniendo precios: {e}")
                try:
                    self.ib.disconnect()
                except:
                    pass
                return {}

    def get_live_prices_batch(self, asset_identifiers: List[Dict[str, str]]) -> Dict[str, LivePrice]:
        """Wrapper para compatibilidad con endpoints."""
        symbols_to_fetch = set()
        isin_to_symbol = {}
        
        for asset in asset_identifiers:
            symbol = asset.get('symbol')
            isin = asset.get('isin')
            if symbol:
                symbols_to_fetch.add(symbol)
                if isin:
                    isin_to_symbol[isin] = symbol
        
        return self.get_live_prices(
            symbols=list(symbols_to_fetch),
            isin_symbol_map=isin_to_symbol
        )

# Singleton
_service_instance: Optional[IBKRLiveDataService] = None

def get_ibkr_service() -> IBKRLiveDataService:
    global _service_instance
    if _service_instance is None:
        _service_instance = IBKRLiveDataService()
    return _service_instance