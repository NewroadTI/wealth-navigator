#!/usr/bin/env python3
"""
IBKR Download Script - Standalone Downloader
============================================
Script independiente para descargar reportes de IBKR sin dependencias del sistema ETL.
Ejecuta directamente para descargar todos los reportes configurados.

Uso:
    python download.py
    python download.py --report OPENPOSITIONS
    python download.py --output ./custom_dir
"""

import os
import sys
import time
import logging
import requests
import argparse
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime

# =============================================================================
# CONFIGURATION
# =============================================================================

# IBKR Flex Query Token
IBKR_TOKEN = os.getenv("IBKR_TOKEN", "181787535917845028470530")

# Flex Query IDs - Estos generan los reportes CSV
FLEX_QUERIES = {
    "CORPORATES": "1126752",
    "OPENPOSITIONS": "1126562", 
    "PRICES": "1126564",
    "STATEMENTFUNDS": "1126598",
    "TRADES": "1126535",
    "TRANSACCIONES": "1126335",
    "TRANSFERS": "1126559"
}

# URLs de la API de IBKR
IBKR_API_VERSION = "3"
IBKR_INITIATE_URL = "https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest"
IBKR_DOWNLOAD_URL = "https://www.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement"

# Tiempos de espera
WAIT_FOR_GENERATION = 3  # segundos para esperar generación del reporte
WAIT_BETWEEN_FILES = 2   # segundos entre descargas de archivos

# Directorio de salida por defecto
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "downloads"

# =============================================================================
# LOGGING SETUP
# =============================================================================

def setup_logging(verbose: bool = False):
    """Configura el logging para el script."""
    level = logging.DEBUG if verbose else logging.INFO
    
    # Formato con colores para terminal
    class ColoredFormatter(logging.Formatter):
        COLORS = {
            'DEBUG': '\033[36m',    # Cyan
            'INFO': '\033[32m',     # Green
            'WARNING': '\033[33m',  # Yellow
            'ERROR': '\033[31m',    # Red
            'CRITICAL': '\033[35m', # Magenta
        }
        RESET = '\033[0m'
        
        def format(self, record):
            log_color = self.COLORS.get(record.levelname, self.RESET)
            record.levelname = f"{log_color}{record.levelname}{self.RESET}"
            return super().format(record)
    
    handler = logging.StreamHandler()
    handler.setFormatter(ColoredFormatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    ))
    
    logger = logging.getLogger()
    logger.setLevel(level)
    logger.addHandler(handler)
    
    return logging.getLogger(__name__)

# =============================================================================
# DOWNLOADER CLASS
# =============================================================================

class IBKRDownloader:
    """
    Descarga reportes Flex Query desde Interactive Brokers.
    """
    
    def __init__(self, token: str, output_dir: Path):
        self.token = token
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.downloaded_files: List[Path] = []
        self.failed_downloads: List[str] = []
        self.errors: List[Dict] = []
        
        self.logger = logging.getLogger(__name__)
    
    def get_reference_code(self, query_id: str, query_name: str) -> Optional[str]:
        """
        Solicita un reporte a IBKR y obtiene el código de referencia para descarga.
        """
        if not query_id:
            self.logger.error(f"❌ [{query_name}] No hay Query ID configurado")
            return None
        
        params = {
            "t": self.token,
            "q": query_id,
            "v": IBKR_API_VERSION
        }
        
        self.logger.info(f"📋 [{query_name}] Solicitando reporte (Query ID: {query_id})...")
        
        try:
            response = requests.get(IBKR_INITIATE_URL, params=params, timeout=30)
            response.raise_for_status()
            
            root = ET.fromstring(response.content)
            status = root.find("Status").text
            
            if status == "Success":
                ref_code = root.find("ReferenceCode").text
                self.logger.info(f"✅ [{query_name}] Solicitud aceptada. Reference Code: {ref_code}")
                return ref_code
            else:
                error_code = root.find("ErrorCode")
                error_msg = root.find("ErrorMessage")
                code = error_code.text if error_code is not None else "UNKNOWN"
                msg = error_msg.text if error_msg is not None else "Sin mensaje"
                
                self.logger.error(f"❌ [{query_name}] Solicitud fallida. Code: {code} | Message: {msg}")
                self.errors.append({
                    "query": query_name,
                    "error_code": code,
                    "message": msg
                })
                self.failed_downloads.append(query_name)
                return None
                
        except requests.RequestException as e:
            self.logger.error(f"❌ [{query_name}] Error de conexión: {e}")
            self.errors.append({
                "query": query_name,
                "error_code": "CONNECTION_ERROR",
                "message": str(e)
            })
            self.failed_downloads.append(query_name)
            return None
        except ET.ParseError as e:
            self.logger.error(f"❌ [{query_name}] Error parseando XML: {e}")
            self.failed_downloads.append(query_name)
            return None
    
    def download_csv(self, ref_code: str, filename: str) -> Optional[Path]:
        """
        Descarga el reporte CSV usando el código de referencia.
        """
        params = {
            "t": self.token,
            "q": ref_code,
            "v": IBKR_API_VERSION
        }
        
        self.logger.info(f"⏳ Esperando {WAIT_FOR_GENERATION}s para la generación del reporte...")
        time.sleep(WAIT_FOR_GENERATION)
        
        try:
            response = requests.get(IBKR_DOWNLOAD_URL, params=params, timeout=60)
            response.raise_for_status()
            content = response.content
            
            # Verificar si la respuesta es un error XML
            if content.strip().startswith(b"<FlexStatementResponse"):
                root = ET.fromstring(content)
                status = root.find("Status")
                if status is not None and status.text == "Fail":
                    error_msg = root.find("ErrorMessage")
                    msg = error_msg.text if error_msg is not None else "Unknown error"
                    self.logger.error(f"❌ Error de API al descargar: {msg}")
                    self.failed_downloads.append(filename)
                    return None
            
            # Guardar el CSV
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_path = self.output_dir / f"{filename}_{timestamp}.csv"
            
            with open(file_path, "wb") as f:
                f.write(content)
            
            size_kb = len(content) / 1024
            self.logger.info(f"✅ Archivo guardado: {file_path.name} ({size_kb:.1f} KB)")
            self.downloaded_files.append(file_path)
            return file_path
            
        except requests.RequestException as e:
            self.logger.error(f"❌ Error de descarga para {filename}: {e}")
            self.failed_downloads.append(filename)
            return None
        except Exception as e:
            self.logger.error(f"❌ Error inesperado al guardar {filename}: {e}")
            self.failed_downloads.append(filename)
            return None
    
    def download_report(self, query_name: str, query_id: str) -> Optional[Path]:
        """
        Descarga un reporte individual por nombre e ID.
        """
        ref_code = self.get_reference_code(query_id, query_name)
        if ref_code:
            return self.download_csv(ref_code, query_name)
        return None
    
    def download_all_reports(self, queries: Dict[str, str]) -> Dict[str, Path]:
        """
        Descarga todos los reportes configurados.
        Retorna un dict mapeando nombre de query a ruta del archivo.
        """
        results = {}
        
        print("\n" + "=" * 70)
        print("🚀 INICIANDO DESCARGA DE REPORTES IBKR")
        print("=" * 70)
        print(f"📁 Directorio de salida: {self.output_dir}")
        print(f"📊 Reportes a descargar: {len(queries)}")
        print(f"🔑 Token: {self.token[:10]}...{self.token[-10:]}")
        print("=" * 70 + "\n")
        
        if not self.token:
            self.logger.error("❌ IBKR_TOKEN no está configurado!")
            return results
        
        for idx, (name, query_id) in enumerate(queries.items(), 1):
            print(f"\n[{idx}/{len(queries)}] Procesando: {name}")
            print("-" * 50)
            
            file_path = self.download_report(name, query_id)
            if file_path:
                results[name] = file_path
            
            # Esperar entre descargas para evitar rate limiting
            if idx < len(queries):
                time.sleep(WAIT_BETWEEN_FILES)
        
        # Resumen final
        print("\n" + "=" * 70)
        print("📊 RESUMEN DE DESCARGA")
        print("=" * 70)
        print(f"✅ Exitosas: {len(results)}/{len(queries)}")
        print(f"❌ Fallidas: {len(self.failed_downloads)}/{len(queries)}")
        
        if results:
            print("\n📁 Archivos descargados:")
            for name, path in results.items():
                size_kb = path.stat().st_size / 1024
                print(f"   • {name}: {path.name} ({size_kb:.1f} KB)")
        
        if self.failed_downloads:
            print("\n⚠️  Descargas fallidas:")
            for name in self.failed_downloads:
                print(f"   • {name}")
        
        if self.errors:
            print("\n🐛 Errores encontrados:")
            for error in self.errors:
                print(f"   • {error['query']}: {error['error_code']} - {error['message']}")
        
        print("=" * 70 + "\n")
        
        return results

# =============================================================================
# MAIN FUNCTION
# =============================================================================

def main():
    """Función principal del script."""
    parser = argparse.ArgumentParser(
        description="Descarga reportes de IBKR usando Flex Queries",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos de uso:
  python download.py                          # Descargar todos los reportes
  python download.py --report OPENPOSITIONS   # Descargar solo un reporte
  python download.py --output ./my_downloads  # Usar directorio custom
  python download.py --verbose                # Modo verbose con más detalles
  python download.py --list                   # Listar reportes disponibles
        """
    )
    
    parser.add_argument(
        '--report',
        type=str,
        help='Nombre del reporte específico a descargar (ej: OPENPOSITIONS)'
    )
    
    parser.add_argument(
        '--output',
        type=str,
        help=f'Directorio de salida (default: {DEFAULT_OUTPUT_DIR})'
    )
    
    parser.add_argument(
        '--token',
        type=str,
        help='IBKR Flex Token (default: variable de entorno IBKR_TOKEN)'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Modo verbose para debugging'
    )
    
    parser.add_argument(
        '--list',
        action='store_true',
        help='Listar todos los reportes disponibles y salir'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging(verbose=args.verbose)
    
    # Listar reportes si se solicita
    if args.list:
        print("\n📋 Reportes Disponibles:")
        print("=" * 50)
        for name, query_id in FLEX_QUERIES.items():
            print(f"  • {name:20} (ID: {query_id})")
        print("=" * 50 + "\n")
        return 0
    
    # Configuración
    token = args.token or IBKR_TOKEN
    output_dir = Path(args.output) if args.output else DEFAULT_OUTPUT_DIR
    
    # Validar token
    if not token or token == "your_token_here":
        logger.error("❌ IBKR_TOKEN no está configurado!")
        logger.error("   Configure la variable de entorno IBKR_TOKEN o use --token")
        return 1
    
    # Determinar qué reportes descargar
    if args.report:
        report_name = args.report.upper()
        if report_name not in FLEX_QUERIES:
            logger.error(f"❌ Reporte '{report_name}' no existe")
            logger.error(f"   Reportes disponibles: {', '.join(FLEX_QUERIES.keys())}")
            return 1
        queries = {report_name: FLEX_QUERIES[report_name]}
    else:
        queries = FLEX_QUERIES
    
    # Descargar reportes
    try:
        downloader = IBKRDownloader(token=token, output_dir=output_dir)
        results = downloader.download_all_reports(queries)
        
        # Exit code basado en resultados
        if len(results) == len(queries):
            logger.info("✅ Todas las descargas completadas exitosamente")
            return 0
        elif len(results) > 0:
            logger.warning("⚠️  Algunas descargas fallaron")
            return 2
        else:
            logger.error("❌ Todas las descargas fallaron")
            return 1
            
    except KeyboardInterrupt:
        logger.warning("\n⚠️  Descarga interrumpida por el usuario")
        return 130
    except Exception as e:
        logger.error(f"❌ Error inesperado: {e}", exc_info=args.verbose)
        return 1

# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    sys.exit(main())
