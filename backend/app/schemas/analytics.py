from pydantic import BaseModel
from typing import List, Optional

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

# --- SCHEMA PARA TABLA AGREGADA ---
class PositionAggregated(BaseModel):
    asset_id: int
    asset_symbol: str
    asset_class: Optional[str] = None
    
    # Datos Agregados
    total_quantity: float
    avg_cost_price: float      # Cost Basis promedio ponderado
    current_mark_price: float
    total_market_value: float
    
    # PnL y Rendimiento
    total_pnl_unrealized: float
    day_change_pct: Optional[float] = None # Comparación con día anterior
    
    # Desglose
    institutions: List[InstitutionInfo]    # Lista de instituciones con info de usuario
    account_ids: List[int]     # IDs de cuentas involucradas

    class Config:
        from_attributes = True