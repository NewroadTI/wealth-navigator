import sys
import os
import requests
import re
from typing import List, Dict, Optional, Set
import getpass
import json

# Add project root to path (for module imports if needed, though we primarily use API)
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Import the extraction logic
try:
    from accounts_user_extract import extract_client_account_info
except ImportError:
    # Handle case where we might be running from different cwd
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from accounts_user_extract import extract_client_account_info

# Configuration
API_URL = "http://localhost:8000/api/v1" # Running inside the container, this refers to the container itself
DEFAULT_EMAIL = "adminluis@newroadgi.com" 
DEFAULT_PASSWORD = "password123"

STOPWORDS = {"de", "del", "la", "las", "los", "y", "da", "di", "do", "dos", "das", "van", "von"}

def get_token():
    """Authenticate and get access token."""
    try:
        # The auth endpoint is mounted at /auth/login
        response = requests.post(f"{API_URL}/auth/login", data={
            "username": DEFAULT_EMAIL,
            "password": DEFAULT_PASSWORD
        })
        if response.status_code != 200:
            print(f"❌ Login failed: {response.text}")
            return None
        return response.json()["access_token"]
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return None

def get_auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

def normalize_name(name: str) -> set:
    """Convert name to lowercase set of alphanumeric tokens, removing stopwords."""
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
    tokens = set(clean.split())
    return {t for t in tokens if t not in STOPWORDS}

def fuzzy_match_user(existing_users: List[Dict], raw_name: str) -> Optional[Dict]:
    """Finds a user in the list that matches the raw_name using Jaccard Index."""
    if not raw_name:
        return None
        
    target_tokens = normalize_name(raw_name)
    if not target_tokens:
        return None

    best_match = None
    best_score = 0.0
    
    for user in existing_users:
        user_tokens = normalize_name(user.get("full_name") or "")
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
    print("🚀 Starting Pershing Clients Import V2 (API Based)")
    
    # 1. Get Token
    token = get_token()
    if not token:
        print("❌ Could not get authentication token. Aborting.")
        return
    
    headers = get_auth_headers(token)
    
    # 2. Extract Data from CSVs
    print("📂 Extracting data from CSV files...")
    client_data = extract_client_account_info()
    if not client_data:
        print("❌ No data extracted.")
        return
    print(f"✅ Extracted data for {len(client_data)} clients.")

    # 3. Fetch Existing API Data
    print("📡 Fetching existing data from API...")
    try:
        users = requests.get(f"{API_URL}/users/?limit=1000", headers=headers).json()
        portfolios = requests.get(f"{API_URL}/portfolios/?limit=1000", headers=headers).json()
        accounts = requests.get(f"{API_URL}/accounts/?limit=2000", headers=headers).json()
        roles = requests.get(f"{API_URL}/roles/", headers=headers).json() # Assuming role endpoint exists or we hardcode ID
        
        # Find Investor Role ID
        # Note: /roles endpoint might not exist, checking my assumptions. 
        # If roles endpoint doesn't exist, we might need to hardcode or infer. 
        # The user's previous script fetched role from DB. 
        # Let's assume for now we can filter users to find an investor and copy the role_id, or default to 3 (often investor).
        # Better: let's try to find it in the users list if any exist.
        investor_role_id = None
        for r in roles: # If roles endpoint exists and returns list
             if isinstance(r, dict) and r.get("name") == "INVESTOR":
                 investor_role_id = r.get("role_id")
                 break
        
        if not investor_role_id:
             print("⚠️  Warning: INVESTOR role not found via API. Defaulting to ID 3.")
             investor_role_id = 3

    except Exception as e:
        print(f"❌ Error fetching initial data: {e}")
        return

    # Map Portfolios by User ID for faster lookup
    portfolios_by_user = {} # user_id -> [portfolio]
    for p in portfolios:
        uid = p.get("owner_user_id")
        if uid not in portfolios_by_user:
            portfolios_by_user[uid] = []
        portfolios_by_user[uid].append(p)

    # Map Accounts by Portfolio ID
    accounts_by_portfolio = {} # portfolio_id -> {account_code}
    all_account_codes = set()
    for a in accounts:
        pid = a.get("portfolio_id")
        code = a.get("account_code")
        all_account_codes.add(code)
        if pid not in accounts_by_portfolio:
            accounts_by_portfolio[pid] = set()
        accounts_by_portfolio[pid].add(code)
        
    # Pre-calculate portfolio codes to detect collisions
    # This is tricky without DB access to ALL potential codes, but we can check against API list.
    existing_interface_codes = {p.get("interface_code") for p in portfolios}
    
    # 4. Planning
    print("\n" + "="*50)
    print("PLANNING PHASE")
    print("="*50)
    
    actions = []
    
    # Initialize set with ALL known codes to prevent collisions (Global + Local)
    # We will update this set as we plan new portfolios
    used_codes = {p.get("interface_code") for p in portfolios if p.get("interface_code")}
    
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
             user_id = match.get("user_id")
             user_ports = portfolios_by_user.get(user_id, [])
             if user_ports:
                 # Use existing portfolio code
                 final_p_code = user_ports[0].get("interface_code")
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
            print(f"🔹 MATCH: '{raw_name}' -> API User: '{match.get('full_name')}' (ID: {match.get('user_id')})")
            
            user_ports = portfolios_by_user.get(match.get("user_id"), [])
            
            target_portfolio = None
            if user_ports:
                target_portfolio = user_ports[0] # Assume primary portfolio
            
            if not target_portfolio:
                print(f"   ⚠️  User has no portfolio! Plan: CREATE Portfolio '{final_p_code}'.")
                p_name = f"{match.get('full_name')}'s Portfolio"
                actions.append({
                    "type": "create_portfolio_and_accounts",
                    "user_id": match.get("user_id"),
                    "p_name": p_name,
                    "p_code": final_p_code,
                    "accounts": extract_accounts
                })
            else:
                # Check Accounts
                pid = target_portfolio.get("portfolio_id")
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

    # 6. Execution
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
                
                tax_id = f"TAX-{username.upper()}"

                user_payload = {
                    "email": email,
                    "username": username,
                    "password": DEFAULT_PASSWORD,
                    "full_name": raw_name,
                    "role_id": action["role_id"],
                    "is_active": True,
                    "phone": f"+519{suffix}{suffix}", # Pseudo-unique phone
                    "tax_id": tax_id, 
                    "entity_type": "Individual"
                }
                
                # POST User
                res_user = requests.post(f"{API_URL}/users/", json=user_payload, headers=headers)
                if res_user.status_code != 201:
                    print(f"❌ Failed to create user {raw_name}: {res_user.text}")
                    continue
                
                new_user = res_user.json()
                user_id = new_user["user_id"]
                
                # POST Portfolio
                port_payload = {
                    "owner_user_id": user_id,
                    "interface_code": action["p_code"],
                    "name": action["p_name"],
                    "main_currency": "USD",
                    "residence_country": "PE",
                    "active_status": True,
                    "inception_date": "2024-01-01" # Default
                }
                res_port = requests.post(f"{API_URL}/portfolios/", json=port_payload, headers=headers)
                if res_port.status_code != 201:
                    print(f"❌ Failed to create portfolio for {raw_name}: {res_port.text}")
                    continue
                    
                new_port = res_port.json()
                pid = new_port["portfolio_id"]
                
                # POST Accounts
                for acct_code in action["accounts"]:
                    acc_payload = {
                        "portfolio_id": pid,
                        "account_code": acct_code,
                        "institution": "PERSHING LLC",
                        "account_alias": acct_code,
                        "currency": "USD",
                        "account_type": "Individual",
                        "investment_strategy_id": 1 # Default or None
                    }
                    res_acc = requests.post(f"{API_URL}/accounts/", json=acc_payload, headers=headers)
                    if res_acc.status_code != 201:
                         print(f"   ❌ Failed account {acct_code}: {res_acc.text}")
                    else:
                         print(f"   ✅ Created account {acct_code}")

                print(f"✅ Full setup complete for {raw_name}")

            elif action["type"] == "add_accounts":
                pid = action["portfolio_id"]
                for acct_code in action["accounts"]:
                    acc_payload = {
                        "portfolio_id": pid,
                        "account_code": acct_code,
                        "institution": "PERSHING LLC",
                        "account_alias": acct_code,
                        "currency": "USD",
                        "account_type": "Individual",
                        "investment_strategy_id": 1
                    }
                    res_acc = requests.post(f"{API_URL}/accounts/", json=acc_payload, headers=headers)
                    if res_acc.status_code != 201:
                         print(f"   ❌ Failed account {acct_code}: {res_acc.text}")
                    else:
                         print(f"   ✅ Created account {acct_code}")

            elif action["type"] == "create_portfolio_and_accounts":
                 user_id = action["user_id"]
                 # POST Portfolio
                 port_payload = {
                    "owner_user_id": user_id,
                    "interface_code": action["p_code"],
                    "name": action["p_name"],
                    "main_currency": "USD",
                    "residence_country": "PE",
                    "active_status": True,
                    "inception_date": "2024-01-01"
                }
                 res_port = requests.post(f"{API_URL}/portfolios/", json=port_payload, headers=headers)
                 if res_port.status_code != 201:
                    print(f"❌ Failed to create portfolio for user {user_id}: {res_port.text}")
                    continue
                
                 new_port = res_port.json()
                 pid = new_port["portfolio_id"]
                 
                 for acct_code in action["accounts"]:
                    acc_payload = {
                        "portfolio_id": pid,
                        "account_code": acct_code,
                        "institution": "PERSHING LLC",
                        "account_alias": acct_code,
                        "currency": "USD",
                        "account_type": "Individual",
                        "investment_strategy_id": 1
                    }
                    res_acc = requests.post(f"{API_URL}/accounts/", json=acc_payload, headers=headers)
                    if res_acc.status_code != 201:
                         print(f"   ❌ Failed account {acct_code}: {res_acc.text}")
                    else:
                         print(f"   ✅ Created account {acct_code}")
                 print(f"✅ Created Portfolio + Accounts for user {user_id}")

        except Exception as e:
            print(f"❌ Exception processing action: {e}")

if __name__ == "__main__":
    run_import()
