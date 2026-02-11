from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import traceback
from app.api import deps
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetRead, AssetUpdate

router = APIRouter()

@router.get("/", response_model=List[AssetRead])
def read_assets(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    class_id: Optional[int] = None,
    is_active: bool = True
) -> Any:
    """
    Retrieve assets with optional filtering.
    """
    query = db.query(Asset).filter(Asset.is_active == is_active)
    
    if class_id:
        query = query.filter(Asset.class_id == class_id)

    if search:
        # Busca por símbolo, descripción o ISIN
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Asset.symbol.ilike(search_filter),
                Asset.description.ilike(search_filter),
                Asset.isin.ilike(search_filter)
            )
        )
        
    assets = query.offset(skip).limit(limit).all()
    return assets

# app/api/v1/endpoints/assets.py


# ... imports ...

@router.post("/", response_model=AssetRead)
def create_asset(
    *,
    db: Session = Depends(deps.get_db),
    asset_in: AssetCreate,
) -> Any:
    """
    Create new asset.
    """
    try:
        # 1. Verificar duplicados
        existing_asset = db.query(Asset).filter(Asset.symbol == asset_in.symbol).first()
        if existing_asset:
            return existing_asset 

        # 2. Convertir Pydantic a Dict
        try:
            obj_in_data = asset_in.model_dump()
        except AttributeError:
            obj_in_data = asset_in.dict()

        # --- CORRECCIÓN AQUÍ ---
        # Eliminamos 'name' porque el modelo de DB no tiene esa columna.
        # La DB usa 'description'.
        if "name" in obj_in_data:
            del obj_in_data["name"] 
        # -----------------------

        # 3. Crear instancia del Modelo
        db_obj = Asset(**obj_in_data)
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # Opcional: Para devolver respuesta correcta, le volvemos a poner el name
        # basado en la descripción, para que coincida con el Schema de respuesta
        if not hasattr(db_obj, "name"):
            setattr(db_obj, "name", db_obj.description)
            
        return db_obj

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error creando asset: {str(e)}")
    

@router.get("/{asset_id}", response_model=AssetRead)
def read_asset_by_id(
    asset_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get asset by ID.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset

@router.put("/{asset_id}", response_model=AssetRead)
def update_asset(
    *,
    db: Session = Depends(deps.get_db),
    asset_id: int,
    asset_in: AssetUpdate,
) -> Any:
    """
    Update an asset.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    try:
        update_data = asset_in.model_dump(exclude_unset=True)
    except AttributeError:
        update_data = asset_in.dict(exclude_unset=True)

    if "name" in update_data:
        del update_data["name"]

    for field, value in update_data.items():
        setattr(asset, field, value)

    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset

@router.delete("/{asset_id}", response_model=AssetRead)
def delete_asset(
    *,
    db: Session = Depends(deps.get_db),
    asset_id: int,
) -> Any:
    """
    Delete an asset. Related references (trades, positions, etc.) will have their asset_id set to NULL.
    Market prices for this asset will be deleted (CASCADE).
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    try:
        db.delete(asset)
        db.commit()
        return asset
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail=f"Error deleting asset: {str(e)}"
        )