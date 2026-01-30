import csv
import re
import os

def extract_names():
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'transactions.csv')
    
    unique_names = set()
    
    if not os.path.exists(file_path):
        print(f"File {file_path} not found in current directory: {os.getcwd()}")
        return

    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            # The file has metadata in the first 8 lines. 
            # Line 9 contains the headers.
            # We'll read lines until we find the header starting with 'Process Date' or similar, 
            # or just skip fixed 8 lines if strictly formatted.
            # Based on view_file, headers are on line 9 (index 8).
            
            lines = f.readlines()
            
            # Find the header row index
            header_index = -1
            for i, line in enumerate(lines):
                if "Full Name" in line:
                    header_index = i
                    break
            
            if header_index == -1:
                print("Could not find 'Full Name' column in the file.")
                return

            # Parse CSV from the header row onwards
            # We treat the header row and subsequent rows as the CSV content
            csv_lines = lines[header_index:]
            reader = csv.DictReader(csv_lines)
            
            for row in reader:
                full_name_raw = row.get('Full Name', '')
                if not full_name_raw:
                    continue
                
                # Logic to extract the name:
                # 1. Check for wide whitespace (tab or >= 2 spaces).
                # 2. Take the first part.
                # 3. Validation: If the name contains digits (0-9), it likely contains address info 
                #    (e.g., "URB 123", "CALLE 4"). In that case, use the fallback of first 3 words.
                
                parts = re.split(r'\s{2,}', full_name_raw)
                
                candidate_name = ""
                if len(parts) > 0:
                    candidate_name = parts[0].strip()
                    
                # Heuristic: Check for digits in the extracted name
                has_digits = any(char.isdigit() for char in candidate_name)
                
                if has_digits:
                    # Likely address leakage or glued address
                    # Fallback: first 3 words as requested by user
                    words = candidate_name.split()
                    cleaned_name = " ".join(words[:3])
                else:
                    cleaned_name = candidate_name
                
                # Specific cleanup: remove surrounding quotes if present
                cleaned_name = cleaned_name.strip('"').strip()
                
                if cleaned_name:
                    unique_names.add(cleaned_name)

        # Output results
        print("-" * 30)
        print("Found Names:")
        print("-" * 30)
        for name in sorted(unique_names):
            print(name)
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    extract_names()
