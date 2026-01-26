from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps

# Importamos el Modelo (DB) y los Schemas
from app.models.user import Role, User
from app.schemas.user import RoleRead, RoleCreate, RoleUpdate, RoleReadWithPermissions

router = APIRouter()

@router.get("/", response_model=List[RoleRead])
def get_roles_list(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Lista todos los roles disponibles en el sistema.
    """
    roles = db.query(Role).offset(skip).limit(limit).all()
    return roles

@router.get("/{role_id}", response_model=RoleReadWithPermissions)
def get_role_by_id(
    role_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Obtiene un rol específico por su ID, incluyendo sus permisos.
    """
    role = db.query(Role).filter(Role.role_id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rol con ID {role_id} no encontrado"
        )
    return role

@router.post("/", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
def create_role(
    role_in: RoleCreate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Crea un nuevo rol en el sistema.
    El nombre del rol debe ser único y se convertirá a mayúsculas.
    """
    # Normalizar nombre a mayúsculas
    role_name = role_in.name.upper()
    
    # Validar que el nombre no exista
    existing_role = db.query(Role).filter(Role.name == role_name).first()
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El rol {role_name} ya existe"
        )
    
    # Crear el rol
    role = Role(
        name=role_name,
        description=role_in.description
    )
    
    db.add(role)
    db.commit()
    db.refresh(role)
    
    return role

@router.put("/{role_id}", response_model=RoleRead)
def update_role(
    role_id: int,
    role_in: RoleUpdate,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Actualiza un rol existente.
    Solo actualiza los campos proporcionados (partial update).
    """
    # Buscar el rol
    role = db.query(Role).filter(Role.role_id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rol con ID {role_id} no encontrado"
        )
    
    # Validar nombre único si se está actualizando
    if role_in.name:
        role_name = role_in.name.upper()
        if role_name != role.name:
            existing_role = db.query(Role).filter(Role.name == role_name).first()
            if existing_role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El rol {role_name} ya existe"
                )
            role.name = role_name
    
    # Actualizar descripción si se proporciona
    if role_in.description is not None:
        role.description = role_in.description
    
    db.commit()
    db.refresh(role)
    
    return role

@router.delete("/{role_id}", status_code=status.HTTP_200_OK)
def delete_role(
    role_id: int,
    db: Session = Depends(deps.get_db)
) -> Any:
    """
    Elimina un rol del sistema.
    Solo permite eliminar roles que no tengan usuarios asignados.
    """
    role = db.query(Role).filter(Role.role_id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rol con ID {role_id} no encontrado"
        )
    
    # Verificar que no haya usuarios con este rol
    users_count = db.query(User).filter(User.role_id == role_id).count()
    if users_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede eliminar el rol {role.name}. Tiene {users_count} usuario(s) asignado(s)."
        )
    
    # Eliminar el rol
    role_name = role.name
    db.delete(role)
    db.commit()
    
    return {
        "message": f"Rol {role_name} eliminado exitosamente",
        "role_id": role_id
    }
