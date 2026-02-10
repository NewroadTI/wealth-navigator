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

# Constants for batch processing
BATCH_SIZE = 50  # Max contracts per batch to avoid socket overload
BATCH_DELAY = 0.5  # Delay between batches in seconds

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
    Includes price cache to avoid redundant IB queries.
    """
    _instance = None
    _lock = Lock()     # Lock para el patrón Singleton
    _ib_lock = Lock()  # Lock CRÍTICO para operaciones con IB
    _failed_symbols: Set[str] = set()  # Caché de símbolos que fallaron
    _failed_isins: Set[str] = set()  # Caché de ISINs que fallaron
    _price_cache: Dict[str, tuple] = {}  # Caché de precios: symbol -> (LivePrice, timestamp)
    _cache_ttl: int = 10  # Segundos de validez del caché
    
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
                    timeout=5,  # Reducido de 10 a 5 segundos
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
        """
        Obtiene precios en vivo. Valida en batch pero maneja errores individualmente.
        Uses non-blocking lock with timeout to prevent request pile-up.
        Uses price cache to avoid redundant IB queries.
        """
        targets = list(set([s for s in (symbols or []) if s not in self._failed_symbols]))
        isin_map = isin_symbol_map or {}

        if not targets:
            return {}

        result = {}
        now = datetime.now()
        symbols_to_fetch = []
        
        # Check cache first
        for symbol in targets:
            if symbol in self._price_cache:
                cached_price, cached_time = self._price_cache[symbol]
                age = (now - cached_time).total_seconds()
                if age < self._cache_ttl:
                    result[symbol] = cached_price
                    # Also add by ISIN if available
                    if cached_price.isin:
                        result[cached_price.isin] = cached_price
                    continue
            symbols_to_fetch.append(symbol)
        
        # If all prices are cached, return immediately (no lock needed)
        if not symbols_to_fetch:
            logger.info(f"✓ Devolviendo {len(result)} precios desde caché")
            return result
        
        logger.info(f"Cache: {len(targets) - len(symbols_to_fetch)} hits, {len(symbols_to_fetch)} misses")

        # Try to acquire lock with timeout (don't block other requests)
        lock_acquired = self._ib_lock.acquire(timeout=2)
        if not lock_acquired:
            logger.warning("Could not acquire IB lock (another request in progress), returning cached results only")
            return result
        
        try:
            try:
                self._ensure_connected()
                
                logger.info(f"Validando {len(symbols_to_fetch)} contratos en batch...")
                
                # Dividir en chunks para evitar sobrecargar el socket
                all_qualified = []
                chunks = [symbols_to_fetch[i:i + BATCH_SIZE] for i in range(0, len(symbols_to_fetch), BATCH_SIZE)]
                
                for chunk_idx, chunk in enumerate(chunks, 1):
                    try:
                        # Verificar conexión antes de cada chunk
                        if not self.ib.isConnected():
                            logger.warning(f"Reconectando antes del chunk {chunk_idx}...")
                            self._ensure_connected()
                        
                        logger.info(f"Procesando chunk {chunk_idx}/{len(chunks)} ({len(chunk)} contratos)...")
                        contracts = [Stock(s, 'SMART', 'USD') for s in chunk]
                        
                        # Validar este chunk
                        qualified = self.ib.qualifyContracts(*contracts)
                        all_qualified.extend(qualified)
                        
                        # Pequeño delay entre chunks para no saturar
                        if chunk_idx < len(chunks):
                            self.ib.sleep(BATCH_DELAY)
                            
                    except Exception as e:
                        logger.warning(f"Error en chunk {chunk_idx}: {e}")
                        # Intentar reconectar para el siguiente chunk
                        try:
                            self.ib.disconnect()
                            self.ib.sleep(1)
                            self._ensure_connected()
                        except Exception as reconn_err:
                            logger.error(f"Error reconectando: {reconn_err}")
                        continue
                
                qualified_contracts = all_qualified
                
                # Mapear contratos válidos por symbol
                valid_by_symbol = {}
                for contract in qualified_contracts:
                    valid_by_symbol[contract.symbol] = contract
                
                # Identificar cuáles fallaron y reintentar con ISIN
                failed_symbols = set(symbols_to_fetch) - set(valid_by_symbol.keys())
                isin_contracts = []
                isin_to_symbol = {}
                
                for symbol in failed_symbols:
                    # Buscar ISIN asociado
                    isin = None
                    for isin_key, sym in isin_map.items():
                        if sym == symbol:
                            isin = isin_key
                            break
                    
                    if isin and isin not in self._failed_isins:
                        isin_contract = Stock(isin, 'SMART', 'USD')
                        isin_contracts.append(isin_contract)
                        isin_to_symbol[isin] = symbol
                
                # Validar contratos con ISIN (también en chunks)
                if isin_contracts:
                    logger.info(f"Reintentando {len(isin_contracts)} símbolos con ISIN...")
                    isin_chunks = [isin_contracts[i:i + BATCH_SIZE] for i in range(0, len(isin_contracts), BATCH_SIZE)]
                    
                    for chunk_idx, isin_chunk in enumerate(isin_chunks, 1):
                        try:
                            # Verificar conexión
                            if not self.ib.isConnected():
                                logger.warning(f"Reconectando para ISINs chunk {chunk_idx}...")
                                self._ensure_connected()
                            
                            qualified_isin = self.ib.qualifyContracts(*isin_chunk)
                            for contract in qualified_isin:
                                # El símbolo puede ser ISIN o el symbol real
                                original_symbol = isin_to_symbol.get(contract.symbol)
                                if original_symbol:
                                    valid_by_symbol[original_symbol] = contract
                                    logger.info(f"✓ Encontrado por ISIN: {contract.symbol} -> {original_symbol}")
                            
                            # Delay entre chunks de ISIN
                            if chunk_idx < len(isin_chunks):
                                self.ib.sleep(BATCH_DELAY)
                                
                        except Exception as e:
                            logger.debug(f"Error validando ISINs chunk {chunk_idx}: {e}")
                            # Intentar reconectar
                            try:
                                self.ib.disconnect()
                                self.ib.sleep(1)
                                self._ensure_connected()
                            except:
                                pass
                            continue
                
                # Cachear los que definitivamente fallaron
                still_failed = set(symbols_to_fetch) - set(valid_by_symbol.keys())
                for symbol in still_failed:
                    self._failed_symbols.add(symbol)
                    # También cachear ISIN si existe
                    for isin_key, sym in isin_map.items():
                        if sym == symbol:
                            self._failed_isins.add(isin_key)
                    logger.debug(f"✗ Cacheado como fallido: {symbol}")
                
                # Obtener precios solo para contratos válidos (también en chunks)
                if valid_by_symbol:
                    logger.info(f"Obteniendo precios para {len(valid_by_symbol)} contratos...")
                    
                    # Dividir contratos válidos en chunks para reqTickers
                    all_tickers = []
                    valid_contracts = list(valid_by_symbol.values())
                    ticker_chunks = [valid_contracts[i:i + BATCH_SIZE] for i in range(0, len(valid_contracts), BATCH_SIZE)]
                    
                    for chunk_idx, ticker_chunk in enumerate(ticker_chunks, 1):
                        try:
                            # Verificar conexión
                            if not self.ib.isConnected():
                                logger.warning(f"Reconectando para ticker chunk {chunk_idx}...")
                                self._ensure_connected()
                            
                            logger.info(f"Solicitando precios chunk {chunk_idx}/{len(ticker_chunks)} ({len(ticker_chunk)} contratos)...")
                            tickers = self.ib.reqTickers(*ticker_chunk)
                            # Give IB time to respond
                            self.ib.sleep(1)
                            all_tickers.extend(tickers)
                            
                            # Delay entre chunks
                            if chunk_idx < len(ticker_chunks):
                                self.ib.sleep(BATCH_DELAY)
                                
                        except Exception as ticker_err:
                            logger.error(f"Error en reqTickers chunk {chunk_idx}: {ticker_err}")
                            # Intentar reconectar
                            try:
                                self.ib.disconnect()
                                self.ib.sleep(1)
                                self._ensure_connected()
                            except:
                                pass
                            continue
                    
                    tickers = all_tickers
                    
                    for ticker in tickers:
                        try:
                            symbol = ticker.contract.symbol
                            price = ticker.marketPrice()
                            
                            if not price or str(price) == 'nan' or price <= 0:
                                price = ticker.last if ticker.last else ticker.close
                            
                            if not price or str(price) == 'nan' or price <= 0:
                                continue
                            
                            # Encontrar el símbolo original
                            original_symbol = symbol
                            for sym, contract in valid_by_symbol.items():
                                if contract.symbol == symbol:
                                    original_symbol = sym
                                    break
                            
                            # Buscar ISIN
                            isin = None
                            for isin_key, sym in isin_map.items():
                                if sym == original_symbol:
                                    isin = isin_key
                                    break
                            
                            live_price = LivePrice(
                                symbol=original_symbol,
                                isin=isin,
                                price=float(price),
                                bid=ticker.bid if ticker.bid else None,
                                ask=ticker.ask if ticker.ask else None,
                                last=ticker.last,
                                close=ticker.close,
                                timestamp=datetime.now(),
                                currency="USD"
                            )
                            
                            result[original_symbol] = live_price
                            if isin:
                                result[isin] = live_price
                            
                            # Update cache
                            self._price_cache[original_symbol] = (live_price, datetime.now())
                        except Exception as e:
                            logger.error(f"Error procesando ticker: {e}")
                            continue
                
                fetched_count = len([k for k in result if k in symbols_to_fetch])
                logger.info(f"✓ Obtenidos {fetched_count} precios de {len(symbols_to_fetch)} intentos (total: {len(result)})")
                return result

            except Exception as e:
                logger.error(f"Error obteniendo precios: {e}")
                logger.error(traceback.format_exc())
                try:
                    self.ib.disconnect()
                except:
                    pass
                return {}
        finally:
            # Always release the lock
            self._ib_lock.release()

    def get_live_prices_batch(self, asset_identifiers: List[Dict[str, str]]) -> Dict[str, LivePrice]:
        """
        Wrapper para compatibilidad con endpoints.
        Filtra assets ya cacheados como fallidos y busca el resto.
        Detecta ISINs automáticamente para evitar buscarlos como símbolos.
        """
        symbols_to_fetch = []
        isin_to_symbol = {}
        
        def is_isin(value: str) -> bool:
            """Detectar si un string es un ISIN (12 chars, starts with 2 letters)."""
            if not value or len(value) != 12:
                return False
            # ISINs empiezan con 2 letras (código de país) seguidas de alfanuméricos
            return value[:2].isalpha() and value[2:].isalnum()
        
        for asset in asset_identifiers:
            symbol = asset.get('symbol')
            isin = asset.get('isin')
            
            # Si symbol parece ser un ISIN, moverlo a isin
            if symbol and is_isin(symbol):
                logger.debug(f"Detectado ISIN en campo symbol: {symbol}")
                if not isin:
                    isin = symbol
                symbol = None  # No intentar buscar como symbol
            
            # Solo intentar si no está en caché de fallidos
            if symbol and not is_isin(symbol) and symbol not in self._failed_symbols:
                symbols_to_fetch.append(symbol)
                if isin and isin not in self._failed_isins:
                    isin_to_symbol[isin] = symbol
            elif not symbol and isin and isin not in self._failed_isins:
                # Si no hay symbol pero sí ISIN, agregarlo al mapa con el ISIN como clave
                isin_to_symbol[isin] = isin  # Usamos ISIN como fallback
        
        if not symbols_to_fetch and not isin_to_symbol:
            logger.warning("No hay símbolos para consultar (todos en caché de fallidos o son ISINs inválidos)")
            return {}
        
        logger.info(f"Consultando {len(symbols_to_fetch)} activos (caché: {len(self._failed_symbols)} symbols, {len(self._failed_isins)} ISINs)")
        if isin_to_symbol:
            logger.info(f"Mapeo ISIN->Symbol: {len(isin_to_symbol)} pares")
        
        # Una sola pasada: el método interno maneja symbol + ISIN automáticamente
        return self.get_live_prices(
            symbols=symbols_to_fetch if symbols_to_fetch else None,
            isin_symbol_map=isin_to_symbol
        )

# Singleton
_service_instance: Optional[IBKRLiveDataService] = None

def get_ibkr_service() -> IBKRLiveDataService:
    global _service_instance
    if _service_instance is None:
        _service_instance = IBKRLiveDataService()
    return _service_instance