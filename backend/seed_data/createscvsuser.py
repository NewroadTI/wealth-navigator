import csv
import os
import shutil
import re
import glob
from datetime import datetime  # <--- IMPORTANTE: Necesario para manejar fechas

# --- CONFIGURACIÓN ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALL_DATA_USERS_DIR = os.path.join(BASE_DIR, "inceptioncsvs", "all_data_users")
BASE_OUTPUT_DIR = os.path.join(BASE_DIR, "inceptioncsvs")

def sanitize_filename(name):
    """Limpia el nombre para que sea un archivo válido."""
    clean = re.sub(r'[^a-zA-Z0-9]', '_', name.strip())
    return re.sub(r'_+', '_', clean)

def extract_user_code_from_filename(filename):
    """
    Extrae el código de usuario del nombre del archivo.
    Busca patrones como U12345678 en el nombre del archivo.
    """
    match = re.search(r'U\d+', filename)
    return match.group(0) if match else "unknown_user"

def get_all_user_files():
    """
    Obtiene todos los archivos CSV del directorio all_data_users.
    """
    if not os.path.exists(ALL_DATA_USERS_DIR):
        print(f"❌ Error: No se encontró el directorio {ALL_DATA_USERS_DIR}")
        return []
    
    csv_files = glob.glob(os.path.join(ALL_DATA_USERS_DIR, "*.csv"))
    print(f"📂 Encontrados {len(csv_files)} archivos CSV para procesar")
    return csv_files

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

def get_account_code(source_path):
    """Busca el código de cuenta en la sección Introduction."""
    try:
        with open(source_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 4 and row[0].strip() == 'Introduction' and row[1].strip() == 'Data':
                    return row[3].strip() 
    except Exception as e:
        print(f"⚠️ No se pudo pre-leer el código de cuenta de {source_path}: {e}")
    return "unknown_account"

def get_report_date(source_path):
    """Busca la fecha 'As Of' y la convierte a YYYY-MM-DD."""
    try:
        with open(source_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f)
            for row in reader:
                # Busca: Projected Income, MetaInfo, As Of, [DATE]
                if len(row) >= 4 and row[0].strip() == 'Projected Income' and row[1].strip() == 'MetaInfo':
                    if "As Of" in row[2]:
                        raw_date = row[3].strip()
                        return parse_date_to_iso(raw_date) # <--- Aquí convertimos la fecha
    except Exception as e:
        print(f"⚠️ No se pudo pre-leer la fecha del reporte de {source_path}: {e}")
    return ""

def process_single_file(source_path):
    """
    Procesa un solo archivo CSV y genera los archivos divididos.
    """
    filename = os.path.basename(source_path)
    print(f"\n📂 Procesando archivo: {filename}")
    
    # Extraer código de usuario del nombre del archivo
    user_code_from_filename = extract_user_code_from_filename(filename)
    
    # Leer código de cuenta del archivo (como respaldo)
    user_code_from_content = get_account_code(source_path)
    report_date = get_report_date(source_path)
    
    # Priorizar el código del archivo sobre el del contenido
    user_code = user_code_from_filename if user_code_from_filename != "unknown_user" else user_code_from_content
    
    print(f"👤 Usuario detectado en archivo: {user_code_from_filename}")
    print(f"👤 Usuario detectado en contenido: {user_code_from_content}")
    print(f"👤 Usuario final: {user_code}")
    print(f"📅 Fecha de reporte (ISO): {report_date}")
    
    final_output_dir = os.path.join(BASE_OUTPUT_DIR, user_code)

    # Crear directorio de salida
    if os.path.exists(final_output_dir):
        shutil.rmtree(final_output_dir)
    os.makedirs(final_output_dir, exist_ok=True)
    print(f"📁 Directorio de salida: {final_output_dir}")

    section_counters = {} 
    current_file = None
    current_writer = None
    current_section_name = None
    
    try:
        with open(source_path, 'r', encoding='utf-8', errors='replace') as f_in:
            reader = csv.reader(f_in)
            
            rows_processed = 0
            files_created = 0
            
            for row in reader:
                if not row or len(row) < 2: 
                    continue
                
                section = row[0].strip()
                row_type = row[1].strip()
                content = row[2:]
                
                # Limpiar contenido vacío al final
                while content and not content[-1].strip():
                    content.pop()

                if row_type == 'Header':
                    # Cerrar archivo anterior si existe
                    if current_file:
                        current_file.close()
                    
                    # Crear nombre de archivo
                    count = section_counters.get(section, 0)
                    filename = f"{sanitize_filename(section)}_{count}.csv"
                    section_counters[section] = count + 1
                    
                    # Crear nuevo archivo
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

            # Cerrar último archivo
            if current_file:
                current_file.close()

        print(f"✅ Archivo procesado: {filename}")
        print(f"   - Filas procesadas: {rows_processed}")
        print(f"   - Archivos generados: {files_created}")
        print(f"   - Directorio: {final_output_dir}")
        
        return True
        
    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo {source_path}")
        return False
    except Exception as e:
        print(f"❌ Error inesperado procesando {source_path}: {e}")
        return False

def split_csv():
    """
    Función principal que procesa todos los archivos CSV en all_data_users.
    """
    print("🚀 Iniciando procesamiento masivo de archivos CSV...")
    
    # Obtener todos los archivos CSV
    csv_files = get_all_user_files()
    
    if not csv_files:
        print("❌ No se encontraron archivos CSV para procesar")
        return
    
    successful = 0
    failed = 0
    
    # Procesar cada archivo
    for i, file_path in enumerate(csv_files, 1):
        print(f"\n{'='*60}")
        print(f"📋 Procesando archivo {i}/{len(csv_files)}")
        print(f"{'='*60}")
        
        if process_single_file(file_path):
            successful += 1
        else:
            failed += 1
    
    # Resumen final
    print(f"\n{'='*60}")
    print(f"🎉 RESUMEN FINAL")
    print(f"{'='*60}")
    print(f"✅ Archivos procesados exitosamente: {successful}")
    print(f"❌ Archivos con errores: {failed}")
    print(f"📊 Total de archivos: {len(csv_files)}")
    print(f"📁 Directorios generados en: {BASE_OUTPUT_DIR}")
    
    if successful > 0:
        print("\n📂 Directorios de usuarios generados:")
        for user_dir in os.listdir(BASE_OUTPUT_DIR):
            user_path = os.path.join(BASE_OUTPUT_DIR, user_dir)
            if os.path.isdir(user_path) and user_dir.startswith('U'):
                file_count = len([f for f in os.listdir(user_path) if f.endswith('.csv')])
                print(f"   - {user_dir}: {file_count} archivos CSV")

if __name__ == "__main__":
    split_csv()