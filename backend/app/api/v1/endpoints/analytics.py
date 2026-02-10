from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
import asyncio
import json
import logging

from app.api import deps
from app.models.asset import Position
from app.models.asset import Asset, AssetClass
from app.models.portfolio import Account, Portfolio
from app.models.user import User
from app.db.session import SessionLocal
from app.schemas.analytics import (
    PositionAggregated, MoversResponse, TopMover,
    LivePriceRequest, LivePriceResponse, LivePriceItem
)

router = APIRouter()
sse_logger = logging.getLogger(__name__)

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
    query = query.options(
        joinedload(Position.account).joinedload(Account.portfolio).joinedload(Portfolio.owner)
    )
    
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
                "fx_rates": [],  # Lista de fx_rates para calcular promedio
                "currencies": []  # Lista de currencies
            }
        
        # Sumatorias agregadas
        data = aggregated[aid]
        qty = float(pos.quantity or 0)
        cost_money = float(pos.cost_basis_money or 0)
        market_value = float(pos.position_value or 0)
        pnl = float(pos.fifo_pnl_unrealized or 0)
        mark_price = float(pos.mark_price or 0)
        fx_rate = float(pos.fx_rate_to_base or 1.0)
        currency = pos.currency or "USD"
        
        data["qty"] += qty
        data["market_value"] += market_value
        data["cost_money"] += cost_money
        data["pnl"] += pnl
        data["mark_prices"].append(mark_price)
        data["fx_rates"].append(fx_rate)
        data["currencies"].append(currency)
        
        # Guardar CADA CUENTA única con todos sus datos
        account_id = pos.account_id
        if account_id not in data["account_holders"]:
            institution = pos.account.institution  # Ej: IBKR
            # Obtener el usuario del portfolio propietario
            portfolio = db.query(Portfolio).filter(Portfolio.portfolio_id == pos.account.portfolio_id).first()
            user_name = None
            user_first_name = None
            user_last_name = None
            if portfolio and portfolio.owner:
                full_name = portfolio.owner.full_name or ""
                parts = full_name.split()
                if len(parts) >= 2:
                    first_name = parts[0][:4].lower()  # 4 letras primer nombre
                    last_name = parts[-1][:3].lower()  # 3 letras último apellido
                    user_name = f"{first_name}_{last_name}"
                    user_first_name = parts[0]  # Nombre completo
                    user_last_name = parts[-1]  # Apellido completo
            
            # Calcular avg_cost_price para esta cuenta
            acct_avg_price = cost_money / qty if qty != 0 else 0
            
            data["account_holders"][account_id] = {
                "institution": institution,
                "user_name": user_name,
                "user_first_name": user_first_name,
                "user_last_name": user_last_name,
                "quantity": qty,
                "cost_money": cost_money,
                "avg_cost_price": acct_avg_price,
                "market_price": mark_price,  # Para futura implementación
                "market_value": market_value,
                "unrealized_pnl": pnl,
                "fx_rate_to_base": fx_rate,
                "currency": currency,
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
                user_first_name=holder_data["user_first_name"],
                user_last_name=holder_data["user_last_name"],
                quantity=holder_data["quantity"],
                avg_cost_price=holder_data["avg_cost_price"],
                cost_basis_money=holder_data["cost_money"],
                market_price=holder_data["market_price"],
                market_value=holder_data["market_value"],
                unrealized_pnl=holder_data["unrealized_pnl"],
                day_change_pct=acct_day_change,
                fx_rate_to_base=holder_data["fx_rate_to_base"],
                currency=holder_data["currency"]
            ))
        
        # Calcular estadísticas de distribución
        best_pnl_pct = max(pnl_percentages) if pnl_percentages else None
        worst_pnl_pct = min(pnl_percentages) if pnl_percentages else None
        median_pnl_pct = statistics.median(pnl_percentages) if pnl_percentages else None
        
        # Determinar moneda predominante (la más común)
        from collections import Counter
        currency_counts = Counter(data["currencies"])
        predominant_currency = currency_counts.most_common(1)[0][0] if currency_counts else "USD"
            
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
            fx_rate_to_base=avg_fx_rate,
            currency=predominant_currency
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


# =============================================================================
# LIVE DATA ENDPOINTS - Real-time prices from IB Gateway
# =============================================================================

@router.post("/live-prices", response_model=LivePriceResponse)
def get_live_prices(
    request: LivePriceRequest
):
    """
    Fetch live market prices from IB Gateway for the specified assets.
    
    This endpoint:
    1. Receives a list of asset_ids from the frontend (current page positions)
    2. Looks up the ISIN and symbol for each asset
    3. Fetches live prices from IB Gateway
    4. Returns updated prices mapped by asset_id
    
    Priority for matching:
    1. ISIN from IBKR API -> ISIN from positions
    2. Symbol from IBKR API -> Symbol from positions
    """
    from app.services.ibkr_live_data import get_ibkr_service
    import logging
    
    logger = logging.getLogger(__name__)
    
    if not request.asset_ids:
        return LivePriceResponse(
            prices=[],
            success=True,
            connected=False,
            message="No assets requested"
        )
    
    # Init vars
    assets = []
    prev_prices_map = {}
    
    # 1. & 2. Get asset info and previous prices - SHORT LIVED DB CONNECTION
    with SessionLocal() as db:
        assets = db.query(
            Asset.asset_id,
            Asset.symbol,
            Asset.isin,
            Asset.description
        ).filter(Asset.asset_id.in_(request.asset_ids)).all()
        
        if not assets:
            return LivePriceResponse(
                prices=[],
                success=False,
                connected=False,
                message="No assets found for the given IDs"
            )
        
        # Get previous day prices for day change calculation
        try:
            latest_date = db.query(func.max(Position.report_date)).scalar()
            prev_date = get_previous_date(db, latest_date) if latest_date else None
            
            if prev_date:
                prev_positions = db.query(
                    Position.asset_id,
                    Position.mark_price
                ).filter(
                    Position.report_date == prev_date,
                    Position.asset_id.in_(request.asset_ids)
                ).all()
                
                # Average if multiple positions per asset
                from collections import defaultdict
                temp_prices = defaultdict(list)
                for p in prev_positions:
                    temp_prices[p.asset_id].append(float(p.mark_price or 0))
                
                for aid, prices in temp_prices.items():
                    prev_prices_map[aid] = sum(prices) / len(prices) if prices else 0
        except Exception as e:
            logger.error(f"Error fetching previous prices: {e}")
            # Continue without previous prices
    
    # --- END OF DB SESSION ---
    # Connection is now closed and returned to pool
    
    # Build lookup structures
    asset_by_id = {a.asset_id: a for a in assets}
    isin_to_asset_id = {}
    symbol_to_asset_id = {}
    
    asset_identifiers = []
    
    for asset in assets:
        identifier = {"asset_id": asset.asset_id}
        
        if asset.symbol:
            identifier["symbol"] = asset.symbol
            symbol_to_asset_id[asset.symbol.upper()] = asset.asset_id
            
        if asset.isin:
            identifier["isin"] = asset.isin
            isin_to_asset_id[asset.isin.upper()] = asset.asset_id
            
        asset_identifiers.append(identifier)
    
    # 3. Connect to IB Gateway and fetch live prices

    ibkr_service = get_ibkr_service()
    
    try:
        live_prices = ibkr_service.get_live_prices_batch(asset_identifiers)
    except Exception as e:
        logger.error(f"Error fetching live prices: {e}")
        return LivePriceResponse(
            prices=[],
            success=False,
            connected=False,
            message=f"Failed to connect to IB Gateway: {str(e)}"
        )
    
    if not live_prices:
        return LivePriceResponse(
            prices=[],
            success=True,
            connected=ibkr_service.is_connected(),
            message="No live prices available"
        )
    
    # 4. Map live prices back to asset_ids
    result_prices = []
    
    for asset in assets:
        # Try to find live price by symbol first (more reliable)
        live_price = None
        
        if asset.symbol and asset.symbol.upper() in live_prices:
            live_price = live_prices[asset.symbol.upper()]
        elif asset.symbol and asset.symbol in live_prices:
            live_price = live_prices[asset.symbol]
        elif asset.isin and asset.isin.upper() in live_prices:
            live_price = live_prices[asset.isin.upper()]
        elif asset.isin and asset.isin in live_prices:
            live_price = live_prices[asset.isin]
        
        if live_price:
            # Calculate day change vs previous close
            prev_price = prev_prices_map.get(asset.asset_id, 0)
            day_change_pct = 0.0
            
            if prev_price > 0:
                day_change_pct = ((live_price.price - prev_price) / prev_price) * 100
            
            result_prices.append(LivePriceItem(
                asset_id=asset.asset_id,
                symbol=asset.symbol,
                isin=asset.isin,
                live_price=live_price.price,
                previous_close=prev_price if prev_price > 0 else None,
                day_change_pct=day_change_pct,
                bid=live_price.bid,
                ask=live_price.ask,
                last=live_price.last,
                timestamp=live_price.timestamp.isoformat() if live_price.timestamp else None,
                currency=live_price.currency
            ))
    
    return LivePriceResponse(
        prices=result_prices,
        success=True,
        connected=True,
        message=f"Fetched {len(result_prices)} live prices"
    )


@router.get("/live-movers", response_model=MoversResponse)
def get_live_movers(
    db: Session = Depends(deps.get_db),
    asset_ids: List[int] = Query(..., description="List of asset IDs to compare"),
    limit: int = 5
):
    """
    Calculate top movers from current page positions vs previous day.
    Only uses database records (no live data).
    Only considers the assets specified in asset_ids (current page).
    """
    if not asset_ids:
        return MoversResponse(gainers=[], losers=[])
    
    # Get asset info
    assets = db.query(
        Asset.asset_id,
        Asset.symbol,
        Asset.description
    ).filter(Asset.asset_id.in_(asset_ids)).all()
    
    if not assets:
        return MoversResponse(gainers=[], losers=[])
    
    # Get latest date
    latest_date = db.query(func.max(Position.report_date)).scalar()
    if not latest_date:
        return MoversResponse(gainers=[], losers=[])
    
    # Get previous day
    prev_date = get_previous_date(db, latest_date)
    if not prev_date:
        return MoversResponse(gainers=[], losers=[])
    
    # Get current prices (latest date)
    current_positions = db.query(
        Position.asset_id,
        Position.mark_price
    ).filter(
        Position.report_date == latest_date,
        Position.asset_id.in_(asset_ids)
    ).all()
    
    from collections import defaultdict
    current_prices_temp = defaultdict(list)
    for p in current_positions:
        current_prices_temp[p.asset_id].append(float(p.mark_price or 0))
    
    current_prices_map = {}
    for aid, prices in current_prices_temp.items():
        current_prices_map[aid] = sum(prices) / len(prices) if prices else 0
    
    # Get previous day prices
    prev_positions = db.query(
        Position.asset_id,
        Position.mark_price
    ).filter(
        Position.report_date == prev_date,
        Position.asset_id.in_(asset_ids)
    ).all()
    
    prev_prices_temp = defaultdict(list)
    for p in prev_positions:
        prev_prices_temp[p.asset_id].append(float(p.mark_price or 0))
    
    prev_prices_map = {}
    for aid, prices in prev_prices_temp.items():
        prev_prices_map[aid] = sum(prices) / len(prices) if prices else 0
    
    # Calculate movers
    movers = []
    
    for asset in assets:
        current_price = current_prices_map.get(asset.asset_id, 0)
        prev_price = prev_prices_map.get(asset.asset_id, 0)
        
        if current_price > 0 and prev_price > 0:
            pct_change = ((current_price - prev_price) / prev_price) * 100
            
            movers.append(TopMover(
                asset_id=asset.asset_id,
                asset_symbol=asset.symbol,
                asset_name=asset.description,
                current_price=current_price,
                previous_price=prev_price,
                change_pct=pct_change,
                direction="UP" if pct_change >= 0 else "DOWN"
            ))
    
    # Sort and return top gainers/losers
    gainers = sorted(movers, key=lambda x: x.change_pct, reverse=True)[:limit]
    losers = sorted(movers, key=lambda x: x.change_pct)[:limit]
    
    return MoversResponse(gainers=gainers, losers=losers)


@router.get("/live-status")
def get_live_data_status():
    """
    Check the connection status to IB Gateway.
    """
    from app.services.ibkr_live_data import get_ibkr_service
    
    service = get_ibkr_service()
    connected = service.is_connected()
    
    return {
        "connected": connected,
        "gateway_host": service.gateway_host,
        "gateway_port": service.gateway_port,
        "message": "Connected to IB Gateway" if connected else "Not connected to IB Gateway"
    }


# ==================== SSE LIVE PRICES ====================

@router.get("/live-prices/stream")
async def live_prices_stream(
    request: Request,
    asset_ids: str = Query(None, description="Comma-separated list of asset IDs to subscribe to (optional, can use POST /subscribe after connecting)")
):
    """
    Server-Sent Events endpoint for live price streaming.
    
    The client can optionally subscribe with a list of asset IDs in the URL,
    or connect first and then use POST /live-prices/subscribe to set the subscription.
    The server fetches prices every 15 seconds and pushes updates to all connected clients.
    
    Usage:
        // Connect without initial subscription
        const evtSource = new EventSource('/api/v1/analytics/live-prices/stream');
        evtSource.addEventListener('connected', (e) => {
            const data = JSON.parse(e.data);
            // Use data.connection_id to subscribe via POST /live-prices/subscribe
        });
        
        // Or connect with immediate subscription (for small lists)
        const evtSource = new EventSource('/api/v1/analytics/live-prices/stream?asset_ids=1,2,3');
        
        evtSource.addEventListener('prices', (e) => {
            const data = JSON.parse(e.data);
            console.log(data.prices);
        });
    
    Events:
        - connected: Initial connection confirmation with connection_id and cached prices
        - prices: Price updates (every ~15 seconds)
        - heartbeat: Keep-alive signal (every ~30 seconds)
        - error: Error messages
    """
    from app.services.live_prices_sse import get_sse_manager, SSEMessage
    from dataclasses import asdict
    
    # Parse asset IDs if provided
    parsed_asset_ids = []
    if asset_ids:
        try:
            parsed_asset_ids = [int(x.strip()) for x in asset_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid asset_ids format. Use comma-separated integers.")
        
        if len(parsed_asset_ids) > 100:
            raise HTTPException(status_code=400, detail="Maximum 100 assets per subscription")
    
    manager = get_sse_manager()
    
    async def event_generator():
        """Generate SSE events for the client."""
        connection = manager.create_connection()
        manager.update_subscription(connection.connection_id, parsed_asset_ids)
        
        try:
            # Send initial connected event with cached prices
            cached = manager.get_cached_prices(parsed_asset_ids)
            await connection.send(SSEMessage(
                event="connected",
                data={
                    "connection_id": connection.connection_id,
                    "subscribed_assets": len(parsed_asset_ids),
                    "cached_prices": [asdict(p) for p in cached] if cached else [],
                    "message": "Connected to live prices stream"
                }
            ))
            
            # Main event loop
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    sse_logger.info(f"Client disconnected: {connection.connection_id[:8]}")
                    break
                
                try:
                    # Wait for message with timeout (for heartbeat)
                    message = await asyncio.wait_for(
                        connection.queue.get(),
                        timeout=35.0  # Slightly longer than heartbeat interval
                    )
                    yield message.format()
                    
                except asyncio.TimeoutError:
                    # Send heartbeat if no messages
                    heartbeat = SSEMessage(
                        event="heartbeat",
                        data={"timestamp": asyncio.get_event_loop().time()}
                    )
                    yield heartbeat.format()
                    
        except asyncio.CancelledError:
            sse_logger.info(f"SSE connection cancelled: {connection.connection_id[:8]}")
        except Exception as e:
            sse_logger.error(f"SSE error: {e}")
            error_msg = SSEMessage(
                event="error",
                data={"message": str(e)}
            )
            yield error_msg.format()
        finally:
            manager.remove_connection(connection.connection_id)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.post("/live-prices/subscribe")
async def update_subscription(
    request: LivePriceRequest,
    connection_id: str = Query(..., description="SSE connection ID to update")
):
    """
    Update the asset subscription for an existing SSE connection.
    
    This allows changing which assets a client receives updates for
    without reconnecting.
    """
    from app.services.live_prices_sse import get_sse_manager
    
    manager = get_sse_manager()
    manager.update_subscription(connection_id, request.asset_ids)
    
    return {
        "success": True,
        "connection_id": connection_id,
        "subscribed_assets": len(request.asset_ids)
    }


@router.get("/live-prices/status")
def get_sse_status():
    """Get the status of the SSE live prices service."""
    from app.services.live_prices_sse import get_sse_manager
    from app.services.ibkr_live_data import get_ibkr_service
    
    manager = get_sse_manager()
    ibkr = get_ibkr_service()
    
    return {
        "active_connections": manager.connection_count,
        "subscribed_assets": manager.subscribed_asset_count,
        "cached_prices": len(manager._last_prices),
        "ibkr_connected": ibkr.is_connected(),
        "fetch_interval_seconds": manager._fetch_interval
    }