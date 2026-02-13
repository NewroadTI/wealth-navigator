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
    
    inviu_code: Optional[str] = None
    
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
    inviu_code: Optional[str] = None
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
    external_transaction_id: Optional[str] = None
    action_id: Optional[str] = None
    transfer_account_id: Optional[int] = None


class CashJournalCreate(CashJournalBase):
    """Schema for creating a cash journal entry."""
    account_id: int
    asset_id: Optional[int] = None
    transfer_account_id: Optional[int] = None


class CashJournalRead(CashJournalBase):
    journal_id: int
    account_id: int
    asset_id: Optional[int] = None
    external_transaction_id: Optional[str] = None
    action_id: Optional[str] = None
    transfer_account_id: Optional[int] = None

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
    account_id: int
    asset_id: int
    report_date: date
    quantity: float
    mark_price: Optional[float] = None
    position_value: Optional[float] = None
    cost_basis_money: Optional[float] = None
    cost_basis_price: Optional[float] = None
    open_price: Optional[float] = None
    fifo_pnl_unrealized: Optional[float] = None
    percent_of_nav: Optional[float] = None
    side: Optional[str] = None
    level_of_detail: Optional[str] = None
    open_date_time: Optional[datetime] = None
    vesting_date: Optional[date] = None
    accrued_interest: Optional[float] = None
    fx_rate_to_base: Optional[float] = 1.0
    currency: Optional[str] = None

class PositionCreate(PositionBase):
    pass

class PositionRead(PositionBase):
    position_id: int
    #asset: Optional[AssetRead] = None # Para ver nombre del activo
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


# =============================================================================
# BULK CREATE SCHEMAS (For ETL API-based insertion)
# =============================================================================

class TradeCreate(TradeBase):
    """Schema for creating a single trade via API."""
    account_id: int
    asset_id: Optional[int] = None
    
    # IBKR identifiers
    ib_transaction_id: Optional[str] = None
    ib_exec_id: Optional[str] = None
    ib_trade_id: Optional[str] = None
    ib_order_id: Optional[str] = None
    
    # Options fields
    multiplier: Optional[Decimal] = None
    strike: Optional[Decimal] = None
    expiry: Optional[date] = None
    put_call: Optional[str] = None


class BulkTradesRequest(BaseModel):
    """Schema for bulk trades creation."""
    trades: List[TradeCreate]


class FXTransactionCreate(FXTransactionBase):
    """Schema for creating a single FX transaction via API."""
    account_id: int
    target_account_id: Optional[int] = None
    
    # Additional fields for IBKR
    commission: Optional[Decimal] = None
    commission_currency: Optional[str] = None
    ib_transaction_id: Optional[str] = None
    ib_exec_id: Optional[str] = None
    ib_order_id: Optional[str] = None
    exchange: Optional[str] = None
    transaction_type: Optional[str] = None
    notes: Optional[str] = None


class BulkFXTransactionsRequest(BaseModel):
    """Schema for bulk FX transactions creation."""
    transactions: List[FXTransactionCreate]


class BulkPositionsRequest(BaseModel):
    """Schema for bulk positions creation/update."""
    positions: List[PositionCreate]


class BulkResponse(BaseModel):
    """Standard response for bulk operations."""
    status: str  # "success", "partial", "error"
    total: int
    created: int
    updated: int = 0
    skipped: int
    errors: List[dict] = []


# =============================================================================
# STRUCTURED NOTES SCHEMAS
# =============================================================================

class StructuredNoteRead(BaseModel):
    """Schema for reading a structured note record."""
    note_id: int
    asset_id: int
    isin: str
    upload_date: date

    # Inception fields
    dealer: Optional[str] = None
    code: Optional[str] = None
    status: Optional[str] = None
    product_type: Optional[str] = None
    issuer: Optional[str] = None
    custodian: Optional[str] = None
    advisor: Optional[str] = None
    nominal: Optional[Decimal] = None
    size: Optional[float] = None

    underlyings: Optional[List[Dict[str, Any]]] = None

    # Dates
    maturity_date: Optional[date] = None
    issue_date: Optional[date] = None
    strike_date: Optional[date] = None
    last_autocall_obs: Optional[date] = None
    next_autocall_obs: Optional[date] = None
    next_coupon_obs: Optional[date] = None
    next_payment_date: Optional[date] = None

    # Coupon data
    coupon_annual_pct: Optional[Decimal] = None
    coupon_periodic_pct: Optional[Decimal] = None
    coupon_annual_amount: Optional[Decimal] = None
    coupon_periodic_amount: Optional[Decimal] = None
    coupon_type: Optional[str] = None

    # Barriers & Triggers
    cap_pct: Optional[Decimal] = None
    capital_protected_pct: Optional[Decimal] = None
    autocall_trigger: Optional[Decimal] = None
    step_down: Optional[Decimal] = None
    autocall_obs_count: Optional[Decimal] = None
    protection_barrier: Optional[Decimal] = None
    coupon_barrier: Optional[Decimal] = None

    # Observation frequency
    observation_frequency: Optional[str] = None

    # Additional fields
    termsheet: Optional[str] = None
    termsheet_url: Optional[str] = None
    coupons_paid_count: Optional[Decimal] = None
    coupons_paid_amount: Optional[Decimal] = None
    gross_yield_pct: Optional[Decimal] = None

    # AIS-only fields
    bid: Optional[Decimal] = None
    ask: Optional[Decimal] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StructuredNoteHolderRead(BaseModel):
    """Schema for showing who holds a structured note (from positions)."""
    full_name: str
    portfolio_name: str
    quantity: float
    mark_price: Optional[float] = None
    cost_basis_price: Optional[float] = None
    position_value: Optional[float] = None
    purchase_date: Optional[date] = None
    report_date: date


class StructuredNoteImportResponse(BaseModel):
    """Response from the structured notes import endpoint."""
    status: str  # "success", "partial", "error"
    total_rows: int
    created: int
    updated: int
    skipped: int
    missing_assets: List[Dict[str, Any]] = []  # [{isin, underlyings_label, done}]
    errors: List[str] = []
    job_id: Optional[int] = None
