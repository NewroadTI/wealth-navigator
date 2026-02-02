"""
API Client - Wrapper for backend API calls
==========================================
Handles authentication and API requests to the WealthNavigator backend.
"""

import logging
import requests
from typing import Dict, Any, Optional, List
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.jobs.config import API_ENDPOINTS, BACKEND_API_BASE

logger = logging.getLogger("ETL.api_client")


class APIClient:
    """
    Client for interacting with the WealthNavigator backend API.
    """
    
    def __init__(self, base_url: str = None, timeout: int = 30):
        self.base_url = base_url or BACKEND_API_BASE
        self.timeout = timeout
        self.session = self._create_session()
        
        # Cache for frequently looked up data
        self._account_cache: Dict[str, int] = {}  # account_code -> account_id
        self._asset_cache: Dict[str, int] = {}    # symbol -> asset_id
    
    def _create_session(self) -> requests.Session:
        """Create a session with retry logic."""
        session = requests.Session()
        
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json"
        })
        
        return session
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None
    ) -> Optional[Dict]:
        """
        Make an API request with error handling.
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                timeout=self.timeout
            )
            
            if response.status_code == 200 or response.status_code == 201:
                return response.json()
            elif response.status_code == 404:
                return None
            elif response.status_code == 400:
                # Bad request - might be duplicate
                error_detail = response.json().get("detail", "Unknown error")
                logger.warning(f"Bad request to {endpoint}: {error_detail}")
                return {"error": error_detail, "status_code": 400}
            else:
                logger.error(f"API Error {response.status_code}: {response.text}")
                return {"error": response.text, "status_code": response.status_code}
                
        except requests.RequestException as e:
            logger.error(f"Request failed: {e}")
            return {"error": str(e), "status_code": 0}
    
    # ==========================================================================
    # ACCOUNT OPERATIONS
    # ==========================================================================
    
    def get_account_by_code(self, account_code: str) -> Optional[Dict]:
        """Get an account by its code (e.g., U16337121_USD)."""
        # Check cache first
        if account_code in self._account_cache:
            return {"account_id": self._account_cache[account_code]}
        
        # Query API
        result = self._make_request(
            "GET",
            "/api/v1/accounts/",
            params={"limit": 10000}  # Get all accounts
        )
        
        if result and isinstance(result, list):
            # Update cache and find our account
            for acc in result:
                self._account_cache[acc["account_code"]] = acc["account_id"]
            
            if account_code in self._account_cache:
                return {"account_id": self._account_cache[account_code]}
        
        return None
    
    def get_account_id(self, account_code: str) -> Optional[int]:
        """Get account_id from account_code."""
        account = self.get_account_by_code(account_code)
        return account.get("account_id") if account else None
    
    def create_account(self, account_data: Dict) -> Optional[Dict]:
        """Create a new account."""
        result = self._make_request("POST", "/api/v1/accounts/", data=account_data)
        if result and "account_id" in result:
            self._account_cache[result["account_code"]] = result["account_id"]
        return result
    
    def get_or_create_account(
        self,
        portfolio_id: int,
        client_account_id: str,
        currency: str,
        institution: str = "IBKR",
        account_alias: str = None
    ) -> Optional[int]:
        """
        Get account_id or create the account if it doesn't exist.
        Returns account_id or None if creation fails.
        """
        account_code = f"{client_account_id}_{currency}"
        
        # Check if exists
        account_id = self.get_account_id(account_code)
        if account_id:
            return account_id
        
        # Create new account
        logger.info(f"Creating new account: {account_code}")
        new_account = self.create_account({
            "portfolio_id": portfolio_id,
            "account_code": account_code,
            "account_alias": account_alias or client_account_id,
            "currency": currency,
            "institution": institution,
            "account_type": "Brokerage"
        })
        
        if new_account and "account_id" in new_account:
            return new_account["account_id"]
        
        return None
    
    # ==========================================================================
    # ASSET OPERATIONS
    # ==========================================================================
    
    def get_asset_by_symbol(self, symbol: str) -> Optional[Dict]:
        """Get an asset by symbol."""
        if symbol in self._asset_cache:
            return {"asset_id": self._asset_cache[symbol]}
        
        result = self._make_request(
            "GET",
            "/api/v1/assets/",
            params={"search": symbol, "limit": 10}
        )
        
        if result and isinstance(result, list):
            # Find exact match
            for asset in result:
                if asset["symbol"] == symbol:
                    self._asset_cache[symbol] = asset["asset_id"]
                    return asset
        
        return None
    
    def get_asset_id(self, symbol: str) -> Optional[int]:
        """Get asset_id from symbol."""
        asset = self.get_asset_by_symbol(symbol)
        return asset.get("asset_id") if asset else None
    
    def create_asset(self, asset_data: Dict) -> Optional[Dict]:
        """Create a new asset."""
        result = self._make_request("POST", "/api/v1/assets/", data=asset_data)
        if result and "asset_id" in result:
            self._asset_cache[result["symbol"]] = result["asset_id"]
        return result
    
    def get_or_create_asset(
        self,
        symbol: str,
        description: str = None,
        isin: str = None,
        cusip: str = None,
        currency: str = "USD",
        class_id: int = 1  # Default to Equities
    ) -> Optional[int]:
        """
        Get asset_id or create the asset if it doesn't exist.
        """
        asset_id = self.get_asset_id(symbol)
        if asset_id:
            return asset_id
        
        logger.info(f"Creating new asset: {symbol}")
        new_asset = self.create_asset({
            "symbol": symbol,
            "description": description or symbol,
            "isin": isin,
            "cusip": cusip,
            "currency": currency,
            "class_id": class_id,
            "is_active": True
        })
        
        if new_asset and "asset_id" in new_asset:
            return new_asset["asset_id"]
        
        return None
    
    # ==========================================================================
    # CORPORATE ACTIONS
    # ==========================================================================
    
    def create_corporate_action(self, action_data: Dict) -> Optional[Dict]:
        """Create a single corporate action."""
        return self._make_request(
            "POST",
            "/api/v1/transactions/corporate-actions/",
            data=action_data
        )
    
    def create_corporate_actions_bulk(self, actions: List[Dict]) -> Dict:
        """
        Create multiple corporate actions.
        Returns summary of successes and failures.
        """
        return self._make_request(
            "POST",
            "/api/v1/transactions/corporate-actions/bulk",
            data={"actions": actions}
        )
    
    # ==========================================================================
    # TRADES
    # ==========================================================================
    
    def create_trade(self, trade_data: Dict) -> Optional[Dict]:
        """Create a single trade."""
        return self._make_request(
            "POST",
            "/api/v1/transactions/trades/",
            data=trade_data
        )
    
    def create_trades_bulk(self, trades: List[Dict]) -> Dict:
        """Create multiple trades."""
        return self._make_request(
            "POST",
            "/api/v1/transactions/trades/bulk",
            data={"trades": trades}
        )
    
    # ==========================================================================
    # POSITIONS
    # ==========================================================================
    
    def create_position(self, position_data: Dict) -> Optional[Dict]:
        """Create or update a position."""
        return self._make_request(
            "POST",
            "/api/v1/positions/",
            data=position_data
        )
    
    def create_positions_bulk(self, positions: List[Dict]) -> Dict:
        """Create multiple positions."""
        return self._make_request(
            "POST",
            "/api/v1/positions/bulk",
            data={"positions": positions}
        )
    
    # ==========================================================================
    # PORTFOLIOS
    # ==========================================================================
    
    def get_portfolio_by_code(self, interface_code: str) -> Optional[Dict]:
        """Get a portfolio by interface code."""
        result = self._make_request(
            "GET",
            "/api/v1/portfolios/",
            params={"limit": 1000}
        )
        
        if result and isinstance(result, list):
            for port in result:
                if port.get("interface_code") == interface_code:
                    return port
        
        return None
    
    def get_or_create_portfolio(
        self,
        owner_user_id: int,
        interface_code: str,
        name: str,
        main_currency: str = "USD"
    ) -> Optional[int]:
        """Get or create a portfolio."""
        existing = self.get_portfolio_by_code(interface_code)
        if existing:
            return existing.get("portfolio_id")
        
        result = self._make_request(
            "POST",
            "/api/v1/portfolios/",
            data={
                "owner_user_id": owner_user_id,
                "interface_code": interface_code,
                "name": name,
                "main_currency": main_currency,
                "active_status": True
            }
        )
        
        return result.get("portfolio_id") if result else None
    
    # ==========================================================================
    # UTILITY METHODS
    # ==========================================================================
    
    def clear_cache(self):
        """Clear all internal caches."""
        self._account_cache.clear()
        self._asset_cache.clear()
    
    def preload_accounts(self):
        """Preload all accounts into cache."""
        result = self._make_request(
            "GET",
            "/api/v1/accounts/",
            params={"limit": 10000}
        )
        
        if result and isinstance(result, list):
            for acc in result:
                self._account_cache[acc["account_code"]] = acc["account_id"]
            logger.info(f"Preloaded {len(self._account_cache)} accounts into cache")
    
    def preload_assets(self):
        """Preload all assets into cache."""
        result = self._make_request(
            "GET",
            "/api/v1/assets/",
            params={"limit": 10000}
        )
        
        if result and isinstance(result, list):
            for asset in result:
                self._asset_cache[asset["symbol"]] = asset["asset_id"]
            logger.info(f"Preloaded {len(self._asset_cache)} assets into cache")


# Global client instance
_client: Optional[APIClient] = None


def get_api_client() -> APIClient:
    """Get or create the global API client instance."""
    global _client
    if _client is None:
        _client = APIClient()
    return _client
