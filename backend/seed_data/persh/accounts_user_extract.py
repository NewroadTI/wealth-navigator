import os
import glob
import csv

def extract_client_account_info():
    # Directory setup
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "transactions_csv")
    
    # Check if directory exists
    if not os.path.exists(data_dir):
        print(f"Directory not found: {data_dir}")
        return {}

    # Get all .csv files
    csv_files = glob.glob(os.path.join(data_dir, "*.csv"))
    
    if not csv_files:
        print(f"No CSV files found in {data_dir}")
        return {}
        
    extracted_data = {} # { "Client Name": { "accounts": set(), "files": [] } }

    for file_path in csv_files:
        file_name = os.path.basename(file_path)
        
        # Skip the general account file
        if file_name == "account_general.csv":
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                lines = [f.readline() for _ in range(5)]
                
                if len(lines) < 3:
                    continue
                
                # Extract Account
                account_line = lines[1]
                account_val = None
                if account_line.startswith("Account:"):
                    parts = account_line.split(',', 1)
                    if len(parts) > 0:
                        account_val = parts[0].replace("Account:", "").strip()
                
                # Extract Client
                client_line = lines[2]
                client_val = None
                if client_line.startswith("Client:"):
                    parts = client_line.split(',', 1)
                    if len(parts) > 0:
                        client_val = parts[0].replace("Client:", "").strip()
                
                if client_val and account_val:
                    if client_val not in extracted_data:
                        extracted_data[client_val] = {"accounts": set(), "files": []}
                    extracted_data[client_val]["accounts"].add(account_val)
                    extracted_data[client_val]["files"].append(file_name)
                
        except Exception as e:
            print(f"Error reading {file_name}: {e}")
            
    return extracted_data

if __name__ == "__main__":
    data = extract_client_account_info()
    print(f"{'FILE COUNT':<15} | {'ACCOUNT COUNT':<15} | {'CLIENT'}")
    print("-" * 100)
    for client, info in data.items():
        files_count = len(info['files'])
        accounts_count = len(info['accounts'])
        print(f"{files_count:<15} | {accounts_count:<15} | {client}")
