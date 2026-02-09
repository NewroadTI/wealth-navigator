# app/api/v1/endpoints/persh_accounts.py
"""
Pershing Account Resolution Endpoints

Endpoints for resolving missing accounts from Pershing imports:
- Extract investor names from CSV files
- Fuzzy match names to existing users
- Create accounts for existing users
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
import os
import re
import csv
import logging
from datetime import date, datetime

from app.api import deps
from app.models.user import User, Role
from app.models.portfolio import Account, Portfolio

logger = logging.getLogger(__name__)

router = APIRouter()


# ===========================================================================
# SCHEMAS
# ===========================================================================

class ExtractedName(BaseModel):
    account_code: str
    full_name: str
    parsed_name: str


class ExtractNamesRequest(BaseModel):
    csv_filename: str


class ExtractNamesResponse(BaseModel):
    success: bool
    names: List[ExtractedName]
    errors: List[str]


class MissingAccountInput(BaseModel):
    account_code: str
    parsed_name: Optional[str] = None


class MatchCandidate(BaseModel):
    """A potential user match for an account."""
    user_id: int
    full_name: str
    email: Optional[str] = None
    confidence: int  # 0-100


class MatchResult(BaseModel):
    account_code: str
    parsed_name: str
    candidates: List[MatchCandidate]  # Top candidates above threshold
    # Legacy fields for backward compatibility
    match_found: bool = False
    matched_user_id: Optional[int] = None
    matched_user_name: Optional[str] = None
    matched_user_email: Optional[str] = None
    confidence: int = 0


class MatchUsersRequest(BaseModel):
    missing_accounts: List[MissingAccountInput]


class MatchUsersResponse(BaseModel):
    results: List[MatchResult]


class CreateAccountRequest(BaseModel):
    account_code: str
    user_id: int


class CreateAccountResponse(BaseModel):
    success: bool
    account_id: Optional[int] = None
    account_code: str
    portfolio_id: Optional[int] = None
    message: str


# ===========================================================================
# HELPER FUNCTIONS
# ===========================================================================

def parse_name_from_full_name(full_name: str) -> str:
    """
    Parse a clean name from the "Full Name" column that may contain:
    - Multiple investor names concatenated
    - Address information
    - Separated by large whitespace gaps (5+ spaces = "tabular" separator)
    
    Example input: "F J MUNOZ RODRIGUEZ LA ROSA     G M MACCHIAVELLO CASABONNE      JT TEN..."
    Expected output: "F J MUNOZ RODRIGUEZ LA ROSA"
    """
    if not full_name:
        return ""
    
    # Clean and normalize
    full_name = full_name.strip()
    
    # Split by 3+ spaces (tabular separator used in Pershing exports)
    # This separates the first person's name from subsequent names/addresses
    parts = re.split(r'\s{3,}', full_name)
    
    if parts:
        candidate = parts[0].strip()
        
        # If candidate still has digits, it's likely address mixed in
        # Try to extract just the name part (letters, spaces, hyphens, apostrophes)
        if re.search(r'\d', candidate):
            name_match = re.match(r'^([A-Za-z\s\-\.\']+)', candidate)
            if name_match:
                candidate = name_match.group(1).strip()
        
        # Clean up extra internal spaces
        candidate = ' '.join(candidate.split())
        
        return candidate
    
    return full_name


def fuzzy_match_names(name1: str, name2: str) -> int:
    """
    Improved fuzzy matching between two names.
    Returns a score 0-100.
    
    Improvements:
    - Normalizes accented characters (é → e, ñ → n)
    - Handles word order differences
    - Handles abbreviations (J matches Jose)
    """
    if not name1 or not name2:
        return 0
    
    try:
        from unidecode import unidecode
        # Normalize accents: Muñoz → Munoz
        n1 = unidecode(name1).upper().strip()
        n2 = unidecode(name2).upper().strip()
    except ImportError:
        # Fallback if unidecode not available
        n1 = name1.upper().strip()
        n2 = name2.upper().strip()
    
    # Exact match after normalization
    if n1 == n2:
        return 100
    
    # Check if one is contained in the other
    if n1 in n2 or n2 in n1:
        return 95
    
    # Split into words
    words1 = [w for w in n1.split() if len(w) > 0]
    words2 = [w for w in n2.split() if len(w) > 0]
    
    if not words1 or not words2:
        return 0
    
    # Count matched words with flexible matching
    matched_words = 0
    total_words = max(len(words1), len(words2))
    
    words2_matched = set()
    
    for w1 in words1:
        best_match_score = 0
        best_match_idx = -1
        
        for idx, w2 in enumerate(words2):
            if idx in words2_matched:
                continue
                
            # Exact word match
            if w1 == w2:
                if best_match_score < 100:
                    best_match_score = 100
                    best_match_idx = idx
            # One is abbreviation of the other (J matches JOSE)
            elif len(w1) == 1 and w2.startswith(w1):
                if best_match_score < 80:
                    best_match_score = 80
                    best_match_idx = idx
            elif len(w2) == 1 and w1.startswith(w2):
                if best_match_score < 80:
                    best_match_score = 80
                    best_match_idx = idx
            # One word starts with the other (partial match)
            elif w1.startswith(w2) or w2.startswith(w1):
                if best_match_score < 70:
                    best_match_score = 70
                    best_match_idx = idx
        
        if best_match_idx >= 0:
            words2_matched.add(best_match_idx)
            matched_words += (best_match_score / 100)
    
    # Calculate score based on matched words
    if total_words == 0:
        return 0
    
    score = int((matched_words / total_words) * 100)
    
    return min(score, 100)


# ===========================================================================
# ENDPOINTS
# ===========================================================================

@router.post("/extract-names", response_model=ExtractNamesResponse)
def extract_names_from_csv(
    request: ExtractNamesRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Extract investor names from a CSV file's "Full Name" column.
    Returns parsed names that can be used for fuzzy matching.
    """
    logger.info(f"📥 extract-names called with filename: {request.csv_filename}")
    
    # Try multiple possible paths for the CSV file
    possible_dirs = [
        os.getenv("UPLOADS_DIR", "/app/uploads"),
        "/app/seed_data/persh/daily_transactions_csv",
        "/app/seed_data/persh/uploads",
        os.path.join(os.path.dirname(__file__), "../../../../seed_data/persh/daily_transactions_csv"),
    ]
    
    csv_path = None
    for dir_path in possible_dirs:
        candidate = os.path.join(dir_path, request.csv_filename)
        logger.info(f"🔍 Checking: {candidate}")
        if os.path.exists(candidate):
            csv_path = candidate
            logger.info(f"✅ Found CSV at: {csv_path}")
            break
    
    if not csv_path:
        error_msg = f"CSV file not found: {request.csv_filename}. Searched in: {possible_dirs}"
        logger.error(f"❌ {error_msg}")
        raise HTTPException(status_code=404, detail=error_msg)
    
    names: List[ExtractedName] = []
    errors: List[str] = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
            
            # Find the header row dynamically by looking for "Full Name"
            header_index = -1
            for i, line in enumerate(lines):
                if "Full Name" in line:
                    header_index = i
                    break
            
            if header_index == -1:
                errors.append("Could not find 'Full Name' column in CSV")
                return ExtractNamesResponse(success=False, names=[], errors=errors)
            
            # Parse CSV from the header row onwards
            csv_lines = lines[header_index:]
            reader = csv.DictReader(csv_lines)
            
            # Find the account code column
            account_code_col = None
            if reader.fieldnames:
                for col in reader.fieldnames:
                    col_lower = col.lower().strip()
                    if 'account' in col_lower and ('code' in col_lower or 'id' in col_lower or 'number' in col_lower):
                        account_code_col = col
                        break
                    if col_lower in ['account number', 'account_number', 'accountnumber', 'acct', 'account']:
                        account_code_col = col
                        break
            
            # Get the Full Name column name
            full_name_col = None
            if reader.fieldnames:
                for col in reader.fieldnames:
                    if 'full name' in col.lower() or col.lower() == 'full_name':
                        full_name_col = col
                        break
            
            if not full_name_col:
                errors.append("Could not find 'Full Name' column in CSV headers")
                return ExtractNamesResponse(success=False, names=[], errors=errors)
            
            seen_accounts = set()
            
            for row in reader:
                full_name = row.get(full_name_col, '').strip()
                account_code = row.get(account_code_col, '').strip() if account_code_col else ''
                
                if not account_code or account_code in seen_accounts:
                    continue
                
                seen_accounts.add(account_code)
                
                if full_name:
                    parsed_name = parse_name_from_full_name(full_name)
                    names.append(ExtractedName(
                        account_code=account_code,
                        full_name=full_name,
                        parsed_name=parsed_name
                    ))
    
    except Exception as e:
        errors.append(f"Error reading CSV: {str(e)}")
        return ExtractNamesResponse(success=False, names=[], errors=errors)
    
    return ExtractNamesResponse(success=True, names=names, errors=errors)

def get_code_candidates(raw_name: str) -> List[str]:
    """
    Generate candidate interface codes for a portfolio based on user name.
    Matches logic from import_persh_clients_v2.py
    """
    clean_name = raw_name.replace(',', '').upper()
    tokens = re.findall(r'\w+', clean_name)
    
    candidates = []
    if not tokens:
        candidates.append(f"PORT_{clean_name[:10]}")
        return candidates
        
    first = tokens[0]
    second = tokens[1] if len(tokens) > 1 else ""
    
    # Base Strategy: PORT_{First}{SecondInitial} (or {SecondFull} if First <= 3)
    if len(first) <= 3:
        candidates.append(f"PORT_{first}{second}".upper())
    else:
        # Use first name + first letter of second name
        suffix = second[0] if second else ""
        candidates.append(f"PORT_{first}{suffix}".upper())
        
    return candidates


@router.post("/match-users", response_model=MatchUsersResponse)
def match_missing_accounts_to_users(
    request: MatchUsersRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Fuzzy match missing account codes to existing investors.
    Uses the parsed name to find the best matching user.
    """
    logger.info(f"🔄 Matching {len(request.missing_accounts)} missing accounts to users")
    
    # Get all active investors
    investor_role = db.query(Role).filter(Role.name == "INVESTOR").first()
    if not investor_role:
        return MatchUsersResponse(results=[
            MatchResult(
                account_code=acc.account_code,
                parsed_name=acc.parsed_name or "",
                match_found=False,
                confidence=0
            )
            for acc in request.missing_accounts
        ])
    
    investors = db.query(User).filter(
        User.role_id == investor_role.role_id,
        User.is_active == True
    ).all()
    
    results: List[MatchResult] = []
    
    # Configuration: top 3 candidates above 75% confidence
    MAX_CANDIDATES = 3
    MIN_CONFIDENCE = 75
    
    for missing in request.missing_accounts:
        parsed_name = missing.parsed_name or ""
        
        # Score all investors
        scored_investors = []
        for investor in investors:
            if not investor.full_name:
                continue
            
            score = fuzzy_match_names(parsed_name, investor.full_name)
            
            if score >= MIN_CONFIDENCE:
                scored_investors.append({
                    'investor': investor,
                    'score': score
                })
        
        # Sort by score descending and take top N
        scored_investors.sort(key=lambda x: x['score'], reverse=True)
        top_candidates = scored_investors[:MAX_CANDIDATES]
        
        # Build candidate list
        candidates = [
            MatchCandidate(
                user_id=item['investor'].user_id,
                full_name=item['investor'].full_name,
                email=item['investor'].email,
                confidence=item['score']
            )
            for item in top_candidates
        ]
        
        # Legacy compatibility: use best match if available
        best_match = top_candidates[0]['investor'] if top_candidates else None
        best_score = top_candidates[0]['score'] if top_candidates else 0
        is_match = len(candidates) > 0
        
        results.append(MatchResult(
            account_code=missing.account_code,
            parsed_name=parsed_name,
            candidates=candidates,
            match_found=is_match,
            matched_user_id=best_match.user_id if best_match else None,
            matched_user_name=best_match.full_name if best_match else None,
            matched_user_email=best_match.email if best_match else None,
            confidence=best_score
        ))
    
    logger.info(f"✅ Matching complete: Found {sum(1 for r in results if r.match_found)} matches")
    return MatchUsersResponse(results=results)


@router.post("/create-account", response_model=CreateAccountResponse)
def create_account_for_user(
    request: CreateAccountRequest,
    db: Session = Depends(deps.get_db)
):
    """
    Create a Pershing account for an existing user.
    Finds the user's portfolio and creates the account.
    """
    logger.info(f"🆕 Creating account {request.account_code} for user {request.user_id}")
    
    # Check user exists
    user = db.query(User).filter(User.user_id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {request.user_id} not found")
    
    # Check account doesn't already exist
    existing_account = db.query(Account).filter(Account.account_code == request.account_code).first()
    if existing_account:
        return CreateAccountResponse(
            success=False,
            account_code=request.account_code,
            message=f"Account {request.account_code} already exists (ID: {existing_account.account_id})"
        )
    
    # Get user's portfolio (first one, or create if doesn't exist)
    portfolio = db.query(Portfolio).filter(Portfolio.owner_user_id == request.user_id).first()
    
    if not portfolio:
        # Create a new portfolio for the user
        # Generate clean interface code
        candidates = get_code_candidates(user.full_name)
        base_code = candidates[0]
        
        # Check for collision
        existing_port = db.query(Portfolio).filter(Portfolio.interface_code == base_code).first()
        if existing_port:
             # If collision, try creating unique one
             import random
             interface_code = f"{base_code}_{random.randint(100, 999)}"
        else:
             interface_code = base_code

        portfolio = Portfolio(
            name=f"{user.full_name}'s Portfolio",
            owner_user_id=request.user_id,
            interface_code=interface_code,
            main_currency="USD",
            residence_country="US",
            inception_date=date.today(),
            active_status=True
        )
        db.add(portfolio)
        db.flush()  # Get the portfolio_id
    
    # Create the account
    new_account = Account(
        portfolio_id=portfolio.portfolio_id,
        account_code=request.account_code,
        account_alias=request.account_code,
        account_type="BROKER",
        currency="USD",
        institution="PERSHING"
    )
    
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    
    return CreateAccountResponse(
        success=True,
        account_id=new_account.account_id,
        account_code=new_account.account_code,
        portfolio_id=portfolio.portfolio_id,
        message=f"Account created successfully for user {user.full_name}"
    )


@router.get("/missing-for-job/{job_id}")
def get_missing_accounts_for_job(
    job_id: int,
    db: Session = Depends(deps.get_db)
):
    """
    Get the list of missing accounts for a specific job.
    Retrieves from the ETLJobLog's error details.
    """
    from app.models.asset import ETLJobLog
    
    job = db.query(ETLJobLog).filter(ETLJobLog.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    missing_accounts = []
    
    # Parse error_details JSON to find missing accounts
    if job.error_details:
        details = job.error_details
        if isinstance(details, dict):
            missing_accounts = details.get('missing_accounts', [])
        elif isinstance(details, list):
            # Try to find missing accounts in list format
            for item in details:
                if isinstance(item, dict) and 'account_code' in item:
                    missing_accounts.append(item)
    
    return {
        "job_id": job_id,
        "file_name": job.file_name,
        "missing_accounts": missing_accounts
    }
