import pandas as pd
import os
import glob

# Define file paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(BASE_DIR, 'inviu_csv')

# Identify files
inviu_file = glob.glob(os.path.join(CSV_DIR, "inviu-tenencias-*.csv"))[0]
positions_files = glob.glob(os.path.join(CSV_DIR, "Positions_NVI_NVI_159 (*).csv"))

# Read Inviu file
print(f"Reading Inviu file: {os.path.basename(inviu_file)}")
df_inviu = pd.read_csv(inviu_file)

# Read Positions files and concatenate
dfs_positions = []
found_equities = False
found_mutual = False
found_fixed = False

for p_file in positions_files:
    # Check header to identify type (just for logging/verification)
    with open(p_file, 'r') as f:
        lines = [f.readline() for _ in range(5)]
    
    file_type = "Unknown"
    if len(lines) >= 3:
        if "Filter By: Equities" in lines[2]:
            file_type = "Equities"
            found_equities = True
        elif "Filter By: Mutual Funds" in lines[2]:
            file_type = "Mutual Funds"
            found_mutual = True
        elif "Filter By: Fixed Income Securities" in lines[2]:
            file_type = "Fixed Income"
            found_fixed = True
            
    print(f"Reading {file_type} file: {os.path.basename(p_file)}")
    # Read skipping first 7 rows, so header is row 8 (index 7)
    df = pd.read_csv(p_file, skiprows=7)
    
    # Clean empty rows and footer garbage
    # Footer rows often have text in the first column (Symbol) like "Disclaimer" but NaN in others.
    # We insist on 'Security Description' being present.
    df = df.dropna(subset=['Symbol', 'Security Description'])
    
    # Extra safety: Exclude rows where Symbol is clearly footer text
    # (Though dropna on Security Description likely covers this if those cols are empty in footer)
    df = df[~df['Symbol'].astype(str).str.contains('Disclaimer|Disclosures|Positions are priced|This information', case=False, na=False)]
    
    dfs_positions.append(df)

df_alldata = pd.concat(dfs_positions, ignore_index=True)
print(f"Total rows in alldata: {len(df_alldata)}")



# Pre-processing for matching
# Ensure columns are string for matching
# UPPERCASE symbols for robust matching
df_inviu['Instrumento'] = df_inviu['Instrumento'].astype(str).str.strip().str.upper()
df_alldata['Symbol'] = df_alldata['Symbol'].astype(str).str.strip().str.upper()

# Clean 'Nombre' for Inviu (remove trailing (*))
# "N/c  (*)" -> "N/c"
def clean_nombre(val):
    if not isinstance(val, str):
        return str(val)
    val = val.strip()
    if val.endswith("(*)"):
        val = val[:-3].strip() # Remove (*) and strip again
    # Normalize whitespace: replace multiple spaces with single space
    val = " ".join(val.split())
    return str(val)


# Clean and Uppercase for name matching
df_inviu['Nombre_Clean'] = df_inviu['Nombre'].apply(clean_nombre).str.upper()
df_alldata['Security Description'] = df_alldata['Security Description'].astype(str).str.strip().str.upper().apply(lambda x: " ".join(str(x).split()) if pd.notnull(x) else "")

# --- Match 1: Symbol ---
print("\n" + "="*80)
print("MATCH 1: By Instrumento == Symbol")
print("="*80)

# Merge
merged_symbol = pd.merge(
    df_inviu, 
    df_alldata, 
    left_on='Instrumento', 
    right_on='Symbol', 
    how='left', 
    indicator=True
)

match_symbol = merged_symbol[merged_symbol['_merge'] == 'both'].copy()
remaining_inviu = merged_symbol[merged_symbol['_merge'] == 'left_only'].copy()

# Select columns for Match Symbol
cols_map_symbol = {
    'Instrumento': 'Instrumento (Inviu)',
    'Symbol': 'Symbol (Alldata)',
    'Nombre': 'Nombre',
    'Security Description': 'Security Description (Alldata)',
    'ISIN': 'ISIN', 
    'CUSIP': 'CUSIP',
    'Sedol': 'Sedol',
    'Cuenta': 'Cuenta',  # Added account
    'Monto total': 'Monto Total',
    'Cantidad': 'Cantidad (Inviu)',
    'Moneda': 'Moneda (Inviu)',
    'Market Value': 'Market Value',
    'Settlement Date Quantity': 'Quantity (Alldata)', 
    'Last $': 'Last $',
    'Price Date': 'Price Date'
}

# Output columns list
output_cols = [
    'Instrumento', 'Symbol', 'Nombre', 'Security Description', 
    'ISIN', 'CUSIP', 'Sedol', 'Cuenta',
    'Monto total', 'Cantidad', 'Moneda', 
    'Market Value', 'Settlement Date Quantity', 'Last $', 'Price Date'
]

# Ensure columns exist before selecting
available_cols = [c for c in output_cols if c in match_symbol.columns]
match_symbol_out = match_symbol[available_cols].rename(columns=cols_map_symbol)

print(f"Total Matches: {len(match_symbol_out)}")

# Columns to show in print (limited to ~7 as requested)
print_cols = [
    'Instrumento (Inviu)', 'Symbol (Alldata)', 'Nombre', 'ISIN', 
    'Monto Total', 'Cantidad (Inviu)', 'Market Value'
]
print_cols_avail = [c for c in print_cols if c in match_symbol_out.columns]

if not match_symbol_out.empty:
    print(match_symbol_out[print_cols_avail].to_string())
else:
    print("No matches found.")

# --- Match 2: Name ---
print("\n" + "="*80)
print("MATCH 2: By Cleaned Nombre == Security Description")
print("="*80)

# Recover the original structure for remaining items (drop merge columns)
# Drop _merge column
remaining_inviu = remaining_inviu.drop(columns=['_merge'])
# Also drop alldata columns that were added as NaN
alldata_cols = [c for c in df_alldata.columns if c in remaining_inviu.columns]
remaining_inviu = remaining_inviu.drop(columns=alldata_cols, errors='ignore')

merged_name = pd.merge(
    remaining_inviu,
    df_alldata,
    left_on='Nombre_Clean',
    right_on='Security Description',
    how='left',
    indicator=True
)

match_name = merged_name[merged_name['_merge'] == 'both'].copy()
final_remaining = merged_name[merged_name['_merge'] == 'left_only'].copy()

available_cols_name = [c for c in output_cols if c in match_name.columns]
match_name_out = match_name[available_cols_name].rename(columns=cols_map_symbol)

print(f"Total Matches: {len(match_name_out)}")

print_cols_avail_name = [c for c in print_cols if c in match_name_out.columns]

if not match_name_out.empty:
    print(match_name_out[print_cols_avail_name].to_string())
else:
    print("No matches found.")


# --- Extract USD ---
print("\n" + "="*80)
print("EXTRACT USD: From remaining Inviu items where Instrumento == 'USD'")
print("="*80)

# Filter final_remaining for USD
usd_items = final_remaining[final_remaining['Instrumento'] == 'USD'].copy()

# Output only specific columns for USD
usd_cols = ['Instrumento', 'Nombre', 'Monto total', 'Cantidad', 'Cuenta']
usd_items_out = usd_items[usd_cols]

print(f"Total USD Items: {len(usd_items_out)}")
if not usd_items_out.empty:
    print(usd_items_out.to_string())
else:
    print("No USD items found.")

# --- Remaining (Excluding USD) ---
print("\n" + "="*80)
print("UNMATCHED ITEMS (Excluding USD)")
print("="*80)

final_remaining_no_usd = final_remaining[final_remaining['Instrumento'] != 'USD'].copy()
final_remaining_out = final_remaining_no_usd[df_inviu.columns.drop('Nombre_Clean')].copy()
print(f"Total Unmatched (excluding USD): {len(final_remaining_out)}")
# Only print a subset of columns for readability
unmatched_print_cols = ['Instrumento', 'Nombre', 'Monto total', 'Cantidad', 'Cuenta']
if not final_remaining_out.empty:
    print(final_remaining_out[unmatched_print_cols].to_string())
else:
    print("No unmatched items.")
