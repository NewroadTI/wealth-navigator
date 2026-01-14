-- 1. Activar extensión TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Tabla Relacional Normal (Usuarios)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'advisor',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tabla para TimescaleDB (Precios de Activos)
CREATE TABLE IF NOT EXISTS asset_prices (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    volume INT
);

-- 4. Convertirla en Hypertable (La magia de Timescale)
SELECT create_hypertable('asset_prices', 'time');

-- 5. Datos semilla de prueba
INSERT INTO users (email, full_name, role) VALUES ('admin@newroad.com', 'Admin User', 'admin');
INSERT INTO asset_prices (time, symbol, price, volume) VALUES (NOW(), 'AAPL', 185.50, 1000);
