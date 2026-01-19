from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, CHAR
from sqlalchemy.orm import relationship
from app.db.base import Base

class Portfolio(Base):
    __tablename__ = "portfolios"
    portfolio_id = Column(Integer, primary_key=True, index=True)
    
    owner_user_id = Column(Integer, ForeignKey("users.user_id"))
    
    interface_code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String)
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
    account_code = Column(String, nullable=False, unique=True) # UXXXXXX
    account_alias = Column(String)
    account_type = Column(String)
    currency = Column(CHAR(3))
    
    portfolio = relationship("Portfolio", back_populates="accounts")
    trades = relationship("Trade", back_populates="account")
    cash_journal = relationship("CashJournal", back_populates="account")
    