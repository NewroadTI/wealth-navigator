import asyncio
import json
import logging
import math
import uuid
from typing import Dict, Set, Optional, List, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from collections import defaultdict

# Imports de modelos solo para tipado (evitar ciclos)
from app.schemas.analytics import LivePriceItem

logger = logging.getLogger(__name__)

# --- Helper Functions ---
def sanitize_value(value: Any) -> Any:
    if value is None: return None
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value): return None
    return value

def sanitize_dict(data: dict) -> dict:
    result = {}
    for key, value in data.items():
        if isinstance(value, dict):
            result[key] = sanitize_dict(value)
        elif isinstance(value, list):
            result[key] = [sanitize_dict(item) if isinstance(item, dict) else sanitize_value(item) for item in value]
        else:
            result[key] = sanitize_value(value)
    return result

@dataclass
class LivePriceUpdate:
    asset_id: int
    symbol: str
    isin: Optional[str]
    live_price: float
    previous_close: Optional[float]
    day_change_pct: float
    bid: Optional[float]
    ask: Optional[float]
    last: Optional[float]
    timestamp: str
    currency: str = "USD"

@dataclass
class SSEMessage:
    event: str
    data: dict
    def format(self) -> str:
        return f"event: {self.event}\ndata: {json.dumps(self.data)}\n\n"

class SSEConnection:
    def __init__(self, connection_id: str):
        self.connection_id = connection_id
        self.queue: asyncio.Queue = asyncio.Queue()
        self.subscribed_asset_ids: Set[int] = set()
        self.connected_at = datetime.now()
        self.last_heartbeat = datetime.now()
        
    async def send(self, message: SSEMessage):
        await self.queue.put(message)
        
    async def send_prices(self, prices: List[LivePriceUpdate]):
        relevant_prices = [p for p in prices if p.asset_id in self.subscribed_asset_ids]
        if relevant_prices:
            prices_data = [sanitize_dict(asdict(p)) for p in relevant_prices]
            await self.send(SSEMessage(
                event="prices",
                data={"prices": prices_data, "timestamp": datetime.now().isoformat()}
            ))

class LivePricesSSEManager:
    _instance: Optional['LivePricesSSEManager'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized: return
        self._initialized = True
        
        self._connections: Dict[str, SSEConnection] = {}
        self._background_task: Optional[asyncio.Task] = None
        self._running = False
        
        # Configuración de intervalos
        self._fetch_interval = 15
        self._cache_refresh_interval = 600  # 10 minutos para refrescar datos estáticos de DB
        
        # --- CAPA DE CACHÉ (Memoria) ---
        self._last_prices: Dict[int, LivePriceUpdate] = {}
        self._all_subscribed_assets: Set[int] = set()
        
        # Cachés estáticos (evitan ir a la DB cada 15s)
        self._asset_info_cache: Dict[int, dict] = {} # {id: {symbol: 'AAPL', isin: '...'}}
        self._prev_price_cache: Dict[int, float] = {} # {id: 150.50}
        self._last_db_refresh = datetime.min
        
        logger.info("LivePricesSSEManager initialized with Memory Caching")
    
    @property
    def connection_count(self) -> int: return len(self._connections)
    
    def create_connection(self) -> SSEConnection:
        conn_id = str(uuid.uuid4())
        connection = SSEConnection(conn_id)
        self._connections[conn_id] = connection
        if not self._running: self._start_background_task()
        return connection
    
    def remove_connection(self, connection_id: str):
        if connection_id in self._connections:
            del self._connections[connection_id]
            self._update_subscribed_assets()
            if self.connection_count == 0: self._stop_background_task()
    
    def update_subscription(self, connection_id: str, asset_ids: List[int]):
        if connection_id in self._connections:
            self._connections[connection_id].subscribed_asset_ids = set(asset_ids)
            self._update_subscribed_assets()

    def _update_subscribed_assets(self):
        self._all_subscribed_assets = set()
        for conn in self._connections.values():
            self._all_subscribed_assets.update(conn.subscribed_asset_ids)

    def _start_background_task(self):
        if self._background_task is None or self._background_task.done():
            self._running = True
            self._background_task = asyncio.create_task(self._price_fetch_loop())
            logger.info("SSE background task started")

    def _stop_background_task(self):
        self._running = False
        if self._background_task:
            self._background_task.cancel()
            self._background_task = None

    async def _price_fetch_loop(self):
        """Bucle principal optimizado: Solo usa memoria, toca DB raramente."""
        logger.info("Starting optimized price fetch loop")
        
        while self._running:
            try:
                # Si no hay usuarios, esperamos sin hacer nada
                if self.connection_count == 0:
                    await asyncio.sleep(5)
                    continue

                # 1. Refrescar caché de DB si es necesario (Datos estáticos)
                # Esto carga Symbols, ISINs y Precios de Cierre Anterior
                needed_ids = list(self._all_subscribed_assets)
                if needed_ids:
                    await self._refresh_db_cache_if_needed(needed_ids)
                
                # 2. Preparar datos para IBKR desde memoria
                asset_identifiers = []
                valid_asset_ids = []
                
                for aid in needed_ids:
                    info = self._asset_info_cache.get(aid)
                    if info:
                        identifier = {"asset_id": aid}
                        if info['symbol']: identifier["symbol"] = info['symbol']
                        if info['isin']: identifier["isin"] = info['isin']
                        asset_identifiers.append(identifier)
                        valid_asset_ids.append(aid)
                
                # 3. Consultar IBKR (Operación I/O pesada)
                if asset_identifiers:
                    from app.services.ibkr_live_data import get_ibkr_service
                    ibkr = get_ibkr_service()
                    
                    # Usamos un ejecutor para no bloquear, pero el servicio tiene su propio Lock
                    loop = asyncio.get_event_loop()
                    live_data = await loop.run_in_executor(
                        None, 
                        ibkr.get_live_prices_batch, 
                        asset_identifiers
                    )
                    
                    if live_data:
                        updates = self._process_live_data(live_data, valid_asset_ids)
                        await self._broadcast_prices(updates)
                
                await asyncio.sleep(self._fetch_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in price loop: {e}")
                await asyncio.sleep(5)

    async def _refresh_db_cache_if_needed(self, asset_ids: List[int]):
        """Consulta la DB solo si ha pasado tiempo o hay IDs nuevos que no conocemos."""
        now = datetime.now()
        
        # Detectar si hay assets desconocidos en la suscripción
        unknown_ids = [aid for aid in asset_ids if aid not in self._asset_info_cache]
        
        time_expired = (now - self._last_db_refresh).total_seconds() > self._cache_refresh_interval
        
        if unknown_ids or time_expired:
            logger.info("Refreshing static asset data from DB...")
            try:
                # Importación diferida para evitar ciclos
                from app.db.session import SessionLocal
                from app.models.asset import Asset, Position
                from sqlalchemy import func
                from app.api.v1.endpoints.analytics import get_previous_date
                
                # Ejecutar DB query en hilo aparte para no congelar el loop de eventos
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self._db_refresh_task, asset_ids)
                
                self._last_db_refresh = now
            except Exception as e:
                logger.error(f"Error refreshing DB cache: {e}")

    def _db_refresh_task(self, asset_ids: List[int]):
        """Tarea síncrona que corre en thread pool para actualizar caché."""
        from app.db.session import SessionLocal
        from app.models.asset import Asset, Position
        from sqlalchemy import func
        from app.api.v1.endpoints.analytics import get_previous_date
        
        with SessionLocal() as db:
            # 1. Cargar Info Estática (Symbols/ISINs)
            assets = db.query(Asset.asset_id, Asset.symbol, Asset.isin).filter(
                Asset.asset_id.in_(asset_ids)
            ).all()
            
            for a in assets:
                self._asset_info_cache[a.asset_id] = {
                    "symbol": a.symbol,
                    "isin": a.isin
                }
            
            # 2. Cargar Precios de Cierre Anterior (Para Day Change)
            latest_date = db.query(func.max(Position.report_date)).scalar()
            if latest_date:
                prev_date = get_previous_date(db, latest_date)
                if prev_date:
                    prev_positions = db.query(
                        Position.asset_id, Position.mark_price
                    ).filter(
                        Position.report_date == prev_date,
                        Position.asset_id.in_(asset_ids)
                    ).all()
                    
                    # Agrupar (puede haber multiples portfolios)
                    temp_prices = defaultdict(list)
                    for p in prev_positions:
                        temp_prices[p.asset_id].append(float(p.mark_price or 0))
                    
                    for aid, prices in temp_prices.items():
                        avg = sum(prices)/len(prices) if prices else 0
                        self._prev_price_cache[aid] = avg

    def _process_live_data(self, live_data: dict, asset_ids: List[int]) -> List[LivePriceUpdate]:
        """Cruza los datos vivos de IBKR con la caché estática para generar updates."""
        updates = []
        for aid in asset_ids:
            info = self._asset_info_cache.get(aid)
            if not info: continue
            
            symbol = info['symbol']
            isin = info['isin']
            
            # Buscar en respuesta de IBKR
            price_obj = None
            if symbol and symbol in live_data:
                price_obj = live_data[symbol]
            elif isin and isin in live_data:
                price_obj = live_data[isin]
            
            if price_obj:
                prev = self._prev_price_cache.get(aid, 0.0)
                change = 0.0
                if prev > 0:
                    change = ((price_obj.price - prev) / prev) * 100
                
                update = LivePriceUpdate(
                    asset_id=aid,
                    symbol=symbol or "",
                    isin=isin,
                    live_price=sanitize_value(price_obj.price),
                    previous_close=sanitize_value(prev) if prev > 0 else None,
                    day_change_pct=sanitize_value(change),
                    bid=sanitize_value(price_obj.bid),
                    ask=sanitize_value(price_obj.ask),
                    last=sanitize_value(price_obj.last),
                    timestamp=datetime.now().isoformat(),
                    currency=price_obj.currency
                )
                updates.append(update)
                self._last_prices[aid] = update
                
        return updates

    async def _broadcast_prices(self, prices: List[LivePriceUpdate]):
        if not prices: return
        # Enviar a todas las conexiones concurrentes
        # Usamos gather para que sea paralelos entre clientes
        tasks = []
        for conn in list(self._connections.values()):
            tasks.append(conn.send_prices(prices))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def get_cached_prices(self, asset_ids: List[int]) -> List[LivePriceUpdate]:
        return [self._last_prices[aid] for aid in asset_ids if aid in self._last_prices]

# Singleton
_manager: Optional[LivePricesSSEManager] = None
def get_sse_manager() -> LivePricesSSEManager:
    global _manager
    if _manager is None:
        _manager = LivePricesSSEManager()
    return _manager