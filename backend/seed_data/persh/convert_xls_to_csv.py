import pandas as pd
import os
import glob

def convert_excel_to_csv():
    # Get the directory where the script is located
    directory = os.path.dirname(os.path.abspath(__file__))
    data_directory = os.path.join(directory, "data/all_transactions")
    output_directory = os.path.join(directory, "transactions_csv")
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)
        print(f"Created output directory: {output_directory}")
    
    # Find all .xls and .xlsx files in the data directory
    excel_files = glob.glob(os.path.join(data_directory, "*.xls*"))
    
    if not excel_files:
        print(f"No Excel files (.xls or .xlsx) found in {data_directory}.")
        return

    for file_path in excel_files:
        # Avoid converting the script itself or already converted csv files if named similarly
        if file_path.endswith('.csv'):
            continue
            
        file_name = os.path.basename(file_path)
        base_name = os.path.splitext(file_name)[0]
        output_file = os.path.join(output_directory, f"{base_name}.csv")
        
        print(f"Converting '{file_name}' to '{base_name}.csv'...")
        
        try:
            # Read Excel file
            # engine='openpyxl' is for .xlsx, engine='xlrd' is for .xls
            # pandas handles this automatically in newer versions if dependencies are installed
            df = pd.read_excel(file_path)
            
            # Save as CSV
            df.to_csv(output_file, index=False)
            print(f"Successfully converted: {output_file}")
        except Exception as e:
            print(f"Error converting {file_name}: {e}")

if __name__ == "__main__":
    convert_excel_to_csv()
