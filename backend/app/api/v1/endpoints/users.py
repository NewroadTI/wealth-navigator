from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.core.security import get_password_hash

# Importamos el Modelo (DB) y los Schemas (Datos de entrada/salida)
from app.models.user import User, Role
from app.schemas.user import UserRead, UserCreate, UserUpdate

router = APIRouter()

@router.get("/", response_model=List[UserRead])
def get_users_list(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Lista todos los usuarios registrados en la base de datos.
    Soporta paginación básica.
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/investors", response_model=List[UserRead])
def get_investors(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Lista usuarios con rol INVESTOR.
    """
    investor_role = db.query(Role).filter(Role.name == "INVESTOR").first()
    if not investor_role:
        return []
    
    investors = db.query(User).filter(
        User.role_id == investor_role.role_id,
        User.is_active == True
    ).order_by(User.full_name).offset(skip).limit(limit).all()
    return investors


@router.get("/advisors", response_model=List[UserRead])
def get_advisors(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Lista usuarios con rol ADVISOR.
    """
    advisor_role = db.query(Role).filter(Role.name == "ADVISOR").first()
    if not advisor_role:
        return []
    
    advisors = db.query(User).filter(
        User.role_id == advisor_role.role_id,
        User.is_active == True
    ).order_by(User.full_name).offset(skip).limit(limit).all()
    return advisors


@router.get("/{user_id}", response_model=UserRead)
def get_user_by_id(
    user_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Obtiene un usuario específico por su ID.
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con ID {user_id} no encontrado"
        )
    return user

@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea un nuevo usuario en el sistema.
    Válida que el email y username sean únicos.
    """
    # Validar que el email no exista
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El email {user_in.email} ya está registrado"
        )
    
    # Validar que el username no exista
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El username {user_in.username} ya está en uso"
        )
    
    # Validar que el rol exista
    role = db.query(Role).filter(Role.role_id == user_in.role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El rol con ID {user_in.role_id} no existe"
        )
    
    # Crear el usuario
    user = User(
        email=user_in.email,
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        tax_id=user_in.tax_id,
        entity_type=user_in.entity_type,
        is_active=user_in.is_active,
        role_id=user_in.role_id
    )
    
    try:
        db.add(user)
        db.commit()
    except Exception as e:
        db.rollback()
        # Check for IntegrityError
        error_msg = str(e).lower()
        if "unique constraint" in error_msg:
             if "tax_id" in error_msg:
                 detail = f"El Tax ID {user_in.tax_id} ya está registrado."
             elif "username" in error_msg:
                 detail = f"El username '{user_in.username}' ya está en uso."
             elif "email" in error_msg:
                 detail = f"El email '{user_in.email}' ya está registrado."
             else:
                 detail = "Error de integridad: Un campo único ya existe."
             
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail
            )
        else:
            # Re-raise standard 500
            raise e
            
    db.refresh(user)
    
    return user

@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza los datos de un usuario existente.
    Solo actualiza los campos proporcionados (partial update).
    No permite actualizar la contraseña (usar endpoint separado).
    """
    # Buscar el usuario
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con ID {user_id} no encontrado"
        )
    
    # Validar email único si se está actualizando
    if user_in.email and user_in.email != user.email:
        existing_email = db.query(User).filter(User.email == user_in.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El email {user_in.email} ya está registrado"
            )
    
    # Validar username único si se está actualizando
    if user_in.username and user_in.username != user.username:
        existing_username = db.query(User).filter(User.username == user_in.username).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El username {user_in.username} ya está en uso"
            )
    
    # Validar que el rol exista si se está actualizando
    if user_in.role_id:
        role = db.query(Role).filter(Role.role_id == user_in.role_id).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El rol con ID {user_in.role_id} no existe"
            )
    
    # Actualizar solo los campos proporcionados
    update_data = user_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    return user

@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Realiza un soft delete marcando is_active=False.
    No elimina físicamente el usuario de la base de datos.
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con ID {user_id} no encontrado"
        )
    
    # Soft delete
    user.is_active = False
    db.commit()
    
    return {
        "message": f"Usuario {user.full_name} desactivado exitosamente",
        "user_id": user_id,
        "is_active": False
    }