from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, CHAR, Numeric
from sqlalchemy.orm import relationship
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
    
    investment_strategy = relationship("InvestmentStrategy")
    
    portfolio = relationship("Portfolio", back_populates="accounts")
    trades = relationship("Trades", back_populates="account")
    cash_journal = relationship("CashJournal", foreign_keys="[CashJournal.account_id]", back_populates="account")
    return_series = relationship("AccountReturnSeries", back_populates="account")
    performance_attribution = relationship("PerformanceAttribution", back_populates="account")
    corporate_actions = relationship("CorporateAction", back_populates="account")
    positions = relationship("Position", back_populates="account") # Soluciona el error actual


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