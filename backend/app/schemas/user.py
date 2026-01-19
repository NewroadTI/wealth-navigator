from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any, Dict
from datetime import datetime

# --- ROLE SCHEMAS ---
class RoleRead(BaseModel):
    role_id: int
    name: str
    description: Optional[str] = None
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

class UserRead(UserBase):
    user_id: int
    role_id: int
    created_at: datetime
    role: Optional[RoleRead] = None
    class Config:
        from_attributes = True

# --- AUDIT LOG SCHEMAS (Nuevo) ---
class AuditLogRead(BaseModel):
    log_id: int
    user_id: Optional[int] = None
    action: str
    table_name: Optional[str] = None
    record_id: Optional[str] = None
    # Usamos Any o Dict para JSONB, ya que la estructura varía
    old_value: Optional[Dict[str, Any]] = None 
    new_value: Optional[Dict[str, Any]] = None
    timestamp: datetime

    class Config:
        from_attributes = True