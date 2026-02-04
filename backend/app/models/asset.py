from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Numeric, CHAR, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy import event, DDL
from sqlalchemy.dialects.postgresql import JSONB  # <--- IMPORTANTE: Agrega esto

from app.db.base import Base


class StockExchange(Base):
    __tablename__ = "stock_exchanges"
    # Ej: NYSE, New York Stock Exchange, US
    exchange_code = Column(String, primary_key=True, index=True) # NYSE
    name = Column(String, nullable=False)
    country_code = Column(CHAR(2), ForeignKey("countries.iso_code")) # US
    
    country = relationship("Country", back_populates="exchanges")
    indices = relationship("MarketIndex", back_populates="exchange")


class Industry(Base):
    __tablename__ = "industries"
    # Ej: TECH, Technology, Information Technology
    industry_code = Column(String, primary_key=True) # TECH
    name = Column(String, nullable=False)
    sector = Column(String) # Information Technology

    assets = relationship("Asset", back_populates="industry")


# --- MAESTROS ---
class AssetClass(Base):
    __tablename__ = "asset_classes"
    class_id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)

    sub_classes = relationship("AssetSubClass", back_populates="asset_class")

class AssetSubClass(Base):
    __tablename__ = "asset_sub_classes"
    sub_class_id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("asset_classes.class_id"), nullable=False)
    code = Column(String)
    name = Column(String, nullable=False)

    asset_class = relationship("AssetClass", back_populates="sub_classes")



class Asset(Base):
    __tablename__ = "assets"
    asset_id = Column(Integer, primary_key=True, index=True)
    
    class_id = Column(Integer, ForeignKey("asset_classes.class_id"), nullable=False)
    sub_class_id = Column(Integer, ForeignKey("asset_sub_classes.sub_class_id"))
    
    symbol = Column(String, nullable=False) # ISIN suele usarse aquí o en isin
    description = Column(String)
    isin = Column(String)
    figi = Column(String)
    cusip = Column(String)
    ib_conid = Column(Integer, unique=True)
    
    # --- CLASIFICACIÓN ---
    industry_code = Column(String, ForeignKey("industries.industry_code"), nullable=True)
    country_code = Column(CHAR(2), ForeignKey("countries.iso_code"), nullable=True)
    currency = Column(CHAR(3))
    
    # --- DATOS GENERALES DE CONTRATO ---
    multiplier = Column(Numeric, default=1)
    contract_size = Column(Numeric, default=0) # Aquí podrías poner el "Size" (ej. 370000) o en Positions
    
    # --- DATOS DE OPCIONES / FUTUROS (Ya los tenías) ---
    underlying_symbol = Column(String) # Para opciones simples (1 a 1)
    strike_price = Column(Numeric)     # Para opciones simples
    expiry_date = Column(Date)
    put_call = Column(String(4))
    
    # --- DATOS DE RENTA FIJA / NOTAS ESTRUCTURADAS ---
    maturity_date = Column(Date)       # Final Fixing Date / Redemption Date
    coupon_rate = Column(Numeric)      # Coupon p.a. (ej. 17.15)
    
    # +++++ NUEVAS COLUMNAS PARA NOTAS ESTRUCTURADAS +++++
    
    issuer = Column(String, nullable=True)           # Ej: BNP Paribas
    product_category = Column(String, nullable=True) # Ej: Phoenix Autocall
    
    # Fechas Críticas
    initial_fixing_date = Column(Date, nullable=True)
    next_autocall_date = Column(Date, nullable=True)
    next_coupon_payment_date = Column(Date, nullable=True)
    
    # Barreras y Triggers (Guardar como decimal: 55% = 0.55 o 55.0 segun tu estandar)
    autocall_trigger = Column(Numeric, nullable=True) # Ej: 100.00
    coupon_trigger = Column(Numeric, nullable=True)   # Ej: 55.00
    capital_barrier = Column(Numeric, nullable=True)  # Ej: 50.00
    protection_level = Column(Numeric, nullable=True) # Ej: 100.00 (Capital Protection)
    
    payment_frequency = Column(String, nullable=True) # Ej: Quarterly
    
    # Detalles de Subyacentes (JSONB)
    # Aquí guardarás la lista: [{'ticker': '9888 HK', 'initial_level': 143.8}, ...]
    structured_note_details = Column(JSONB, nullable=True) 
    
    is_active = Column(Boolean, default=True)
    
    # Relaciones
    country = relationship("Country", back_populates="assets")
    industry = relationship("Industry", back_populates="assets")
    corporate_actions = relationship("CorporateAction", back_populates="asset")
# --- TRANSACCIONES ---
# --- TRANSACCIONES ---
class Trades(Base):
    __tablename__ = "trades"
    
    # ID interno de tu sistema (Autoincremental)
    transaction_id = Column(Integer, primary_key=True, index=True)
    
    account_id = Column(Integer, ForeignKey("accounts.account_id"))
    asset_id = Column(Integer, ForeignKey("assets.asset_id"))
    
    # --- IDENTIFICADORES IBKR (Clave para conciliación) ---
    # "TransactionID": ID numérico único del movimiento (ej: 37183892878). 
    # Es el MEJOR campo para evitar duplicados.
    ib_transaction_id = Column(String, unique=True, nullable=True)
    
    # "IBExecID": String complejo (ej: 0001506d.695e...). 
    # A veces es null en cancelaciones o movimientos internos.
    ib_exec_id = Column(String, index=True, nullable=True) 
    
    # "TradeID": Agrupa varias ejecuciones parciales de una misma orden
    ib_trade_id = Column(String, nullable=True)
    
    # "IBOrderID" / "BrokerageOrderID"
    ib_order_id = Column(String, nullable=True)

    # --- FECHAS ---
    # "ReportDate" del CSV: Fecha sin hora
    trade_date = Column(Date, nullable=False)
    
    # "SettleDateTarget": Cuando realmente se mueve el efectivo
    settlement_date = Column(Date, nullable=True)
    
    # "ReportDate": Fecha de corte del reporte
    report_date = Column(Date, nullable=True)

    # --- CLASIFICACIÓN ---
    # "TransactionType": ExchTrade, TradeCancel, FracShare, etc.
    transaction_type = Column(String, nullable=True)
    
    # "Buy/Sell": BUY, SELL, SELL (Ca.)
    side = Column(String, nullable=True)
    
    # "Exchange": NYSE, DARK, IDEALFX (Para Forex)
    exchange = Column(String, nullable=True)

    # --- ECONOMÍA ---
    quantity = Column(Numeric, nullable=False)
    price = Column(Numeric, nullable=False)       # "TradePrice"
    
    # Importes Monetarios
    gross_amount = Column(Numeric, nullable=True) # "TradeMoney" (Cantidad * Precio)
    net_amount = Column(Numeric, nullable=True)   # "NetCash" (Gross - Comisiones - Impuestos)
    proceeds = Column(Numeric, nullable=True)     # "Proceeds" (Suele ser igual a TradeMoney en acciones)

    # --- COSTOS Y PNL (Nuevos campos del reporte detallado) ---
    commission = Column(Numeric, nullable=True)   # "IBCommission"
    tax = Column(Numeric, nullable=True)          # "Taxes"
    
    # Datos Fiscales y de Rendimiento
    cost_basis = Column(Numeric, nullable=True)   # "CostBasis" (Base de costo actualizada)
    realized_pnl = Column(Numeric, nullable=True) # "FifoPnlRealized" (Ganancia/Pérdida realizada en esta venta)
    mtm_pnl = Column(Numeric, nullable=True)      # "MtmPnl" (Marcado a mercado del día)

    # --- OPCIONES / DERIVADOS ---
    multiplier = Column(Numeric, nullable=True)   # "Multiplier" (100 para opciones)
    strike = Column(Numeric, nullable=True)       # "Strike" (Precio de ejercicio)
    expiry = Column(Date, nullable=True)          # "Expiry" (Fecha de vencimiento)
    put_call = Column(String, nullable=True)      # "Put/Call" (C o P)

    # --- EXTRAS ---
    currency = Column(CHAR(3))                    # "CurrencyPrimary" o "IBCommissionCurrency"
    description = Column(Text)                    # "Description"
    notes = Column(Text, nullable=True)           # "Notes/Codes" (Ej: O, C, P para Open/Close)
    
    # Relaciones
    account = relationship("Account", back_populates="trades")
    asset = relationship("Asset")

class CashJournal(Base):
    __tablename__ = "cash_journal"
    journal_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.account_id"))
    asset_id = Column(Integer, ForeignKey("assets.asset_id"), nullable=True)
    
    date = Column(Date, nullable=False)
    ex_date = Column(Date, nullable=True)      # Ex-Date (Fecha de corte del derecho)
    type = Column(String, nullable=False) 
    amount = Column(Numeric, nullable=False)
    currency = Column(CHAR(3), ForeignKey("currencies.code")) 
    
    quantity = Column(Numeric, nullable=True)
    rate_per_share = Column(Numeric, nullable=True)

    description = Column(Text)
    reference_code = Column(String, unique=True, nullable=True) # TransactionID único
    extra_details = Column(JSONB, nullable=True)
    account = relationship("Account", back_populates="cash_journal")
    asset = relationship("Asset")
    external_transaction_id = Column(String, unique=True, index=True, nullable=True) 
    action_id = Column(String, nullable=True)

class FXTransaction(Base):
    __tablename__ = "fx_transactions"
    fx_id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(Date)  # Fecha sin hora del ReportDate
    
    # Cuenta de donde SALE el dinero (Source)
    account_id = Column(Integer, ForeignKey("accounts.account_id"), nullable=False)
    
    # Cuenta a donde ENTRA el dinero (Target)
    target_account_id = Column(Integer, ForeignKey("accounts.account_id"), nullable=True)
    
    source_currency = Column(CHAR(3))
    source_amount = Column(Numeric)
    target_currency = Column(CHAR(3))
    target_amount = Column(Numeric)
    side = Column(String, nullable=True)  # BUY / SELL
    
    exchange_rate = Column(Numeric)
    commission = Column(Numeric, nullable=True)  # "IBCommission"
    commission_currency = Column(CHAR(3), nullable=True)  # "IBCommissionCurrency"
    
    # Identificadores IBKR
    ib_transaction_id = Column(String, index=True, nullable=True)  # "TransactionID"
    ib_exec_id = Column(String, nullable=True)  # "IBExecID"
    ib_order_id = Column(String, nullable=True)  # "IBOrderID"
    
    # Extras
    exchange = Column(String, nullable=True)  # "Exchange" (IDEALFX, etc.)
    transaction_type = Column(String, nullable=True)  # "TransactionType" (ExchTrade, TradeCancel)
    notes = Column(String, nullable=True)  # "Notes/Codes"
    
    external_id = Column(String, unique=True, nullable=True)

class PerformanceAttribution(Base):
    __tablename__ = "performance_attribution"
    attribution_id = Column(BigInteger, primary_key=True, index=True)
    
    account_id = Column(Integer, ForeignKey("accounts.account_id"), nullable=False)
    
    # asset_id es NULLABLE para soportar filas de totales como "Total Bonds", "Total Crypto"
    asset_id = Column(Integer, ForeignKey("assets.asset_id"), nullable=True)
    
    # --- Datos del CSV ---
    # Si asset_id es Null, usamos esto para saber qué es (Ej: 'Total Bonds')
    category_label = Column(String, nullable=True) 
    
    avg_weight = Column(Numeric,nullable=True)      # CSV: AvgWeight (Importante para atribución)
    return_pct = Column(Numeric,nullable=True)      # CSV: Return
    contribution_pct = Column(Numeric,nullable=True)# CSV: Contribution

    realized_pnl = Column(Numeric,nullable=True)    # CSV: Realized_P&L
    unrealized_pnl = Column(Numeric,nullable=True)  # CSV: Unrealized_P&L
    
    # Metadata extra
    is_open_position = Column(Boolean, default=False, nullable=True) # CSV: Open (Yes/No)
    sector_snapshot = Column(String, ForeignKey("industries.industry_code"), nullable=True)
  # CSV: Sector (Guardar snapshot pq el sector del activo puede cambiar)

    account = relationship("Account", back_populates="performance_attribution")
    asset = relationship("Asset")


# ... (Tu código existente de Asset, Trade, CashJournal, FXTransaction) ...

# --- FALTABA ESTO ---



class CorporateAction(Base):
    __tablename__ = "corporate_actions"
    
    # Identificadores principales
    action_id = Column(Integer, primary_key=True, index=True)
    ib_action_id = Column(String, unique=True, nullable=True)  # ActionID del tipo 2, puede ser NULL
    transaction_id = Column(String, nullable=True)  # TransactionID del tipo 2, puede ser NULL
    
    # Relaciones obligatorias
    account_id = Column(Integer, ForeignKey("accounts.account_id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.asset_id"), nullable=True)  # Puede ser NULL si no hay activo
    
    # Campos del tipo 1
    action_type = Column(String, nullable=True)  # Tipo normalizado: SPLIT, SPINOFF, MATURITY, RIGHTS, ACQUISITION, DELISTING
    
    # Fechas (pueden venir en diferentes formatos)
    report_date = Column(Date, nullable=True)  # Fecha del reporte (tipo 2)
    execution_date = Column(Date, nullable=True)  # Fecha de ejecución
    
    # Descripciones
    description = Column(Text, nullable=True)  # Descripción completa
    
    # Campos de ratios (extraíbles de la descripción)
    ratio_old = Column(Numeric(10, 6), nullable=True)
    ratio_new = Column(Numeric(10, 6), nullable=True)
    
    # Ajustes
    quantity_adjustment = Column(Numeric(20, 6), nullable=True)  # Cantidad ajustada
    
    # Campos del tipo 2
    symbol = Column(String, nullable=True)  # Símbolo del activo
    isin = Column(String, nullable=True)  # ISIN del activo
    cusip = Column(String, nullable=True)  # CUSIP del activo
    security_id = Column(String, nullable=True)  # SecurityID
    security_id_type = Column(String, nullable=True)  # Tipo de SecurityID
    
    # Campos financieros del tipo 2
    amount = Column(Numeric(20, 6), nullable=True)
    proceeds = Column(Numeric(20, 6), nullable=True)
    value = Column(Numeric(20, 6), nullable=True)
    fifo_pnl_realized = Column(Numeric(20, 6), nullable=True)
    mtm_pnl = Column(Numeric(20, 6), nullable=True)
    
    # Campos adicionales de metadatos
    currency = Column(String, nullable=True)  # Moneda
    
    
    # Relaciones
    account = relationship("Account", back_populates="corporate_actions")
    asset = relationship("Asset", back_populates="corporate_actions")

from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from app.db.base import Base

class Position(Base):
    __tablename__ = "positions"
    position_id = Column(Integer, primary_key=True, index=True)
    
    # Obligatorios: Sin esto no existe una posición
    account_id = Column(Integer, ForeignKey("accounts.account_id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.asset_id"), nullable=False)
    report_date = Column(Date, nullable=False) # 'As Of' (T1) o 'ReportDate' (T2)
    quantity = Column(Numeric, nullable=False) # 'Quantity' (T1 & T2)
    
    # --- VALORACIÓN DE MERCADO ---
    # Nullable=True porque a veces el reporte de resumen falla en traer precios exactos de bonos raros
    mark_price = Column(Numeric, nullable=True)     # 'ClosePrice' (T1) / 'MarkPrice' (T2)
    position_value = Column(Numeric, nullable=True) # 'Value' (T1) / 'PositionValue' (T2)
    
    # --- COSTOS Y BASE ---
    cost_basis_money = Column(Numeric, nullable=True) # 'Cost Basis' (T1) / 'CostBasisMoney' (T2)
    cost_basis_price = Column(Numeric, nullable=True) # 'CostBasisPrice' (T2). En T1 se puede calcular (Money/Qty)
    open_price = Column(Numeric, nullable=True)       # 'OpenPrice' (Solo T2) - Precio original de apertura
    
    # --- P&L (Ganancias y Pérdidas) ---
    fifo_pnl_unrealized = Column(Numeric, nullable=True) # 'UnrealizedP&L' (T1) / 'FifoPnlUnrealized' (T2)
    percent_of_nav = Column(Numeric, nullable=True)      # 'PercentOfNAV' (Solo T2)
    
    # --- DETALLES DE POSICIÓN ---
    side = Column(String, nullable=True) # 'Long'/'Short' (Solo T2)
    level_of_detail = Column(String, nullable=True) # 'SUMMARY'/'LOT' (Solo T2)
    
    # --- FECHAS DE TENENCIA (Solo T2) ---
    open_date_time = Column(DateTime, nullable=True) # 'OpenDateTime' (T2) - Cuándo se abrió
    vesting_date = Column(Date, nullable=True)       # 'VestingDate' (T2)
    
    # --- EXTRAS Y RENTA FIJA ---
    accrued_interest = Column(Numeric, nullable=True)   # 'AccruedInterest' (T2)
    fx_rate_to_base = Column(Numeric, default=1, nullable=True) # 'FXRateToBase' (T1 & T2)
    currency = Column(CHAR(3), nullable=True) # 'Currency' (T1 & T2)


    # Relaciones
    account = relationship("Account", back_populates="positions")
    asset = relationship("Asset")

class MarketPrice(Base):
    __tablename__ = "market_prices"
    # Usamos BigInteger para IDs autoincrementales masivos
    
    asset_id = Column(Integer, ForeignKey("assets.asset_id"), primary_key=True)
    time = Column(Date, nullable=False, primary_key=True) 
    
    price_close = Column(Numeric)
    prior_mtm_pnl = Column(Numeric)
    source = Column(String, default='IBKR')
class MarketIndex(Base):
    __tablename__ = "market_indices"
    # Ej: SPX, S&P 500, NYSE, US
    index_code = Column(String, primary_key=True) # SPX
    name = Column(String, nullable=False)
    exchange_code = Column(String, ForeignKey("stock_exchanges.exchange_code"))
    country_code = Column(CHAR(2), ForeignKey("countries.iso_code"))
    
    exchange = relationship("StockExchange", back_populates="indices")
    country = relationship("Country")
# Catálogos del Sistema (Los ponemos aquí o en un archivo system.py)
class Currency(Base):
    __tablename__ = "currencies"
    code = Column(CHAR(3), primary_key=True)
    name = Column(String)

class Country(Base):
    __tablename__ = "countries"
    iso_code = Column(CHAR(2), primary_key=True) # US, PE, ES
    name = Column(String)
    
    # Relaciones inversas
    assets = relationship("Asset", back_populates="country")
    exchanges = relationship("StockExchange", back_populates="country")
    
class IncomeProjection(Base):
    __tablename__ = "income_projections"
    
    projection_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.account_id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.asset_id"), nullable=True) # Null para Cash
    
    # Fecha en la que se generó esta proyección
    report_date = Column(Date, nullable=False, index=True)
    
    # Datos del activo en ese momento
    symbol = Column(String) # Opcional: Denormalizado para rapidez
    description = Column(String) # Ej: "Ordinary Dividend" o "Credit Interest"
    
    # Valores Proyectados
    quantity = Column(Numeric)
    price = Column(Numeric)
    market_value = Column(Numeric)      # Columna 'Value'
    yield_pct = Column(Numeric)         # Columna 'Current Yield %'
    
    # Resultados del Ingreso
    estimated_annual_income = Column(Numeric)
    estimated_remaining_income = Column(Numeric) # El resto del 2026
    
    frequency = Column(Integer) # Ej: 12, 4, 1
    currency = Column(CHAR(3))
    
    account = relationship("Account")
    asset = relationship("Asset")

class InvestmentStrategy(Base):
    """Estrategias de inversión para clasificar portfolios."""
    __tablename__ = "investment_strategies"
    strategy_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)


# ==========================================================================
# ETL JOB TRACKING
# ==========================================================================

class ETLJobLog(Base):
    """
    Registro de ejecuciones de jobs ETL para monitoreo y debugging.
    """
    __tablename__ = "etl_job_logs"
    
    job_id = Column(Integer, primary_key=True, index=True)
    
    # Identificación del job
    job_type = Column(String, nullable=False, index=True)  # CORPORATES, TRADES, POSITIONS, etc.
    job_name = Column(String, nullable=True)  # Nombre descriptivo
    
    # Estado del job
    status = Column(String, nullable=False, default="pending")  # pending, running, success, failed, partial
    
    # Timestamps
    started_at = Column(DateTime, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Métricas
    records_processed = Column(Integer, default=0)
    records_created = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_skipped = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    
    # Detalles del archivo procesado
    file_name = Column(String, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    
    # Logs y errores (JSONB para flexibilidad)
    error_message = Column(Text, nullable=True)
    error_details = Column(JSONB, nullable=True)  # Lista de errores detallados
    
    # Metadata adicional
    execution_time_seconds = Column(Numeric, nullable=True)
    created_assets = Column(JSONB, nullable=True)  # Assets creados automáticamente
    extra_data = Column(JSONB, nullable=True)  # Datos adicionales flexibles


class ETLSyncStatus(Base):
    """
    Estado actual de sincronización por tipo de reporte.
    Una fila por tipo de reporte, se actualiza con cada ejecución.
    """
    __tablename__ = "etl_sync_status"
    
    status_id = Column(Integer, primary_key=True, index=True)
    report_type = Column(String, unique=True, nullable=False, index=True)  # CORPORATES, TRADES, etc.
    
    # Última ejecución exitosa
    last_success_at = Column(DateTime, nullable=True)
    last_success_records = Column(Integer, default=0)
    
    # Última ejecución (cualquier estado)
    last_run_at = Column(DateTime, nullable=True)
    last_run_status = Column(String, nullable=True)  # success, failed, partial
    last_run_job_id = Column(Integer, ForeignKey("etl_job_logs.job_id"), nullable=True)
    
    # Estadísticas acumuladas
    total_runs_today = Column(Integer, default=0)
    total_records_today = Column(Integer, default=0)
    success_rate_today = Column(Numeric, default=100)
    
    # Última fecha del reporte de datos
    last_data_date = Column(Date, nullable=True)  # Fecha más reciente en los datos procesados
    
    # Configuración
    is_enabled = Column(Boolean, default=True)
    auto_sync_enabled = Column(Boolean, default=False)
    
    last_job = relationship("ETLJobLog", foreign_keys=[last_run_job_id])


event.listen(
    MarketPrice.__table__, 
    'after_create', 
    DDL("SELECT create_hypertable('market_prices', 'time', chunk_time_interval => INTERVAL '1 month', if_not_exists => TRUE);")
)