# Data Migration Plan: Legacy CSV to Postgres

**Source File:** `HSM_Students_Data.csv`  
**Target Database:** HSM Management (Postgres)

## 1. Overview
This migration involves moving student profiles, enrollment status, and credit balances from a legacy CSV file into the normalized relational schema.

**Key Challenge:** The CSV contains unstructured text for Batches (e.g., "Vocal_SA_4_5", "Siva_Batch_Friday") and Payment Cycles. These must be mapped to UUIDs of structured records in the new database.

## 2. Schema Mapping

| CSV Header | Target Table | Target Column | Transformation Logic |
| :--- | :--- | :--- | :--- |
| **Name** | `students` | `name` | Trim whitespace. |
| **Email** | `students` | `email` | Normalize to lowercase. Used for duplicate checking. |
| **Phone Number** | `students` | `phone` | Clean formatting (remove spaces/dashes). |
| **Locality** | `students` | `metadata->address` | Store in metadata JSON. |
| **Age** | `students` | `metadata->age` | Store in metadata (DOB is preferred but Age is provided). |
| **Profession** | `students` | `metadata->profession` | Store in metadata. |
| **Headshot** | `students` | `metadata->legacy_image` | Store file path. |
| **Course** | `instruments` | `name` | Map to Instrument UUID (e.g., "Vocals" -> UUID). |
| **Day 1 Batch** | `enrollment_batches` | `batch_id` | **Requires Lookup Map**: Map string "Vocal_SA_4_5" -> Batch UUID. |
| **Day 2 Batch** | `enrollment_batches` | `batch_id` | Same as Day 1. |
| **Payment Cycle** | `enrollment_batches` | `payment_frequency` | Map "Quarterly_Vocals" -> "quarterly", "Monthly..." -> "monthly". |
| **Date of Admission** | `enrollments` | `enrolled_on` | Parse date formats (DD-MMM-YYYY or MM/DD/YYYY). |
| **LEFT** | `students` | `is_active` | If "YES" or "TRUE" -> `false`. Else `true`. |
| **Classes covered...** | `enrollments` | `classes_remaining` | Parse integer. Handle negatives or blanks as 0. |

## 3. Prerequisites (Before Running Migration)

Since the new system relies on Foreign Keys, the referenced entities must exist first.

1.  **Instruments**: Ensure all instruments in the CSV (Vocals, Guitar, Keyboard, Drums, Tabla, Violin, Carnatik) exist in the `instruments` table.
2.  **Teachers**: Create teacher profiles for names found in batch descriptions (e.g., "Siva", "John sir") or create a generic "Legacy Teacher".
3.  **Batches**: Create `batches` records in the DB that correspond to the CSV descriptions.
    *   *Action:* Run `extract_unique_values.js` to get the list of all batch strings.
    *   *Action:* Create a `batch_mapping.json` file that maps `{ "Vocal_SA_4_5": "UUID-OF-BATCH" }`.

## 4. Migration Process

The migration script (`import_students.js`) will perform the following steps for each row in the CSV:

1.  **Validation**: Skip empty rows. Check for valid Email.
2.  **Student Creation**:
    *   Check if student exists by Email.
    *   If yes, update/skip. If no, `INSERT INTO students`.
    *   Set `is_active` based on the 'LEFT' column.
3.  **Enrollment Creation**:
    *   Create a single `enrollments` record for the student.
    *   Set `classes_remaining` from "Classes covered by payment".
    *   Set `enrolled_on` from "Date of Admission".
4.  **Batch Assignment**:
    *   **Condition:** Only proceed if student is ACTIVE (`is_active = true`). Inactive students will have no batch enrollments.
    *   Look up "Day 1 Batch" string in `batch_mapping.json`.
    *   Look up "Day 2 Batch" string in `batch_mapping.json`.
    *   `INSERT INTO enrollment_batches` for each valid batch found.
    *   Set `payment_frequency` based on "Payment Cycle".

## 5. Rollback Plan

If the migration fails or data is corrupt:

```sql
-- Delete students created during migration (assuming they were created after a specific timestamp)
DELETE FROM students WHERE created_at > '2026-01-XX 00:00:00';
-- Cascading deletes will remove enrollments and batch assignments.
```

## 6. Next Steps

1.  Run `node extract_unique_values.js` to see what data we are dealing with.
2.  Manually create the Batches in the Web UI or via SQL.
3.  Populate `batch_mapping.json`.
4.  Run `node import_students.js`.