"""
ETL Configuration - IBKR Data Import
=====================================
Configuration settings for downloading and processing IBKR reports.
"""

import os
from pathlib import Path

# --- DIRECTORIES ---
BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
PROCESSED_DIR = BASE_DIR / "processed"

# Ensure directories exist
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

# --- IBKR FLEX QUERY CONFIGURATION ---
IBKR_TOKEN = os.getenv("IBKR_TOKEN", "181787535917845028470530")

# Flex Query IDs - These generate the CSV reports
FLEX_QUERIES = {
    "CORPORATES": "1126752",
    "OPENPOSITIONS": "1126562", 
    "PRICES": "1126564",
    "STATEMENTFUNDS": "1126598",
    "TRADES": "1126535",
    "TRANSACCIONES": "1126335",
    "TRANSFERS": "1126559"
}

# IBKR API URLs
IBKR_API_VERSION = "3"
IBKR_INITIATE_URL = "https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest"
IBKR_DOWNLOAD_URL = "https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement"

# --- TIMING ---
WAIT_FOR_GENERATION = 3  # seconds to wait for report generation
WAIT_BETWEEN_FILES = 2   # seconds between file downloads

# --- SUPPORTED CURRENCIES ---
MONEDAS_SUPPORTED = [
    "USD", "HKD", "GBP", "EUR", "CAD", "CHF", "JPY", "AUD", "CNH",
    "TWD", "SGD", "MXN", "KRW", "INR"
]

# --- BACKEND API CONFIGURATION ---
# When running inside Docker, use service name. Outside Docker, use localhost.
BACKEND_API_BASE = os.getenv("BACKEND_API_BASE", "http://localhost:8000")

# API Endpoints
API_ENDPOINTS = {
    "accounts": f"{BACKEND_API_BASE}/api/v1/accounts",
    "assets": f"{BACKEND_API_BASE}/api/v1/assets",
    "portfolios": f"{BACKEND_API_BASE}/api/v1/portfolios",
    "corporate_actions": f"{BACKEND_API_BASE}/api/v1/transactions/corporate-actions",
    "trades": f"{BACKEND_API_BASE}/api/v1/transactions/trades",
    "positions": f"{BACKEND_API_BASE}/api/v1/positions",
    "cash_journal": f"{BACKEND_API_BASE}/api/v1/transactions/cash-journal",
}

# --- CSV COLUMN MAPPINGS ---
# Maps IBKR CSV column names to our database column names
# Based on actual IBKR Flex Query Corporate Actions format:
# ClientAccountID, AccountAlias, Model, CurrencyPrimary, FXRateToBase, AssetClass, SubCategory,
# Symbol, Description, Conid, SecurityID, SecurityIDType, CUSIP, ISIN, FIGI, ListingExchange,
# UnderlyingConid, UnderlyingSymbol, UnderlyingSecurityID, UnderlyingListingExchange, Issuer,
# IssuerCountryCode, Multiplier, Strike, Expiry, Put/Call, PrincipalAdjustFactor, Report Date,
# Date/Time, ActionDescription, Amount, Proceeds, Value, Quantity, FifoPnlRealized, MtmPnl,
# Code, Type, TransactionID, ActionID, LevelOfDetail, SerialNumber, DeliveryType, CommodityType,
# Fineness, Weight

CORPORATE_ACTIONS_COLUMNS = {
    # Account identification
    "client_account_id": "ClientAccountID",
    "account_alias": "AccountAlias",
    "currency": "CurrencyPrimary",
    
    # Asset identification
    "symbol": "Symbol",
    "description": "ActionDescription",  # Use ActionDescription as main description
    "description_alt": "Description",     # Alternative description field
    "conid": "Conid",
    "security_id": "SecurityID",
    "security_id_type": "SecurityIDType",
    "cusip": "CUSIP",
    "isin": "ISIN",
    "figi": "FIGI",
    
    # Dates
    "report_date": "Report Date",
    "execution_date": "Date/Time",
    
    # Financial values
    "amount": "Amount",
    "proceeds": "Proceeds",
    "value": "Value",
    "quantity_adjustment": "Quantity",
    "fifo_pnl_realized": "FifoPnlRealized",
    "mtm_pnl": "MtmPnl",
    
    # IBKR identifiers
    "action_type": "Type",          # FS, RS, SO, TC, etc.
    "transaction_id": "TransactionID",
    "ib_action_id": "ActionID",
    
    # Filtering
    "level_of_detail": "LevelOfDetail",  # DETAIL, SUMMARY, etc.
}

# Action type normalization - IBKR Type codes to human-readable
ACTION_TYPE_MAP = {
    "FS": "Split",           # Forward Split
    "RS": "Reverse Split",   # Reverse Split  
    "SO": "Spinoff",
    "TC": "Tender",
    "DW": "Delisting",
    "CA": "Corporate Action",
    "TO": "Acquisition",
    "SD": "Stock Dividend",
    "BM": "Bonus Issue",
    "RI": "Rights Issue",
    "DI": "Dividend",
    "IC": "Issuer Change",
    "SI": "Symbol Change",
}

# --- ASSET CLASS DEFAULTS ---
DEFAULT_EQUITY_CLASS_ID = 1  # Equities class
DEFAULT_SUBCLASS_ID = None
