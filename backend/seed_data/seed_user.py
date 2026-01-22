import sys
import logging
import os

sys.path.append(".")

from app.db.session import SessionLocal
from app.core.security import get_password_hash

# --- MODELOS ---
# Importamos TODO para que SQLAlchemy pueda resolver todas las relaciones
# (User <-> Portfolio <-> Account <-> Trade/CashJournal)
from app.models.user import User, Role
from app.models.portfolio import Portfolio, PortfolioAdvisor, Account
# AGREGAR ESTA LÍNEA ES LA SOLUCIÓN:
from app.models.asset import Asset, CashJournal , Country, CorporateAction, Trades

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    db = SessionLocal()
    
    try:
        logger.info("--- 🌱 Sembrando Solo Admin (IAM) ---")

        # 1. CREAR ROL 'ADMIN'
        role = db.query(Role).filter(Role.name == "ADMIN").first()
        if not role:
            role = Role(name="ADMIN", description="Super Usuario con acceso total al ERP")
            db.add(role)
            db.commit()
            db.refresh(role)
            logger.info(f"✅ Rol creado: ADMIN (ID: {role.role_id})")
        else:
            logger.info(f"ℹ️ El Rol ADMIN ya existe (ID: {role.role_id})")

        # 2. CREAR USUARIO 'ADMIN LUIS'
        ADMIN_EMAIL = "adminluis@newroadgi.com"
        ADMIN_USER = "admin"
        ADMIN_NAME = "Admin Luis"
        ADMIN_PASS = "password123" 
        
        user = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not user:
            user = User(
                email=ADMIN_EMAIL,
                username=ADMIN_USER,
                password_hash=get_password_hash(ADMIN_PASS),
                full_name=ADMIN_NAME,
                phone="+51999999999",
                tax_id="TAX-ADMIN-001",    
                entity_type="INDIVIDUAL",
                role_id=role.role_id,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"✅ Usuario Admin creado: {ADMIN_EMAIL} (ID: {user.user_id})")
        else:
            logger.info(f"ℹ️ El usuario {ADMIN_EMAIL} ya existe (ID: {user.user_id})")

        print("\n--- 🏁 Semilla de Admin completada ---")
        
    except Exception as e:
        logger.error(f"❌ Error creando datos iniciales: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()