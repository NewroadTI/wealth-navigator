import csv
import os
import shutil
import re

# --- CONFIGURACIÓN ---
SOURCE_FILENAME = "userhistory.csv"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_PATH = os.path.join(BASE_DIR, SOURCE_FILENAME)

# Si no está en seed_data, buscar en root
if not os.path.exists(SOURCE_PATH):
    SOURCE_PATH = os.path.join("/app", SOURCE_FILENAME)

OUTPUT_DIR = os.path.join(BASE_DIR, "inceptioncsvs")

def sanitize_filename(name):
    """Limpia el nombre para que sea un archivo válido."""
    # Reemplazar espacios y caracteres raros por guiones bajos
    clean = re.sub(r'[^a-zA-Z0-9]', '_', name.strip())
    # Eliminar guiones bajos duplicados
    return re.sub(r'_+', '_', clean)

def split_csv():
    print(f"📂 Leyendo archivo maestro: {SOURCE_PATH}")
    
    # 1. Preparar directorio de salida (Limpiar si existe)
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR)
    print(f"📁 Directorio creado: {OUTPUT_DIR}")

    # Contadores para manejar secciones con múltiples tablas (ej: Historical Performance)
    section_counters = {} 
    
    current_file = None
    current_writer = None
    current_section_name = None
    
    # Abrimos el archivo original
    try:
        with open(SOURCE_PATH, 'r', encoding='utf-8', errors='replace') as f_in:
            reader = csv.reader(f_in)
            
            rows_processed = 0
            files_created = 0
            
            for row in reader:
                if not row or len(row) < 2: continue
                
                section = row[0].strip()
                row_type = row[1].strip()
                
                # Los datos reales suelen empezar en la columna 2 (index 2)
                # Introduction, Header, Name, Account... -> Datos son [Name, Account...]
                content = row[2:]
                
                # Limpiar columnas vacías al final de la fila
                # (Iteramos al revés para quitar vacíos del final)
                while content and not content[-1].strip():
                    content.pop()

                # --- DETECTAR NUEVA TABLA ---
                # Una nueva tabla empieza si encontramos un "Header"
                if row_type == 'Header':
                    # Cerrar archivo anterior si existe
                    if current_file:
                        current_file.close()
                    
                    # Calcular nombre del nuevo archivo
                    # Si la sección se repite (como Historical Performance), incrementamos contador
                    count = section_counters.get(section, 0)
                    if section != current_section_name:
                         # Si cambiamos de sección totalmente, resetear o mantener lógica
                         # Pero como Historical Performance aparece en bloques contiguos, el contador sirve.
                         pass
                    
                    filename = f"{sanitize_filename(section)}_{count}.csv"
                    section_counters[section] = count + 1
                    
                    filepath = os.path.join(OUTPUT_DIR, filename)
                    
                    # Abrir nuevo archivo
                    current_file = open(filepath, 'w', newline='', encoding='utf-8')
                    current_writer = csv.writer(current_file)
                    
                    # Escribir encabezado
                    current_writer.writerow(content)
                    
                    current_section_name = section
                    files_created += 1
                    # print(f"   -> Creando: {filename}")

                # --- ESCRIBIR DATOS ---
                elif row_type == 'Data' and current_writer:
                    # Solo escribir si pertenece a la sección activa
                    if section == current_section_name:
                        current_writer.writerow(content)
                
                rows_processed += 1

            # Cerrar el último archivo
            if current_file:
                current_file.close()

        print(f"✅ Proceso terminado.")
        print(f"   - Filas procesadas: {rows_processed}")
        print(f"   - Archivos generados: {files_created}")
        print(f"   - Ubicación: {OUTPUT_DIR}")
        
        # Listar archivos generados para confirmar
        print("\nArchivos Generados:")
        for f in sorted(os.listdir(OUTPUT_DIR)):
            print(f" - {f}")

    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo {SOURCE_PATH}")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")

if __name__ == "__main__":
    split_csv()