import sys
import logging

sys.path.append(".")

from app.db.session import SessionLocal
from app.models.user import Role

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lista de roles del sistema
SYSTEM_ROLES = [
    {
        "name": "ADMIN",
        "description": "Super Usuario con acceso total al ERP. Puede gestionar usuarios, roles y configuraciones del sistema."
    },
    {
        "name": "ADVISOR",
        "description": "Asesor financiero que gestiona portafolios de clientes. Puede ver y modificar portafolios asignados."
    },
    {
        "name": "INVESTOR",
        "description": "Cliente inversionista. Solo puede visualizar su propio portafolio y reportes."
    }
]

def seed_roles():
    """Crea los roles base del sistema si no existen."""
    db = SessionLocal()
    
    try:
        logger.info("--- 🌱 Sembrando Roles del Sistema ---")
        
        for role_data in SYSTEM_ROLES:
            existing_role = db.query(Role).filter(Role.name == role_data["name"]).first()
            
            if not existing_role:
                role = Role(
                    name=role_data["name"],
                    description=role_data["description"]
                )
                db.add(role)
                db.commit()
                db.refresh(role)
                logger.info(f"✅ Rol creado: {role.name} (ID: {role.role_id})")
            else:
                logger.info(f"ℹ️ El rol {role_data['name']} ya existe (ID: {existing_role.role_id})")
        
        # Mostrar resumen
        all_roles = db.query(Role).all()
        print("\n--- 📋 Roles en el sistema ---")
        for role in all_roles:
            print(f"  • {role.name} (ID: {role.role_id}): {role.description}")
        
        print("\n--- 🏁 Semilla de Roles completada ---")
        
    except Exception as e:
        logger.error(f"❌ Error creando roles: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_roles()
