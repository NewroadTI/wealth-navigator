from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Numeric, CHAR, Text, BigInteger
from sqlalchemy.orm import relationship
from app.db.base import Base
from sqlalchemy import event, DDL




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
    
    symbol = Column(String, nullable=False)
    description = Column(String)
    isin = Column(String)
    figi = Column(String)
    cusip = Column(String)
    ib_conid = Column(Integer, unique=True)
    
    #sector es ahora industry_code
    sector = Column(String)
    # --- NUEVA FOREIGN KEY A INDUSTRY ---
    industry_code = Column(String, ForeignKey("industries.industry_code"), nullable=True)
    
    # --- CAMBIO IMPORTANTE: AHORA ES FOREIGN KEY ---
    country_code = Column(CHAR(2), ForeignKey("countries.iso_code"), nullable=True)
    
    currency = Column(CHAR(3))
    
    multiplier = Column(Numeric, default=1)
    contract_size = Column(Numeric, default=0)
    
    underlying_symbol = Column(String)
    strike_price = Column(Numeric)
    expiry_date = Column(Date)
    put_call = Column(String(4))
    
    maturity_date = Column(Date)
    coupon_rate = Column(Numeric)
    
    is_active = Column(Boolean, default=True)
    
    # Relación nueva para acceder a datos del país desde el asset
    country = relationship("Country", back_populates="assets")
    industry = relationship("Industry", back_populates="assets") # <--- NUEVO


# --- TRANSACCIONES ---
class Trade(Base):
    __tablename__ = "trades"
    trade_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.account_id"))
    asset_id = Column(Integer, ForeignKey("assets.asset_id"))
    
    ib_exec_id = Column(String, unique=True) # ID único ejecución
    ib_order_id = Column(String)
    
    trade_date = Column(DateTime, nullable=False)
    settlement_date = Column(Date)
    
    transaction_type = Column(String, nullable=False) # BUY, SELL
    quantity = Column(Numeric, nullable=False)
    price = Column(Numeric, nullable=False)
    
    gross_amount = Column(Numeric)
    commission = Column(Numeric)
    tax = Column(Numeric)
    net_amount = Column(Numeric) # Dinero final
    currency = Column(CHAR(3))
    
    description = Column(Text)
    
    account = relationship("Account", back_populates="trades")
    asset = relationship("Asset")

class CashJournal(Base):
    __tablename__ = "cash_journal"
    journal_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.account_id"))
    
    date = Column(Date, nullable=False)
    type = Column(String, nullable=False) # DIVIDEND, INTEREST, FEE
    amount = Column(Numeric, nullable=False)
    currency = Column(CHAR(3))
    
    asset_id = Column(Integer, ForeignKey("assets.asset_id"), nullable=True)
    description = Column(Text)
    reference_code = Column(String, unique=True) # TransactionID único
    
    account = relationship("Account", back_populates="cash_journal")
    asset = relationship("Asset")

class FXTransaction(Base):
    __tablename__ = "fx_transactions"
    fx_id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(DateTime)
    
    account_id = Column(Integer, ForeignKey("accounts.account_id"))
    
    source_currency = Column(CHAR(3))
    source_amount = Column(Numeric)
    target_currency = Column(CHAR(3))
    target_amount = Column(Numeric)
    
    exchange_rate = Column(Numeric)
    external_id = Column(String, unique=True)

class PerformanceAttribution(Base):
    __tablename__ = "performance_attribution"
    attribution_id = Column(BigInteger, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.account_id"))
    asset_id = Column(Integer, ForeignKey("assets.asset_id"))
    
    start_date = Column(Date)
    end_date = Column(Date)
    
    return_pct = Column(Numeric)
    contribution_pct = Column(Numeric)
    realized_pnl = Column(Numeric)
    unrealized_pnl = Column(Numeric)


# ... (Tu código existente de Asset, Trade, CashJournal, FXTransaction) ...

# --- FALTABA ESTO ---

class CorporateAction(Base):
    __tablename__ = "corporate_actions"
    action_id = Column(Integer, primary_key=True, index=True)
    ib_action_id = Column(String, unique=True)
    
    asset_id = Column(Integer, ForeignKey("assets.asset_id"))
    account_id = Column(Integer, ForeignKey("accounts.account_id"))
    
    report_date = Column(Date)
    execution_date = Column(Date)
    
    action_type = Column(String) # SPLIT, SPINOFF
    description = Column(Text)
    
    ratio_old = Column(Numeric)
    ratio_new = Column(Numeric)
    quantity_adjustment = Column(Numeric)
    cash_in_lieu = Column(Numeric)
    
    transaction_id = Column(String)

class Position(Base):
    __tablename__ = "positions"
    position_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.account_id"))
    asset_id = Column(Integer, ForeignKey("assets.asset_id"))
    report_date = Column(Date, nullable=False)
    
    # Core Data
    quantity = Column(Numeric, nullable=False)
    
    # Precios y Costos
    cost_basis_money = Column(Numeric)
    cost_basis_price = Column(Numeric)
    mark_price = Column(Numeric)
    position_value = Column(Numeric)
    
    # P&L
    fifo_pnl_unrealized = Column(Numeric)
    percent_of_nav = Column(Numeric)
    
    # Extras
    accrued_interest = Column(Numeric)
    vesting_date = Column(Date)
    side = Column(String)
    fx_rate_to_base = Column(Numeric, default=1)

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


event.listen(
    MarketPrice.__table__, 
    'after_create', 
    DDL("SELECT create_hypertable('market_prices', 'time', chunk_time_interval => INTERVAL '1 month', if_not_exists => TRUE);")
)