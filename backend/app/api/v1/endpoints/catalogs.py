from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps

# Importamos el Modelo (SQLAlchemy) y el Schema (Pydantic)
from app.models.asset import Country, Currency, StockExchange, MarketIndex
from app.schemas.asset import (
    CountryRead, CountryCreate, CountryUpdate,
    CurrencyRead, CurrencyCreate, CurrencyUpdate,
    StockExchangeRead, StockExchangeCreate, StockExchangeUpdate,
    MarketIndexRead, MarketIndexCreate, MarketIndexUpdate
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


# ... imports anteriores ...
from app.models.asset import AssetClass # Importar el modelo
from app.schemas.asset import AssetClassRead # Importar el schema nuevo

# ... endpoints anteriores ...

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