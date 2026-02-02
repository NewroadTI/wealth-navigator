"""
IBKR Downloader - Download Flex Reports from Interactive Brokers
================================================================
Downloads CSV reports using the IBKR Flex Query API.
"""

import os
import time
import logging
import requests
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Optional, List

from app.jobs.config import (
    IBKR_TOKEN,
    FLEX_QUERIES,
    IBKR_API_VERSION,
    IBKR_INITIATE_URL,
    IBKR_DOWNLOAD_URL,
    WAIT_FOR_GENERATION,
    WAIT_BETWEEN_FILES,
    DOWNLOAD_DIR
)

logger = logging.getLogger("ETL.downloader")


class IBKRDownloader:
    """
    Downloads Flex Query reports from Interactive Brokers.
    """
    
    def __init__(self, token: str = None, output_dir: Path = None):
        self.token = token or IBKR_TOKEN
        self.output_dir = output_dir or DOWNLOAD_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.downloaded_files: List[Path] = []
        self.errors: List[Dict] = []
    
    def get_reference_code(self, query_id: str, query_name: str) -> Optional[str]:
        """
        Request a report from IBKR and get the reference code for download.
        """
        if not query_id:
            logger.error(f"No query ID configured for {query_name}")
            return None
        
        params = {
            "t": self.token,
            "q": query_id,
            "v": IBKR_API_VERSION
        }
        
        logger.info(f"[{query_name}] Requesting report (Query ID: {query_id})...")
        
        try:
            response = requests.get(IBKR_INITIATE_URL, params=params, timeout=30)
            response.raise_for_status()
            
            root = ET.fromstring(response.content)
            status = root.find("Status").text
            
            if status == "Success":
                ref_code = root.find("ReferenceCode").text
                logger.info(f"[{query_name}] Request accepted. Reference Code: {ref_code}")
                return ref_code
            else:
                error_code = root.find("ErrorCode")
                error_msg = root.find("ErrorMessage")
                code = error_code.text if error_code is not None else "?"
                msg = error_msg.text if error_msg is not None else "No message"
                logger.error(f"[{query_name}] Request failed. Code: {code} | Message: {msg}")
                self.errors.append({
                    "query": query_name,
                    "error_code": code,
                    "message": msg
                })
                return None
                
        except requests.RequestException as e:
            logger.error(f"[{query_name}] Connection error: {e}")
            self.errors.append({
                "query": query_name,
                "error_code": "CONNECTION_ERROR",
                "message": str(e)
            })
            return None
        except ET.ParseError as e:
            logger.error(f"[{query_name}] XML parse error: {e}")
            return None
    
    def download_csv(self, ref_code: str, filename: str) -> Optional[Path]:
        """
        Download the CSV report using the reference code.
        """
        params = {
            "t": self.token,
            "q": ref_code,
            "v": IBKR_API_VERSION
        }
        
        logger.info(f"Waiting {WAIT_FOR_GENERATION}s for report generation...")
        time.sleep(WAIT_FOR_GENERATION)
        
        try:
            response = requests.get(IBKR_DOWNLOAD_URL, params=params, timeout=60)
            response.raise_for_status()
            content = response.content
            
            # Check if response is an error XML
            if content.strip().startswith(b"<FlexStatementResponse"):
                root = ET.fromstring(content)
                if root.find("Status").text == "Fail":
                    error_msg = root.find("ErrorMessage").text
                    logger.error(f"Download failed (API Error): {error_msg}")
                    self._create_empty_file(filename)
                    return None
            
            # Save the CSV
            file_path = self.output_dir / f"{filename}.csv"
            with open(file_path, "wb") as f:
                f.write(content)
            
            logger.info(f"✅ File saved: {filename}.csv ({len(content)} bytes)")
            self.downloaded_files.append(file_path)
            return file_path
            
        except requests.RequestException as e:
            logger.error(f"Download error for {filename}: {e}")
            self._create_empty_file(filename)
            return None
    
    def _create_empty_file(self, filename: str):
        """Create an empty placeholder file for failed downloads."""
        file_path = self.output_dir / f"{filename}.csv"
        try:
            file_path.touch()
            logger.warning(f"Created empty placeholder: {filename}.csv")
        except Exception as e:
            logger.error(f"Failed to create empty file {filename}: {e}")
    
    def download_report(self, query_name: str, query_id: str) -> Optional[Path]:
        """
        Download a single report by name and ID.
        """
        ref_code = self.get_reference_code(query_id, query_name)
        if ref_code:
            return self.download_csv(ref_code, query_name)
        return None
    
    def download_all_reports(self, queries: Dict[str, str] = None) -> Dict[str, Path]:
        """
        Download all configured reports.
        Returns a dict mapping query name to file path.
        """
        queries = queries or FLEX_QUERIES
        results = {}
        
        logger.info("=" * 50)
        logger.info("STARTING IBKR REPORT DOWNLOAD")
        logger.info("=" * 50)
        
        if not self.token:
            logger.error("IBKR_TOKEN not configured!")
            return results
        
        for name, query_id in queries.items():
            file_path = self.download_report(name, query_id)
            if file_path:
                results[name] = file_path
            
            # Wait between downloads to avoid rate limiting
            if name != list(queries.keys())[-1]:  # Don't wait after last file
                time.sleep(WAIT_BETWEEN_FILES)
        
        logger.info("=" * 50)
        logger.info(f"DOWNLOAD COMPLETE: {len(results)}/{len(queries)} reports")
        if self.errors:
            logger.warning(f"Errors encountered: {len(self.errors)}")
        logger.info("=" * 50)
        
        return results
    
    def get_file_path(self, query_name: str) -> Optional[Path]:
        """Get the path for a specific report file."""
        file_path = self.output_dir / f"{query_name}.csv"
        if file_path.exists() and file_path.stat().st_size > 0:
            return file_path
        return None


def download_ibkr_reports(
    token: str = None,
    output_dir: Path = None,
    queries: Dict[str, str] = None
) -> Dict[str, Path]:
    """
    Convenience function to download all IBKR reports.
    
    Args:
        token: IBKR Flex token (defaults to env var)
        output_dir: Directory to save files (defaults to config)
        queries: Dict of query names to IDs (defaults to config)
    
    Returns:
        Dict mapping query names to downloaded file paths
    """
    downloader = IBKRDownloader(token=token, output_dir=output_dir)
    return downloader.download_all_reports(queries)


if __name__ == "__main__":
    # Test standalone execution
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    results = download_ibkr_reports()
    print(f"\nDownloaded files: {list(results.keys())}")
