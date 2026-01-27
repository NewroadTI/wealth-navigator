from pydantic import BaseModel
from typing import Optional, List, Dict, Any # Agrega Dict y Any para JSONBfrom datetime import date, datetime
from decimal import Decimal
from datetime import date, datetime
# --- TRADE SCHEMAS ---


# --- CATALOG SCHEMAS ---
class CurrencyRead(BaseModel):
    code: str
    name: Optional[str] = None
    class Config:
        from_attributes = True

class CurrencyCreate(BaseModel):
    code: str
    name: str

class CurrencyUpdate(BaseModel):
    name: str

class CountryRead(BaseModel):
    iso_code: str
    name: Optional[str] = None
    class Config:
        from_attributes = True

class CountryCreate(BaseModel):
    iso_code: str
    name: str

class CountryUpdate(BaseModel):
    name: str

# --- ASSET SCHEMAS ---
class AssetBase(BaseModel):
    symbol: str
    description: Optional[str] = None
    isin: Optional[str] = None
    figi: Optional[str] = None
    cusip: Optional[str] = None
    ib_conid: Optional[int] = None
    
    # Clasificación
    class_id: int
    sub_class_id: Optional[int] = None
    industry_code: Optional[str] = None
    country_code: Optional[str] = None
    currency: Optional[str] = None
    
    # Datos Técnicos
    multiplier: Optional[Decimal] = 1
    contract_size: Optional[Decimal] = 0
    
    # Derivados
    underlying_symbol: Optional[str] = None
    strike_price: Optional[Decimal] = None
    expiry_date: Optional[date] = None
    put_call: Optional[str] = None 
    
    # Bonos / Notas Estructuradas
    maturity_date: Optional[date] = None
    coupon_rate: Optional[Decimal] = None
    
    issuer: Optional[str] = None
    product_category: Optional[str] = None
    
    initial_fixing_date: Optional[date] = None
    next_autocall_date: Optional[date] = None
    next_coupon_payment_date: Optional[date] = None
    
    autocall_trigger: Optional[Decimal] = None
    coupon_trigger: Optional[Decimal] = None
    capital_barrier: Optional[Decimal] = None
    protection_level: Optional[Decimal] = None
    payment_frequency: Optional[str] = None
    
    # JSONB field para baskets
    structured_note_details: Optional[Dict[str, Any]] = None
    
    is_active: Optional[bool] = True

# --- CREATE ---
class AssetCreate(AssetBase):
    pass

# --- UPDATE ---
class AssetUpdate(BaseModel):
    # Hacemos todos opcionales para permitir actualizaciones parciales
    symbol: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    isin: Optional[str] = None
    figi: Optional[str] = None
    cusip: Optional[str] = None
    ib_conid: Optional[int] = None
    class_id: Optional[int] = None
    sub_class_id: Optional[int] = None
    industry_code: Optional[str] = None
    country_code: Optional[str] = None
    currency: Optional[str] = None
    multiplier: Optional[Decimal] = None
    contract_size: Optional[Decimal] = None
    underlying_symbol: Optional[str] = None
    strike_price: Optional[Decimal] = None
    expiry_date: Optional[date] = None
    put_call: Optional[str] = None
    maturity_date: Optional[date] = None
    coupon_rate: Optional[Decimal] = None
    issuer: Optional[str] = None
    product_category: Optional[str] = None
    initial_fixing_date: Optional[date] = None
    next_autocall_date: Optional[date] = None
    next_coupon_payment_date: Optional[date] = None
    autocall_trigger: Optional[Decimal] = None
    coupon_trigger: Optional[Decimal] = None
    capital_barrier: Optional[Decimal] = None
    protection_level: Optional[Decimal] = None
    payment_frequency: Optional[str] = None
    structured_note_details: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

# --- READ ---
class AssetRead(AssetBase):
    asset_id: int

    class Config:
        from_attributes = True


# --- TRADES ---
class TradeBase(BaseModel):
    ib_exec_id: Optional[str] = None
    ib_transaction_id: Optional[str] = None
    ib_order_id: Optional[str] = None
    trade_date: datetime
    settlement_date: Optional[date] = None
    report_date: Optional[date] = None
    
    transaction_type: Optional[str] = None
    side: Optional[str] = None
    exchange: Optional[str] = None
    
    quantity: Decimal
    price: Decimal
    gross_amount: Optional[Decimal] = None
    net_amount: Optional[Decimal] = None
    proceeds: Optional[Decimal] = None
    commission: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    
    cost_basis: Optional[Decimal] = None
    realized_pnl: Optional[Decimal] = None
    mtm_pnl: Optional[Decimal] = None
    
    currency: str
    description: Optional[str] = None
    notes: Optional[str] = None

class TradeRead(TradeBase):
    transaction_id: int  # CORREGIDO: Debe coincidir con el modelo DB (era trade_id)
    account_id: int
    asset_id: Optional[int] = None # CORREGIDO: Ahora acepta Null (None)
    
    

    class Config:
        from_attributes = True

# --- CASH JOURNAL ---
class CashJournalBase(BaseModel):
    date: date
    ex_date: Optional[date] = None
    type: str
    amount: Decimal
    currency: str
    
    quantity: Optional[Decimal] = None
    rate_per_share: Optional[Decimal] = None
    
    description: Optional[str] = None
    reference_code: Optional[str] = None
    extra_details: Optional[Dict[str, Any]] = None

class CashJournalRead(CashJournalBase):
    journal_id: int
    account_id: int
    asset_id: Optional[int] = None

    class Config:
        from_attributes = True

# --- FX TRANSACTIONS ---
class FXTransactionBase(BaseModel):
    trade_date: datetime
    source_currency: str
    source_amount: Decimal
    target_currency: str
    target_amount: Decimal
    side: Optional[str] = None
    exchange_rate: Optional[Decimal] = None
    external_id: Optional[str] = None

class FXTransactionRead(FXTransactionBase):
    fx_id: int
    account_id: int
    target_account_id: Optional[int] = None

    class Config:
        from_attributes = True

# --- CORPORATE ACTIONS ---
class CorporateActionBase(BaseModel):
    ib_action_id: Optional[str] = None
    transaction_id: Optional[str] = None
    action_type: Optional[str] = None
    report_date: Optional[date] = None
    execution_date: Optional[date] = None
    description: Optional[str] = None
    
    ratio_old: Optional[Decimal] = None
    ratio_new: Optional[Decimal] = None
    quantity_adjustment: Optional[Decimal] = None
    
    symbol: Optional[str] = None
    isin: Optional[str] = None
    amount: Optional[Decimal] = None
    proceeds: Optional[Decimal] = None
    value: Optional[Decimal] = None
    fifo_pnl_realized: Optional[Decimal] = None
    currency: Optional[str] = None

class CorporateActionRead(CorporateActionBase):
    action_id: int
    account_id: int
    asset_id: Optional[int] = None

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
    account_id: int
    asset_id: int
    asset: Optional[AssetRead] = None # Para ver nombre del activo
    class Config:
        from_attributes = True

class AccountBalanceRead(BaseModel):
    """Schema para el balance agregado por cuenta."""
    account_id: int
    balance: Decimal
    position_count: int
    
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

class StockExchangeCreate(BaseModel):
    exchange_code: str
    name: str
    country_code: Optional[str] = None

class StockExchangeUpdate(BaseModel):
    name: Optional[str] = None
    country_code: Optional[str] = None

class MarketIndexRead(BaseModel):
    index_code: str
    name: str
    country_code: Optional[str] = None
    exchange_code: Optional[str] = None
    class Config:
        from_attributes = True

class MarketIndexCreate(BaseModel):
    index_code: str
    name: str
    country_code: Optional[str] = None
    exchange_code: Optional[str] = None

class MarketIndexUpdate(BaseModel):
    name: Optional[str] = None
    country_code: Optional[str] = None
    exchange_code: Optional[str] = None

class IndustryRead(BaseModel):
    industry_code: str
    name: str
    sector: Optional[str] = None
    class Config:
        from_attributes = True

class IndustryBase(BaseModel):
    industry_code: str
    name: str
    sector: Optional[str] = None

class IndustryCreate(IndustryBase):
    pass

class IndustryUpdate(BaseModel):
    name: Optional[str] = None
    sector: Optional[str] = None


from typing import List, Optional # Asegúrate de tener estos imports arriba

# ... tus otros schemas ...

# --- ASSET HIERARCHY SCHEMAS ---

class AssetSubClassRead(BaseModel):
    sub_class_id: int
    code: Optional[str] = None
    name: str
    class Config:
        from_attributes = True

class AssetSubClassCreate(BaseModel):
    code: str
    name: str

class AssetSubClassUpsert(BaseModel):
    sub_class_id: Optional[int] = None
    code: str
    name: str

class AssetClassRead(BaseModel):
    class_id: int
    code: str
    name: str
    description: Optional[str] = None # Si agregaste descripción en la DB
    
    # AQUÍ ESTÁ LA MAGIA: Una lista de hijos dentro del padre
    sub_classes: List[AssetSubClassRead] = []
    
    class Config:
        from_attributes = True

class AssetClassCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    sub_classes: List[AssetSubClassCreate] = []

class AssetClassUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sub_classes: Optional[List[AssetSubClassUpsert]] = None

# --- INVESTMENT STRATEGY SCHEMAS ---
class InvestmentStrategyBase(BaseModel):
    name: str
    description: Optional[str] = None

class InvestmentStrategyCreate(InvestmentStrategyBase):
    pass

class InvestmentStrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class InvestmentStrategyRead(InvestmentStrategyBase):
    strategy_id: int
    class Config:
        from_attributes = True