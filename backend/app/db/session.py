from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Obtener la URL de la base de datos del entorno o usar la de Docker por defecto
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:securepassword123@db:5432/wealthroad")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)