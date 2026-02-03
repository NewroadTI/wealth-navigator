# Database Migrations

Sistema de migraciones automáticas para actualizaciones de esquema de base de datos.

## 📁 Estructura

```
database/
├── init/
│   └── 01_init.sql          # Inicialización (TimescaleDB extension)
└── migrations/
    ├── run-migrations.sh    # Script ejecutor de migraciones
    ├── 001_add_missing_columns.sql
    ├── 002_next_migration.sql  # Futuras migraciones
    └── ...
```

## 🚀 Uso

### Desarrollo Local

Ejecutar migraciones manualmente:

```bash
./migrate.sh
```

Este script:
1. Ejecuta todas las migraciones SQL en orden
2. Reinicia el backend para aplicar los cambios

### Producción (GitHub Actions)

Las migraciones se ejecutan **automáticamente** en cada deploy:

1. Haces `git push origin main`
2. GitHub Actions:
   - Construye el backend
   - Copia archivos al servidor
   - Ejecuta `docker compose up`
   - **Ejecuta migraciones automáticamente**
   - Reinicia el backend

## ✍️ Crear una Nueva Migración

### 1. Crear archivo SQL

Crea un nuevo archivo en `database/migrations/` con numeración secuencial:

```bash
# Ejemplo: 002_add_user_preferences.sql
```

### 2. Escribir migración idempotente

**IMPORTANTE:** Las migraciones deben ser **idempotentes** (pueden ejecutarse múltiples veces sin errores):

```sql
-- ✅ CORRECTO: Verificar antes de crear
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'preferences'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN preferences JSONB DEFAULT '{}';
        
        RAISE NOTICE 'Added preferences column to users';
    ELSE
        RAISE NOTICE 'Column preferences already exists';
    END IF;
END $$;

-- ❌ INCORRECTO: Falla si ya existe
ALTER TABLE users ADD COLUMN preferences JSONB;
```

### 3. Ejemplos de Migraciones Comunes

**Agregar columna:**
```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tabla' AND column_name = 'columna'
    ) THEN
        ALTER TABLE tabla ADD COLUMN columna VARCHAR;
        RAISE NOTICE 'Added columna to tabla';
    END IF;
END $$;
```

**Agregar índice:**
```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'tabla' AND indexname = 'idx_columna'
    ) THEN
        CREATE INDEX idx_columna ON tabla(columna);
        RAISE NOTICE 'Created index idx_columna';
    END IF;
END $$;
```

**Crear tabla:**
```sql
CREATE TABLE IF NOT EXISTS nueva_tabla (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Modificar tipo de columna:**
```sql
DO $$ 
BEGIN
    -- Verificar tipo actual
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tabla' 
        AND column_name = 'columna'
        AND data_type != 'text'
    ) THEN
        ALTER TABLE tabla ALTER COLUMN columna TYPE TEXT;
        RAISE NOTICE 'Changed columna type to TEXT';
    ELSE
        RAISE NOTICE 'Column columna already TEXT';
    END IF;
END $$;
```

### 4. Probar Localmente

```bash
# Ejecutar migraciones
./migrate.sh

# Verificar en la base de datos
docker compose exec db psql -U admin -d wealthroad -c "\d+ tabla"
```

### 5. Commit y Push

```bash
git add database/migrations/002_*.sql
git commit -m "feat: Add user preferences column"
git push origin main
```

GitHub Actions ejecutará la migración automáticamente en producción.

## 🔍 Verificar Migraciones

### Ver estructura de tabla

```bash
docker compose exec db psql -U admin -d wealthroad -c "\d+ cash_journal"
```

### Ver columnas de una tabla

```bash
docker compose exec db psql -U admin -d wealthroad -c "
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cash_journal';
"
```

### Ver logs del backend

```bash
docker compose logs backend -f
```

## 🐛 Solución de Problemas

### Migración falló en producción

1. Ver logs del deploy en GitHub Actions
2. Conectarse al servidor:
   ```bash
   ssh root@tu-servidor
   cd /root/wealth-navigator
   docker compose logs db
   ```
3. Ejecutar migración manualmente:
   ```bash
   docker compose exec db bash
   cd /docker-entrypoint-initdb.d/migrations
   ./run-migrations.sh
   ```

### Columna ya existe error

Las migraciones deben verificar con `IF NOT EXISTS`. Actualiza la migración para ser idempotente.

### Rollback de migración

Si necesitas revertir:

```bash
# Conectar a la DB
docker compose exec db psql -U admin -d wealthroad

# Ejecutar rollback manual
DROP TABLE IF EXISTS tabla_nueva;
ALTER TABLE tabla DROP COLUMN IF EXISTS columna;
```

## 📋 Checklist de Migración

- [ ] Archivo con numeración secuencial (001, 002, ...)
- [ ] Migración es idempotente (usa `IF NOT EXISTS`)
- [ ] Probada localmente con `./migrate.sh`
- [ ] Verificada estructura con `\d+ tabla`
- [ ] Commiteada y pusheada a `main`
- [ ] Deploy automático completado exitosamente
- [ ] Producción funciona correctamente

## 🎯 Mejores Prácticas

1. **Una migración por cambio lógico** - No mezclar múltiples features
2. **Siempre idempotente** - Debe poder ejecutarse múltiples veces
3. **Mensajes informativos** - Usa `RAISE NOTICE` para feedback
4. **Probar antes de pushear** - Ejecutar localmente primero
5. **Nombrado descriptivo** - `002_add_user_role_column.sql`
6. **Documentar cambios complejos** - Comentarios en SQL
7. **No eliminar migraciones** - Solo agregar nuevas
8. **Backup antes de cambios mayores** - En producción
