from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, desc
from datetime import date, timedelta
from decimal import Decimal

from app.api import deps
from app.models.asset import Position, Asset, AssetClass, Industry
from app.models.portfolio import Portfolio, Account
from pydantic import BaseModel

router = APIRouter()


# ===== SCHEMAS =====

class TopMover(BaseModel):
    symbol: str
    name: str
    asset_id: int
    change: float
    change_percent: float
    current_value: float
    previous_value: float

class TopMoversResponse(BaseModel):
    gainers: List[TopMover]
    losers: List[TopMover]
    report_date: str
    previous_date: str

class AllocationItem(BaseModel):
    name: str
    value: float
    percentage: float
    color: str | None = None

class AllocationResponse(BaseModel):
    data: List[AllocationItem]
    total_value: float
    report_date: str


# ===== HELPER FUNCTIONS =====

def get_color_for_index(index: int) -> str:
    """Generate colors for allocation charts"""
    colors = [
        'hsl(220, 82%, 44%)',  # Blue
        'hsl(38, 70%, 55%)',   # Orange
        'hsl(142, 70%, 45%)',  # Green
        'hsl(280, 60%, 55%)',  # Purple
        'hsl(200, 70%, 50%)',  # Cyan
        'hsl(350, 65%, 55%)',  # Red
        'hsl(45, 85%, 55%)',   # Yellow
        'hsl(220, 14%, 55%)',  # Gray
    ]
    return colors[index % len(colors)]


# ===== ENDPOINTS =====

@router.get("/top-movers/{portfolio_id}", response_model=TopMoversResponse)
def get_portfolio_top_movers(
    portfolio_id: int,
    db: Session = Depends(deps.get_db),
    limit: int = Query(3, ge=1, le=10, description="Number of top gainers/losers to return")
) -> TopMoversResponse:
    """
    Get top gaining and losing positions for a portfolio over the last 2 days.
    Compares the most recent report date with the previous one.
    """
    # Verify portfolio exists
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get account IDs for this portfolio
    account_ids = [acc.account_id for acc in portfolio.accounts]
    if not account_ids:
        return TopMoversResponse(
            gainers=[],
            losers=[],
            report_date="",
            previous_date=""
        )
    
    # Get the two most recent report dates with position data
    dates_query = db.query(Position.report_date).filter(
        Position.account_id.in_(account_ids)
    ).distinct().order_by(desc(Position.report_date)).limit(2)
    
    dates = [d[0] for d in dates_query.all()]
    
    if len(dates) < 2:
        return TopMoversResponse(
            gainers=[],
            losers=[],
            report_date=str(dates[0]) if dates else "",
            previous_date=""
        )
    
    current_date = dates[0]
    previous_date = dates[1]
    
    # Get current positions
    current_positions = db.query(
        Position.asset_id,
        func.sum(Position.position_value).label('current_value')
    ).filter(
        Position.account_id.in_(account_ids),
        Position.report_date == current_date
    ).group_by(Position.asset_id).all()
    
    # Get previous positions
    previous_positions = db.query(
        Position.asset_id,
        func.sum(Position.position_value).label('previous_value')
    ).filter(
        Position.account_id.in_(account_ids),
        Position.report_date == previous_date
    ).group_by(Position.asset_id).all()
    
    # Build dictionaries for comparison
    current_dict = {p.asset_id: float(p.current_value or 0) for p in current_positions}
    previous_dict = {p.asset_id: float(p.previous_value or 0) for p in previous_positions}
    
    # Calculate changes
    movers = []
    all_asset_ids = set(current_dict.keys()) | set(previous_dict.keys())
    
    for asset_id in all_asset_ids:
        current_val = current_dict.get(asset_id, 0)
        previous_val = previous_dict.get(asset_id, 0)
        
        # Skip if both values are zero or very small
        if current_val == 0 and previous_val == 0:
            continue
        
        change = current_val - previous_val
        
        # Calculate percentage change
        if previous_val != 0:
            change_percent = (change / abs(previous_val)) * 100
        elif current_val != 0:
            change_percent = 100.0  # New position
        else:
            change_percent = 0.0
        
        # Get asset info
        asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
        if not asset:
            continue
        
        movers.append({
            'symbol': asset.symbol,
            'name': asset.description or asset.symbol,
            'asset_id': asset_id,
            'change': change,
            'change_percent': change_percent,
            'current_value': current_val,
            'previous_value': previous_val
        })
    
    # Sort by absolute change value
    movers.sort(key=lambda x: abs(x['change']), reverse=True)
    
    # Separate gainers and losers
    gainers = [TopMover(**m) for m in movers if m['change'] > 0][:limit]
    losers = [TopMover(**m) for m in movers if m['change'] < 0][:limit]
    
    return TopMoversResponse(
        gainers=gainers,
        losers=losers,
        report_date=str(current_date),
        previous_date=str(previous_date)
    )


@router.get("/asset-allocation/{portfolio_id}", response_model=AllocationResponse)
def get_portfolio_asset_allocation(
    portfolio_id: int,
    db: Session = Depends(deps.get_db),
    report_date: Optional[str] = Query(None, description="Report date (YYYY-MM-DD). If not provided, uses the latest.")
) -> AllocationResponse:
    """
    Get asset allocation breakdown by asset class for a portfolio.
    Returns the distribution of portfolio value across different asset classes (Equity, Fixed Income, Funds, etc.)
    """
    # Verify portfolio exists
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get account IDs for this portfolio
    account_ids = [acc.account_id for acc in portfolio.accounts]
    if not account_ids:
        return AllocationResponse(data=[], total_value=0.0, report_date="")
    
    # Determine report date
    if report_date:
        try:
            target_date = date.fromisoformat(report_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        # Get latest report date
        latest = db.query(func.max(Position.report_date)).filter(
            Position.account_id.in_(account_ids)
        ).scalar()
        if not latest:
            return AllocationResponse(data=[], total_value=0.0, report_date="")
        target_date = latest
    
    # Query positions grouped by asset class
    allocation_query = db.query(
        AssetClass.name.label('class_name'),
        func.sum(Position.position_value).label('total_value')
    ).join(
        Asset, Position.asset_id == Asset.asset_id
    ).join(
        AssetClass, Asset.class_id == AssetClass.class_id
    ).filter(
        Position.account_id.in_(account_ids),
        Position.report_date == target_date
    ).group_by(
        AssetClass.name
    ).all()
    
    # Calculate total and percentages
    total_value = sum(float(item.total_value or 0) for item in allocation_query)
    
    if total_value == 0:
        return AllocationResponse(data=[], total_value=0.0, report_date=str(target_date))
    
    allocation_items = []
    for idx, item in enumerate(allocation_query):
        value = float(item.total_value or 0)
        percentage = (value / total_value) * 100 if total_value > 0 else 0
        
        allocation_items.append(AllocationItem(
            name=item.class_name,
            value=round(value, 2),
            percentage=round(percentage, 2),
            color=get_color_for_index(idx)
        ))
    
    # Sort by value descending
    allocation_items.sort(key=lambda x: x.value, reverse=True)
    
    return AllocationResponse(
        data=allocation_items,
        total_value=round(total_value, 2),
        report_date=str(target_date)
    )


@router.get("/sector-allocation/{portfolio_id}", response_model=AllocationResponse)
def get_portfolio_sector_allocation(
    portfolio_id: int,
    db: Session = Depends(deps.get_db),
    report_date: Optional[str] = Query(None, description="Report date (YYYY-MM-DD). If not provided, uses the latest.")
) -> AllocationResponse:
    """
    Get sector allocation breakdown for a portfolio.
    Returns the distribution of portfolio value across different sectors/industries.
    """
    # Verify portfolio exists
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get account IDs for this portfolio
    account_ids = [acc.account_id for acc in portfolio.accounts]
    if not account_ids:
        return AllocationResponse(data=[], total_value=0.0, report_date="")
    
    # Determine report date
    if report_date:
        try:
            target_date = date.fromisoformat(report_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        # Get latest report date
        latest = db.query(func.max(Position.report_date)).filter(
            Position.account_id.in_(account_ids)
        ).scalar()
        if not latest:
            return AllocationResponse(data=[], total_value=0.0, report_date="")
        target_date = latest
    
    # Query positions grouped by sector
    # Use case to handle NULL industry_code as "Other"
    allocation_query = db.query(
        case(
            (Industry.sector.isnot(None), Industry.sector),
            else_="Other"
        ).label('sector_name'),
        func.sum(Position.position_value).label('total_value')
    ).join(
        Asset, Position.asset_id == Asset.asset_id
    ).outerjoin(
        Industry, Asset.industry_code == Industry.industry_code
    ).filter(
        Position.account_id.in_(account_ids),
        Position.report_date == target_date
    ).group_by(
        'sector_name'
    ).all()
    
    # Calculate total and percentages
    total_value = sum(float(item.total_value or 0) for item in allocation_query)
    
    if total_value == 0:
        return AllocationResponse(data=[], total_value=0.0, report_date=str(target_date))
    
    allocation_items = []
    for idx, item in enumerate(allocation_query):
        value = float(item.total_value or 0)
        percentage = (value / total_value) * 100 if total_value > 0 else 0
        
        allocation_items.append(AllocationItem(
            name=item.sector_name or "Other",
            value=round(value, 2),
            percentage=round(percentage, 2),
            color=get_color_for_index(idx)
        ))
    
    # Sort by value descending
    allocation_items.sort(key=lambda x: x.value, reverse=True)
    
    return AllocationResponse(
        data=allocation_items,
        total_value=round(total_value, 2),
        report_date=str(target_date)
    )


@router.get("/country-allocation/{portfolio_id}", response_model=AllocationResponse)
def get_portfolio_country_allocation(
    portfolio_id: int,
    db: Session = Depends(deps.get_db),
    report_date: Optional[str] = Query(None, description="Report date (YYYY-MM-DD). If not provided, uses the latest.")
) -> AllocationResponse:
    """
    Get country allocation breakdown for a portfolio.
    Returns the distribution of portfolio value across different countries.
    """
    # Verify portfolio exists
    portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    # Get account IDs for this portfolio
    account_ids = [acc.account_id for acc in portfolio.accounts]
    if not account_ids:
        return AllocationResponse(data=[], total_value=0.0, report_date="")
    
    # Determine report date
    if report_date:
        try:
            target_date = date.fromisoformat(report_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        # Get latest report date
        latest = db.query(func.max(Position.report_date)).filter(
            Position.account_id.in_(account_ids)
        ).scalar()
        if not latest:
            return AllocationResponse(data=[], total_value=0.0, report_date="")
        target_date = latest
    
    # Import Country model
    from app.models.asset import Country
    
    # Query positions grouped by country
    allocation_query = db.query(
        case(
            (Country.name.isnot(None), Country.name),
            else_="Other"
        ).label('country_name'),
        func.sum(Position.position_value).label('total_value')
    ).join(
        Asset, Position.asset_id == Asset.asset_id
    ).outerjoin(
        Country, Asset.country_code == Country.iso_code
    ).filter(
        Position.account_id.in_(account_ids),
        Position.report_date == target_date
    ).group_by(
        'country_name'
    ).all()
    
    # Calculate total and percentages
    total_value = sum(float(item.total_value or 0) for item in allocation_query)
    
    if total_value == 0:
        return AllocationResponse(data=[], total_value=0.0, report_date=str(target_date))
    
    allocation_items = []
    for idx, item in enumerate(allocation_query):
        value = float(item.total_value or 0)
        percentage = (value / total_value) * 100 if total_value > 0 else 0
        
        allocation_items.append(AllocationItem(
            name=item.country_name or "Other",
            value=round(value, 2),
            percentage=round(percentage, 2),
            color=get_color_for_index(idx)
        ))
    
    # Sort by value descending
    allocation_items.sort(key=lambda x: x.value, reverse=True)
    
    return AllocationResponse(
        data=allocation_items,
        total_value=round(total_value, 2),
        report_date=str(target_date)
    )
