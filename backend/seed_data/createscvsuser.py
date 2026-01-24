import csv
import os
import shutil
import re
from datetime import datetime  # <--- IMPORTANTE: Necesario para manejar fechas

# --- CONFIGURACIÓN ---
SOURCE_FILENAME = "user2.csv"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_PATH = os.path.join(BASE_DIR, SOURCE_FILENAME)

if not os.path.exists(SOURCE_PATH):
    SOURCE_PATH = os.path.join("/app", SOURCE_FILENAME)

BASE_OUTPUT_DIR = os.path.join(BASE_DIR, "inceptioncsvs")

def sanitize_filename(name):
    """Limpia el nombre para que sea un archivo válido."""
    clean = re.sub(r'[^a-zA-Z0-9]', '_', name.strip())
    return re.sub(r'_+', '_', clean)

def parse_date_to_iso(date_str):
    """
    Convierte 'January 21, 2026' a '2026-01-21'.
    Si falla, devuelve el string original.
    """
    try:
        # %B = Nombre completo del mes (January)
        # %d = Día del mes (21)
        # %Y = Año con siglo (2026)
        dt_obj = datetime.strptime(date_str.strip(), "%B %d, %Y")
        return dt_obj.strftime("%Y-%m-%d")
    except ValueError:
        print(f"⚠️ No se pudo parsear la fecha: '{date_str}', se usará tal cual.")
        return date_str

def get_account_code():
    """Busca el código de cuenta en la sección Introduction."""
    try:
        with open(SOURCE_PATH, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 4 and row[0].strip() == 'Introduction' and row[1].strip() == 'Data':
                    return row[3].strip() 
    except Exception as e:
        print(f"⚠️ No se pudo pre-leer el código de cuenta: {e}")
    return "unknown_account"

def get_report_date():
    """Busca la fecha 'As Of' y la convierte a YYYY-MM-DD."""
    try:
        with open(SOURCE_PATH, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            for row in reader:
                # Busca: Projected Income, MetaInfo, As Of, [DATE]
                if len(row) >= 4 and row[0].strip() == 'Projected Income' and row[1].strip() == 'MetaInfo':
                    if "As Of" in row[2]:
                        raw_date = row[3].strip()
                        return parse_date_to_iso(raw_date) # <--- Aquí convertimos la fecha
    except Exception as e:
        print(f"⚠️ No se pudo pre-leer la fecha del reporte: {e}")
    return ""

def split_csv():
    print(f"📂 Leyendo archivo maestro: {SOURCE_PATH}")
    
    user_code = get_account_code()
    report_date = get_report_date() # Ahora esto ya trae "2026-01-21"
    
    print(f"👤 Usuario detectado: {user_code}")
    print(f"📅 Fecha de reporte (ISO): {report_date}")
    
    final_output_dir = os.path.join(BASE_OUTPUT_DIR, user_code)

    if os.path.exists(final_output_dir):
        shutil.rmtree(final_output_dir)
    os.makedirs(final_output_dir, exist_ok=True)
    print(f"📁 Directorio de salida: {final_output_dir}")

    section_counters = {} 
    current_file = None
    current_writer = None
    current_section_name = None
    
    try:
        with open(SOURCE_PATH, 'r', encoding='utf-8', errors='replace') as f_in:
            reader = csv.reader(f_in)
            
            rows_processed = 0
            files_created = 0
            
            for row in reader:
                if not row or len(row) < 2: continue
                
                section = row[0].strip()
                row_type = row[1].strip()
                content = row[2:]
                
                while content and not content[-1].strip():
                    content.pop()

                if row_type == 'Header':
                    if current_file:
                        current_file.close()
                    
                    count = section_counters.get(section, 0)
                    filename = f"{sanitize_filename(section)}_{count}.csv"
                    section_counters[section] = count + 1
                    
                    filepath = os.path.join(final_output_dir, filename)
                    current_file = open(filepath, 'w', newline='', encoding='utf-8')
                    current_writer = csv.writer(current_file)
                    
                    # INYECCIÓN HEADER
                    if section == 'Projected Income':
                        content.append("reportdate")
                    
                    current_writer.writerow(content)
                    current_section_name = section
                    files_created += 1

                elif row_type == 'Data' and current_writer:
                    if section == current_section_name:
                        # INYECCIÓN DATA
                        if section == 'Projected Income':
                            content.append(report_date)
                        
                        current_writer.writerow(content)
                
                rows_processed += 1

            if current_file:
                current_file.close()

        print(f"✅ Proceso terminado.")
        print(f"   - Archivos generados en: {final_output_dir}")
        
    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo {SOURCE_PATH}")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")

if __name__ == "__main__":
    split_csv()