"""
ETL Main Orchestrator
=====================
Main entry point for the IBKR data import pipeline.

This module orchestrates:
1. Downloading reports from IBKR Flex Queries
2. Processing each report type (Corporate Actions, Trades, Positions, etc.)
3. Uploading data to the WealthNavigator backend via API
"""

import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ETL")

# Import ETL components
from app.jobs.config import DOWNLOAD_DIR, FLEX_QUERIES
from app.jobs.downloader import IBKRDownloader, download_ibkr_reports
from app.jobs.api_client import get_api_client
from app.jobs.processors.corporate_actions import CorporateActionsProcessor
from app.jobs.processors.open_positions import OpenPositionsProcessor
from app.jobs.processors.cash_journal import CashJournalProcessor
from app.jobs.processors.trades import TradesProcessor


class ETLOrchestrator:
    """
    Main orchestrator for the IBKR to WealthNavigator ETL pipeline.
    """
    
    def __init__(
        self,
        download_dir: Path = None,
        skip_download: bool = False,
        api_base_url: str = None
    ):
        """
        Initialize the ETL orchestrator.
        
        Args:
            download_dir: Directory for downloaded files
            skip_download: If True, skip download and use existing files
            api_base_url: Override the API base URL
        """
        self.download_dir = download_dir or DOWNLOAD_DIR
        self.skip_download = skip_download
        self.api_client = get_api_client()
        
        if api_base_url:
            self.api_client.base_url = api_base_url
        
        self.results: Dict[str, Any] = {
            "started_at": None,
            "completed_at": None,
            "download": {},
            "processing": {},
            "errors": []
        }
    
    def run(self, report_types: List[str] = None) -> Dict[str, Any]:
        """
        Run the full ETL pipeline.
        
        Args:
            report_types: List of report types to process (default: all)
        
        Returns:
            Summary of the ETL run
        """
        self.results["started_at"] = datetime.now().isoformat()
        logger.info("=" * 60)
        logger.info("STARTING ETL PIPELINE")
        logger.info("=" * 60)
        
        # Step 1: Download reports
        downloaded_files = {}
        if not self.skip_download:
            downloaded_files = self._download_reports()
            self.results["download"] = {
                "status": "completed" if downloaded_files else "failed",
                "files": list(downloaded_files.keys())
            }
        else:
            logger.info("Skipping download, using existing files...")
            # Find existing files
            for name in FLEX_QUERIES.keys():
                file_path = self.download_dir / f"{name}.csv"
                if file_path.exists() and file_path.stat().st_size > 0:
                    downloaded_files[name] = file_path
            self.results["download"] = {
                "status": "skipped",
                "files": list(downloaded_files.keys())
            }
        
        # Step 2: Process each report type
        if report_types is None:
            report_types = list(FLEX_QUERIES.keys())
        
        for report_type in report_types:
            if report_type in downloaded_files:
                self._process_report(report_type, downloaded_files[report_type])
            else:
                logger.warning(f"No file found for {report_type}, skipping...")
        
        self.results["completed_at"] = datetime.now().isoformat()
        
        logger.info("=" * 60)
        logger.info("ETL PIPELINE COMPLETED")
        logger.info(f"Results: {self.results}")
        logger.info("=" * 60)
        
        return self.results
    
    def _download_reports(self) -> Dict[str, Path]:
        """Download all reports from IBKR."""
        logger.info("PHASE 1: Downloading reports from IBKR...")
        
        downloader = IBKRDownloader(output_dir=self.download_dir)
        return downloader.download_all_reports()
    
    def _process_report(self, report_type: str, file_path: Path):
        """
        Process a single report type.
        
        Args:
            report_type: Type of report (CORPORATES, TRADES, etc.)
            file_path: Path to the CSV file
        """
        logger.info(f"PHASE 2: Processing {report_type}...")
        
        try:
            if report_type == "CORPORATES":
                result = self._process_corporate_actions(file_path)
            elif report_type == "TRADES":
                result = self._process_trades(file_path)
            elif report_type == "OPENPOSITIONS":
                result = self._process_positions(file_path)
            elif report_type == "TRANSACCIONES":
                result = self._process_cash_journal(file_path)
            elif report_type == "TRANSFERS":
                result = self._process_transfers(file_path)
            else:
                logger.info(f"No processor implemented for {report_type}, skipping...")
                result = {"status": "skipped", "reason": "No processor implemented"}
            
            self.results["processing"][report_type] = result
            
        except Exception as e:
            logger.error(f"Error processing {report_type}: {e}")
            self.results["processing"][report_type] = {
                "status": "error",
                "error": str(e)
            }
            self.results["errors"].append({
                "report_type": report_type,
                "error": str(e)
            })
    
    def _process_corporate_actions(self, file_path: Path) -> Dict[str, Any]:
        """Process corporate actions CSV."""
        processor = CorporateActionsProcessor(api_client=self.api_client)
        return processor.process_file(file_path)
    
    def _process_trades(self, file_path: Path) -> Dict[str, Any]:
        """Process trades CSV."""
        processor = TradesProcessor(api_client=self.api_client)
        
        # Read CSV and convert to list of dicts
        import csv
        rows = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        return processor.process(rows)
    
    def _process_positions(self, file_path: Path) -> Dict[str, Any]:
        """Process open positions CSV."""
        processor = OpenPositionsProcessor(api_client=self.api_client)
        return processor.process_file(file_path)
    
    def _process_cash_journal(self, file_path: Path) -> Dict[str, Any]:
        """Process transactions (cash journal) CSV."""
        processor = CashJournalProcessor(api_client=self.api_client)
        return processor.process_file(file_path)
    
    def _process_transfers(self, file_path: Path) -> Dict[str, Any]:
        """Process transfers CSV."""
        # TODO: Implement transfers processor
        logger.info("Transfers processor not yet implemented")
        return {"status": "not_implemented"}
    
    # ==========================================================================
    # CONVENIENCE METHODS
    # ==========================================================================
    
    def process_corporate_actions_only(self, file_path: Path = None) -> Dict[str, Any]:
        """
        Process only corporate actions.
        
        Args:
            file_path: Optional custom file path
        """
        if file_path is None:
            file_path = self.download_dir / "CORPORATES.csv"
        
        if not file_path.exists():
            return {"status": "error", "error": f"File not found: {file_path}"}
        
        return self._process_corporate_actions(file_path)


def run_etl(
    skip_download: bool = False,
    report_types: List[str] = None,
    download_dir: Path = None
) -> Dict[str, Any]:
    """
    Run the ETL pipeline.
    
    Args:
        skip_download: Skip downloading and use existing files
        report_types: List of report types to process (default: all)
        download_dir: Override download directory
    
    Returns:
        ETL run summary
    """
    orchestrator = ETLOrchestrator(
        download_dir=download_dir,
        skip_download=skip_download
    )
    return orchestrator.run(report_types=report_types)


def run_corporate_actions_only(file_path: Path = None) -> Dict[str, Any]:
    """
    Quick function to process only corporate actions.
    
    Args:
        file_path: Path to CSV file (optional)
    """
    orchestrator = ETLOrchestrator(skip_download=True)
    return orchestrator.process_corporate_actions_only(file_path)


# ==========================================================================
# CLI ENTRY POINT
# ==========================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="IBKR to WealthNavigator ETL Pipeline")
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip downloading and use existing files"
    )
    parser.add_argument(
        "--report-types",
        nargs="+",
        choices=list(FLEX_QUERIES.keys()),
        help="Specific report types to process"
    )
    parser.add_argument(
        "--corporate-actions-only",
        action="store_true",
        help="Process only corporate actions"
    )
    parser.add_argument(
        "--file",
        type=str,
        help="Path to a specific CSV file to process"
    )
    
    args = parser.parse_args()
    
    if args.corporate_actions_only:
        file_path = Path(args.file) if args.file else None
        result = run_corporate_actions_only(file_path)
    else:
        result = run_etl(
            skip_download=args.skip_download,
            report_types=args.report_types
        )
    
    print("\n" + "=" * 60)
    print("ETL RESULTS:")
    print("=" * 60)
    import json
    print(json.dumps(result, indent=2, default=str))
