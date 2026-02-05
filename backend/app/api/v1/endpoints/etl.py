"""
ETL API Endpoints
=================
HTTP endpoints to trigger and monitor ETL jobs.
"""

import logging
from typing import List, Optional
from pathlib import Path
from datetime import datetime, timedelta, date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.api.deps import get_db
from app.jobs import run_etl, run_corporate_actions_only
from app.jobs.config import FLEX_QUERIES, DOWNLOAD_DIR
from app.models.asset import ETLJobLog as ETLJobLogModel, ETLSyncStatus as ETLSyncStatusModel
from app.schemas.etl import (
    ETLJobLog, ETLSyncStatus, ETLDashboardResponse, ETLDashboardStats,
    ETLReportStatus, ETLActivityLog, ETLTriggerRequest, ETLTriggerResponse,
    ETLReportConfig, ETLConfigResponse
)

router = APIRouter()


# ==========================================================================
# SCHEMAS
# ==========================================================================

class ETLRunRequest(BaseModel):
    """Request schema for triggering ETL."""
    skip_download: bool = False
    report_types: Optional[List[str]] = None


class ETLResponse(BaseModel):
    """Response schema for ETL operations."""
    status: str
    message: str
    details: Optional[dict] = None


# ==========================================================================
# ENDPOINTS
# ==========================================================================

@router.post("/run", response_model=ETLResponse)
def trigger_etl_sync(request: ETLRunRequest):
    """
    Run the full ETL pipeline synchronously.
    
    This will:
    1. Download reports from IBKR (unless skip_download=True)
    2. Process each report type
    3. Upload data to the database via API
    
    Warning: This can take several minutes depending on data volume.
    """
    try:
        result = run_etl(
            skip_download=request.skip_download,
            report_types=request.report_types
        )
        
        return ETLResponse(
            status="completed",
            message="ETL pipeline completed successfully",
            details=result
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"ETL pipeline failed: {str(e)}"
        )


@router.post("/run-async", response_model=ETLResponse)
def trigger_etl_async(
    request: ETLRunRequest,
    background_tasks: BackgroundTasks
):
    """
    Trigger ETL pipeline in background.
    Returns immediately while ETL runs asynchronously.
    """
    background_tasks.add_task(
        run_etl,
        skip_download=request.skip_download,
        report_types=request.report_types
    )
    
    return ETLResponse(
        status="started",
        message="ETL pipeline started in background",
        details={"report_types": request.report_types or list(FLEX_QUERIES.keys())}
    )


@router.post("/corporate-actions", response_model=ETLResponse)
def process_corporate_actions(
    file_path: Optional[str] = Query(None, description="Path to CSV file")
):
    """
    Process only Corporate Actions.
    Uses existing downloaded file or specify a custom path.
    """
    try:
        path = Path(file_path) if file_path else None
        result = run_corporate_actions_only(path)
        
        return ETLResponse(
            status="completed",
            message="Corporate actions processed",
            details=result
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process corporate actions: {str(e)}"
        )


@router.get("/status")
def get_etl_status():
    """
    Get the status of available files and last ETL run.
    """
    available_files = {}
    
    for name in FLEX_QUERIES.keys():
        file_path = DOWNLOAD_DIR / f"{name}.csv"
        if file_path.exists():
            stat = file_path.stat()
            available_files[name] = {
                "exists": True,
                "size_bytes": stat.st_size,
                "modified": stat.st_mtime
            }
        else:
            available_files[name] = {"exists": False}
    
    return {
        "download_dir": str(DOWNLOAD_DIR),
        "files": available_files,
        "configured_queries": list(FLEX_QUERIES.keys())
    }


@router.get("/config")
def get_etl_config():
    """
    Get current ETL configuration.
    """
    return {
        "download_dir": str(DOWNLOAD_DIR),
        "flex_queries": FLEX_QUERIES,
        "supported_report_types": list(FLEX_QUERIES.keys())
    }


# ==========================================================================
# REPORT TYPE DISPLAY INFO
# ==========================================================================

REPORT_DISPLAY_INFO = {
    "CORPORATES": {
        "display_name": "Corporate Actions",
        "description": "Splits, dividends, mergers, spinoffs"
    },
    "OPENPOSITIONS": {
        "display_name": "Open Positions",
        "description": "Current portfolio holdings"
    },
    "PRICES": {
        "display_name": "Market Prices", 
        "description": "Historical price data"
    },
    "STATEMENTFUNDS": {
        "display_name": "Cash Journal",
        "description": "Dividends, interest, deposits, withdrawals, fees"
    },
    "TRADES": {
        "display_name": "Trades",
        "description": "Buy/sell transactions"
    },
    "TRANSACCIONES": {
        "display_name": "Transactions",
        "description": "All account transactions"
    },
    "TRANSFERS": {
        "display_name": "Transfers (ACATS)",
        "description": "Asset transfers between accounts"
    }
}


# ==========================================================================
# DASHBOARD ENDPOINTS
# ==========================================================================

@router.get("/dashboard", response_model=ETLDashboardResponse)
def get_etl_dashboard(db: Session = Depends(get_db)):
    """
    Get complete ETL dashboard data including stats, report statuses, and recent activity.
    """
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    
    # 1. Get dashboard stats
    today_jobs = db.query(ETLJobLogModel).filter(
        ETLJobLogModel.started_at >= today_start
    ).all()
    
    syncs_today = len(today_jobs)
    records_today = sum(j.records_processed or 0 for j in today_jobs)
    successful_today = sum(1 for j in today_jobs if j.status == "success")
    success_rate = (successful_today / syncs_today * 100) if syncs_today > 0 else 100
    
    last_job = db.query(ETLJobLogModel).order_by(
        ETLJobLogModel.started_at.desc()
    ).first()
    
    stats = ETLDashboardStats(
        active_report_types=len(FLEX_QUERIES),
        syncs_today=syncs_today,
        records_processed_today=records_today,
        success_rate_today=round(success_rate, 1),
        last_sync_at=last_job.started_at if last_job else None
    )
    
    # 2. Get report statuses
    report_statuses = []
    
    for report_type in FLEX_QUERIES.keys():
        info = REPORT_DISPLAY_INFO.get(report_type, {
            "display_name": report_type,
            "description": "No description"
        })
        
        # Get sync status from DB or use defaults
        sync_status = db.query(ETLSyncStatusModel).filter(
            ETLSyncStatusModel.report_type == report_type
        ).first()
        
        # Get latest job for this report type
        latest_job = db.query(ETLJobLogModel).filter(
            ETLJobLogModel.job_type == report_type
        ).order_by(ETLJobLogModel.started_at.desc()).first()
        
        status = "never_run"
        last_run_at = None
        last_success_at = None
        records_last_run = 0
        error_message = None
        
        if latest_job:
            status = latest_job.status
            last_run_at = latest_job.started_at
            records_last_run = latest_job.records_processed or 0
            error_message = latest_job.error_message
            
            if latest_job.status == "success":
                last_success_at = latest_job.started_at
            else:
                # Find last successful job
                last_success_job = db.query(ETLJobLogModel).filter(
                    and_(
                        ETLJobLogModel.job_type == report_type,
                        ETLJobLogModel.status == "success"
                    )
                ).order_by(ETLJobLogModel.started_at.desc()).first()
                if last_success_job:
                    last_success_at = last_success_job.started_at
        
        report_statuses.append(ETLReportStatus(
            report_type=report_type,
            display_name=info["display_name"],
            description=info["description"],
            status=status,
            last_run_at=last_run_at,
            last_success_at=last_success_at,
            records_last_run=records_last_run,
            error_message=error_message,
            is_enabled=sync_status.is_enabled if sync_status else True,
            auto_sync_enabled=sync_status.auto_sync_enabled if sync_status else False
        ))
    
    # 3. Get recent activity (last 20 jobs)
    recent_jobs = db.query(ETLJobLogModel).order_by(
        ETLJobLogModel.started_at.desc()
    ).limit(20).all()
    
    recent_activity = []
    for job in recent_jobs:
        duration = None
        if job.completed_at and job.started_at:
            duration = (job.completed_at - job.started_at).total_seconds()
        
        recent_activity.append(ETLActivityLog(
            job_id=job.job_id,
            job_type=job.job_type,
            status=job.status,
            started_at=job.started_at,
            completed_at=job.completed_at,
            records_processed=job.records_processed or 0,
            records_created=job.records_created or 0,
            records_skipped=job.records_skipped or 0,
            records_failed=job.records_failed or 0,
            error_message=job.error_message,
            duration_seconds=duration
        ))
    
    return ETLDashboardResponse(
        stats=stats,
        report_statuses=report_statuses,
        recent_activity=recent_activity,
        last_updated=datetime.now()
    )


@router.get("/jobs", response_model=List[ETLJobLog])
def get_etl_jobs(
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Get ETL job history with optional filters.
    """
    query = db.query(ETLJobLogModel)
    
    if report_type:
        query = query.filter(ETLJobLogModel.job_type == report_type)
    if status:
        query = query.filter(ETLJobLogModel.status == status)
    
    jobs = query.order_by(
        ETLJobLogModel.started_at.desc()
    ).offset(offset).limit(limit).all()
    
    return jobs


@router.get("/jobs/{job_id}", response_model=ETLJobLog)
def get_etl_job(job_id: int, db: Session = Depends(get_db)):
    """
    Get a specific ETL job by ID.
    """
    job = db.query(ETLJobLogModel).filter(ETLJobLogModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


@router.get("/jobs/{job_id}/records")
def get_etl_job_records(
    job_id: int,
    record_type: Optional[str] = Query(None, description="Filter by 'skipped' or 'failed'"),
    db: Session = Depends(get_db)
):
    """
    Get detailed skipped/failed records for a specific ETL job.
    
    Query Parameters:
    - record_type: 'skipped' or 'failed' (optional, returns both if not specified)
    
    Returns:
    - skipped_records: Array of records that were skipped with reasons
    - failed_records: Array of records that failed processing with error messages
    - missing_assets: Summary of assets not found in database
    - missing_accounts: Summary of accounts not found in database
    """
    job = db.query(ETLJobLogModel).filter(ETLJobLogModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    extra_data = job.extra_data or {}
    
    # Log for debugging
    logger = logging.getLogger("ETL")
    logger.info(f"Fetching records for job {job_id}")
    logger.info(f"Extra data keys: {extra_data.keys()}")
    logger.info(f"Skipped records count: {len(extra_data.get('skipped_records', []))}")
    logger.info(f"Failed records count: {len(extra_data.get('failed_records', []))}")
    
    
    # Deduplicate missing assets by symbol/ISIN (frontend shows unique count)
    seen_assets = {}
    for asset in extra_data.get("missing_assets", []):
        key = asset.get("isin") or asset.get("symbol") or asset.get("security_id")
        if key and key not in seen_assets:
            seen_assets[key] = asset
        elif key:
            # Update count if already exists
            if "count" in asset:
                seen_assets[key]["count"] = seen_assets[key].get("count", 1) + asset.get("count", 1)
    
    unique_missing_assets = list(seen_assets.values())
    
    response = {
        "job_id": job.job_id,
        "job_type": job.job_type,
        "status": job.status,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "records_processed": job.records_processed,
        "records_created": job.records_created,
        "records_skipped": job.records_skipped,
        "records_failed": job.records_failed,
        "filename": job.file_name,  # ⭐ CRITICAL: Frontend needs this for extract-names endpoint
        "skipped_records": [],
        "failed_records": [],
        "missing_assets": unique_missing_assets,
        "missing_accounts": extra_data.get("missing_accounts", [])
    }
    
    # Filter based on record_type parameter
    if record_type is None or record_type == "skipped":
        response["skipped_records"] = extra_data.get("skipped_records", [])
        # Fallback for older jobs (like Pershing) that stored skipped records in error_details
        if not response["skipped_records"] and job.error_details:
             response["skipped_records"] = job.error_details.get("skipped_records", [])
    
    if record_type is None or record_type == "failed":
        response["failed_records"] = extra_data.get("failed_records", [])
    
    return response


class MarkItemDoneRequest(BaseModel):
    """Request to mark a missing account or asset as resolved."""
    item_type: str  # "account" or "asset"
    item_key: str   # account_code for accounts, isin/symbol for assets


@router.post("/jobs/{job_id}/mark-done")
def mark_item_as_done(
    job_id: int,
    request: MarkItemDoneRequest,
    db: Session = Depends(get_db)
):
    """
    Mark a missing account or asset as resolved (done=true).
    Updates the job's extra_data JSON field.
    """
    from sqlalchemy.orm.attributes import flag_modified
    
    job = db.query(ETLJobLogModel).filter(ETLJobLogModel.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    extra_data = job.extra_data or {}
    updated = False
    
    if request.item_type == "account":
        missing_accounts = extra_data.get("missing_accounts", [])
        for acc in missing_accounts:
            if acc.get("account_code") == request.item_key:
                acc["done"] = True
                updated = True
                break
        extra_data["missing_accounts"] = missing_accounts
        
    elif request.item_type == "asset":
        missing_assets = extra_data.get("missing_assets", [])
        for asset in missing_assets:
            # Match by isin or symbol
            if (asset.get("isin") == request.item_key or 
                asset.get("symbol") == request.item_key or
                f"SYMBOL:{asset.get('symbol')}" == request.item_key):
                asset["done"] = True
                updated = True
                break
        extra_data["missing_assets"] = missing_assets
    else:
        raise HTTPException(status_code=400, detail="item_type must be 'account' or 'asset'")
    
    if not updated:
        raise HTTPException(status_code=404, detail=f"{request.item_type} with key {request.item_key} not found")
    
    # Save back to DB - CRITICAL: Use flag_modified to force SQLAlchemy to detect JSON changes
    job.extra_data = extra_data
    flag_modified(job, "extra_data")  # Tell SQLAlchemy the JSON field changed
    db.commit()
    
    # Check if all items are done to update job.done status
    all_accounts_done = all(acc.get("done", False) for acc in extra_data.get("missing_accounts", []))
    all_assets_done = all(asset.get("done", False) for asset in extra_data.get("missing_assets", []))
    
    if all_accounts_done and all_assets_done and (extra_data.get("missing_accounts") or extra_data.get("missing_assets")):
        job.done = True
        db.commit()
    
    return {
        "success": True,
        "message": f"Marked {request.item_type} {request.item_key} as done",
        "all_resolved": all_accounts_done and all_assets_done
    }


@router.post("/trigger", response_model=ETLTriggerResponse)
def trigger_etl_job(
    request: ETLTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Trigger a specific ETL job by report type.
    Downloads ONLY the specified report file and processes it.
    """
    if request.report_type not in FLEX_QUERIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown report type: {request.report_type}"
        )
    
    # Create job log
    job = ETLJobLogModel(
        job_type=request.report_type,
        job_name=REPORT_DISPLAY_INFO.get(request.report_type, {}).get("display_name", request.report_type),
        status="running",
        started_at=datetime.now()
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Run in background - only for THIS report type
    background_tasks.add_task(
        _run_single_etl_job,
        job_id=job.job_id,
        report_type=request.report_type
    )
    
    return ETLTriggerResponse(
        success=True,
        job_id=job.job_id,
        message=f"ETL job started for {request.report_type}",
        job_type=request.report_type
    )


def _run_single_etl_job(job_id: int, report_type: str):
    """
    Run ETL job for a single report type.
    Downloads only the specific file and processes it.
    """
    from app.db.session import SessionLocal
    from app.jobs.downloader import IBKRDownloader
    from pathlib import Path
    
    db = SessionLocal()
    job = db.query(ETLJobLogModel).filter(ETLJobLogModel.job_id == job_id).first()
    
    try:
        import logging
        logger = logging.getLogger("ETL")
        logger.info(f"Starting ETL job for {report_type}...")
        
        # 1. Download only this specific report
        downloader = IBKRDownloader()
        query_id = FLEX_QUERIES.get(report_type)
        
        if not query_id:
            raise ValueError(f"No query ID configured for {report_type}")
        
        file_path = downloader.download_report(report_type, query_id)
        
        if not file_path or not file_path.exists():
            job.status = "failed"
            job.error_message = f"Failed to download {report_type} report"
            job.completed_at = datetime.now()
            db.commit()
            return
        
        # Update job with file info
        job.file_name = file_path.name
        job.file_size_bytes = file_path.stat().st_size
        db.commit()
        
        # 2. Process the file based on report type
        result = {"status": "success", "records_processed": 0, "records_created": 0, "records_failed": 0}
        
        if report_type == "CORPORATES":
            from app.jobs.processors.corporate_actions import CorporateActionsProcessor
            from app.jobs.api_client import get_api_client
            
            api_client = get_api_client()
            processor = CorporateActionsProcessor(api_client=api_client)
            result = processor.process_file(file_path)
        
        elif report_type == "OPENPOSITIONS":
            from app.jobs.processors.open_positions import OpenPositionsProcessor
            from app.jobs.api_client import get_api_client
            
            api_client = get_api_client()
            processor = OpenPositionsProcessor(api_client=api_client)
            result = processor.process_file(file_path)
        
        elif report_type == "STATEMENTFUNDS":
            from app.jobs.processors.cash_journal import CashJournalProcessor
            from app.jobs.api_client import get_api_client
            
            api_client = get_api_client()
            processor = CashJournalProcessor(api_client=api_client)
            result = processor.process_file(file_path)
        
        elif report_type == "TRANSFERS":
            from app.jobs.processors.transfers import TransfersProcessor
            from app.jobs.api_client import get_api_client
            
            api_client = get_api_client()
            processor = TransfersProcessor(api_client=api_client)
            result = processor.process_file(file_path)
        
        elif report_type == "TRADES":
            from app.jobs.processors.trades import TradesProcessor
            from app.jobs.api_client import get_api_client
            import csv
            
            # Read CSV file
            rows = []
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            # Process with APIClient
            api_client = get_api_client()
            processor = TradesProcessor(api_client=api_client)
            result = processor.process(rows)
            
            # Map result to expected format
            stats = result.get("stats", {})
            result = {
                "status": "success",
                "records_processed": stats.get("trades_created", 0) + stats.get("fx_created", 0) + stats.get("trades_skipped", 0) + stats.get("fx_skipped", 0),
                "records_created": stats.get("trades_created", 0) + stats.get("fx_created", 0),
                "records_skipped": stats.get("trades_skipped", 0) + stats.get("fx_skipped", 0),
                "records_failed": stats.get("errors", 0),
                "missing_assets": result.get("missing_assets", []),
                "missing_accounts": result.get("missing_accounts", []),
                "skipped_records": result.get("skipped_records", []),
                "failed_records": result.get("failed_records", []),
            }
        
        # TODO: Add other report type processors here
        else:
            logger.warning(f"No processor implemented for {report_type}")
            result = {
                "status": "success",
                "message": f"No processor implemented for {report_type}",
                "records_processed": 0,
                "records_created": 0,
                "records_failed": 0
            }
        
        # 3. Update job log
        job.completed_at = datetime.now()
        # Update job stats
        job.records_processed = result.get("records_processed", 0)
        job.records_created = result.get("records_created", 0)
        job.records_updated = result.get("records_updated", 0)
        job.records_skipped = result.get("records_skipped", 0)
        job.records_failed = result.get("records_failed", 0)
        job.status = result.get("status", "success")
        
        # Auto-mark successful jobs as done, failed/partial jobs need user review
        if job.status == "success":
            job.done = True
        else:
            job.done = False
        
        job.file_name = result.get("file_name", job.file_name) # Keep existing if not in result
        job.file_size_bytes = result.get("file_size_bytes", job.file_size_bytes) # Keep existing if not in result
        job.error_message = result.get("error_message")
        job.error_details = result.get("error_details")
        
        if result.get("created_assets"):
            job.created_assets = [{"symbol": s} for s in result.get("created_assets", [])]
        else:
            job.created_assets = None # Clear if not present
        
        # Store missing assets/accounts in extra_data for frontend to display
        extra_data = {}
        if result.get("missing_assets"):
            extra_data["missing_assets"] = result.get("missing_assets")
        if result.get("missing_accounts"):
            extra_data["missing_accounts"] = result.get("missing_accounts")
        if result.get("skipped_records"):
            extra_data["skipped_records"] = result.get("skipped_records", [])
        if result.get("failed_records"):
            extra_data["failed_records"] = result.get("failed_records", [])
        if extra_data:
            job.extra_data = extra_data
        else:
            job.extra_data = None # Clear if not present
        
        if job.started_at and job.completed_at:
            job.execution_time_seconds = Decimal(str((job.completed_at - job.started_at).total_seconds()))
        
        db.commit()
        db.refresh(job)
        
        logger.info(f"ETL job {job_id} completed: {result}")
        
    except Exception as e:
        import traceback
        logger = logging.getLogger("ETL")
        logger.error(f"ETL job {job_id} failed: {e}")
        logger.error(traceback.format_exc())
        
        job = db.query(ETLJobLogModel).filter(ETLJobLogModel.job_id == job_id).first()
        if job:
            job.status = "failed"
            job.completed_at = datetime.now()
            job.error_message = str(e)
            db.commit()
    finally:
        db.close()


async def _run_etl_job_with_logging(job_id: int, report_type: str):
    """
    DEPRECATED: Use _run_single_etl_job instead.
    This function caused HTTP deadlocks by calling the API from within the API.
    """
    _run_single_etl_job(job_id, report_type)
