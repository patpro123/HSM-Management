# db/scripts

All database utility scripts live here.

## Migration Runner

Apply a specific migration by number:

```bash
node db/scripts/apply-migration.js 007
node db/scripts/apply-migration.js 015
```

The script auto-resolves the filename from `db/migrations/` by prefix match.

## Setup Scripts

| Script | Purpose |
|---|---|
| `start-db.sh` | Start local PostgreSQL via Docker Compose |
| `setup-neon.sh` | Configure Neon (production) database |
| `verify-db.sh` | Verify database connectivity and schema |
| `verify-migration-006.sh` | Verify migration 006 was applied correctly |

## One-off Utilities

| Script | Purpose |
|---|---|
| `apply_migration_004.js` | Apply migration 004 (legacy runner, kept for reference) |
| `verify_migration_004.js` | Verify migration 004 (legacy) |
| `cleanup-attendance.js` | Fix attendance record inconsistencies |
