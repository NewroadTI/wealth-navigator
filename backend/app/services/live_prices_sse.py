"""
Server-Sent Events (SSE) service for live prices.

Architecture:
1. Clients connect to SSE endpoint and subscribe with their asset IDs
2. A single background task fetches prices from IBKR every N seconds  
3. Prices are pushed to all connected clients
4. Clients automatically reconnect if connection is lost

This avoids the problems with multiple concurrent requests blocking the IB lock.
"""

import asyncio
import json
import logging
import math
from typing import Dict, Set, Optional, List, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from collections import defaultdict
import uuid

logger = logging.getLogger(__name__)


def sanitize_value(value: Any) -> Any:
    """Convert NaN and inf to None for JSON serialization."""
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
    return value


def sanitize_dict(data: dict) -> dict:
    """Recursively sanitize all values in a dict for JSON serialization."""
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
    """A single price update for an asset."""
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
    """SSE message format."""
    event: str
    data: dict
    
    def format(self) -> str:
        """Format as SSE string."""
        return f"event: {self.event}\ndata: {json.dumps(self.data)}\n\n"


class SSEConnection:
    """Represents a single SSE client connection."""
    
    def __init__(self, connection_id: str):
        self.connection_id = connection_id
        self.queue: asyncio.Queue = asyncio.Queue()
        self.subscribed_asset_ids: Set[int] = set()
        self.connected_at = datetime.now()
        self.last_heartbeat = datetime.now()
        
    async def send(self, message: SSEMessage):
        """Send a message to this client."""
        await self.queue.put(message)
        
    async def send_prices(self, prices: List[LivePriceUpdate]):
        """Send price updates to this client."""
        # Filter to only subscribed assets
        relevant_prices = [p for p in prices if p.asset_id in self.subscribed_asset_ids]
        if relevant_prices:
            # Convert to dict and sanitize NaN values
            prices_data = [sanitize_dict(asdict(p)) for p in relevant_prices]
            await self.send(SSEMessage(
                event="prices",
                data={
                    "prices": prices_data,
                    "timestamp": datetime.now().isoformat(),
                    "connected": True
                }
            ))


class LivePricesSSEManager:
    """
    Manages SSE connections and price broadcasting.
    
    Singleton pattern ensures a single manager across the application.
    """
    
    _instance: Optional['LivePricesSSEManager'] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self._initialized = True
        self._connections: Dict[str, SSEConnection] = {}
        self._background_task: Optional[asyncio.Task] = None
        self._running = False
        self._fetch_interval = 15  # seconds
        self._heartbeat_interval = 30  # seconds
        self._last_prices: Dict[int, LivePriceUpdate] = {}  # Cache of last prices
        self._all_subscribed_assets: Set[int] = set()  # Union of all client subscriptions
        
        logger.info("LivePricesSSEManager initialized")
    
    @property
    def connection_count(self) -> int:
        return len(self._connections)
    
    @property
    def subscribed_asset_count(self) -> int:
        return len(self._all_subscribed_assets)
    
    def create_connection(self) -> SSEConnection:
        """Create a new SSE connection."""
        connection_id = str(uuid.uuid4())
        connection = SSEConnection(connection_id)
        self._connections[connection_id] = connection
        
        logger.info(f"SSE connection created: {connection_id} (total: {self.connection_count})")
        
        # Start background task if not running
        if not self._running:
            self._start_background_task()
        
        return connection
    
    def remove_connection(self, connection_id: str):
        """Remove a connection."""
        if connection_id in self._connections:
            del self._connections[connection_id]
            self._update_subscribed_assets()
            logger.info(f"SSE connection removed: {connection_id} (total: {self.connection_count})")
            
            # Stop background task if no connections
            if self.connection_count == 0:
                self._stop_background_task()
    
    def update_subscription(self, connection_id: str, asset_ids: List[int]):
        """Update the asset subscription for a connection."""
        if connection_id in self._connections:
            self._connections[connection_id].subscribed_asset_ids = set(asset_ids)
            self._update_subscribed_assets()
            logger.debug(f"Connection {connection_id[:8]} subscribed to {len(asset_ids)} assets")
    
    def _update_subscribed_assets(self):
        """Update the union of all subscribed assets."""
        self._all_subscribed_assets = set()
        for conn in self._connections.values():
            self._all_subscribed_assets.update(conn.subscribed_asset_ids)
    
    def _start_background_task(self):
        """Start the background price fetching task."""
        if self._background_task is None or self._background_task.done():
            self._running = True
            self._background_task = asyncio.create_task(self._price_fetch_loop())
            logger.info("SSE background task started")
    
    def _stop_background_task(self):
        """Stop the background task."""
        self._running = False
        if self._background_task:
            self._background_task.cancel()
            self._background_task = None
            logger.info("SSE background task stopped")
    
    async def _price_fetch_loop(self):
        """Background loop that fetches prices and broadcasts to clients."""
        logger.info("Price fetch loop started")
        
        while self._running and self.connection_count > 0:
            try:
                # Fetch prices for all subscribed assets
                if self._all_subscribed_assets:
                    prices = await self._fetch_prices(list(self._all_subscribed_assets))
                    
                    if prices:
                        # Cache the prices
                        for price in prices:
                            self._last_prices[price.asset_id] = price
                        
                        # Broadcast to all connections
                        await self._broadcast_prices(prices)
                
                # Wait before next fetch
                await asyncio.sleep(self._fetch_interval)
                
            except asyncio.CancelledError:
                logger.info("Price fetch loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in price fetch loop: {e}")
                await asyncio.sleep(5)  # Wait before retry
        
        logger.info("Price fetch loop ended")
    
    async def _fetch_prices(self, asset_ids: List[int]) -> List[LivePriceUpdate]:
        """Fetch live prices from IBKR for the given asset IDs."""
        from app.db.session import SessionLocal
        from app.models.asset import Asset, Position
        from app.services.ibkr_live_data import get_ibkr_service
        from sqlalchemy import func
        from collections import defaultdict
        
        prices = []
        
        try:
            # Get asset info from DB
            with SessionLocal() as db:
                assets = db.query(
                    Asset.asset_id,
                    Asset.symbol,
                    Asset.isin,
                    Asset.description
                ).filter(Asset.asset_id.in_(asset_ids)).all()
                
                if not assets:
                    return []
                
                # Get previous prices for day change calculation
                prev_prices_map = {}
                try:
                    from app.api.v1.endpoints.analytics import get_previous_date
                    latest_date = db.query(func.max(Position.report_date)).scalar()
                    prev_date = get_previous_date(db, latest_date) if latest_date else None
                    
                    if prev_date:
                        prev_positions = db.query(
                            Position.asset_id,
                            Position.mark_price
                        ).filter(
                            Position.report_date == prev_date,
                            Position.asset_id.in_(asset_ids)
                        ).all()
                        
                        temp_prices = defaultdict(list)
                        for p in prev_positions:
                            temp_prices[p.asset_id].append(float(p.mark_price or 0))
                        
                        for aid, plist in temp_prices.items():
                            prev_prices_map[aid] = sum(plist) / len(plist) if plist else 0
                except Exception as e:
                    logger.error(f"Error getting previous prices: {e}")
            
            # Build asset identifiers for IBKR
            asset_by_id = {a.asset_id: a for a in assets}
            asset_identifiers = []
            
            for asset in assets:
                identifier = {"asset_id": asset.asset_id}
                if asset.symbol:
                    identifier["symbol"] = asset.symbol
                if asset.isin:
                    identifier["isin"] = asset.isin
                asset_identifiers.append(identifier)
            
            # Fetch from IBKR (runs in thread pool to not block)
            ibkr_service = get_ibkr_service()
            
            loop = asyncio.get_event_loop()
            live_prices = await loop.run_in_executor(
                None,
                ibkr_service.get_live_prices_batch,
                asset_identifiers
            )
            
            if not live_prices:
                logger.warning("No live prices returned from IBKR")
                return []
            
            # Map prices to assets
            for asset in assets:
                live_price = None
                
                if asset.symbol and asset.symbol.upper() in live_prices:
                    live_price = live_prices[asset.symbol.upper()]
                elif asset.symbol and asset.symbol in live_prices:
                    live_price = live_prices[asset.symbol]
                elif asset.isin and asset.isin.upper() in live_prices:
                    live_price = live_prices[asset.isin.upper()]
                elif asset.isin and asset.isin in live_prices:
                    live_price = live_prices[asset.isin]
                
                if live_price:
                    prev_price = prev_prices_map.get(asset.asset_id, 0)
                    day_change_pct = 0.0
                    
                    if prev_price > 0:
                        day_change_pct = ((live_price.price - prev_price) / prev_price) * 100
                    
                    # Sanitize all numeric values to avoid NaN in JSON
                    prices.append(LivePriceUpdate(
                        asset_id=asset.asset_id,
                        symbol=asset.symbol or "",
                        isin=asset.isin,
                        live_price=sanitize_value(live_price.price),
                        previous_close=sanitize_value(prev_price) if prev_price > 0 else None,
                        day_change_pct=sanitize_value(day_change_pct),
                        bid=sanitize_value(live_price.bid),
                        ask=sanitize_value(live_price.ask),
                        last=sanitize_value(live_price.last),
                        timestamp=live_price.timestamp.isoformat() if live_price.timestamp else datetime.now().isoformat(),
                        currency=live_price.currency
                    ))
            
            logger.info(f"Fetched {len(prices)} live prices for {len(asset_ids)} assets")
            return prices
            
        except Exception as e:
            logger.error(f"Error fetching prices: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    async def _broadcast_prices(self, prices: List[LivePriceUpdate]):
        """Broadcast prices to all connected clients."""
        if not prices:
            return
            
        # Send to each connection (only their subscribed assets)
        for connection in list(self._connections.values()):
            try:
                await connection.send_prices(prices)
            except Exception as e:
                logger.error(f"Error sending to connection {connection.connection_id[:8]}: {e}")
    
    async def send_heartbeat(self):
        """Send heartbeat to all connections."""
        message = SSEMessage(
            event="heartbeat",
            data={"timestamp": datetime.now().isoformat()}
        )
        
        for connection in list(self._connections.values()):
            try:
                await connection.send(message)
                connection.last_heartbeat = datetime.now()
            except Exception as e:
                logger.error(f"Error sending heartbeat: {e}")
    
    def get_cached_prices(self, asset_ids: List[int]) -> List[LivePriceUpdate]:
        """Get cached prices for immediate response."""
        return [
            self._last_prices[aid] 
            for aid in asset_ids 
            if aid in self._last_prices
        ]


# Singleton instance
_manager: Optional[LivePricesSSEManager] = None


def get_sse_manager() -> LivePricesSSEManager:
    """Get the SSE manager singleton."""
    global _manager
    if _manager is None:
        _manager = LivePricesSSEManager()
    return _manager
