from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB # Necesario para Audit Logs
from app.db.base import Base

class Role(Base):
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    
    users = relationship("User", back_populates="role")
    permissions = relationship("Permission", secondary="role_permissions")

class Permission(Base):
    __tablename__ = "permissions"
    permission_id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, nullable=False)
    description = Column(Text)

class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id = Column(Integer, ForeignKey("roles.role_id"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("permissions.permission_id"), primary_key=True)

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=True, index=True)
    password_hash = Column(String, nullable=False)
    
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    # Nuevos campos V3
    tax_id = Column(String, unique=True, nullable=True) # DNI, NIF, SSN, etc.
    entity_type = Column(String, default='INDIVIDUAL', nullable=True) # INDIVIDUAL, CORP, TRUST
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    role_id = Column(Integer, ForeignKey("roles.role_id"))
    
    # Relaciones Portafolios
    role = relationship("Role", back_populates="users")
    owned_portfolios = relationship("Portfolio", back_populates="owner")
    advisor_assignments = relationship("PortfolioAdvisor", back_populates="advisor")



# --- FALTABA ESTO ---

class AuditLog(Base):
    __tablename__ = "audit_logs"
    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    
    action = Column(String) # CREATE, UPDATE, DELETE
    table_name = Column(String)
    record_id = Column(String)
    
    old_value = Column(JSONB)
    new_value = Column(JSONB)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now())