from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps

# Importamos el Modelo (SQLAlchemy) y el Schema (Pydantic)
from app.models.asset import Country, Currency, StockExchange, MarketIndex, AssetClass, AssetSubClass, Asset
from app.schemas.asset import (
    CountryRead, CountryCreate, CountryUpdate,
    CurrencyRead, CurrencyCreate, CurrencyUpdate,
    StockExchangeRead, StockExchangeCreate, StockExchangeUpdate,
    MarketIndexRead, MarketIndexCreate, MarketIndexUpdate,
    AssetClassRead, AssetClassCreate, AssetClassUpdate
)

router = APIRouter()

@router.get("/countries", response_model=List[CountryRead])
def get_countries(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 300 # Límite alto por defecto para traer todos los países de una
) -> Any:
    """
    Recupera el catálogo maestro de países.
    """
    countries = db.query(Country).order_by(Country.name).offset(skip).limit(limit).all()
    return countries


@router.post("/countries", response_model=CountryRead, status_code=status.HTTP_201_CREATED)
def create_country(
    payload: CountryCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea un nuevo país en el catálogo.
    """
    # Verificar si ya existe
    existing = db.query(Country).filter(Country.iso_code == payload.iso_code.upper()).first()
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Country with ISO code '{payload.iso_code}' already exists."
        )
    
    # Crear nuevo país
    new_country = Country(
        iso_code=payload.iso_code.upper(),
        name=payload.name
    )
    
    db.add(new_country)
    db.commit()
    db.refresh(new_country)
    return new_country


@router.put("/countries/{iso_code}", response_model=CountryRead)
def update_country(
    iso_code: str,
    payload: CountryUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza un país existente.
    """
    country = db.query(Country).filter(Country.iso_code == iso_code.upper()).first()
    if not country:
        raise HTTPException(
            status_code=404, 
            detail=f"Country with ISO code '{iso_code}' was not found."
        )
    
    # Actualizar el nombre
    country.name = payload.name
    
    db.commit()
    db.refresh(country)
    return country


@router.delete("/countries/{iso_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_country(
    iso_code: str,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Elimina un país del catálogo.
    """
    country = db.query(Country).filter(Country.iso_code == iso_code.upper()).first()
    if not country:
        raise HTTPException(
            status_code=404, 
            detail=f"Country with ISO code '{iso_code}' was not found."
        )
    
    # Verificar si hay activos o exchanges usando este país
    from app.models.asset import Asset
    assets_count = db.query(Asset).filter(Asset.country_code == iso_code.upper()).count()
    exchanges_count = db.query(StockExchange).filter(StockExchange.country_code == iso_code.upper()).count()
    
    if assets_count > 0 or exchanges_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete country '{country.name}' because it has {assets_count} asset(s) and {exchanges_count} exchange(s) associated."
        )
    
    db.delete(country)
    db.commit()


@router.get("/currencies", response_model=List[CurrencyRead])
def get_currencies(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Recupera el catálogo de monedas soportadas (ISO 4217).
    """
    currencies = db.query(Currency).order_by(Currency.code).offset(skip).limit(limit).all()
    return currencies


@router.post("/currencies", response_model=CurrencyRead, status_code=status.HTTP_201_CREATED)
def create_currency(
    payload: CurrencyCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea una nueva moneda en el catálogo.
    """
    # Verificar si ya existe
    existing = db.query(Currency).filter(Currency.code == payload.code.upper()).first()
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Currency with code '{payload.code}' already exists."
        )
    
    # Crear nueva moneda
    new_currency = Currency(
        code=payload.code.upper(),
        name=payload.name
    )
    
    db.add(new_currency)
    db.commit()
    db.refresh(new_currency)
    return new_currency


@router.put("/currencies/{code}", response_model=CurrencyRead)
def update_currency(
    code: str,
    payload: CurrencyUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza una moneda existente.
    """
    currency = db.query(Currency).filter(Currency.code == code.upper()).first()
    if not currency:
        raise HTTPException(
            status_code=404, 
            detail=f"Currency with code '{code}' was not found."
        )
    
    # Actualizar el nombre
    currency.name = payload.name
    
    db.commit()
    db.refresh(currency)
    return currency


@router.delete("/currencies/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_currency(
    code: str,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Elimina una moneda del catálogo.
    """
    currency = db.query(Currency).filter(Currency.code == code.upper()).first()
    if not currency:
        raise HTTPException(
            status_code=404, 
            detail=f"Currency with code '{code}' was not found."
        )
    
    # Verificar si hay activos usando esta moneda
    from app.models.asset import Asset
    assets_count = db.query(Asset).filter(Asset.currency == code.upper()).count()
    
    if assets_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete currency '{currency.name}' because it has {assets_count} asset(s) associated."
        )
    
    db.delete(currency)
    db.commit()


# 2. ENDPOINT DE EXCHANGES
@router.get("/exchanges", response_model=List[StockExchangeRead])
def get_stock_exchanges(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Lista las bolsas de valores (Stock Exchanges) soportadas.
    """
    exchanges = db.query(StockExchange).order_by(StockExchange.exchange_code).offset(skip).limit(limit).all()
    return exchanges


@router.post("/exchanges", response_model=StockExchangeRead, status_code=status.HTTP_201_CREATED)
def create_stock_exchange(
    payload: StockExchangeCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea una bolsa de valores (Stock Exchange).
    """
    existing = db.query(StockExchange).filter(StockExchange.exchange_code == payload.exchange_code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Stock exchange already exists.")

    if payload.country_code:
        country = db.query(Country).filter(Country.iso_code == payload.country_code.upper()).first()
        if not country:
            raise HTTPException(status_code=400, detail="Country code does not exist.")

    obj = StockExchange(
        exchange_code=payload.exchange_code.upper(),
        name=payload.name,
        country_code=payload.country_code.upper() if payload.country_code else None,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/exchanges/{exchange_code}", response_model=StockExchangeRead)
def update_stock_exchange(
    exchange_code: str,
    payload: StockExchangeUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza una bolsa de valores (Stock Exchange).
    """
    obj = db.query(StockExchange).filter(StockExchange.exchange_code == exchange_code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Stock exchange was not found.")

    if payload.country_code is not None:
        if payload.country_code == "":
            obj.country_code = None
        else:
            country = db.query(Country).filter(Country.iso_code == payload.country_code.upper()).first()
            if not country:
                raise HTTPException(status_code=400, detail="Country code does not exist.")
            obj.country_code = payload.country_code.upper()

    if payload.name is not None:
        obj.name = payload.name

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/exchanges/{exchange_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stock_exchange(
    exchange_code: str,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Elimina una bolsa de valores (Stock Exchange).
    """
    obj = db.query(StockExchange).filter(StockExchange.exchange_code == exchange_code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Stock exchange was not found.")

    indices_count = db.query(MarketIndex).filter(MarketIndex.exchange_code == obj.exchange_code).count()
    if indices_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete stock exchange '{obj.exchange_code}' because it has {indices_count} index/indices associated.",
        )

    db.delete(obj)
    db.commit()

# 3. ENDPOINT DE INDICES
@router.get("/indices", response_model=List[MarketIndexRead])
def get_market_indices(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Lista los índices de mercado (Market Indices) soportados.
    """
    indices = db.query(MarketIndex).order_by(MarketIndex.index_code).offset(skip).limit(limit).all()
    return indices


@router.post("/indices", response_model=MarketIndexRead, status_code=status.HTTP_201_CREATED)
def create_market_index(
    payload: MarketIndexCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea un índice de mercado (Market Index).
    """
    existing = db.query(MarketIndex).filter(MarketIndex.index_code == payload.index_code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Market index already exists.")

    if payload.country_code:
        country = db.query(Country).filter(Country.iso_code == payload.country_code.upper()).first()
        if not country:
            raise HTTPException(status_code=400, detail="Country code does not exist.")

    if payload.exchange_code:
        exchange = db.query(StockExchange).filter(StockExchange.exchange_code == payload.exchange_code.upper()).first()
        if not exchange:
            raise HTTPException(status_code=400, detail="Exchange code does not exist.")

    obj = MarketIndex(
        index_code=payload.index_code.upper(),
        name=payload.name,
        country_code=payload.country_code.upper() if payload.country_code else None,
        exchange_code=payload.exchange_code.upper() if payload.exchange_code else None,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/indices/{index_code}", response_model=MarketIndexRead)
def update_market_index(
    index_code: str,
    payload: MarketIndexUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza un índice de mercado (Market Index).
    """
    obj = db.query(MarketIndex).filter(MarketIndex.index_code == index_code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Market index was not found.")

    if payload.country_code is not None:
        if payload.country_code == "":
            obj.country_code = None
        else:
            country = db.query(Country).filter(Country.iso_code == payload.country_code.upper()).first()
            if not country:
                raise HTTPException(status_code=400, detail="Country code does not exist.")
            obj.country_code = payload.country_code.upper()

    if payload.exchange_code is not None:
        if payload.exchange_code == "" or payload.exchange_code == "-":
            obj.exchange_code = None
        else:
            exchange = db.query(StockExchange).filter(StockExchange.exchange_code == payload.exchange_code.upper()).first()
            if not exchange:
                raise HTTPException(status_code=400, detail="Exchange code does not exist.")
            obj.exchange_code = payload.exchange_code.upper()

    if payload.name is not None:
        obj.name = payload.name

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/indices/{index_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_market_index(
    index_code: str,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Elimina un índice de mercado (Market Index).
    """
    obj = db.query(MarketIndex).filter(MarketIndex.index_code == index_code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Market index was not found.")

    db.delete(obj)
    db.commit()


# ... imports ...
from app.models.asset import Industry # Importar
from app.schemas.asset import IndustryRead, IndustryCreate, IndustryUpdate # Importar

# ... endpoints existentes ...

@router.get("/industries", response_model=List[IndustryRead])
def get_industries(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 500 # Límite alto porque son ~200 items
) -> Any:
    """
    Lista las industrias y sectores disponibles.
    """
    return db.query(Industry).order_by(Industry.name).offset(skip).limit(limit).all()


@router.post("/industries", response_model=IndustryRead, status_code=status.HTTP_201_CREATED)
def create_industry(
    payload: IndustryCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea una industria nueva.
    """
    existing = db.query(Industry).filter(Industry.industry_code == payload.industry_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Industry already exists.")

    obj = Industry(
        industry_code=payload.industry_code,
        name=payload.name,
        sector=payload.sector
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/industries/{industry_code}", response_model=IndustryRead)
def update_industry(
    industry_code: str,
    payload: IndustryUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza una industria existente.
    """
    obj = db.query(Industry).filter(Industry.industry_code == industry_code).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Industry was not found.")

    if payload.name is not None:
        obj.name = payload.name
    if payload.sector is not None:
        obj.sector = payload.sector

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/industries/{industry_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_industry(
    industry_code: str,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Elimina una industria por código.
    """
    obj = db.query(Industry).filter(Industry.industry_code == industry_code).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Industry was not found.")

    db.delete(obj)
    db.commit()


@router.get("/asset-classes", response_model=List[AssetClassRead])
def get_asset_hierarchy(
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Retorna la jerarquía completa de Activos (Clases -> Subclases).
    Ideal para llenar selectores en cascada en el Frontend.
    """
    # SQLAlchemy traerá las clases y, automáticamente, sus subclases anidadas
    classes = db.query(AssetClass).order_by(AssetClass.name).all()
    return classes


@router.post("/asset-classes", response_model=AssetClassRead, status_code=status.HTTP_201_CREATED)
def create_asset_class(
    payload: AssetClassCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea una Asset Class con subclases opcionales.
    """
    existing = db.query(AssetClass).filter(AssetClass.code == payload.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Asset class already exists.")

    obj_kwargs = {
        "code": payload.code.upper(),
        "name": payload.name,
    }
    if hasattr(AssetClass, "description"):
        obj_kwargs["description"] = payload.description

    obj = AssetClass(**obj_kwargs)
    db.add(obj)
    db.flush()

    for sub in payload.sub_classes:
        db.add(AssetSubClass(
            class_id=obj.class_id,
            code=sub.code.upper(),
            name=sub.name,
        ))

    db.commit()
    db.refresh(obj)
    return obj


@router.put("/asset-classes/{class_id}", response_model=AssetClassRead)
def update_asset_class(
    class_id: int,
    payload: AssetClassUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza una Asset Class y sincroniza sus subclases.
    """
    obj = db.query(AssetClass).filter(AssetClass.class_id == class_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Asset class was not found.")

    if payload.code is not None:
        code_upper = payload.code.upper()
        existing = db.query(AssetClass).filter(AssetClass.code == code_upper, AssetClass.class_id != class_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Asset class code already exists.")
        obj.code = code_upper

    if payload.name is not None:
        obj.name = payload.name

    if payload.description is not None and hasattr(obj, "description"):
        obj.description = payload.description

    if payload.sub_classes is not None:
        existing_subs = {sub.sub_class_id: sub for sub in obj.sub_classes}
        provided_ids = set()

        for sub in payload.sub_classes:
            if sub.sub_class_id:
                existing_sub = existing_subs.get(sub.sub_class_id)
                if not existing_sub:
                    raise HTTPException(status_code=404, detail="Asset sub class was not found.")
                existing_sub.code = sub.code.upper()
                existing_sub.name = sub.name
                provided_ids.add(sub.sub_class_id)
            else:
                db.add(AssetSubClass(
                    class_id=obj.class_id,
                    code=sub.code.upper(),
                    name=sub.name,
                ))

        to_delete = [sub for sub_id, sub in existing_subs.items() if sub_id not in provided_ids]
        if to_delete:
            delete_ids = [sub.sub_class_id for sub in to_delete]
            assets_count = db.query(Asset).filter(Asset.sub_class_id.in_(delete_ids)).count()
            if assets_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot delete sub class because it has assets associated.",
                )
            for sub in to_delete:
                db.delete(sub)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/asset-classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset_class(
    class_id: int,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Elimina una Asset Class si no tiene activos asociados.
    """
    obj = db.query(AssetClass).filter(AssetClass.class_id == class_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Asset class was not found.")

    assets_count = db.query(Asset).filter(Asset.class_id == class_id).count()
    if assets_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete asset class because it has assets associated.",
        )

    sub_ids = [sub.sub_class_id for sub in obj.sub_classes]
    if sub_ids:
        sub_assets_count = db.query(Asset).filter(Asset.sub_class_id.in_(sub_ids)).count()
        if sub_assets_count > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete asset class because it has sub class assets associated.",
            )
        for sub in obj.sub_classes:
            db.delete(sub)

    db.delete(obj)
    db.commit()


# --- INVESTMENT STRATEGIES ENDPOINTS ---
from app.models.asset import InvestmentStrategy
from app.schemas.asset import InvestmentStrategyRead, InvestmentStrategyCreate, InvestmentStrategyUpdate

@router.get("/investment-strategies", response_model=List[InvestmentStrategyRead])
def get_investment_strategies(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Lista las estrategias de inversión disponibles.
    """
    return db.query(InvestmentStrategy).order_by(InvestmentStrategy.name).offset(skip).limit(limit).all()


@router.post("/investment-strategies", response_model=InvestmentStrategyRead, status_code=status.HTTP_201_CREATED)
def create_investment_strategy(
    payload: InvestmentStrategyCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea una nueva estrategia de inversión.
    """
    existing = db.query(InvestmentStrategy).filter(InvestmentStrategy.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Investment strategy '{payload.name}' already exists.")

    obj = InvestmentStrategy(
        name=payload.name,
        description=payload.description
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/investment-strategies/{strategy_id}", response_model=InvestmentStrategyRead)
def update_investment_strategy(
    strategy_id: int,
    payload: InvestmentStrategyUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza una estrategia de inversión existente.
    """
    obj = db.query(InvestmentStrategy).filter(InvestmentStrategy.strategy_id == strategy_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Investment strategy was not found.")

    if payload.name is not None:
        # Verificar que el nuevo nombre no exista ya
        existing = db.query(InvestmentStrategy).filter(
            InvestmentStrategy.name == payload.name,
            InvestmentStrategy.strategy_id != strategy_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Investment strategy '{payload.name}' already exists.")
        obj.name = payload.name
    
    if payload.description is not None:
        obj.description = payload.description

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/investment-strategies/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investment_strategy(
    strategy_id: int,
    db: Session = Depends(deps.get_db)
) -> None:
    """
    Elimina una estrategia de inversión.
    """
    obj = db.query(InvestmentStrategy).filter(InvestmentStrategy.strategy_id == strategy_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Investment strategy was not found.")

    db.delete(obj)
    db.commit()