#!/usr/bin/env bash
set -euo pipefail

# Setup Neon Database with Schema and Seed Data
# Usage: ./scripts/setup-neon.sh "postgresql://user:pass@host/dbname?sslmode=require"

if [ $# -eq 0 ]; then
    echo "Error: Connection string required"
    echo ""
    echo "Usage: ./scripts/setup-neon.sh \"postgresql://user:pass@host/dbname\""
    echo ""
    echo "Get your connection string from:"
    echo "  Neon Dashboard → Your Project → Connection Details → Connection String"
    echo ""
    exit 1
fi

NEON_CONNECTION_STRING="$1"

echo "🔗 Testing connection to Neon database..."

# Use Docker postgres container to run psql (has all PostgreSQL tools)
if ! docker ps | grep -q hsm-postgres; then
    echo "⚠️  Local PostgreSQL container not running."
    echo "Starting it temporarily to use psql client..."
    docker compose up -d postgres
    sleep 3
fi

# Test connection
if ! docker exec -i hsm-postgres psql "$NEON_CONNECTION_STRING" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Failed to connect to Neon database"
    echo "Please check your connection string"
    exit 1
fi

echo "✅ Connection successful!"
echo ""

# Apply schema
echo "📋 Applying schema.sql..."
docker exec -i hsm-postgres psql "$NEON_CONNECTION_STRING" < db/schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema applied successfully!"
else
    echo "❌ Failed to apply schema"
    exit 1
fi

echo ""

# Apply seed data
echo "🌱 Applying seed.sql..."
docker exec -i hsm-postgres psql "$NEON_CONNECTION_STRING" < db/seed.sql

if [ $? -eq 0 ]; then
    echo "✅ Seed data applied successfully!"
else
    echo "❌ Failed to apply seed data"
    exit 1
fi

echo ""
echo "🎉 Neon database setup complete!"
echo ""
echo "Verifying installation..."
echo ""

# Verify tables
TABLE_COUNT=$(docker exec -i hsm-postgres psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
echo "📊 Tables created: $TABLE_COUNT"

# Verify instruments
INSTRUMENT_COUNT=$(docker exec -i hsm-postgres psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM instruments;")
echo "🎹 Instruments: $INSTRUMENT_COUNT"

# Verify teachers
TEACHER_COUNT=$(docker exec -i hsm-postgres psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM teachers;")
echo "👨‍🏫 Teachers: $TEACHER_COUNT"

# Verify packages
PACKAGE_COUNT=$(docker exec -i hsm-postgres psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM packages;")
echo "📦 Packages: $PACKAGE_COUNT"

echo ""
echo "✨ Your Neon database is ready to use!"
echo ""
echo "Next steps:"
echo "1. Update backend-enroll/db.js with your Neon connection string"
echo "2. Test backend: cd backend-enroll && node index.js"
echo ""
