# HSM Database — PostgreSQL Setup & Migrations

Complete database setup guide for the HSM Management System using PostgreSQL 15.

## Quick Setup (Docker Compose — Recommended)

```bash
# Start PostgreSQL + pgAdmin
docker compose up -d

# Apply schema and seed data
./scripts/start-db.sh

# Verify setup
./scripts/verify-db.sh
```

**Services:**
- PostgreSQL: `localhost:5432`
  - User: `hsm_admin`
  - Password: `secret`
  - Database: `hsm_dev`
- pgAdmin: `http://localhost:8080`
  - Email: `admin@hsm.local`
  - Password: `admin`

## Option A — Docker Compose (Recommended)

The `docker-compose.yml` in the project root provides:
- PostgreSQL 15 container with persistent volume
- pgAdmin 4 web interface for database management
- Automatic network configuration

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d
```

## Option B — Homebrew (macOS)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start service
brew services start postgresql@15

# Create database and user
createdb hsm_dev
createuser -s hsm_admin
psql -c "ALTER USER hsm_admin WITH PASSWORD 'secret';"

# Apply schema
psql -U hsm_admin -d hsm_dev -f db/schema.sql

# Load seed data
psql -U hsm_admin -d hsm_dev -f db/seed.sql
```

## Option C — Docker CLI

```bash
# Run PostgreSQL container
docker run --name hsm-postgres \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_USER=hsm_admin \
  -e POSTGRES_DB=hsm_dev \
  -p 5432:5432 \
  -v hsm_pgdata:/var/lib/postgresql/data \
  -d postgres:15

# Apply schema
psql -h localhost -U hsm_admin -d hsm_dev -f db/schema.sql

# Load seed data
psql -h localhost -U hsm_admin -d hsm_dev -f db/seed.sql
```

## Database Schema

The database includes the following tables:

### Core Tables
- **students** — Student profiles and contact information
- **teachers** — Teacher profiles with payout configuration
- **instruments** — Available instruments (Keyboard, Guitar, etc.)
- **packages** — Payment packages (Monthly/Quarterly)
- **batches** — Class batches (instrument + teacher + schedule)

### Enrollment & Tracking
- **enrollments** — One per student (multi-instrument support)
- **enrollment_batches** — Links students to specific batches
- **attendance_records** — Daily attendance tracking
- **payments** — Payment history and transactions

### Schema Features
✅ UUID primary keys via `pgcrypto` extension  
✅ Foreign key constraints with cascading  
✅ Timestamp tracking (created_at, updated_at)  
✅ JSONB metadata support  
✅ Composite indexes for performance  
✅ Table and column comments  

## Migrations

Schema migrations are in `db/migrations/` directory:

1. **001_update_enrollment_schema.sql**
   - Made `enrollments.instrument_id` nullable
   - Updated to support one enrollment per student
   - Added table comments

2. **002_add_teacher_payout_columns.sql**
   - Added `per_session_rate` to teachers table
   - Added `payout_month` and `status` to payments
   - Enabled teacher payout calculations

3. **003_add_enrollment_batches_columns.sql**
   - Added `payment_frequency` to enrollment_batches
   - Added `classes_remaining` tracking per batch
   - Enhanced batch-level class management

To apply migrations manually:
```bash
psql -U hsm_admin -d hsm_dev -f db/migrations/001_update_enrollment_schema.sql
psql -U hsm_admin -d hsm_dev -f db/migrations/002_add_teacher_payout_columns.sql
psql -U hsm_admin -d hsm_dev -f db/migrations/003_add_enrollment_batches_columns.sql
```

## Seed Data

The `seed.sql` file provides:
- 8 instruments (Keyboard, Guitar, Piano, Drums, Tabla, Violin, Vocals)
- 5 teachers with various specializations
- 2 packages (Monthly 8 classes, Quarterly 24 classes)
- 4+ sample batches with different schedules
- Sample student enrollments

## Database Management Tools

### pgAdmin (Web Interface)
Access at `http://localhost:8080` when using Docker Compose
- Full GUI for table browsing, queries, and schema management
- Visual query builder
- Import/export tools

### Command Line
```bash
# Connect to database
psql -h localhost -U hsm_admin -d hsm_dev

# List tables
\dt

# Describe table
\d students

# Run query
SELECT * FROM students;

# Exit
\q
```

### Other Tools
- **TablePlus** — macOS/Windows GUI (recommended)
- **DBeaver** — Cross-platform, open-source
- **DataGrip** — JetBrains IDE

## Backup & Restore

### Backup
```bash
# Full database backup
pg_dump -h localhost -U hsm_admin -d hsm_dev > backup.sql

# Schema only
pg_dump -h localhost -U hsm_admin -d hsm_dev --schema-only > schema_backup.sql

# Data only
pg_dump -h localhost -U hsm_admin -d hsm_dev --data-only > data_backup.sql
```

### Restore
```bash
# Restore from backup
psql -h localhost -U hsm_admin -d hsm_dev < backup.sql
```

## Troubleshooting

### Connection Issues
```bash
# Check if PostgreSQL is running
docker ps  # if using Docker
brew services list  # if using Homebrew

# Test connection
psql -h localhost -U hsm_admin -d hsm_dev -c "SELECT 1;"
```

### Reset Database
```bash
# Drop and recreate
psql -h localhost -U hsm_admin -d postgres -c "DROP DATABASE IF EXISTS hsm_dev;"
psql -h localhost -U hsm_admin -d postgres -c "CREATE DATABASE hsm_dev;"
psql -h localhost -U hsm_admin -d hsm_dev -f db/schema.sql
psql -h localhost -U hsm_admin -d hsm_dev -f db/seed.sql
```

### Check Logs
```bash
# Docker Compose
docker compose logs postgres

# Homebrew
tail -f /opt/homebrew/var/log/postgresql@15.log
```

## Production Considerations

- Use environment variables for credentials (never commit passwords)
- Enable SSL connections
- Set up regular backups (pg_dump + cron or managed backup service)
- Configure connection pooling (PgBouncer)
- Monitor query performance (pg_stat_statements)
- Set up replication for high availability
- Use managed PostgreSQL (AWS RDS, Azure Database, etc.) for production