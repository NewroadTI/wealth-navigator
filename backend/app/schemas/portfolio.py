from pydantic import BaseModel
from typing import Optional, List
from datetime import date

# --- PORTFOLIO ADVISOR SCHEMAS ---
class PortfolioAdvisorBase(BaseModel):
    advisor_user_id: int
    role: str = "PRIMARY"
    start_date: date

class PortfolioAdvisorCreate(PortfolioAdvisorBase):
    portfolio_id: int

class PortfolioAdvisorRead(PortfolioAdvisorBase):
    assignment_id: int
    end_date: Optional[date] = None
    
    class Config:
        from_attributes = True

# --- ACCOUNT SCHEMAS ---
class AccountBase(BaseModel):
    institution: str = "IBKR"
    account_code: str
    account_alias: Optional[str] = None
    account_type: Optional[str] = "Brokerage"
    currency: str = "USD"
    investment_strategy_id: Optional[int] = None

class AccountCreate(AccountBase):
    portfolio_id: int

class AccountRead(AccountBase):
    account_id: int
    portfolio_id: int
    class Config:
        from_attributes = True

# --- PORTFOLIO SCHEMAS ---
class PortfolioBase(BaseModel):
    interface_code: str
    name: str
    main_currency: str = "USD"
    residence_country: Optional[str] = None
    active_status: bool = True

class PortfolioCreate(PortfolioBase):
    owner_user_id: int
    inception_date: Optional[date] = None

class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    main_currency: Optional[str] = None
    residence_country: Optional[str] = None
    active_status: Optional[bool] = None
    inception_date: Optional[date] = None

class PortfolioRead(PortfolioBase):
    portfolio_id: int
    owner_user_id: int
    inception_date: Optional[date] = None
    
    accounts: List[AccountRead] = []
    advisors: List[PortfolioAdvisorRead] = []

    class Config:
        from_attributes = True