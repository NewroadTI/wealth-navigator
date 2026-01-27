import logging
import os
import sys
import runpy

# Configuración básica de logs para ver qué está pasando
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    # 1. Definir la ruta donde están tus scripts de seed
    # Asumimos que están en app/db/seeds. Si están en otro lado, ajusta esta ruta.
    base_dir = os.path.dirname(os.path.abspath(__file__)) # Directorio actual (/app)
    seeds_dir = os.path.join(base_dir, "")

    # 2. Lista ordenada de scripts a ejecutar
    scripts_to_run = [
        "update_schema.py",
        "countries_data.py",
        "currencies_data.py",
        "seed_asset_classes.py",
        "seed_industries.py",
        "seed_market_data.py",
        "seed_roles.py",
        "seed_user.py",
        "seed_strategies.py"
    ]

    logger.info("🚀 Iniciando carga masiva de datos...")

    for script_name in scripts_to_run:
        script_path = os.path.join(seeds_dir, script_name)
        
        # Verificar que el archivo existe
        if not os.path.exists(script_path):
            logger.error(f"❌ Error: No se encontró el archivo {script_path}")
            sys.exit(1)

        logger.info(f"---- Ejecutando: {script_name} ----")
        
        try:
            # run_path ejecuta el archivo como si fuera el script principal (__main__)
            # Esto mantiene el contexto de tus imports y variables
            runpy.run_path(script_path, run_name="__main__")
            logger.info(f"✅ {script_name} completado con éxito.")
            
        except Exception as e:
            logger.error(f"❌ Falló la ejecución de {script_name}")
            logger.error(f"Error: {e}")
            # Detenemos todo si un script falla para evitar inconsistencias
            sys.exit(1)

    logger.info("🎉 ¡Carga de datos finalizada correctamente!")

if __name__ == "__main__":
    main()