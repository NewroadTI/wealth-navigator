from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.api import deps
from app.models.asset import Position
from app.models.asset import Asset, AssetClass
from app.models.portfolio import Account, Portfolio
from app.schemas.analytics import PositionAggregated, MoversResponse, TopMover

router = APIRouter()

def get_previous_date(db: Session, target_date: date) -> Optional[date]:
    """Busca la fecha disponible anterior más cercana a la target_date."""
    prev_date_query = db.query(func.max(Position.report_date)).filter(
        Position.report_date < target_date
    ).scalar()
    return prev_date_query

@router.get("/positions-report", response_model=List[PositionAggregated])
def get_positions_aggregated_report(
    db: Session = Depends(deps.get_db),
    report_date: date = Query(..., description="Fecha del reporte"),
    portfolio_id: Optional[int] = None,
    asset_class_id: Optional[int] = None,
    asset_subclass_id: Optional[int] = None,
    asset_id: Optional[int] = None,
):
    """
    Genera la TABLA PRINCIPAL con agregación por Asset.
    Calcula promedios ponderados y agrupa instituciones.
    """
    
    # 1. Query Base para HOY (Filtrado)
    query = db.query(Position).join(Asset).join(Account).join(Portfolio)
    
    query = query.filter(Position.report_date == report_date)
    
    if portfolio_id:
        query = query.filter(Portfolio.portfolio_id == portfolio_id)
    if asset_id:
        query = query.filter(Position.asset_id == asset_id)
    if asset_class_id:
        query = query.filter(Asset.class_id == asset_class_id)
    if asset_subclass_id:
        query = query.filter(Asset.sub_class_id == asset_subclass_id)
        
    current_positions = query.all()

    # 2. Obtener precios del DÍA ANTERIOR (Para calcular % change)
    # Necesitamos el promedio de mkt_price para cada asset en el día anterior
    prev_date = get_previous_date(db, report_date)
    prev_prices_map = {} # Diccionario {asset_id: avg_mark_price}
    
    if prev_date:
        # Reutilizamos filtros excepto la fecha
        prev_query = db.query(Position.asset_id, Position.mark_price).join(Asset).join(Account).join(Portfolio)
        prev_query = prev_query.filter(Position.report_date == prev_date)
        
        if portfolio_id:
            prev_query = prev_query.filter(Portfolio.portfolio_id == portfolio_id)
        
        prev_data = prev_query.all()
        
        # Calcular promedio de mkt_price por asset_id
        prev_prices_agg = {}
        for row in prev_data:
            aid = row.asset_id
            price = float(row.mark_price or 0)
            if aid not in prev_prices_agg:
                prev_prices_agg[aid] = []
            prev_prices_agg[aid].append(price)
        
        # Calcular promedio
        for aid, prices in prev_prices_agg.items():
            prev_prices_map[aid] = sum(prices) / len(prices) if prices else 0

    # 3. Agregación en Python (Grouping)
    # Usamos un diccionario para agrupar las posiciones por Asset ID
    aggregated = {}

    for pos in current_positions:
        aid = pos.asset_id
        
        if aid not in aggregated:
            aggregated[aid] = {
                "asset_obj": pos.asset,
                "qty": 0.0,
                "market_value": 0.0,
                "cost_money": 0.0,
                "pnl": 0.0,
                "institution_accounts": {},  # Dict para guardar institución -> (account_id, user_name)
                "accounts": [],
                "mark_prices": []  # Lista de mkt_prices para calcular promedio
            }
        
        # Sumatorias
        data = aggregated[aid]
        qty = float(pos.quantity or 0)
        
        data["qty"] += qty
        data["market_value"] += float(pos.position_value or 0)
        data["cost_money"] += float(pos.cost_basis_money or 0)
        data["pnl"] += float(pos.fifo_pnl_unrealized or 0)
        data["mark_prices"].append(float(pos.mark_price or 0))
        
        # Guardar institución con info del usuario
        institution = pos.account.institution  # Ej: IBKR
        if institution not in data["institution_accounts"]:
            # Obtener el usuario del portfolio propietario
            portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == pos.account.portfolio_id).first()
            user_name = None
            if portfolio and portfolio.owner:
                full_name = portfolio.owner.full_name or ""
                parts = full_name.split()
                if len(parts) >= 2:
                    first_name = parts[0][:4].lower()  # 4 letras primer nombre
                    last_name = parts[-1][:3].lower()  # 3 letras último apellido
                    user_name = f"{first_name}_{last_name}"
            data["institution_accounts"][institution] = (pos.account_id, user_name)
        
        data["accounts"].append(pos.account_id)

    # 4. Construir respuesta final calculando promedios y cambios
    from app.schemas.analytics import InstitutionInfo
    results = []
    
    for aid, data in aggregated.items():
        # Calcular Avg Price Ponderado
        avg_price = data["cost_money"] / data["qty"] if data["qty"] != 0 else 0
        
        # Calcular promedio de mkt_price de hoy (en caso de múltiples custodios)
        price_today = sum(data["mark_prices"]) / len(data["mark_prices"]) if data["mark_prices"] else 0
        
        # Calcular Day Change %
        price_yesterday = float(prev_prices_map.get(aid, 0))
        
        day_change_pct = 0.0
        if price_yesterday > 0:
            day_change_pct = ((price_today - price_yesterday) / price_yesterday) * 100
        
        # Construir lista de instituciones con info de usuario
        institutions_list = []
        for institution, (account_id, user_name) in data["institution_accounts"].items():
            institutions_list.append(InstitutionInfo(
                institution=institution,
                account_id=account_id,
                user_name=user_name
            ))
            
        # Crear objeto de respuesta
        item = PositionAggregated(
            asset_id=aid,
            asset_symbol=data["asset_obj"].symbol,
            asset_class=str(data["asset_obj"].class_id),
            
            total_quantity=data["qty"],
            avg_cost_price=avg_price,
            current_mark_price=price_today,
            total_market_value=data["market_value"],
            
            total_pnl_unrealized=data["pnl"],
            day_change_pct=day_change_pct,
            
            institutions=institutions_list,
            account_ids=data["accounts"]
        )
        results.append(item)
        
    return results


@router.get("/movers", response_model=MoversResponse)
def get_top_movers(
    db: Session = Depends(deps.get_db),
    report_date: date = Query(..., description="Fecha base para comparar"),
    limit: int = 5
):
    """
    Obtiene los Top Gainers y Top Losers basados en el cambio de precio
    entre report_date y el día anterior disponible.
    """
    prev_date = get_previous_date(db, report_date)
    
    if not prev_date:
        # Si no hay histórico, devolvemos listas vacías
        return MoversResponse(gainers=[], losers=[])

    # SQL Puro o SQLAlchemy optimizado para no traer todas las rows a memoria
    # Estrategia: Obtener precios de hoy y ayer y calcular en Python (Más seguro por duplicados)
    
    # Precios HOY (Distinct por Asset para evitar duplicados si hay múltiples cuentas)
    today_prices = db.query(
        Position.asset_id, 
        Position.mark_price, 
        Asset.symbol, 
        Asset.description
    ).join(Asset).filter(
        Position.report_date == report_date
    ).distinct(Position.asset_id).all()
    
    # Precios AYER
    yesterday_prices = db.query(
        Position.asset_id, 
        Position.mark_price
    ).filter(
        Position.report_date == prev_date
    ).distinct(Position.asset_id).all()
    
    y_prices_map = {p.asset_id: float(p.mark_price or 0) for p in yesterday_prices}
    
    calculated_movers = []
    
    for item in today_prices:
        aid = item.asset_id
        curr_price = float(item.mark_price or 0)
        prev_price = y_prices_map.get(aid, 0)
        
        if prev_price > 0:
            pct_change = ((curr_price - prev_price) / prev_price) * 100
            
            calculated_movers.append(TopMover(
                asset_id=aid,
                asset_symbol=item.symbol,
                asset_name=item.description,
                current_price=curr_price,
                previous_price=prev_price,
                change_pct=pct_change,
                direction="UP" if pct_change >= 0 else "DOWN"
            ))

    # Ordenar lista
    # Gainers: Mayor a menor
    gainers = sorted(calculated_movers, key=lambda x: x.change_pct, reverse=True)[:limit]
    
    # Losers: Menor a mayor
    losers = sorted(calculated_movers, key=lambda x: x.change_pct)[:limit]
    
    return MoversResponse(gainers=gainers, losers=losers)


@router.get("/filter-options")
def get_filter_options(
    db: Session = Depends(deps.get_db),
):
    """
    Retorna las opciones disponibles para los filtros de Positions:
    - Portfolios
    - Asset Classes
    - Asset SubClasses
    - Assets
    - Available Report Dates
    """
    from app.models.portfolio import Portfolio
    from app.models.asset import AssetClass, AssetSubClass, Asset
    
    # Obtener Portfolios activos
    portfolios = db.query(Portfolio.portfolio_id, Portfolio.name).filter(
        Portfolio.active_status == True
    ).all()
    
    # Obtener Asset Classes
    asset_classes = db.query(AssetClass.class_id, AssetClass.code, AssetClass.name).all()
    
    # Obtener Asset SubClasses
    asset_subclasses = db.query(
        AssetSubClass.sub_class_id, 
        AssetSubClass.class_id,
        AssetSubClass.code, 
        AssetSubClass.name
    ).all()
    
    # Obtener Assets (todos los que están en posiciones)
    assets = db.query(
        Asset.asset_id,
        Asset.symbol,
        Asset.description,
        Asset.class_id,
        Asset.sub_class_id
    ).distinct(Asset.asset_id).all()
    
    # Obtener fechas disponibles en los reportes
    available_dates = db.query(Position.report_date).distinct().order_by(
        Position.report_date.desc()
    ).all()
    
    return {
        "portfolios": [
            {"id": p.portfolio_id, "name": p.name} for p in portfolios
        ],
        "asset_classes": [
            {"id": ac.class_id, "code": ac.code, "name": ac.name} for ac in asset_classes
        ],
        "asset_subclasses": [
            {"id": as_.sub_class_id, "class_id": as_.class_id, "code": as_.code, "name": as_.name} 
            for as_ in asset_subclasses
        ],
        "assets": [
            {
                "id": a.asset_id, 
                "symbol": a.symbol, 
                "name": a.description,
                "class_id": a.class_id,
                "subclass_id": a.sub_class_id
            } for a in assets
        ],
        "available_dates": [d.report_date.isoformat() for d in available_dates if d.report_date]
    }