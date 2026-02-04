"""
Schemas para el sistema de ETL monitoring.
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date


# ==========================================================================
# JOB LOG SCHEMAS
# ==========================================================================

class ETLJobLogBase(BaseModel):
    job_type: str
    job_name: Optional[str] = None
    status: str = "pending"
    records_processed: int = 0
    records_created: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    records_failed: int = 0
    file_name: Optional[str] = None


class ETLJobLogCreate(ETLJobLogBase):
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    execution_time_seconds: Optional[float] = None


class ETLJobLog(ETLJobLogBase):
    job_id: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    execution_time_seconds: Optional[float] = None
    created_assets: Optional[List[Dict[str, Any]]] = None
    extra_data: Optional[Dict[str, Any]] = None
    done: bool = False

    class Config:
        from_attributes = True


# ==========================================================================
# SYNC STATUS SCHEMAS
# ==========================================================================

class ETLSyncStatusBase(BaseModel):
    report_type: str
    is_enabled: bool = True
    auto_sync_enabled: bool = False


class ETLSyncStatus(ETLSyncStatusBase):
    status_id: int
    last_success_at: Optional[datetime] = None
    last_success_records: int = 0
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    last_run_job_id: Optional[int] = None
    total_runs_today: int = 0
    total_records_today: int = 0
    success_rate_today: float = 100
    last_data_date: Optional[date] = None

    class Config:
        from_attributes = True


# ==========================================================================
# DASHBOARD RESPONSE SCHEMAS
# ==========================================================================

class ETLDashboardStats(BaseModel):
    """Estadísticas generales para el dashboard."""
    active_report_types: int
    syncs_today: int
    records_processed_today: int
    success_rate_today: float
    last_sync_at: Optional[datetime] = None


class ETLReportStatus(BaseModel):
    """Estado de un tipo de reporte específico."""
    report_type: str
    display_name: str
    description: str
    status: str  # success, failed, pending, never_run
    last_run_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    records_last_run: int = 0
    error_message: Optional[str] = None
    is_enabled: bool = True
    auto_sync_enabled: bool = False


class ETLActivityLog(BaseModel):
    """Log de actividad reciente."""
    job_id: int
    job_type: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_processed: int = 0
    records_created: int = 0
    records_skipped: int = 0
    records_failed: int = 0
    error_message: Optional[str] = None
    duration_seconds: Optional[float] = None


class ETLDashboardResponse(BaseModel):
    """Respuesta completa del dashboard ETL."""
    stats: ETLDashboardStats
    report_statuses: List[ETLReportStatus]
    recent_activity: List[ETLActivityLog]
    last_updated: datetime


# ==========================================================================
# TRIGGER SCHEMAS
# ==========================================================================

class ETLTriggerRequest(BaseModel):
    """Request para triggear un job ETL."""
    report_type: str
    force: bool = False  # Forzar aunque ya se ejecutó hoy


class ETLTriggerResponse(BaseModel):
    """Response después de triggear un job."""
    success: bool
    job_id: Optional[int] = None
    message: str
    job_type: str


# ==========================================================================
# CONFIG SCHEMAS  
# ==========================================================================

class ETLReportConfig(BaseModel):
    """Configuración de un tipo de reporte."""
    report_type: str
    query_id: str
    display_name: str
    description: str
    endpoint: str
    is_enabled: bool = True


class ETLConfigResponse(BaseModel):
    """Configuración completa del ETL."""
    reports: List[ETLReportConfig]
    api_base_url: str
    download_directory: str
