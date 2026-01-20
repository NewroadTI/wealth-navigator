from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

# --- CATALOG SCHEMAS ---
class CurrencyRead(BaseModel):
    code: str
    name: Optional[str] = None
    class Config:
        from_attributes = True

class CountryRead(BaseModel):
    iso_code: str
    name: Optional[str] = None
    class Config:
        from_attributes = True

# --- ASSET SCHEMAS ---
class AssetBase(BaseModel):
    symbol: str
    name: str
    description: Optional[str] = None
    isin: Optional[str] = None
    figi: Optional[str] = None
    cusip: Optional[str] = None
    ib_conid: Optional[int] = None
    
    # Clasificación
    sector: Optional[str] = None
    country_code: Optional[str] = None
    currency: Optional[str] = None
    
    # Datos Técnicos
    multiplier: Optional[Decimal] = 1
    contract_size: Optional[Decimal] = 0
    
    # Derivados (Opciones/Futuros)
    underlying_symbol: Optional[str] = None
    strike_price: Optional[Decimal] = None
    expiry_date: Optional[date] = None
    put_call: Optional[str] = None # 'PUT', 'CALL'
    
    # Bonos
    maturity_date: Optional[date] = None
    coupon_rate: Optional[Decimal] = None
    
    is_active: Optional[bool] = True

class AssetCreate(AssetBase):
    class_id: int
    sub_class_id: Optional[int] = None

class AssetRead(AssetBase):
    asset_id: int
    class_id: int
    class Config:
        from_attributes = True

# --- TRADE SCHEMAS ---
class TradeBase(BaseModel):
    ib_exec_id: str
    ib_order_id: Optional[str] = None
    trade_date: datetime
    settlement_date: Optional[date] = None
    
    transaction_type: str # BUY, SELL
    quantity: Decimal
    price: Decimal
    
    gross_amount: Optional[Decimal] = None
    commission: Optional[Decimal] = 0
    tax: Optional[Decimal] = 0
    net_amount: Optional[Decimal] = None
    currency: str
    
    description: Optional[str] = None
    exchange: Optional[str] = None

class TradeCreate(TradeBase):
    account_id: int
    asset_id: int

class TradeRead(TradeBase):
    trade_id: int
    asset: Optional[AssetRead] = None
    class Config:
        from_attributes = True

# --- CASH JOURNAL SCHEMAS ---
class CashJournalBase(BaseModel):
    date: date
    type: str # DIVIDEND, INTEREST, FEE
    amount: Decimal
    currency: str
    description: Optional[str] = None
    reference_code: Optional[str] = None

class CashJournalCreate(CashJournalBase):
    account_id: int
    asset_id: Optional[int] = None

class CashJournalRead(CashJournalBase):
    journal_id: int
    class Config:
        from_attributes = True

# --- FX TRANSACTION SCHEMAS (Nuevo) ---
class FXTransactionBase(BaseModel):
    trade_date: datetime
    source_currency: str
    source_amount: Decimal
    target_currency: str
    target_amount: Decimal
    exchange_rate: Optional[Decimal] = None
    description: Optional[str] = None
    external_id: Optional[str] = None

class FXTransactionCreate(FXTransactionBase):
    account_id: int

class FXTransactionRead(FXTransactionBase):
    fx_id: int
    class Config:
        from_attributes = True

# --- CORPORATE ACTION SCHEMAS (Nuevo) ---
class CorporateActionBase(BaseModel):
    ib_action_id: Optional[str] = None
    report_date: Optional[date] = None
    execution_date: Optional[date] = None
    action_type: str # SPLIT, MERGER
    description: Optional[str] = None
    ratio_old: Optional[Decimal] = None
    ratio_new: Optional[Decimal] = None
    quantity_adjustment: Optional[Decimal] = None
    cash_in_lieu: Optional[Decimal] = None

class CorporateActionCreate(CorporateActionBase):
    asset_id: int
    account_id: int

class CorporateActionRead(CorporateActionBase):
    action_id: int
    class Config:
        from_attributes = True

# --- POSITION SCHEMAS (Nuevo - Vital para Snapshots) ---
class PositionBase(BaseModel):
    report_date: date
    quantity: Decimal
    cost_basis_money: Optional[Decimal] = None
    cost_basis_price: Optional[Decimal] = None
    mark_price: Optional[Decimal] = None
    position_value: Optional[Decimal] = None
    fifo_pnl_unrealized: Optional[Decimal] = None
    percent_of_nav: Optional[Decimal] = None
    accrued_interest: Optional[Decimal] = None

class PositionCreate(PositionBase):
    account_id: int
    asset_id: int

class PositionRead(PositionBase):
    position_id: int
    asset: Optional[AssetRead] = None # Para ver nombre del activo
    class Config:
        from_attributes = True

# --- MARKET PRICE SCHEMAS (Nuevo) ---
class MarketPriceBase(BaseModel):
    date: date
    price_close: Decimal
    prior_mtm_pnl: Optional[Decimal] = None
    source: Optional[str] = "IBKR"

class MarketPriceCreate(MarketPriceBase):
    asset_id: int

class MarketPriceRead(MarketPriceBase):
    asset_id: int
    class Config:
        from_attributes = True

# --- PERFORMANCE ATTRIBUTION SCHEMAS (Nuevo) ---
class PerformanceAttributionRead(BaseModel):
    attribution_id: int
    start_date: date
    end_date: date
    return_pct: Optional[Decimal] = None
    contribution_pct: Optional[Decimal] = None
    realized_pnl: Optional[Decimal] = None
    unrealized_pnl: Optional[Decimal] = None
    
    class Config:
        from_attributes = True


# ... (Tus imports y schemas existentes: CurrencyRead, CountryRead, etc.)

# --- MARKET DATA SCHEMAS ---

class StockExchangeRead(BaseModel):
    exchange_code: str
    name: str
    country_code: Optional[str] = None
    class Config:
        from_attributes = True

class MarketIndexRead(BaseModel):
    index_code: str
    name: str
    country_code: Optional[str] = None
    exchange_code: Optional[str] = None
    class Config:
        from_attributes = True

class IndustryRead(BaseModel):
    industry_code: str
    name: str
    sector: Optional[str] = None
    class Config:
        from_attributes = True


from typing import List, Optional # Asegúrate de tener estos imports arriba

# ... tus otros schemas ...

# --- ASSET HIERARCHY SCHEMAS ---

class AssetSubClassRead(BaseModel):
    sub_class_id: int
    code: Optional[str] = None
    name: str
    class Config:
        from_attributes = True

class AssetClassRead(BaseModel):
    class_id: int
    code: str
    name: str
    description: Optional[str] = None # Si agregaste descripción en la DB
    
    # AQUÍ ESTÁ LA MAGIA: Una lista de hijos dentro del padre
    sub_classes: List[AssetSubClassRead] = []
    
    class Config:
        from_attributes = True