"""
Script to extract all unique operation types from inviu_fulldata.csv
This helps understand the mapping to DB tables.
"""
import os
import csv
from collections import Counter

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'inviu_fulldata.csv')

def extract_types():
    if not os.path.exists(DATA_FILE):
        print(f"ERROR: File not found: {DATA_FILE}")
        return
    
    operation_types = Counter()
    activity_types = Counter()
    
    with open(DATA_FILE, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            # Column: "Operación"
            op = row.get("Operación", "").strip()
            if op:
                operation_types[op] += 1
            
            # Column: "Tipo de actividad"
            act_type = row.get("Tipo de actividad", "").strip()
            if act_type:
                activity_types[act_type] += 1
    
    print("=" * 60)
    print("OPERACIÓN (Operation Column)")
    print("=" * 60)
    for op, count in operation_types.most_common():
        print(f"  {op}: {count}")
    
    print("\n" + "=" * 60)
    print("TIPO DE ACTIVIDAD (Activity Type Column)")
    print("=" * 60)
    for act, count in activity_types.most_common():
        print(f"  {act}: {count}")

if __name__ == "__main__":
    extract_types()
