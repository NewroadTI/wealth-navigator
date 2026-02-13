"""
Pydantic schemas for TWR (Time-Weighted Return) endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date


# --- TWR Daily Row ---
class TWRDailyRead(BaseModel):
    twr_daily_id: int
    account_id: int
    date: date
    nav: Optional[float] = None
    sum_cash_journal: Optional[float] = None
    twr: Optional[float] = None
    hp: Optional[float] = None
    initial_hp_date: Optional[date] = None
    is_complete: bool = False

    class Config:
        from_attributes = True


class TWRDailyUpdate(BaseModel):
    """For manual edits of a TWR row (e.g. override nav or cash_journal)."""
    nav: Optional[float] = None
    sum_cash_journal: Optional[float] = None


# --- TWR Series ---
class TWRSeriesPoint(BaseModel):
    date: str
    twr: float = Field(description="TWR as percentage, e.g. 5.23 means 5.23%")
    nav: float


class TWRSeriesResponse(BaseModel):
    portfolio_id: int
    cutoff_date: Optional[str] = None
    data: List[TWRSeriesPoint]


# --- TWR Table (paginated) ---
class TWRTableResponse(BaseModel):
    total: int
    page: int
    page_size: int
    data: List[TWRDailyRead]


# --- TWR Sync Status ---
class AccountSyncStatus(BaseModel):
    account_id: int
    account_code: str
    last_twr_date: Optional[str] = None
    last_nav_date: Optional[str] = None
    is_synced: bool


class TWRStatusResponse(BaseModel):
    is_synced: bool
    last_complete_date: Optional[str] = None
    expected_date: str
    missing_etl_jobs: List[str] = []
    accounts_status: List[AccountSyncStatus] = []
    cutoff_date: Optional[str] = None
    message: Optional[str] = None


# --- Cutoff Date ---
class CutoffDateUpdate(BaseModel):
    cutoff_date: date = Field(description="New cutoff date for TWR calculation start")


class CutoffDateResponse(BaseModel):
    portfolio_id: int
    cutoff_date: str
    message: str
    twr_calculated: int


# --- Recalculate ---
class TWRRecalculateResponse(BaseModel):
    message: str
    twr_calculated: int
    cutoff_date: Optional[str] = None


# --- Batch NAV Upsert (for ETL processor via API) ---
class TWRNavUpsertItem(BaseModel):
    account_code: str = Field(description="Account code e.g. U17124790_USD")
    date: date
    nav: float


class TWRNavUpsertBatch(BaseModel):
    rows: List[TWRNavUpsertItem]


class TWRNavUpsertResponse(BaseModel):
    records_created: int
    records_updated: int
    records_failed: int
    missing_accounts: List[str] = []


# --- Fill & Calculate ---
class TWRFillAndCalculateResponse(BaseModel):
    message: str
    cash_journal_filled: int
    twr_calculated: int


# --- Benchmark ---
class BenchmarkPoint(BaseModel):
    date: str
    benchmark: float = Field(description="Normalized benchmark return as percentage from cutoff date")


class BenchmarkSeriesResponse(BaseModel):
    account_id: int
    ticker: str
    cutoff_date: Optional[str] = None
    data: List[BenchmarkPoint]
