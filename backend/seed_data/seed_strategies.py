"""
Seed de Estrategias de Inversión iniciales.
"""
import sys
import logging

sys.path.append(".")

from app.db.session import SessionLocal
from app.models.asset import InvestmentStrategy
# Import all models to resolve SQLAlchemy relationships
from app.models.user import User
from app.models.portfolio import Portfolio, Account

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lista de estrategias por defecto
STRATEGIES_DATA = [
    {
        "name": "Growth",
        "description": "Estrategia enfocada en el crecimiento del capital a largo plazo, invirtiendo en activos con alto potencial de apreciación."
    },
    {
        "name": "Income",
        "description": "Estrategia orientada a generar ingresos regulares mediante dividendos e intereses."
    },
    {
        "name": "Value",
        "description": "Estrategia que busca activos infravalorados con fundamentos sólidos."
    },
    {
        "name": "Balanced",
        "description": "Estrategia equilibrada que combina crecimiento e ingresos."
    },
    {
        "name": "Conservative",
        "description": "Estrategia de bajo riesgo enfocada en preservación del capital."
    },
    {
        "name": "Aggressive",
        "description": "Estrategia de alto riesgo buscando máximos retornos."
    },
]

def seed_strategies():
    """Crea las estrategias de inversión iniciales."""
    db = SessionLocal()
    
    try:
        logger.info("--- 🎯 Sembrando Estrategias de Inversión ---")
        
        created = 0
        existing = 0
        
        for strategy_data in STRATEGIES_DATA:
            # Verificar si ya existe
            strategy = db.query(InvestmentStrategy).filter(
                InvestmentStrategy.name == strategy_data["name"]
            ).first()
            
            if not strategy:
                strategy = InvestmentStrategy(
                    name=strategy_data["name"],
                    description=strategy_data["description"]
                )
                db.add(strategy)
                db.commit()
                db.refresh(strategy)
                logger.info(f"✅ Estrategia creada: {strategy.name} (ID: {strategy.strategy_id})")
                created += 1
            else:
                logger.info(f"ℹ️ Estrategia existente: {strategy.name}")
                existing += 1
        
        # Mostrar resumen
        all_strategies = db.query(InvestmentStrategy).all()
        print("\n--- 📋 Estrategias en el sistema ---")
        for s in all_strategies:
            print(f"  • {s.name}: {s.description[:50]}..." if s.description and len(s.description) > 50 else f"  • {s.name}: {s.description or 'Sin descripción'}")
        
        print(f"\n--- 🏁 Semilla de Estrategias completada ---")
        print(f"  • Creadas: {created}")
        print(f"  • Existentes: {existing}")
        print(f"  • Total en sistema: {len(all_strategies)}")
        
    except Exception as e:
        logger.error(f"❌ Error creando estrategias: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_strategies()
