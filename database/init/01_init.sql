-- 1. Solo activar la extensión (Vital)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. ¡NO CREAR TABLAS AQUÍ! 
-- Dejaremos que FastAPI (SQLAlchemy) cree las tablas 'users', 'assets', etc.