"""
IBKR Live Data Service
======================
Connects to IB Gateway to fetch real-time market prices.
Uses ib_insync library for communication with TWS/Gateway.
"""

import logging
import os
from typing import Dict, List, Optional, Set
from datetime import datetime
from dataclasses import dataclass
from threading import Lock
from concurrent.futures import ThreadPoolExecutor
import asyncio
import traceback

logger = logging.getLogger(__name__)

# Thread pool for running ib_insync operations
_executor = ThreadPoolExecutor(max_workers=1)


@dataclass
class LivePrice:
    """Live price data for an asset."""
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
    Service to fetch real-time market data from IB Gateway.
    
    The IB Gateway container runs on the same Docker network.
    Connection details:
    - Host: ib-gateway (container name) or host.docker.internal for host access
    - Port: 4001 (mapped from 4003 internal)
    """
    
    # Class-level connection to reuse across requests
    _instance = None
    _lock = Lock()
    
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
        self.ib = None
        self._connected = False
        self._contracts_cache: Dict[str, any] = {}  # symbol -> qualified contract
        self._isin_to_symbol: Dict[str, str] = {}   # isin -> symbol mapping
        
        # Connection settings - configurable via environment
        # For Docker: use host.docker.internal to reach host network
        # For local dev: use 127.0.0.1
        self.gateway_host = os.getenv("IBKR_GATEWAY_HOST", "host.docker.internal")
        self.gateway_port = int(os.getenv("IBKR_GATEWAY_PORT", "4001"))
        self.client_id = int(os.getenv("IBKR_CLIENT_ID", "10"))
        
        # Market data type: 1=Live (real-time), 2=Frozen, 3=Delayed, 4=Delayed Frozen
        # Default to 1 (real-time) if you have active subscriptions
        self.market_data_type = int(os.getenv("IBKR_MARKET_DATA_TYPE", "1"))
        
        logger.info(f"IBKRLiveDataService initialized - Host: {self.gateway_host}:{self.gateway_port}, Data Type: {self.market_data_type}")
    
    def connect(self) -> bool:
        """
        Connect to IB Gateway. Returns True if successful.
        Runs in a separate thread with its own event loop.
        """
        if self._connected and self.ib and self.ib.isConnected():
            return True
        
        def _connect_sync():
            """Synchronous connection logic to run in thread pool."""
            try:
                from ib_insync import IB, util
                import asyncio
                
                # Create a new event loop for this thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                if self.ib is None:
                    self.ib = IB()
                
                if not self.ib.isConnected():
                    logger.info(f"Connecting to IB Gateway at {self.gateway_host}:{self.gateway_port}...")
                    
                    # Use util.run to properly execute async operations
                    util.run(
                        self.ib.connectAsync(
                            host=self.gateway_host,
                            port=self.gateway_port,
                            clientId=self.client_id,
                            readonly=True,
                            timeout=10
                        )
                    )
                    
                    # Request market data type: 1=Live/Real-time (requires subscription)
                    # 3=Delayed (free, 15-20 min delay)
                    self.ib.reqMarketDataType(self.market_data_type)
                    
                    self._connected = True
                    data_type_name = "Real-time" if self.market_data_type == 1 else "Delayed" if self.market_data_type == 3 else f"Type {self.market_data_type}"
                    logger.info(f"Successfully connected to IB Gateway - Using {data_type_name} market data")
                    
                return True
                
            except Exception as e:
                logger.error(f"Failed to connect to IB Gateway: {e}")
                logger.error(f"Connection error traceback: {traceback.format_exc()}")
                self._connected = False
                return False
        
        # Run connection in thread pool to avoid event loop conflicts
        try:
            future = _executor.submit(_connect_sync)
            return future.result(timeout=15)
        except Exception as e:
            logger.error(f"Failed to connect to IB Gateway: {e}")
            logger.error(f"Connection outer error traceback: {traceback.format_exc()}")
            self._connected = False
            return False
    
    def disconnect(self):
        """Disconnect from IB Gateway."""
        if self.ib and self.ib.isConnected():
            try:
                self.ib.disconnect()
                self._connected = False
                logger.info("Disconnected from IB Gateway")
            except Exception as e:
                logger.error(f"Error disconnecting: {e}")
    
    def is_connected(self) -> bool:
        """Check if connected to IB Gateway."""
        return self._connected and self.ib and self.ib.isConnected()
    
    def _qualify_contracts(self, symbols: List[str]) -> List[any]:
        """
        Qualify stock contracts for the given symbols.
        Uses cache to avoid re-qualifying known contracts.
        Must be called from a thread with an event loop.
        """
        from ib_insync import Stock
        
        contracts_to_qualify = []
        qualified_contracts = []
        
        for symbol in symbols:
            if symbol in self._contracts_cache:
                qualified_contracts.append(self._contracts_cache[symbol])
            else:
                # Create stock contract - SMART routing, USD currency
                contract = Stock(symbol, 'SMART', 'USD')
                contracts_to_qualify.append((symbol, contract))
        
        if contracts_to_qualify:
            # Batch qualify new contracts
            new_contracts = [c[1] for c in contracts_to_qualify]
            try:
                # Call directly - we're already in the right thread with event loop
                logger.info(f"Qualifying {len(new_contracts)} new contracts...")
                qualified = self.ib.qualifyContracts(*new_contracts)
                logger.info(f"Qualification complete, got {len(qualified)} results")
                
                # Cache successful qualifications
                for i, (symbol, _) in enumerate(contracts_to_qualify):
                    if i < len(qualified) and qualified[i]:
                        self._contracts_cache[symbol] = qualified[i]
                        qualified_contracts.append(qualified[i])
                        logger.info(f"Qualified {symbol}: {qualified[i]}")
                        
            except Exception as e:
                logger.error(f"Error qualifying contracts: {e}")
                logger.error(f"Qualification error traceback: {traceback.format_exc()}")
        
        return qualified_contracts
    
    def get_live_prices(
        self, 
        symbols: Optional[List[str]] = None,
        isins: Optional[List[str]] = None,
        isin_symbol_map: Optional[Dict[str, str]] = None
    ) -> Dict[str, LivePrice]:
        """
        Get live prices for the given symbols or ISINs.
        Runs in thread pool to avoid event loop conflicts.
        
        Args:
            symbols: List of stock symbols (e.g., ['AAPL', 'MSFT'])
            isins: List of ISINs (e.g., ['US0378331005'])
            isin_symbol_map: Mapping from ISIN to symbol for lookup
            
        Returns:
            Dictionary mapping symbol/isin to LivePrice
        """
        if not self.connect():
            logger.warning("Cannot fetch live prices - not connected to IB Gateway")
            return {}
        
        # Build list of symbols to fetch
        fetch_symbols: Set[str] = set()
        isin_to_symbol: Dict[str, str] = isin_symbol_map or {}
        
        if symbols:
            fetch_symbols.update(symbols)
            
        if isins and isin_symbol_map:
            for isin in isins:
                if isin in isin_symbol_map:
                    symbol = isin_symbol_map[isin]
                    fetch_symbols.add(symbol)
                    isin_to_symbol[isin] = symbol
        
        if not fetch_symbols:
            return {}
        
        def _fetch_prices_sync():
            """Synchronous price fetching to run in thread pool."""
            try:
                import asyncio
                
                logger.info(f"Starting price fetch for {len(fetch_symbols)} symbols")
                
                # Ensure we have an event loop in this thread
                try:
                    loop = asyncio.get_event_loop()
                    logger.info("Using existing event loop")
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    logger.info("Created new event loop")
                
                # Qualify contracts
                symbol_list = list(fetch_symbols)
                logger.info(f"Qualifying contracts for symbols: {symbol_list}")
                contracts = self._qualify_contracts(symbol_list)
                
                if not contracts:
                    logger.warning("No contracts could be qualified")
                    return {}
                
                logger.info(f"Successfully qualified {len(contracts)} contracts")
                
                # Fetch tickers in batches of 100 (IB API limit)
                all_tickers = []
                batch_size = 100
                
                for i in range(0, len(contracts), batch_size):
                    batch = contracts[i:i + batch_size]
                    logger.info(f"Requesting tickers for batch {i//batch_size + 1} ({len(batch)} contracts)")
                    # Call directly - we're already in the right thread with event loop
                    tickers = self.ib.reqTickers(*batch)
                    all_tickers.extend(tickers)
                    logger.info(f"Received {len(tickers)} tickers")
                    
                    # Small sleep between batches to be nice to the API
                    if i + batch_size < len(contracts):
                        import time
                        time.sleep(0.1)
                
                # Build result dictionary
                result: Dict[str, LivePrice] = {}
                
                for ticker in all_tickers:
                    if ticker and ticker.contract:
                        symbol = ticker.contract.symbol
                        
                        # Get market price (uses best available: last, close, or mid)
                        price = ticker.marketPrice()
                        
                        if price is not None and price > 0:
                            live_price = LivePrice(
                                symbol=symbol,
                                isin=None,  # Will be filled from map
                                price=price,
                                bid=ticker.bid if hasattr(ticker, 'bid') else None,
                                ask=ticker.ask if hasattr(ticker, 'ask') else None,
                                last=ticker.last if hasattr(ticker, 'last') else None,
                                close=ticker.close if hasattr(ticker, 'close') else None,
                                timestamp=datetime.now(),
                                currency="USD"
                            )
                            
                            # Store by symbol
                            result[symbol] = live_price
                            
                            # Also store by ISIN if we have the mapping
                            for isin, sym in isin_to_symbol.items():
                                if sym == symbol:
                                    result[isin] = live_price
                                    live_price.isin = isin
                
                logger.info(f"Fetched {len(result)} live prices from IB Gateway")
                return result
                
            except Exception as e:
                logger.error(f"Error fetching live prices: {e}")
                logger.error(f"Fetch prices error traceback: {traceback.format_exc()}")
                return {}
        
        # Run in thread pool to avoid event loop conflicts
        try:
            future = _executor.submit(_fetch_prices_sync)
            result = future.result(timeout=30)
            logger.info(f"get_live_prices returning {len(result)} prices")
            return result
        except Exception as e:
            logger.error(f"Error fetching live prices: {e}")
            logger.error(f"Outer fetch error traceback: {traceback.format_exc()}")
            return {}
    
    def get_live_prices_batch(
        self,
        asset_identifiers: List[Dict[str, str]]
    ) -> Dict[str, LivePrice]:
        """
        Get live prices for a batch of assets identified by ISIN or symbol.
        
        Args:
            asset_identifiers: List of dicts with 'isin' and/or 'symbol' keys
            
        Returns:
            Dictionary mapping identifier (isin or symbol) to LivePrice
        """
        if not self.connect():
            return {}
        
        # Collect all symbols, preferring ISIN->symbol lookup
        symbols_to_fetch: Set[str] = set()
        isin_to_symbol: Dict[str, str] = {}
        
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


# Singleton instance
_service_instance: Optional[IBKRLiveDataService] = None


def get_ibkr_service() -> IBKRLiveDataService:
    """Get or create the IBKR live data service singleton."""
    global _service_instance
    if _service_instance is None:
        _service_instance = IBKRLiveDataService()
    return _service_instance
