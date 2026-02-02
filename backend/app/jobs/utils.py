"""
ETL Utilities - Helper functions for data processing
=====================================================
"""

import re
import logging
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import Optional, Dict, Any, Tuple
import pandas as pd

logger = logging.getLogger("ETL.utils")


def parse_decimal(val) -> Optional[Decimal]:
    """
    Parse a value to Decimal, handling various formats.
    Returns None if parsing fails.
    """
    if pd.isna(val) or str(val).strip() in ["", "-", "nan", "None"]:
        return None
    try:
        clean = str(val).replace(",", "").replace("$", "").replace(" ", "").strip()
        if clean.startswith("<"):
            return None
        return Decimal(clean)
    except (InvalidOperation, ValueError):
        return None


def validate_numeric_limit(val: Optional[Decimal], precision: int = 10, scale: int = 6) -> Optional[Decimal]:
    """
    Validate that a decimal value fits within DB precision limits.
    Returns None if the value exceeds limits.
    """
    if val is None:
        return None
    limit = Decimal(10 ** (precision - scale))
    if abs(val) >= limit:
        return None
    return val


def parse_date(val) -> Optional[date]:
    """
    Parse various date formats to Python date object.
    Supports: YYYYMMDD, MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD
    """
    if pd.isna(val) or str(val).strip() == "":
        return None
    
    s = str(val).strip()
    
    # Handle datetime with semicolon (e.g., "07/01/2026;202500")
    if ";" in s:
        s = s.split(";")[0]
    
    try:
        # YYYYMMDD format
        if re.match(r"^\d{8}$", s):
            return datetime.strptime(s, "%Y%m%d").date()
        
        # MM/DD/YY or MM/DD/YYYY format
        if "/" in s:
            try:
                return datetime.strptime(s, "%m/%d/%y").date()
            except ValueError:
                return datetime.strptime(s, "%m/%d/%Y").date()
        
        # YYYY-MM-DD format
        if "-" in s:
            return datetime.strptime(s, "%Y-%m-%d").date()
            
    except ValueError as e:
        logger.warning(f"Failed to parse date '{val}': {e}")
    
    return None


def parse_datetime(val) -> Optional[datetime]:
    """
    Parse various datetime formats.
    Supports: YYYYMMDD;HHMMSS, MM/DD/YYYY HH:MM:SS, etc.
    """
    if pd.isna(val) or str(val).strip() == "":
        return None
    
    s = str(val).strip()
    
    try:
        # IBKR format: "07/01/2026;202500" -> date;time
        if ";" in s:
            parts = s.split(";")
            date_part = parts[0]
            time_part = parts[1] if len(parts) > 1 else "000000"
            
            # Parse date
            if "/" in date_part:
                try:
                    d = datetime.strptime(date_part, "%m/%d/%Y")
                except ValueError:
                    d = datetime.strptime(date_part, "%m/%d/%y")
            else:
                d = datetime.strptime(date_part, "%Y%m%d")
            
            # Parse time if available
            if time_part and len(time_part) >= 6:
                hour = int(time_part[:2])
                minute = int(time_part[2:4])
                second = int(time_part[4:6])
                d = d.replace(hour=hour, minute=minute, second=second)
            
            return d
        
        # Standard ISO format
        if "T" in s:
            return datetime.fromisoformat(s)
        
        # Just date, return as datetime at midnight
        date_only = parse_date(val)
        if date_only:
            return datetime.combine(date_only, datetime.min.time())
            
    except ValueError as e:
        logger.warning(f"Failed to parse datetime '{val}': {e}")
    
    return None


def parse_ratio_from_description(description: str) -> Tuple[Optional[Decimal], Optional[Decimal]]:
    """
    Extract ratio (old/new) from corporate action description.
    Example: "SFTBY(US83404D1090) SPLIT 4 FOR 1" -> ratio_new=4, ratio_old=1
    Example: "LCID.OLD SPLIT 1 FOR 10" -> ratio_new=1, ratio_old=10
    """
    if not description:
        return None, None
    
    # Pattern: "X FOR Y" where X is new ratio and Y is old ratio
    match = re.search(r'(\d+(?:\.\d+)?)\s+FOR\s+(\d+(?:\.\d+)?)', description, re.IGNORECASE)
    
    if match:
        ratio_new = validate_numeric_limit(Decimal(match.group(1)))
        ratio_old = validate_numeric_limit(Decimal(match.group(2)))
        return ratio_new, ratio_old
    
    return None, None


def normalize_action_type(raw_type, description: str = "") -> str:
    """
    Normalize the corporate action type from IBKR codes.
    """
    from app.jobs.config import ACTION_TYPE_MAP
    
    # Convert raw_type to string and handle None/NaN
    if raw_type is None or (isinstance(raw_type, float) and pd.isna(raw_type)):
        raw_type = ""
    else:
        raw_type = str(raw_type).strip()
    
    description = str(description) if description else ""
    
    if not raw_type:
        # Try to infer from description
        desc_upper = description.upper()
        if "SPLIT" in desc_upper:
            if "REVERSE" in desc_upper:
                return "Reverse Split"
            return "Split"
        if "SPINOFF" in desc_upper or "SPIN OFF" in desc_upper:
            return "Spinoff"
        if "MERGE" in desc_upper or "ACQUISITION" in desc_upper:
            return "Acquisition"
        if "DELIST" in desc_upper:
            return "Delisting"
        if "DIVIDEND" in desc_upper:
            return "Stock Dividend"
        return "Corporate Action"
    
    # Look up in mapping
    normalized = ACTION_TYPE_MAP.get(raw_type.upper(), raw_type)
    return normalized


def extract_symbol_from_description(description: str) -> Optional[str]:
    """
    Extract symbol from description like "SFTBY(US83404D1090) SPLIT..."
    """
    if not description:
        return None
    
    # Look for symbol before parenthesis
    match = re.match(r'^([A-Z0-9.]+)\s*\(', description)
    if match:
        return match.group(1).replace('.OLD', '').replace('.NEW', '')
    
    # Look for symbol after action description
    match = re.search(r'\(([A-Z0-9]+),', description)
    if match:
        return match.group(1)
    
    return None


def clean_isin(val) -> Optional[str]:
    """Clean and validate ISIN."""
    if pd.isna(val) or not val:
        return None
    
    isin = str(val).strip().upper()
    
    # Basic ISIN validation (12 characters, 2 letters + 10 alphanumeric)
    if len(isin) == 12 and isin[:2].isalpha():
        return isin
    
    return None


def clean_cusip(val) -> Optional[str]:
    """Clean and validate CUSIP."""
    if pd.isna(val) or not val:
        return None
    
    cusip = str(val).strip().upper()
    
    # Basic CUSIP validation (9 characters alphanumeric)
    if len(cusip) == 9:
        return cusip
    
    return None


def get_account_code_from_currency(client_account_id: str, currency: str) -> str:
    """
    Generate the full account code from client account ID and currency.
    Example: ("U16337121", "USD") -> "U16337121_USD"
    """
    return f"{client_account_id}_{currency}"


def build_bulk_payload(records: list, record_type: str) -> Dict[str, Any]:
    """
    Build a bulk insert payload for the API.
    """
    return {
        "record_type": record_type,
        "records": records,
        "count": len(records)
    }


def safe_get(row, key, default=None):
    """
    Safely get a value from a DataFrame row or dict.
    """
    try:
        val = row.get(key, default) if isinstance(row, dict) else row[key] if key in row.index else default
        if pd.isna(val):
            return default
        return val
    except (KeyError, AttributeError):
        return default
