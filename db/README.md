# HSM — Local Database Setup (PostgreSQL)

This document describes how to install PostgreSQL locally on macOS and run the provided `schema.sql`.

## Option A — Homebrew (macOS)
1. Install PostgreSQL via Homebrew:
   ```bash
   brew install postgresql
   ```
2. Start PostgreSQL service:
   ```bash
   brew services start postgresql
   ```
3. Create a development database and user (optional):
   ```bash
   createdb hsm_dev
   # optional: create a role
   createuser -s hsm_admin || true
   psql -c "ALTER USER $(whoami) WITH SUPERUSER;"
   ```
4. Run the schema:
   ```bash
   psql -d hsm_dev -f db/schema.sql
   ```

## Option B — Docker (recommended for isolated dev)
```bash
docker run --name hsm-postgres -e POSTGRES_PASSWORD=secret -e POSTGRES_USER=hsm_admin -e POSTGRES_DB=hsm_dev -p 5432:5432 -d postgres:15
# then copy schema into container or run psql from host (you may need to install psql client)
psql -h localhost -U hsm_admin -d hsm_dev -f db/schema.sql
```

## GUI tools
- TablePlus, DBeaver, or pgAdmin for browsing DB visually.

## Notes
- The schema uses `pgcrypto` for `gen_random_uuid()`; ensure extension is enabled (the schema runs CREATE EXTENSION IF NOT EXISTS pgcrypto;).
- If you prefer SQLite for very lightweight local dev, we can produce an equivalent SQLite schema, but PostgreSQL is recommended for production parity.

---

If you'd like, I can also add a Docker Compose file (`docker-compose.yml`) with Postgres and an admin UI (pgAdmin) to the repo — should I add that?