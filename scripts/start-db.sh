#!/usr/bin/env bash
set -euo pipefail

# Start DB with docker-compose and ensure schema and seed are applied
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed or not in PATH. Please install Docker and try again." >&2
  exit 2
fi

echo "Starting containers with docker compose..."
docker compose up -d

# Wait for Postgres to be ready
echo "Waiting for Postgres to accept connections (up to 60s)..."
start_ts=$(date +%s)
while true; do
  if docker exec hsm-postgres pg_isready -U hsm_admin >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  now=$(date +%s)
  if [ $((now - start_ts)) -gt 60 ]; then
    echo "Timed out waiting for Postgres." >&2
    docker logs hsm-postgres --tail 200 || true
    exit 3
  fi
  sleep 2
done

# Apply schema and seed (in case the init scripts didn't run)
echo "Applying schema and seed SQL files..."
# Copy files into container and run psql
CONTAINER=hsm-postgres
# The image mounts ./db into /docker-entrypoint-initdb.d, but re-run to be safe
cat db/schema.sql | docker exec -i $CONTAINER psql -U hsm_admin -d hsm_dev || true
cat db/seed.sql | docker exec -i $CONTAINER psql -U hsm_admin -d hsm_dev || true

echo "Database should be ready. Run scripts/verify-db.sh to confirm."
