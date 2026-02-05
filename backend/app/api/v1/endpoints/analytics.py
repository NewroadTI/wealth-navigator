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
                "account_holders": {},  # Dict para guardar account_id -> datos completos
                "accounts": [],
                "mark_prices": [],  # Lista de mkt_prices para calcular promedio
                "fx_rates": []  # Lista de fx_rates para calcular promedio
            }
        
        # Sumatorias agregadas
        data = aggregated[aid]
        qty = float(pos.quantity or 0)
        cost_money = float(pos.cost_basis_money or 0)
        market_value = float(pos.position_value or 0)
        pnl = float(pos.fifo_pnl_unrealized or 0)
        mark_price = float(pos.mark_price or 0)
        fx_rate = float(pos.fx_rate_to_base or 1.0)
        
        data["qty"] += qty
        data["market_value"] += market_value
        data["cost_money"] += cost_money
        data["pnl"] += pnl
        data["mark_prices"].append(mark_price)
        data["fx_rates"].append(fx_rate)
        
        # Guardar CADA CUENTA única con todos sus datos
        account_id = pos.account_id
        if account_id not in data["account_holders"]:
            institution = pos.account.institution  # Ej: IBKR
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
            
            # Calcular avg_cost_price para esta cuenta
            acct_avg_price = cost_money / qty if qty != 0 else 0
            
            data["account_holders"][account_id] = {
                "institution": institution,
                "user_name": user_name,
                "quantity": qty,
                "cost_money": cost_money,
                "avg_cost_price": acct_avg_price,
                "market_price": mark_price,  # Para futura implementación
                "market_value": market_value,
                "unrealized_pnl": pnl,
                "fx_rate_to_base": fx_rate,
            }
        else:
            # Acumular si hay múltiples posiciones del mismo asset en la misma cuenta
            holder = data["account_holders"][account_id]
            holder["quantity"] += qty
            holder["cost_money"] += cost_money
            holder["market_value"] += market_value
            holder["unrealized_pnl"] += pnl
            # Recalcular avg_cost_price
            holder["avg_cost_price"] = holder["cost_money"] / holder["quantity"] if holder["quantity"] != 0 else 0
        
        if account_id not in data["accounts"]:
            data["accounts"].append(account_id)

    # 4. Construir respuesta final calculando promedios y cambios
    from app.schemas.analytics import InstitutionInfo
    import statistics
    
    results = []
    
    for aid, data in aggregated.items():
        # Calcular Avg Price Ponderado (agregado)
        avg_price = data["cost_money"] / data["qty"] if data["qty"] != 0 else 0
        
        # Calcular promedio de mkt_price de hoy (en caso de múltiples custodios)
        price_today = sum(data["mark_prices"]) / len(data["mark_prices"]) if data["mark_prices"] else 0
        
        # Calcular promedio de fx_rate_to_base
        avg_fx_rate = sum(data["fx_rates"]) / len(data["fx_rates"]) if data["fx_rates"] else 1.0
        
        # Calcular Day Change % (agregado)
        price_yesterday = float(prev_prices_map.get(aid, 0))
        
        day_change_pct = 0.0
        if price_yesterday > 0:
            day_change_pct = ((price_today - price_yesterday) / price_yesterday) * 100
        
        # Construir lista de account holders con datos completos
        # Y calcular distribución de rendimientos
        institutions_list = []
        pnl_percentages = []  # Lista de PnL % por cuenta para calcular distribución
        gainers = 0
        losers = 0
        neutrals = 0
        
        for account_id, holder_data in data["account_holders"].items():
            # Calcular day_change_pct por cuenta (usando el mark_price de la cuenta vs promedio del día anterior)
            acct_day_change = 0.0
            if price_yesterday > 0 and holder_data.get("market_price", 0) > 0:
                acct_day_change = ((holder_data["market_price"] - price_yesterday) / price_yesterday) * 100
            
            # Calcular PnL % para esta cuenta (unrealized_pnl / cost_money * 100)
            acct_pnl_pct = 0.0
            if holder_data.get("cost_money", 0) > 0:
                acct_pnl_pct = (holder_data["unrealized_pnl"] / holder_data["cost_money"]) * 100
            pnl_percentages.append(acct_pnl_pct)
            
            # Contar gainers/losers
            if holder_data["unrealized_pnl"] > 0:
                gainers += 1
            elif holder_data["unrealized_pnl"] < 0:
                losers += 1
            else:
                neutrals += 1
            
            institutions_list.append(InstitutionInfo(
                institution=holder_data["institution"],
                account_id=account_id,
                user_name=holder_data["user_name"],
                quantity=holder_data["quantity"],
                avg_cost_price=holder_data["avg_cost_price"],
                cost_basis_money=holder_data["cost_money"],
                market_price=holder_data["market_price"],
                market_value=holder_data["market_value"],
                unrealized_pnl=holder_data["unrealized_pnl"],
                day_change_pct=acct_day_change,
                fx_rate_to_base=holder_data["fx_rate_to_base"]
            ))
        
        # Calcular estadísticas de distribución
        best_pnl_pct = max(pnl_percentages) if pnl_percentages else None
        worst_pnl_pct = min(pnl_percentages) if pnl_percentages else None
        median_pnl_pct = statistics.median(pnl_percentages) if pnl_percentages else None
            
        # Crear objeto de respuesta
        item = PositionAggregated(
            asset_id=aid,
            asset_symbol=data["asset_obj"].symbol,
            asset_class=str(data["asset_obj"].class_id),
            
            total_quantity=data["qty"],
            avg_cost_price=avg_price,
            total_cost_basis_money=data["cost_money"],
            current_mark_price=price_today,
            total_market_value=data["market_value"],
            
            total_pnl_unrealized=data["pnl"],
            day_change_pct=day_change_pct,
            
            # Distribución de rendimiento
            gainers_count=gainers,
            losers_count=losers,
            neutral_count=neutrals,
            best_pnl_pct=best_pnl_pct,
            worst_pnl_pct=worst_pnl_pct,
            median_pnl_pct=median_pnl_pct,
            
            institutions=institutions_list,
            account_ids=data["accounts"],
            fx_rate_to_base=avg_fx_rate
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