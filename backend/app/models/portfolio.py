from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, CHAR, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.asset import InvestmentStrategy

class Portfolio(Base):
    __tablename__ = "portfolios"
    portfolio_id = Column(Integer, primary_key=True, index=True)
    
    owner_user_id = Column(Integer, ForeignKey("users.user_id"))
    
    interface_code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    main_currency = Column(CHAR(3)) 
    residence_country = Column(CHAR(2))
    
    inception_date = Column(Date)
    active_status = Column(Boolean, default=True)
    twr_cutoff_date = Column(Date, nullable=True)  # Contract renewal / TWR calculation start date
    
    owner = relationship("User", back_populates="owned_portfolios")
    accounts = relationship("Account", back_populates="portfolio")
    advisors = relationship("PortfolioAdvisor", back_populates="portfolio")

class PortfolioAdvisor(Base):
    __tablename__ = "portfolio_advisors"
    assignment_id = Column(Integer, primary_key=True, index=True)
    
    portfolio_id = Column(Integer, ForeignKey("portfolios.portfolio_id"))
    advisor_user_id = Column(Integer, ForeignKey("users.user_id"))
    
    role = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    
    portfolio = relationship("Portfolio", back_populates="advisors")
    advisor = relationship("User", back_populates="advisor_assignments")

class Account(Base):
    __tablename__ = "accounts"
    account_id = Column(Integer, primary_key=True, index=True)
    
    portfolio_id = Column(Integer, ForeignKey("portfolios.portfolio_id"))
    
    institution = Column(String, default='IBKR', nullable=False)
    account_code = Column(String, nullable=False, unique=True) # UXXXXXX_USD, UXXXXXX_EUR
    account_alias = Column(String)  # UXXXXXX (solo numero de cuenta, sin moneda)
    account_type = Column(String)
    currency = Column(CHAR(3))
    investment_strategy_id = Column(Integer, ForeignKey("investment_strategies.strategy_id"), nullable=True)
    twr_cutoff_date = Column(Date, nullable=True)  # TWR calculation inception date for this account
    
    investment_strategy = relationship("InvestmentStrategy")
    
    portfolio = relationship("Portfolio", back_populates="accounts")
    trades = relationship("Trades", back_populates="account")
    cash_journal = relationship("CashJournal", foreign_keys="[CashJournal.account_id]", back_populates="account")
    return_series = relationship("AccountReturnSeries", back_populates="account")
    performance_attribution = relationship("PerformanceAttribution", back_populates="account")
    corporate_actions = relationship("CorporateAction", back_populates="account")
    fx_transactions = relationship("FXTransaction", foreign_keys="[FXTransaction.account_id]", back_populates="account")
    positions = relationship("Position", back_populates="account") # Soluciona el error actual
    twr_daily = relationship("TWRDaily", back_populates="account")


class AccountReturnSeries(Base):
    __tablename__ = "account_return_series"
    
    series_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.account_id"), nullable=False)
    
    # Periodo del reporte
    # Ej: period_type='M' (Month), 'Q' (Quarter), 'Y' (Year), 'YTD'
    period_type = Column(String(3), nullable=False) 
    
    # Etiqueta original del reporte para display exacto
    # Ej: '202501', '2025 Q1', '2024', 'YTD'
    period_label = Column(String, nullable=False)
    
    # Fecha normalizada (Vital para ordenar gráficas)
    # Si es '202501', guardas 2025-01-31. Si es 2025, guardas 2025-12-31.
    end_date = Column(Date, nullable=False)
    
    return_pct = Column(Numeric, nullable=False) # El valor principal (ej. 9.16)
    
    # Opcional: Si el reporte te da valores monetarios del NAV inicial/final
    starting_nav = Column(Numeric, nullable=True)
    ending_nav = Column(Numeric, nullable=True)
    
    # Constraint para no duplicar datos del mismo mes/cuenta
    # __table_args__ = (UniqueConstraint('account_id', 'period_type', 'period_label', name='uq_acct_period'),)

    account = relationship("Account", back_populates="return_series")


class TWRDaily(Base):
    """
    Daily TWR (Time-Weighted Return) tracking per account.
    Stores daily NAV, cash flow sums and calculated TWR/HP values.
    """
    __tablename__ = "twr_daily"

    twr_daily_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.account_id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    nav = Column(Numeric, nullable=True)             # Total NAV from NLV_HISTORY
    sum_cash_journal = Column(Numeric, default=0)     # Sum of relevant cash_journal amounts
    twr = Column(Numeric, nullable=True)              # Cumulative TWR from initial_hp_date
    hp = Column(Numeric, nullable=True)               # Single-day holding period return
    initial_hp_date = Column(Date, nullable=True)     # Start date for TWR window

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # One record per account per day
        {"schema": None},
    )

    account = relationship("Account", back_populates="twr_daily")