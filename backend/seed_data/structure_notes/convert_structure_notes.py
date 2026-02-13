import pandas as pd
import os

def convert_users_notes():
    input_file = 'backend/seed_data/structure_notes/all_notas.xlsx'
    output_file = 'backend/seed_data/structure_notes/all_notas.csv'

    # Read the 2nd sheet (index 1)
    print(f"Reading {input_file}...")
    df = pd.read_excel(input_file, sheet_name=1)

    # Drop the first column if it's named '#'
    if '#' in df.columns:
        print("Dropping column '#'...")
        df = df.drop(columns=['#'])
    elif df.columns[0] == '#':
        # specific fallback if name matches but maybe whitespace
        print("Dropping first column (matches '#')...")
        df = df.iloc[:, 1:]

    # Rename columns logic
    # We expect: Subyacentes, Unnamed, Unnamed -> Subyacentes, Subyacentes2, Subyacentes3
    # Same for Strike, Spot, Perf (%)
    
    new_columns = list(df.columns)
    
    # We need to iterate and fix specifically the ones mentioned.
    # The columns in the file are: ..., "Subyacentes", "Unnamed: 13", "Unnamed: 14", ...
    
    # Let's map the base headers to their indices to find where they start
    # We can't rely on fixed indices if the file changes, but we know they are sequential.
    
    targets = ["Subyacentes", "Strike", "Spot", "Perf (%)"]
    
    for i, col in enumerate(new_columns):
        if col in targets:
            # Check if next 2 are "Unnamed"
            if i + 1 < len(new_columns) and "Unnamed" in new_columns[i+1]:
                new_columns[i+1] = f"{col}2"
            if i + 2 < len(new_columns) and "Unnamed" in new_columns[i+2]:
                new_columns[i+2] = f"{col}3"
                
    df.columns = new_columns

    print(f"Saving to {output_file}...")
    df.to_csv(output_file, index=False)
    print("Done.")

if __name__ == "__main__":
    convert_users_notes()
