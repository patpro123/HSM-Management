# Database

## Connection

- **Prod:** Neon PostgreSQL (serverless, SSL required) via `DATABASE_URL`
- **Local:** Docker Compose PostgreSQL via individual params (`DB_HOST`, `DB_PORT`, etc.)
- **Pool:** `backend-enroll/db.js` — max 10 connections, 30s idle timeout

## Core Tables

| Table | Key Fields |
|---|---|
| `students` | id (uuid), name, dob, phone, guardian_contact, metadata (JSONB — email, address, image) |
| `enrollments` | id, student_id, status (active/paused/completed), classes_remaining |
| `enrollment_batches` | enrollment_id, batch_id, payment_frequency, classes_remaining |
| `batches` | instrument_id, teacher_id, recurrence (text), start_time, end_time, capacity, is_makeup |
| `instruments` | name, max_batch_size, online_supported |
| `teachers` | name, phone, payout_type (fixed/per_student_monthly), rate, metadata (JSONB) |
| `packages` | instrument_id, name, classes_count, price, payment_frequency |
| `payments` | student_id, package_id, amount, method, metadata (JSONB) |
| `attendance_records` | session_date, batch_id, student_id, status (present/absent/excused), source |
| `teacher_attendance` | teacher_id, batch_id, session_date, status (conducted/not_conducted) |
| `teacher_payouts` | teacher_id, amount, method, period_start, period_end |
| `expenses` | category, amount, date, description |

## Business Logic in DB

- **Attendance deduction:** Mark present → `classes_remaining -= 1` on `enrollment_batches`. Undo (present→absent) → `+1`.
- **Makeup batches:** `is_makeup=true` — only deduct when student actually attends.
- **One enrollment per student:** Multi-instrument via `enrollment_batches` join table.
- **Recurrence format:** Text like `"TUE 17:00-18:00, THU 17:00-18:00"` — parsed in JS.

## Migrations

Sequential SQL files in `db/migrations/` (001–014). Apply with:
```bash
psql $DATABASE_URL < db/migrations/00N_description.sql
```

Always update `db/schema.sql` after creating a migration to keep the DDL source of truth current.

## Transaction Pattern

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... multiple operations
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
} finally {
  client.release();
}
```
