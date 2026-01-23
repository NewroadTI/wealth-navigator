from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any, Dict, List
from datetime import datetime

# --- PERMISSION SCHEMAS ---
class PermissionBase(BaseModel):
    slug: str
    description: Optional[str] = None

class PermissionCreate(PermissionBase):
    pass

class PermissionRead(PermissionBase):
    permission_id: int
    class Config:
        from_attributes = True

# --- ROLE SCHEMAS ---
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class RoleRead(RoleBase):
    role_id: int
    class Config:
        from_attributes = True

class RoleReadWithPermissions(RoleRead):
    permissions: List[PermissionRead] = []
    class Config:
        from_attributes = True

# --- USER SCHEMAS ---
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    entity_type: Optional[str] = "INDIVIDUAL"
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str
    role_id: int

class UserUpdate(BaseModel):
    """Schema para actualizar usuario - todos los campos opcionales"""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None
    entity_type: Optional[str] = None
    is_active: Optional[bool] = None
    role_id: Optional[int] = None

class UserRead(UserBase):
    user_id: int
    role_id: int
    created_at: datetime
    role: Optional[RoleRead] = None
    class Config:
        from_attributes = True

# --- AUDIT LOG SCHEMAS ---
class AuditLogRead(BaseModel):
    log_id: int
    user_id: Optional[int] = None
    action: str
    table_name: Optional[str] = None
    record_id: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None 
    new_value: Optional[Dict[str, Any]] = None
    timestamp: datetime

    class Config:
        from_attributes = True