#!/bin/bash
# Run database migrations
# This script executes all SQL migration files in order

set -e

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/docker-entrypoint-initdb.d/migrations}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-wealthroad}"
DB_USER="${POSTGRES_USER:-wealthroad_user}"

echo "🔄 Starting database migrations..."
echo "   Database: $DB_NAME"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   User: $DB_USER"

# Wait for database to be ready
echo "⏳ Waiting for database..."
for i in {1..30}; do
    if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; then
        echo "✅ Database is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Database not available after 30 attempts"
        exit 1
    fi
    echo "   Attempt $i/30 - retrying in 1s..."
    sleep 1
done

# Execute each migration file in order
if [ -d "$MIGRATIONS_DIR" ]; then
    echo ""
    echo "📂 Found migrations directory: $MIGRATIONS_DIR"
    
    # Sort migration files to ensure they run in order
    for migration_file in $(ls -1 $MIGRATIONS_DIR/*.sql 2>/dev/null | sort); do
        echo ""
        echo "📝 Running migration: $(basename $migration_file)"
        
        if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"; then
            echo "   ✅ Migration completed: $(basename $migration_file)"
        else
            echo "   ❌ Migration failed: $(basename $migration_file)"
            exit 1
        fi
    done
    
    echo ""
    echo "✅ All migrations completed successfully!"
else
    echo "⚠️  No migrations directory found at $MIGRATIONS_DIR"
fi

echo ""
echo "🎉 Database migration process finished!"
