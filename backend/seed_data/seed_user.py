import sys
import logging

sys.path.append(".")

from app.db.session import SessionLocal
from app.core.security import get_password_hash

# --- MODELOS ---
# Importamos TODO para que SQLAlchemy pueda resolver todas las relaciones
from app.models.user import User, Role
from app.models.portfolio import Portfolio, PortfolioAdvisor, Account
from app.models.asset import Asset, CashJournal, Country, CorporateAction, Trades

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lista de usuarios a sembrar
USERS_DATA = [
    # ADMIN
    {
        "email": "adminluis@newroadgi.com",
        "username": "admin",
        "password": "password123",
        "full_name": "Admin Luis",
        "phone": "+51999999999",
        "tax_id": "TAX-ADMIN-001",
        "entity_type": "INDIVIDUAL",
        "role_name": "ADMIN"
    },
    # ADVISORS
    {
        "email": "maria.advisor@newroadgi.com",
        "username": "maria_advisor",
        "password": "password123",
        "full_name": "María García",
        "phone": "+51987654321",
        "tax_id": "TAX-ADV-001",
        "entity_type": "INDIVIDUAL",
        "role_name": "ADVISOR"
    },
    {
        "email": "carlos.advisor@newroadgi.com",
        "username": "carlos_advisor",
        "password": "password123",
        "full_name": "Carlos Rodríguez",
        "phone": "+51987654322",
        "tax_id": "TAX-ADV-002",
        "entity_type": "INDIVIDUAL",
        "role_name": "ADVISOR"
    },
    # INVESTORS
    {
        "email": "ana.investor@example.com",
        "username": "ana_investor",
        "password": "password123",
        "full_name": "Ana Martínez",
        "phone": "+51912345678",
        "tax_id": "TAX-INV-001",
        "entity_type": "INDIVIDUAL",
        "role_name": "INVESTOR"
    },
    {
        "email": "pedro.investor@example.com",
        "username": "pedro_investor",
        "password": "password123",
        "full_name": "Pedro López",
        "phone": "+51912345679",
        "tax_id": "TAX-INV-002",
        "entity_type": "INDIVIDUAL",
        "role_name": "INVESTOR"
    },
    {
        "email": "sofia.investor@example.com",
        "username": "sofia_investor",
        "password": "password123",
        "full_name": "Sofía Fernández",
        "phone": "+51912345680",
        "tax_id": "TAX-INV-003",
        "entity_type": "INDIVIDUAL",
        "role_name": "INVESTOR"
    }
]

def seed_users():
    """Crea usuarios de ejemplo con diferentes roles."""
    db = SessionLocal()
    
    try:
        logger.info("--- 🌱 Sembrando Usuarios del Sistema ---")
        
        # Obtener todos los roles disponibles
        roles = {role.name: role for role in db.query(Role).all()}
        
        if not roles:
            logger.error("❌ No hay roles en la base de datos. Ejecuta seed_roles.py primero.")
            return
        
        logger.info(f"ℹ️ Roles disponibles: {list(roles.keys())}")
        
        users_created = 0
        users_existing = 0
        
        for user_data in USERS_DATA:
            # Verificar si el usuario ya existe
            existing_user = db.query(User).filter(User.email == user_data["email"]).first()
            
            if not existing_user:
                # Obtener el rol correspondiente
                role = roles.get(user_data["role_name"])
                if not role:
                    logger.warning(f"⚠️ Rol {user_data['role_name']} no encontrado. Saltando usuario {user_data['email']}")
                    continue
                
                # Crear usuario
                user = User(
                    email=user_data["email"],
                    username=user_data["username"],
                    password_hash=get_password_hash(user_data["password"]),
                    full_name=user_data["full_name"],
                    phone=user_data["phone"],
                    tax_id=user_data["tax_id"],
                    entity_type=user_data["entity_type"],
                    role_id=role.role_id,
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                
                logger.info(f"✅ Usuario creado: {user.full_name} ({user.email}) - Rol: {user_data['role_name']} (ID: {user.user_id})")
                users_created += 1
            else:
                logger.info(f"ℹ️ El usuario {user_data['email']} ya existe (ID: {existing_user.user_id})")
                users_existing += 1
        
        # Mostrar resumen
        all_users = db.query(User).join(Role).all()
        print("\n--- 📋 Usuarios en el sistema ---")
        for user in all_users:
            print(f"  • {user.full_name} ({user.email}) - Rol: {user.role.name}")
        
        print(f"\n--- 🏁 Semilla de Usuarios completada ---")
        print(f"  • Usuarios creados: {users_created}")
        print(f"  • Usuarios existentes: {users_existing}")
        print(f"  • Total en sistema: {len(all_users)}")
        
    except Exception as e:
        logger.error(f"❌ Error creando usuarios: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()