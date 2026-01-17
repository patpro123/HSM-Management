# Database Schema Status

**Last Updated:** 2026-01-17  
**Schema Version:** v1.3 (with all migrations applied)

## Current State

The `schema.sql` file is now **fully synchronized** with the production database and includes all migrations that have been applied.

## What's Included

### Enums (6 types)
1. `attendance_status` - present, absent, excused
2. `attendance_source` - whatsapp, web, manual
3. `enrollment_status` - active, paused, completed
4. `holiday_scope` - school, teacher, batch
5. `payment_frequency` - monthly, quarterly, half_yearly, yearly ✨ (Added via migration 003)
6. `payout_type` - fixed, per_class, per_student_monthly ✨ (Added via migration 002)

### Tables (11 core tables)

1. **students** - Student profiles and contact information
2. **teachers** - Teacher profiles with payout configuration
   - ✨ Added `payout_type` and `rate` columns (migration 002)
3. **instruments** - Available instruments (8 instruments seeded)
4. **batches** - Class batches with schedules
5. **enrollments** - One per student (multi-instrument support)
   - ✨ Made `instrument_id` nullable (migration 001)
6. **enrollment_batches** - Links students to specific batches
   - ✨ Added `payment_frequency` and `classes_remaining` (migration 003)
7. **attendance_records** - Daily attendance tracking
8. **packages** - Payment packages (Monthly/Quarterly)
9. **payments** - Payment transactions
10. **teacher_payouts** - Teacher payout records
11. **holidays** - Holiday tracking
12. **audit_logs** - System audit trail

### Indexes (5 performance indexes)
- `idx_students_phone` - Fast student lookup by phone
- `idx_enrollments_student` - Student enrollment queries
- `idx_enrollment_batches_enrollment` - Batch enrollment lookups
- `idx_attendance_batch_date` - Attendance queries by batch/date
- `idx_payments_student` - Payment history per student

## Migration History

### Migration 001: Update Enrollment Schema
**File:** `migrations/001_update_enrollment_schema.sql`  
**Applied:** 2026-01-04

Changes:
- Made `enrollments.instrument_id` nullable
- Added table and column comments
- Enables one enrollment per student model

### Migration 002: Add Teacher Payout Columns
**File:** `migrations/002_add_teacher_payout_columns.sql`  
**Applied:** 2026-01-05

Changes:
- Added `payout_type` enum and column to teachers table
- Added `rate` column to teachers table
- Added comments for payout configuration

### Migration 003: Add Enrollment Batches Columns
**File:** `migrations/003_add_enrollment_batches_columns.sql`  
**Applied:** 2026-01-06

Changes:
- Added `payment_frequency` column to enrollment_batches
- Added `classes_remaining` column to enrollment_batches
- Added `enrolled_on` column to enrollment_batches
- Added column comments for clarity

## Setup Instructions

### Fresh Database Setup

```bash
# 1. Start PostgreSQL with Docker Compose
docker compose up -d

# 2. Apply schema and seed data
./scripts/start-db.sh

# 3. Verify setup
./scripts/verify-db.sh
```

### Manual Schema Application

```bash
# Apply schema only (no seed data)
docker exec -i hsm-postgres psql -U hsm_admin -d hsm_dev < db/schema.sql

# Apply seed data
docker exec -i hsm-postgres psql -U hsm_admin -d hsm_dev < db/seed.sql
```

### Reset Database (WARNING: Deletes all data)

```bash
# Stop and remove containers with volumes
docker compose down -v

# Restart and reapply
docker compose up -d
./scripts/start-db.sh
```

## Verification

Run the verification script to check all tables and data:

```bash
./scripts/verify-db.sh
```

Expected output:
- ✓ 11 tables created
- ✓ 8 instruments seeded
- ✓ 5+ teachers seeded
- ✓ 2 packages seeded
- ✓ Sample batches created
- ✓ All indexes present

## Schema Extraction

To extract the current schema from a running database:

```bash
# Export schema only (no data)
docker exec -i hsm-postgres pg_dump -U hsm_admin -d hsm_dev \
  --schema-only --no-owner --no-privileges > db/exported_schema.sql

# Export with data
docker exec -i hsm-postgres pg_dump -U hsm_admin -d hsm_dev \
  --no-owner --no-privileges > db/full_backup.sql
```

## Important Notes

1. **Migrations are cumulative** - The current `schema.sql` includes all migrations, so new setups don't need to run migration files separately.

2. **Backward compatibility** - The `enrollments.instrument_id` field is kept nullable for backward compatibility, but new enrollments should use `enrollment_batches` for instrument assignment.

3. **Auto-updates** - The schema includes `updated_at` columns that can be auto-updated via triggers (not included in base schema, implement as needed).

4. **Foreign key cascading** - Carefully designed cascade rules:
   - Delete student → cascades to enrollments and payments
   - Delete enrollment → cascades to enrollment_batches
   - Delete instrument/teacher → restricted (prevents accidental deletion)

5. **Data integrity** - CHECK constraints on:
   - `classes_remaining >= 0`
   - `amount >= 0` (payments, teacher_payouts)
   - `classes_count > 0` (packages)
   - `rate >= 0` (teachers)

## Development Workflow

### Adding a New Migration

1. Create migration file: `db/migrations/00X_description.sql`
2. Test migration on development database
3. Update `db/schema.sql` to include the changes
4. Document changes in this file
5. Update `IMPLEMENTATION_SUMMARY.md` if needed

### Schema Changes Best Practices

- Always use migrations for production changes
- Never modify `schema.sql` directly in production
- Keep migrations idempotent (safe to run multiple times)
- Test migrations on a copy of production data first
- Document all changes in comments

## Production Considerations

- Use managed PostgreSQL (AWS RDS, Azure Database, etc.)
- Enable automated backups
- Set up replication for high availability
- Configure connection pooling (PgBouncer)
- Monitor query performance with pg_stat_statements
- Regular vacuum and analyze operations
- SSL connections required
- Rotate database credentials regularly

## Support

For schema questions or issues:
1. Check migration files in `db/migrations/`
2. Review this document for current state
3. Extract current schema for comparison
4. Check application logs for SQL errors
