from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- SCHEMA PARA TOP MOVERS (Tarjetas) ---
class TopMover(BaseModel):
    asset_id: int
    asset_symbol: str
    asset_name: Optional[str] = None
    current_price: float
    previous_price: float
    change_pct: float     # El porcentaje calculado
    direction: str        # "UP" o "DOWN"

class MoversResponse(BaseModel):
    gainers: List[TopMover]
    losers: List[TopMover]

# --- SCHEMA PARA INSTITUCIONES CON INFO DE USUARIO ---
class InstitutionInfo(BaseModel):
    institution: str
    account_id: int
    user_name: Optional[str] = None  # Ej: "roberto_sr" (4 letras nombre-3 letras apellido)
    user_first_name: Optional[str] = None  # Nombre completo
    user_last_name: Optional[str] = None   # Apellido completo
    # Datos específicos de esta cuenta para el asset
    quantity: Optional[float] = None
    avg_cost_price: Optional[float] = None
    cost_basis_money: Optional[float] = None
    market_price: Optional[float] = None  # Para futura implementación con API IBKR
    market_value: Optional[float] = None
    unrealized_pnl: Optional[float] = None
    day_change_pct: Optional[float] = None  # Calculado vs día anterior
    fx_rate_to_base: Optional[float] = 1.0  # Tasa de cambio a moneda base
    currency: Optional[str] = "USD"  # Moneda de la posición

# --- SCHEMA PARA TABLA AGREGADA ---
class PositionAggregated(BaseModel):
    asset_id: int
    asset_symbol: str
    asset_class: Optional[str] = None
    
    # Datos Agregados
    total_quantity: float
    avg_cost_price: float      # Cost Basis promedio ponderado
    total_cost_basis_money: float  # Suma total del cost basis
    current_mark_price: float
    total_market_value: float
    
    # PnL y Rendimiento
    total_pnl_unrealized: float
    day_change_pct: Optional[float] = None # Comparación con día anterior
    percent_of_nav: Optional[float] = None # Porcentaje del NAV total
    
    # Distribución de rendimiento (para ver si el agregado es representativo)
    gainers_count: int = 0          # Cuentas con PnL positivo
    losers_count: int = 0           # Cuentas con PnL negativo
    neutral_count: int = 0          # Cuentas con PnL = 0
    best_pnl_pct: Optional[float] = None   # Mejor rendimiento % individual
    worst_pnl_pct: Optional[float] = None  # Peor rendimiento % individual
    median_pnl_pct: Optional[float] = None # Mediana de rendimientos %
    
    # Desglose
    institutions: List[InstitutionInfo]    # Lista de instituciones con info de usuario
    account_ids: List[int]     # IDs de cuentas involucradas
    fx_rate_to_base: Optional[float] = 1.0  # Tasa de cambio promedio a moneda base
    currency: Optional[str] = "USD"  # Moneda predominante o de referencia

    class Config:
        from_attributes = True


# =============================================================================
# LIVE DATA SCHEMAS - Real-time prices from IB Gateway
# =============================================================================

class LivePriceRequest(BaseModel):
    """Request to fetch live prices for specific assets."""
    asset_ids: List[int]  # Asset IDs to fetch prices for


class LivePriceItem(BaseModel):
    """Live price data for a single asset."""
    asset_id: int
    symbol: Optional[str] = None
    isin: Optional[str] = None
    live_price: float
    previous_close: Optional[float] = None
    day_change_pct: Optional[float] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    last: Optional[float] = None
    timestamp: Optional[str] = None
    currency: str = "USD"


class LivePriceResponse(BaseModel):
    """Response containing live prices for requested assets."""
    prices: List[LivePriceItem]
    success: bool
    connected: bool
    message: Optional[str] = None