#!/bin/bash
# Script para ejecutar migraciones en desarrollo local
# Uso: ./migrate.sh

set -e

echo "🔄 Ejecutando migraciones de base de datos..."

# Ejecutar migraciones dentro del contenedor de base de datos
docker compose exec db bash -c "
  export POSTGRES_USER=admin
  export POSTGRES_PASSWORD=securepassword123
  export POSTGRES_DB=wealthroad
  export DB_HOST=localhost
  
  cd /docker-entrypoint-initdb.d/migrations
  chmod +x run-migrations.sh
  ./run-migrations.sh
"

echo ""
echo "✅ Migraciones completadas!"
echo "🔄 Reiniciando backend para aplicar cambios..."

docker compose restart backend

echo "✅ ¡Todo listo!"
