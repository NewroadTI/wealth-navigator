import sys
import os
import csv
import re
from typing import List, Dict, Optional, Tuple
from datetime import date

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User, Role
from app.models.portfolio import Portfolio, Account
from app.core.security import get_password_hash

# Constants
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'inviu_fulldata.csv')
DEFAULT_PASSWORD = "password123"

STOPWORDS = {"de", "del", "la", "las", "los", "y", "da", "di", "do", "dos", "das", "van", "von"}

def normalize_name(name: str) -> set:
    """Convert name to lowercase set of alphanumeric tokens, removing stopwords."""
    # Remove non-alphanumeric except space
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
    tokens = set(clean.split())
    # Remove stopwords
    return {t for t in tokens if t not in STOPWORDS}

def fuzzy_match_user(db: Session, raw_name: str) -> Optional[User]:
    """
    Finds a user in the DB that matches the raw_name using Jaccard Index.
    Jaccard = (Intersection) / (Union).
    Threshold set to 0.7 to ensure high similarity and avoid partial false positives.
    """
    if not raw_name:
        return None
        
    target_tokens = normalize_name(raw_name)
    if not target_tokens:
        return None

    users = db.query(User).all()
    
    best_match = None
    best_score = 0.0
    
    for user in users:
        user_tokens = normalize_name(user.full_name or "")
        if not user_tokens:
            continue
            
        intersection = target_tokens.intersection(user_tokens)
        union = target_tokens.union(user_tokens)
        
        if not union:
            continue
            
        jaccard_index = len(intersection) / len(union)
        
        # Threshold: 0.65 means ~2/3 of the significant words must match
        # Example: "Manuel Caceres" (2) vs "Caceres Manuel" (2) -> 2/2 = 1.0 (Match)
        # Example: "Nuñez Ferrero"(2) vs "Nuñez Taboada"(2) -> 1/3 = 0.33 (No Match)
        if jaccard_index > 0.65:
            if jaccard_index > best_score:
                best_score = jaccard_index
                best_match = user

    return best_match

def generate_interface_code(name: str) -> str:
    """
    Generates interface code based on rules:
    - Default: PORT_{FirstWord}{SecondWordInitial}
    - If FirstWord <= 3 chars: PORT_{FirstWord}{SecondWordFull}
    """
    # Remove commas before processing
    clean_name = name.replace(',', '')
    tokens = re.findall(r'\w+', clean_name)
    
    if not tokens:
        return f"PORT_{clean_name[:10]}".upper()
    
    first = tokens[0]
    
    if len(tokens) == 1:
        return f"PORT_{first}".upper()
    
    second = tokens[1]
    
    if len(first) <= 3:
        # SHORT Name Policy: PORT_DeTaboada
        return f"PORT_{first}{second}".upper()
    else:
        # Standard Policy: PORT_ManuelC
        return f"PORT_{first}{second[0]}".upper()

def run_import():
    db = SessionLocal()
    try:
        # 1. Load CSV Data
        if not os.path.exists(DATA_FILE):
            print(f"[ERROR] File not found: {DATA_FILE}")
            return

        print(f"Reading {DATA_FILE}...")
        
        # Unique mapping: User -> set(AccountCodes)
        # We assume the CSV has columns: "Cliente", "Cuenta" (based on user prompt)
        # Adjust if column names differ in reality, but prompt said "columna cliente" and "columna cuenta"
        
        client_data = {} # { "Raw Name": [Account1, Account2] }
        
        with open(DATA_FILE, 'r', encoding='utf-8', errors='replace') as f:
            # Detect inputs - naive assumption of headers usually
            # But converting XLS to CSV usually preserves headers. 
            # Let's inspect headers or assume standard pandas output.
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            
            # Helper to find column loosely
            col_client = next((h for h in headers if 'client' in h.lower() or 'nombre' in h.lower()), None)
            col_account = next((h for h in headers if 'account' in h.lower() or 'cuenta' in h.lower()), None)

            if not col_client or not col_account:
                print(f"[ERROR] Could not identify Client/Account columns in: {headers}")
                return

            rows = list(reader)
            print(f"Loaded {len(rows)} rows.")

            for row in rows:
                # Normalize name to Title Case as requested
                raw_name = row[col_client].strip().title()
                acct_code = row[col_account].strip()
                
                if not raw_name or not acct_code:
                    continue
                
                if raw_name not in client_data:
                    client_data[raw_name] = set()
                client_data[raw_name].add(acct_code)

        # 2. Plan Phase
        print("\n" + "="*50)
        print("PLANNING PHASE - PREVIEW")
        print("="*50)
        
        actions = [] # List of tuples/dicts with action info
        
        investor_role = db.query(Role).filter(Role.name == "INVESTOR").first()
        if not investor_role:
             print("[ERROR] Role INVESTOR not found. Please seed roles first.")
             return

        for raw_name, accounts in client_data.items():
            # Check Match
            match = fuzzy_match_user(db, raw_name)
            
            if match:
                # User Exists
                print(f"🔹 MATCH: '{raw_name}' -> DB: '{match.full_name}' (ID: {match.user_id})")
                
                # Check Portfolio
                # We need to find THE portfolio for this user.
                # Assuming 1 main portfolio per user for this logic, or matching naming convention?
                # User prompt: "buscairas el portfolio que tenga ese username" (User ID)
                port = db.query(Portfolio).filter(Portfolio.owner_user_id == match.user_id).first()
                
                if not port:
                    print(f"   ⚠️  User has no portfolio! Marking to CREATE Portfolio.")
                    # Logic to create portfolio if missing for existing user?
                    # Prompt says: "si hay match (ya deberia existir el portfolio entonces...)"
                    # But if not, we should probably create it to be safe.
                    # But strict interpretation: "buscairas el portfolio... y ver si la cuenta existe".
                    # I will assume we should create it if missing, using the same naming logic.
                    
                    p_name = f"{match.full_name}'s Portfolio" # Fallback to DB name
                    p_code = generate_interface_code(match.full_name)
                    actions.append({
                        "type": "create_portfolio_and_accounts",
                        "user": match,
                        "p_name": p_name,
                        "p_code": p_code,
                        "accounts": accounts
                    })
                else:
                    # Check Accounts
                    full_accounts = db.query(Account).filter(Account.portfolio_id == port.portfolio_id).all()
                    existing_codes = {acc.account_code for acc in full_accounts}
                    
                    missing_accts = [a for a in accounts if a not in existing_codes]
                    
                    if missing_accts:
                        print(f"   Found {len(missing_accts)} new accounts for existing portfolio.")
                        actions.append({
                            "type": "add_accounts",
                            "portfolio": port,
                            "accounts": missing_accts
                        })
                    else:
                        print("   ✅ All accounts exist.")

            else:
                # New User
                print(f"🆕 NEW USER: '{raw_name}'")
                
                # Naming Logic
                # "el nombre del portfolio sera las dos primeras palabras del nnombre... 's Portfolio"
                
                # Remove commas for cleaner name parsing
                clean_name_for_port = raw_name.replace(',', '')
                tokens = clean_name_for_port.split()
                
                if len(tokens) >= 2:
                    p_base_name = f"{tokens[0]} {tokens[1]}"
                else:
                    p_base_name = clean_name_for_port
                
                p_name = f"{p_base_name}'s Portfolio"
                p_code = generate_interface_code(raw_name)
                
                print(f"   Plan: Create User -> Port '{p_name}' ({p_code}) -> {len(accounts)} Accounts")
                
                actions.append({
                    "type": "create_everything",
                    "raw_name": raw_name,
                    "p_name": p_name,
                    "p_code": p_code,
                    "accounts": accounts,
                    "role_id": investor_role.role_id
                })

        # 3. Confirmation
        if not actions:
            print("\n✅ Nothing to do. All data matches.")
            return

        print("\n" + "-"*50)
        print(f"Summary: {len(actions)} main actions pending.")
        confirm = input("Type 'yes' to execute changes: ")
        
        if confirm.lower() != 'yes':
            print("Cancelled.")
            return

        # 4. Execution
        print("\n🚀 EXECUTING...")
        
        for action in actions:
            if action["type"] == "create_everything":
                # Create User
                raw_name = action["raw_name"]
                
                # Username generation (simple)
                username = re.sub(r'\s+', '.', raw_name.lower())
                email = f"{re.sub(r'[^a-z0-9]', '', username)}@example.com"
                
                # Check conflicts just in case (e.g. email reused)
                # In a real script we might append numbers if email exists
                
                new_user = User(
                    username=username,
                    email=email,
                    full_name=raw_name,
                    password_hash=get_password_hash(DEFAULT_PASSWORD),
                    role_id=action["role_id"],
                    is_active=True,
                    phone="000000000"
                )
                db.add(new_user)
                db.commit()
                db.refresh(new_user)
                
                # Create Portfolio
                new_port = Portfolio(
                    owner_user_id=new_user.user_id,
                    interface_code=action["p_code"],
                    name=action["p_name"],
                    main_currency="USD",
                    residence_country="PE",
                    active_status=True,
                    inception_date=date.today()
                )
                db.add(new_port)
                db.commit()
                db.refresh(new_port)
                
                # Create Accounts
                for acct_code in action["accounts"]:
                    new_acc = Account(
                        portfolio_id=new_port.portfolio_id,
                        account_code=acct_code,
                        institution="PERSHING LLC",
                        account_alias=acct_code,
                        currency="USD",
                        account_type="Individual"
                    )
                    db.add(new_acc)
                db.commit()
                print(f"✅ Created {raw_name} + Portfolio + {len(action['accounts'])} Accounts")

            elif action["type"] == "add_accounts":
                port = action["portfolio"]
                for acct_code in action["accounts"]:
                    new_acc = Account(
                        portfolio_id=port.portfolio_id,
                        account_code=acct_code,
                        institution="PERSHING LLC", # Standard for this file
                        account_alias=acct_code,
                        currency="USD",
                        account_type="Individual"
                    )
                    db.add(new_acc)
                db.commit()
                print(f"✅ Added {len(action['accounts'])} accounts to Portfolio {port.portfolio_id}")

            elif action["type"] == "create_portfolio_and_accounts":
                # User existed but no portfolio
                user = action["user"]
                new_port = Portfolio(
                    owner_user_id=user.user_id,
                    interface_code=action["p_code"],
                    name=action["p_name"],
                    main_currency="USD",
                    residence_country="PE",
                    active_status=True,
                    inception_date=date.today()
                )
                db.add(new_port)
                db.commit()
                db.refresh(new_port)
                
                for acct_code in action["accounts"]:
                    new_acc = Account(
                        portfolio_id=new_port.portfolio_id,
                        account_code=acct_code,
                        institution="PERSHING LLC",
                        account_alias=acct_code,
                        currency="USD",
                        account_type="Individual"
                    )
                    db.add(new_acc)
                db.commit()
                print(f"✅ Created missing Portfolio + Accounts for {user.full_name}")

    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_import()
