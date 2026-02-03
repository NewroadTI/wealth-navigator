"""
Database Client - Direct database access for ETL jobs
=====================================================
Uses SQLAlchemy directly instead of HTTP calls to avoid deadlocks.
"""

import logging
from typing import Dict, Optional, List
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.portfolio import Account, Portfolio
from app.models.asset import Asset, CorporateAction
from app.jobs.config import DEFAULT_EQUITY_CLASS_ID

logger = logging.getLogger("ETL.db_client")


class DBClient:
    """
    Direct database client for ETL operations.
    Avoids HTTP calls that cause deadlocks when running inside the same server.
    """
    
    def __init__(self, db: Session = None):
        self._db = db
        self._owns_session = False
        
        # Cache for frequently looked up data
        self._account_cache: Dict[str, int] = {}  # account_code -> account_id
        self._account_base_cache: Dict[str, int] = {}  # base account_code (without currency suffix) -> account_id
        self._asset_cache: Dict[str, int] = {}    # symbol -> asset_id
        self._asset_isin_cache: Dict[str, int] = {}  # isin -> asset_id
        self._asset_description_cache: Dict[str, int] = {}  # description (lowercase) -> asset_id
    
    @property
    def db(self) -> Session:
        """Get or create a database session."""
        if self._db is None:
            self._db = SessionLocal()
            self._owns_session = True
        return self._db
    
    def close(self):
        """Close the session if we own it."""
        if self._owns_session and self._db:
            self._db.close()
            self._db = None
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
    
    # ==========================================================================
    # ACCOUNT OPERATIONS
    # ==========================================================================
    
    def get_account_id(self, account_code: str) -> Optional[int]:
        """Get account_id from account_code."""
        if not account_code:
            return None
            
        # Check exact match cache first
        if account_code in self._account_cache:
            return self._account_cache[account_code]
        
        # Check base code cache (for codes without currency suffix)
        if account_code in self._account_base_cache:
            return self._account_base_cache[account_code]
        
        # Query DB - exact match
        account = self.db.query(Account).filter(
            Account.account_code == account_code
        ).first()
        
        if account:
            self._account_cache[account_code] = account.account_id
            return account.account_id
        
        # Try base code (remove currency suffix if present)
        base_code = account_code.split('_')[0]
        if base_code != account_code and base_code in self._account_base_cache:
            return self._account_base_cache[base_code]
        
        return None
    
    def preload_accounts(self):
        """Preload all accounts into cache."""
        accounts = self.db.query(Account).all()
        for acc in accounts:
            # Cache full account code
            self._account_cache[acc.account_code] = acc.account_id
            
            # Also cache base code (without currency suffix)
            # If account code has format U12345678_USD, cache U12345678
            if '_' in acc.account_code:
                base_code = acc.account_code.split('_')[0]
                # Only cache if not already present (use first occurrence)
                if base_code not in self._account_base_cache:
                    self._account_base_cache[base_code] = acc.account_id
        
        logger.info(
            f"Preloaded {len(self._account_cache)} accounts into cache "
            f"({len(self._account_base_cache)} unique base codes)"
        )
    
    # ==========================================================================
    # ASSET OPERATIONS
    # ==========================================================================
    
    def get_asset_id(self, symbol: str) -> Optional[int]:
        """Get asset_id from symbol (exact match only)."""
        if not symbol:
            return None
            
        # Check cache first
        if symbol in self._asset_cache:
            return self._asset_cache[symbol]
        
        # Query DB - exact match only (no cleaning)
        # Options like "AAPL  260220C00265000" must be stored as-is
        asset = self.db.query(Asset).filter(Asset.symbol == symbol).first()
        
        if asset:
            self._asset_cache[symbol] = asset.asset_id
            return asset.asset_id
        
        return None
    
    def get_asset_id_flexible(
        self, 
        security_id: str = None, 
        symbol: str = None, 
        description: str = None
    ) -> Optional[int]:
        """
        Find asset_id using flexible search strategy:
        1. First try to match security_id (ISIN) against assets.isin
        2. If not found, try security_id against assets.symbol
        3. If not found, try security_id against assets.description
        4. If not found, try CSV symbol against assets.symbol (fallback)
        5. If still not found, return None
        
        Args:
            security_id: The SecurityID from IBKR CSV (usually ISIN)
            symbol: The Symbol from CSV (for fallback search)
            description: The Description from CSV (for logging)
        
        Returns:
            asset_id if found, None otherwise
        """
        # Try security_id based searches first
        if security_id:
            security_id_clean = security_id.strip()
            security_id_upper = security_id_clean.upper()
            security_id_lower = security_id_clean.lower()
            
            # 1. Try ISIN cache first
            if security_id_upper in self._asset_isin_cache:
                return self._asset_isin_cache[security_id_upper]
            
            # 2. Try symbol cache with security_id
            if security_id_clean in self._asset_cache:
                return self._asset_cache[security_id_clean]
            
            # 3. Try description cache (case-insensitive)
            if security_id_lower in self._asset_description_cache:
                return self._asset_description_cache[security_id_lower]
            
            # If not in cache, query DB directly
            # Try ISIN
            asset = self.db.query(Asset).filter(Asset.isin == security_id_upper).first()
            if asset:
                self._asset_isin_cache[security_id_upper] = asset.asset_id
                return asset.asset_id
            
            # Try symbol with security_id
            asset = self.db.query(Asset).filter(Asset.symbol == security_id_clean).first()
            if asset:
                self._asset_cache[security_id_clean] = asset.asset_id
                return asset.asset_id
            
            # Try description (case-insensitive)
            asset = self.db.query(Asset).filter(
                Asset.description.ilike(security_id_clean)
            ).first()
            if asset:
                self._asset_description_cache[security_id_lower] = asset.asset_id
                return asset.asset_id
        
        # 4. FALLBACK: Try CSV symbol against DB symbol
        if symbol:
            symbol_clean = symbol.strip()
            
            # Check symbol cache
            if symbol_clean in self._asset_cache:
                return self._asset_cache[symbol_clean]
            
            # Query DB by symbol
            asset = self.db.query(Asset).filter(Asset.symbol == symbol_clean).first()
            if asset:
                self._asset_cache[symbol_clean] = asset.asset_id
                return asset.asset_id
        
        return None
    
    def preload_assets(self):
        """Preload all assets into caches (symbol, isin, description)."""
        assets = self.db.query(Asset).all()
        for asset in assets:
            # Cache by symbol
            if asset.symbol:
                self._asset_cache[asset.symbol] = asset.asset_id
            
            # Cache by ISIN (uppercase)
            if asset.isin:
                self._asset_isin_cache[asset.isin.upper()] = asset.asset_id
            
            # Cache by description (lowercase for case-insensitive matching)
            if asset.description:
                self._asset_description_cache[asset.description.lower()] = asset.asset_id
        
        logger.info(
            f"Preloaded {len(self._asset_cache)} assets into cache "
            f"({len(self._asset_isin_cache)} ISINs, {len(self._asset_description_cache)} descriptions)"
        )
    
    def create_asset(
        self,
        symbol: str,
        description: str = None,
        isin: str = None,
        cusip: str = None,
        currency: str = "USD",
        class_id: int = None
    ) -> Optional[int]:
        """Create a new asset and return its ID."""
        try:
            asset = Asset(
                symbol=symbol,
                description=description or symbol,
                isin=isin,
                cusip=cusip,
                currency=currency,
                class_id=class_id or DEFAULT_EQUITY_CLASS_ID,
                is_active=True
            )
            self.db.add(asset)
            self.db.flush()  # Get the ID without committing
            
            self._asset_cache[symbol] = asset.asset_id
            logger.info(f"Created new asset: {symbol} (ID: {asset.asset_id})")
            return asset.asset_id
            
        except Exception as e:
            logger.error(f"Failed to create asset {symbol}: {e}")
            self.db.rollback()
            return None
    
    def get_or_create_asset(
        self,
        symbol: str,
        description: str = None,
        isin: str = None,
        cusip: str = None,
        currency: str = "USD",
        class_id: int = None
    ) -> Optional[int]:
        """Get asset_id or create the asset if it doesn't exist."""
        asset_id = self.get_asset_id(symbol)
        if asset_id:
            return asset_id
        
        return self.create_asset(
            symbol=symbol,
            description=description,
            isin=isin,
            cusip=cusip,
            currency=currency,
            class_id=class_id
        )
    
    # ==========================================================================
    # CORPORATE ACTIONS
    # ==========================================================================
    
    def _prepare_corporate_action_data(self, action_data: Dict) -> Dict:
        """
        Prepare corporate action data for database insertion.
        Converts string dates to date objects and string decimals to Decimal.
        """
        from datetime import date as date_type
        from decimal import Decimal
        
        prepared = {}
        
        # Date fields
        date_fields = ['report_date', 'execution_date']
        for field in date_fields:
            val = action_data.get(field)
            if val is not None:
                if isinstance(val, str):
                    try:
                        prepared[field] = date_type.fromisoformat(val)
                    except ValueError:
                        prepared[field] = None
                elif isinstance(val, date_type):
                    prepared[field] = val
                else:
                    prepared[field] = None
            else:
                prepared[field] = None
        
        # Decimal fields
        decimal_fields = [
            'ratio_old', 'ratio_new', 'quantity_adjustment',
            'amount', 'proceeds', 'value', 'fifo_pnl_realized', 'mtm_pnl'
        ]
        for field in decimal_fields:
            val = action_data.get(field)
            if val is not None:
                if isinstance(val, str):
                    try:
                        prepared[field] = Decimal(val)
                    except Exception:
                        prepared[field] = None
                elif isinstance(val, (int, float)):
                    prepared[field] = Decimal(str(val))
                elif isinstance(val, Decimal):
                    prepared[field] = val
                else:
                    prepared[field] = None
            else:
                prepared[field] = None
        
        # Copy other fields as-is
        other_fields = [
            'account_id', 'asset_id', 'ib_action_id', 'transaction_id',
            'action_type', 'description', 'symbol', 'isin', 'cusip',
            'security_id', 'security_id_type', 'currency'
        ]
        for field in other_fields:
            if field in action_data:
                prepared[field] = action_data[field]
        
        return prepared
    
    def create_corporate_action(self, action_data: Dict) -> Optional[int]:
        """Create a corporate action and return its ID."""
        try:
            prepared = self._prepare_corporate_action_data(action_data)
            action = CorporateAction(**prepared)
            self.db.add(action)
            self.db.flush()
            return action.action_id
        except Exception as e:
            logger.error(f"Failed to create corporate action: {e}")
            return None
    
    def create_corporate_actions_bulk(self, actions: List[Dict]) -> Dict:
        """
        Create multiple corporate actions.
        Returns summary of successes and failures.
        """
        created = 0
        errors = []
        
        for i, action_data in enumerate(actions):
            try:
                prepared = self._prepare_corporate_action_data(action_data)
                action = CorporateAction(**prepared)
                self.db.add(action)
                created += 1
            except Exception as e:
                errors.append({"index": i, "error": str(e)})
        
        try:
            self.db.commit()
        except Exception as e:
            self.db.rollback()
            return {
                "status": "error",
                "total": len(actions),
                "created": 0,
                "skipped": len(actions),
                "errors": [{"error": str(e)}]
            }
        
        return {
            "status": "success" if not errors else "partial",
            "total": len(actions),
            "created": created,
            "skipped": len(errors),
            "errors": errors
        }
    
    # ==========================================================================
    # UTILITY
    # ==========================================================================
    
    def clear_cache(self):
        """Clear all internal caches."""
        self._account_cache.clear()
        self._account_base_cache.clear()
        self._asset_cache.clear()
        self._asset_isin_cache.clear()
        self._asset_description_cache.clear()
    
    def commit(self):
        """Commit the current transaction."""
        self.db.commit()
    
    def rollback(self):
        """Rollback the current transaction."""
        self.db.rollback()


# Global client for use across ETL modules
_db_client: Optional[DBClient] = None


def get_db_client() -> DBClient:
    """Get or create a global DB client instance."""
    global _db_client
    if _db_client is None:
        _db_client = DBClient()
    return _db_client


def reset_db_client():
    """Reset the global DB client (useful between jobs)."""
    global _db_client
    if _db_client:
        _db_client.close()
        _db_client = None
