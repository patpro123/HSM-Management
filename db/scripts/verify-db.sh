#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is not installed or not in PATH. Please install Docker and try again." >&2
  exit 2
fi

CONTAINER=hsm-postgres

echo "Listing public tables:"
docker exec $CONTAINER psql -U hsm_admin -d hsm_dev -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"

echo "Student count:"
docker exec $CONTAINER psql -U hsm_admin -d hsm_dev -c "SELECT count(*) FROM students;"

echo "Instruments:"
docker exec $CONTAINER psql -U hsm_admin -d hsm_dev -c "SELECT id, name FROM instruments ORDER BY name;"

echo "Sample attendance records (latest 10):"
docker exec $CONTAINER psql -U hsm_admin -d hsm_dev -c "SELECT session_date, batch_id, student_id, status FROM attendance_records ORDER BY session_date DESC LIMIT 10;"

echo "If any commands failed, check container logs with: docker logs hsm-postgres --tail 200"
