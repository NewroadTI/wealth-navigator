import sys
import os
import re
from typing import List, Dict, Optional, Set
import json
from datetime import datetime

# --- Path setup (same pattern as import_from_splits_v.py) ---
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.append(".")

# --- DB and Model imports ---
try:
    from app.db.session import SessionLocal
    from app.models.user import User, Role
    from app.models.portfolio import Portfolio, Account
    from app.core.security import get_password_hash
except ImportError:
    print("⚠️ Error importando modelos. Ejecuta desde la raíz del proyecto (dentro del contenedor).")
    sys.exit(1)

# Import the extraction logic
try:
    from accounts_user_extract import extract_client_account_info
except ImportError:
    # Handle case where we might be running from different cwd
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from accounts_user_extract import extract_client_account_info

# Configuration
DEFAULT_PASSWORD = "password123"

STOPWORDS = {"de", "del", "la", "las", "los", "y", "da", "di", "do", "dos", "das", "van", "von"}

def normalize_name(name: str) -> set:
    """Convert name to lowercase set of alphanumeric tokens, removing stopwords."""
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
    tokens = set(clean.split())
    return {t for t in tokens if t not in STOPWORDS}

def fuzzy_match_user(existing_users: List, raw_name: str):
    """Finds a user in the list that matches the raw_name using Jaccard Index.
    Now works with SQLAlchemy User objects instead of dicts."""
    if not raw_name:
        return None
        
    target_tokens = normalize_name(raw_name)
    if not target_tokens:
        return None

    best_match = None
    best_score = 0.0
    
    for user in existing_users:
        user_tokens = normalize_name(user.full_name or "")
        if not user_tokens:
            continue
            
        intersection = target_tokens.intersection(user_tokens)
        union = target_tokens.union(user_tokens)
        
        if not union:
            continue
            
        jaccard_index = len(intersection) / len(union)
        
        # Threshold: 0.65
        if jaccard_index > 0.65:
            if jaccard_index > best_score:
                best_score = jaccard_index
                best_match = user

    return best_match

def generate_interface_code(name: str) -> str:
    """Generates interface code based on rules."""
    clean_name = name.replace(',', '')
    tokens = re.findall(r'\w+', clean_name)
    
    if not tokens:
        return f"PORT_{clean_name[:10]}".upper()
    
    first = tokens[0]
    
    if len(tokens) == 1:
        return f"PORT_{first}".upper()
    
    second = tokens[1]
    
    if len(first) <= 3:
        return f"PORT_{first}{second}".upper()
    else:
        return f"PORT_{first}{second[0]}".upper()

def run_import():
    print("🚀 Starting Pershing Clients Import V2 (DB Direct)")
    
    # 1. Open DB Session
    db = SessionLocal()
    
    try:
        # 2. Extract Data from CSVs
        print("📂 Extracting data from CSV files...")
        client_data = extract_client_account_info()
        if not client_data:
            print("❌ No data extracted.")
            return
        print(f"✅ Extracted data for {len(client_data)} clients.")

        # 3. Fetch Existing DB Data
        print("📡 Fetching existing data from database...")
        try:
            users = db.query(User).all()
            portfolios = db.query(Portfolio).all()
            accounts = db.query(Account).all()
            
            # Find Investor Role ID
            investor_role = db.query(Role).filter(Role.name == "INVESTOR").first()
            investor_role_id = investor_role.role_id if investor_role else None
            
            if not investor_role_id:
                 print("⚠️  Warning: INVESTOR role not found in DB. Defaulting to ID 3.")
                 investor_role_id = 3

        except Exception as e:
            print(f"❌ Error fetching initial data: {e}")
            return

        # Map Portfolios by User ID for faster lookup
        portfolios_by_user = {} # user_id -> [portfolio]
        for p in portfolios:
            uid = p.owner_user_id
            if uid not in portfolios_by_user:
                portfolios_by_user[uid] = []
            portfolios_by_user[uid].append(p)

        # Map Accounts by Portfolio ID
        accounts_by_portfolio = {} # portfolio_id -> {account_code}
        all_account_codes = set()
        for a in accounts:
            pid = a.portfolio_id
            code = a.account_code
            all_account_codes.add(code)
            if pid not in accounts_by_portfolio:
                accounts_by_portfolio[pid] = set()
            accounts_by_portfolio[pid].add(code)
            
        # Pre-calculate portfolio codes to detect collisions
        existing_interface_codes = {p.interface_code for p in portfolios}
        
        # 4. Planning
        print("\n" + "="*50)
        print("PLANNING PHASE")
        print("="*50)
        
        actions = []
        
        # Initialize set with ALL known codes to prevent collisions (Global + Local)
        # We will update this set as we plan new portfolios
        used_codes = {p.interface_code for p in portfolios if p.interface_code}
        
        # Helper to generate candidates
        def get_code_candidates(raw_name: str) -> List[str]:
            clean_name = raw_name.replace(',', '').upper()
            tokens = re.findall(r'\w+', clean_name)
            
            candidates = []
            if not tokens:
                candidates.append(f"PORT_{clean_name[:10]}")
                return candidates
                
            first = tokens[0]
            second = tokens[1] if len(tokens) > 1 else ""
            third = tokens[2] if len(tokens) > 2 else ""
            
            # 1. Base Strategy: PORT_{First}{SecondInitial} (or {SecondFull} if First <= 3)
            if len(first) <= 3 and second:
                base = f"PORT_{first}{second}"
            elif second:
                base = f"PORT_{first}{second[0]}"
            else:
                base = f"PORT_{first}"
            candidates.append(base)
            
            # 2. Strategy: PORT_{First}{SecondFull} (if different)
            if second:
                cand = f"PORT_{first}{second}"
                if cand not in candidates:
                    candidates.append(cand)
                    
            # 3. Strategy: PORT_{First}{SecondFull}{ThirdInitial}
            if second and third:
                cand = f"PORT_{first}{second}{third[0]}"
                if cand not in candidates:
                    candidates.append(cand)
            
            # 4. Strategy: PORT_{First}{SecondFull}{ThirdFull}
            if second and third:
                cand = f"PORT_{first}{second}{third}"
                if cand not in candidates:
                    candidates.append(cand)
                    
            # 5. Fallback: Append Random Suffix
            import random
            candidates.append(f"{base}{random.randint(10,99)}")
            
            return candidates

        for raw_name, info in client_data.items():
            extract_accounts = info["accounts"]
            
            match = fuzzy_match_user(users, raw_name)
            
            # Determine strict Portfolio Code
            if match:
                 # User exists, try to find THEIR existing portfolio code
                 user_id = match.user_id
                 user_ports = portfolios_by_user.get(user_id, [])
                 if user_ports:
                     # Use existing portfolio code
                     final_p_code = user_ports[0].interface_code
                 else:
                     # Need to create one, must be unique
                     candidates = get_code_candidates(raw_name)
                     final_p_code = None
                     for cand in candidates:
                         if cand not in used_codes:
                             final_p_code = cand
                             break
                     if not final_p_code:
                          final_p_code = f"{candidates[0]}_NEW" # Desperate fallback
                     
                     used_codes.add(final_p_code) # Mark as used
            else:
                 # New User, new portfolio
                 candidates = get_code_candidates(raw_name)
                 final_p_code = None
                 for cand in candidates:
                     if cand not in used_codes:
                         final_p_code = cand
                         break
                 if not final_p_code:
                      final_p_code = f"{candidates[0]}_NEW"
                 
                 used_codes.add(final_p_code)

            if match:
                # User Exists
                print(f"🔹 MATCH: '{raw_name}' -> DB User: '{match.full_name}' (ID: {match.user_id})")
                
                user_ports = portfolios_by_user.get(match.user_id, [])
                
                target_portfolio = None
                if user_ports:
                    target_portfolio = user_ports[0] # Assume primary portfolio
                
                if not target_portfolio:
                    print(f"   ⚠️  User has no portfolio! Plan: CREATE Portfolio '{final_p_code}'.")
                    p_name = f"{match.full_name}'s Portfolio"
                    actions.append({
                        "type": "create_portfolio_and_accounts",
                        "user_id": match.user_id,
                        "p_name": p_name,
                        "p_code": final_p_code,
                        "accounts": extract_accounts
                    })
                else:
                    # Check Accounts
                    pid = target_portfolio.portfolio_id
                    existing_accs = accounts_by_portfolio.get(pid, set())
                    
                    missing = [a for a in extract_accounts if a not in existing_accs]
                    
                    if missing:
                        print(f"   found {len(missing)} new accounts for Portfolio {pid}.")
                        actions.append({
                            "type": "add_accounts",
                            "portfolio_id": pid,
                            "accounts": missing
                        })
                    else:
                        print("   ✅ All accounts exist.")
            
            else:
                # New User
                print(f"🆕 NEW USER: '{raw_name}'")
                
                clean_name_for_port = raw_name.replace(',', '')
                tokens = clean_name_for_port.split()
                if len(tokens) >= 2:
                    p_base_name = f"{tokens[0]} {tokens[1]}"
                else:
                    p_base_name = clean_name_for_port
                
                p_name = f"{p_base_name}'s Portfolio"
                
                print(f"   Plan: Create User -> Port '{p_name}' ({final_p_code}) -> {len(extract_accounts)} Accounts")
                
                actions.append({
                    "type": "create_everything",
                    "raw_name": raw_name,
                    "p_name": p_name,
                    "p_code": final_p_code,
                    "accounts": extract_accounts,
                    "role_id": investor_role_id
                })

        # 5. Confirmation
        if not actions:
            print("\n✅ Nothing to do.")
            return

        print("\n" + "-"*50)
        print(f"Summary: {len(actions)} main actions pending.")
        confirm = input("Type 'yes' to execute changes: ")
        
        if confirm.lower() != 'yes':
            print("Cancelled.")
            return

        # 6. Execution (Direct DB)
        print("\n🚀 EXECUTING...")
        
        for action in actions:
            try:
                if action["type"] == "create_everything":
                    # User Creation Logic
                    raw_name = action["raw_name"]
                    
                    # Username generation (robust)
                    base_username = re.sub(r'[^a-z0-9]', '', raw_name.lower())[:15]
                    # Add random suffix to ensure uniqueness
                    import random
                    suffix = random.randint(1000, 9999)
                    username = f"{base_username}{suffix}"
                    email = f"{username}@example.com" 
                    
                    # Check uniqueness
                    while db.query(User).filter(User.username == username).first():
                        suffix = random.randint(1000, 9999)
                        username = f"{base_username}{suffix}"
                        email = f"{username}@example.com"
                    
                    while db.query(User).filter(User.email == email).first():
                        suffix = random.randint(1000, 9999)
                        email = f"{base_username}{suffix}@example.com"
                    
                    tax_id = f"TAX-{username.upper()}"

                    # Create User directly in DB
                    new_user = User(
                        email=email,
                        username=username,
                        password_hash=get_password_hash(DEFAULT_PASSWORD),
                        full_name=raw_name,
                        role_id=action["role_id"],
                        is_active=True,
                        phone=f"+519{suffix}{suffix}",
                        tax_id=tax_id,
                        entity_type="INDIVIDUAL"
                    )
                    db.add(new_user)
                    db.commit()
                    db.refresh(new_user)
                    user_id = new_user.user_id
                    print(f"   ✅ Created user '{raw_name}' (ID: {user_id})")
                    
                    # Create Portfolio directly in DB
                    new_port = Portfolio(
                        owner_user_id=user_id,
                        interface_code=action["p_code"],
                        name=action["p_name"],
                        main_currency="USD",
                        residence_country="PE",
                        active_status=True,
                        inception_date=datetime(2024, 1, 1).date()
                    )
                    db.add(new_port)
                    db.commit()
                    db.refresh(new_port)
                    pid = new_port.portfolio_id
                    print(f"   ✅ Created portfolio '{action['p_name']}' (ID: {pid})")
                    
                    # Create Accounts directly in DB
                    for acct_code in action["accounts"]:
                        # Check if account already exists
                        existing = db.query(Account).filter(Account.account_code == acct_code).first()
                        if existing:
                            print(f"   ⚠️  Account {acct_code} already exists, skipping.")
                            continue
                            
                        new_acc = Account(
                            portfolio_id=pid,
                            account_code=acct_code,
                            institution="PERSHING LLC",
                            account_alias=acct_code,
                            currency="USD",
                            account_type="Individual"
                        )
                        db.add(new_acc)
                        try:
                            db.commit()
                            print(f"   ✅ Created account {acct_code}")
                        except Exception as e:
                            db.rollback()
                            print(f"   ❌ Failed account {acct_code}: {e}")

                    print(f"✅ Full setup complete for {raw_name}")

                elif action["type"] == "add_accounts":
                    pid = action["portfolio_id"]
                    for acct_code in action["accounts"]:
                        existing = db.query(Account).filter(Account.account_code == acct_code).first()
                        if existing:
                            print(f"   ⚠️  Account {acct_code} already exists, skipping.")
                            continue
                            
                        new_acc = Account(
                            portfolio_id=pid,
                            account_code=acct_code,
                            institution="PERSHING LLC",
                            account_alias=acct_code,
                            currency="USD",
                            account_type="Individual"
                        )
                        db.add(new_acc)
                        try:
                            db.commit()
                            print(f"   ✅ Created account {acct_code}")
                        except Exception as e:
                            db.rollback()
                            print(f"   ❌ Failed account {acct_code}: {e}")

                elif action["type"] == "create_portfolio_and_accounts":
                     user_id = action["user_id"]
                     # Create Portfolio
                     new_port = Portfolio(
                        owner_user_id=user_id,
                        interface_code=action["p_code"],
                        name=action["p_name"],
                        main_currency="USD",
                        residence_country="PE",
                        active_status=True,
                        inception_date=datetime(2024, 1, 1).date()
                    )
                     db.add(new_port)
                     db.commit()
                     db.refresh(new_port)
                     pid = new_port.portfolio_id
                     print(f"   ✅ Created portfolio '{action['p_name']}' (ID: {pid})")
                     
                     for acct_code in action["accounts"]:
                        existing = db.query(Account).filter(Account.account_code == acct_code).first()
                        if existing:
                            print(f"   ⚠️  Account {acct_code} already exists, skipping.")
                            continue
                            
                        new_acc = Account(
                            portfolio_id=pid,
                            account_code=acct_code,
                            institution="PERSHING LLC",
                            account_alias=acct_code,
                            currency="USD",
                            account_type="Individual"
                        )
                        db.add(new_acc)
                        try:
                            db.commit()
                            print(f"   ✅ Created account {acct_code}")
                        except Exception as e:
                            db.rollback()
                            print(f"   ❌ Failed account {acct_code}: {e}")
                     print(f"✅ Created Portfolio + Accounts for user {user_id}")

            except Exception as e:
                db.rollback()
                print(f"❌ Exception processing action: {e}")

    finally:
        db.close()
        print("\n🔒 Database session closed.")

if __name__ == "__main__":
    run_import()
