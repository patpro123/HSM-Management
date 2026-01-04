# Enrollment Model: Before vs After

## ❌ OLD MODEL (Before 2026-01-04)

### Problem: One enrollment per instrument per student

```
Student: Priya
  ├── Enrollment 1 (Keyboard)
  │    ├── instrument_id: Keyboard
  │    ├── classes_remaining: 8
  │    └── EnrollmentBatch → Batch (Tue/Thu 17:00, Keyboard, Ravi)
  │
  └── Enrollment 2 (Guitar)
       ├── instrument_id: Guitar
       ├── classes_remaining: 24
       └── EnrollmentBatch → Batch (Wed/Fri 18:00, Guitar, Suresh)
```

**Issues:**
- Multiple enrollment records per student
- Difficult to track total classes for billing
- Student-level data (enrolled_on, status) duplicated
- Confusing when reporting on "how many enrollments"

---

## ✅ NEW MODEL (After 2026-01-04)

### Solution: One enrollment per student, multiple batches via join table

```
Student: Priya
  └── Enrollment (ONE record)
       ├── instrument_id: NULL (deprecated)
       ├── classes_remaining: 32 (total)
       ├── status: active
       ├── enrolled_on: 2026-01-05
       │
       └── EnrollmentBatches (TWO records)
            ├── Batch 1 → Keyboard, Tue/Thu 17:00, Teacher: Ravi
            └── Batch 2 → Guitar, Wed/Fri 18:00, Teacher: Suresh
```

**Benefits:**
- ✅ Single source of truth for student enrollment
- ✅ Total classes remaining in one place
- ✅ Clean semantics: "one student, one enrollment"
- ✅ Easy to add/remove instruments
- ✅ Payments linked to student (not enrollment)

---

## API Comparison

### OLD: Fetching batches for Keyboard students

```javascript
// Had to hardcode or maintain separate list
const keyboardBatches = [
  { id: 'uuid-1', name: 'Tue/Thu 17:00' },
  { id: 'uuid-2', name: 'Tue/Thu 18:00' }
];
```

### NEW: Dynamic batch fetching ✅

```javascript
// Fetch all instruments
GET /api/instruments
// Returns: [{ id, name, max_batch_size, online_supported }, ...]

// Fetch batches for selected instrument
GET /api/batches/:instrumentId
// Returns batches with teacher, schedule, capacity
```

---

## Enrollment Creation Comparison

### OLD POST `/api/enroll`

**Request:**
```json
{
  "answers": {
    "firstName": "Priya",
    "streams": [
      { "instrument": "Keyboard", "batch": "..." },
      { "instrument": "Guitar", "batch": "..." }
    ]
  }
}
```

**What happened:**
- Created 2 enrollment records
- Created 2 enrollment_batches records
- Created 2 payment records

---

### NEW POST `/api/enroll` ✅

**Request:** (same format)
```json
{
  "answers": {
    "firstName": "Priya",
    "streams": [
      { "instrument": "Keyboard", "batch": "..." },
      { "instrument": "Guitar", "batch": "..." }
    ]
  }
}
```

**What happens:**
- Creates 1 student record
- Creates **1 enrollment record** (not 2!)
- Creates 2 enrollment_batches records (one per instrument)
- Creates 2 payment records
- Sets `classes_remaining = 32` (sum of both packages)

---

## Database Query Comparison

### OLD: Get student's total classes

```sql
-- Had to sum across multiple enrollments
SELECT SUM(classes_remaining) 
FROM enrollments 
WHERE student_id = 'uuid-1';
```

### NEW: Get student's total classes ✅

```sql
-- Direct read, no aggregation needed
SELECT classes_remaining 
FROM enrollments 
WHERE student_id = 'uuid-1';
```

---

### OLD: Get all instruments for a student

```sql
-- Join enrollments to instruments
SELECT i.name
FROM enrollments e
JOIN instruments i ON e.instrument_id = i.id
WHERE e.student_id = 'uuid-1';
```

### NEW: Get all instruments for a student ✅

```sql
-- Join through enrollment_batches → batches → instruments
SELECT DISTINCT i.name
FROM enrollments e
JOIN enrollment_batches eb ON e.id = eb.enrollment_id
JOIN batches b ON eb.batch_id = b.id
JOIN instruments i ON b.instrument_id = i.id
WHERE e.student_id = 'uuid-1';
```

*(Slightly longer query, but cleaner data model and more flexibility)*

---

## Migration Path

### Applied Migration: `001_update_enrollment_schema.sql`

```sql
-- Make instrument_id nullable
ALTER TABLE enrollments ALTER COLUMN instrument_id DROP NOT NULL;

-- Add comments
COMMENT ON COLUMN enrollments.instrument_id IS 
  'Deprecated - Use enrollment_batches to link student to specific instrument batches.';
```

### Backward Compatibility

- ✅ Old enrollments still work (instrument_id remains populated)
- ✅ New enrollments set instrument_id = NULL
- ✅ Both read paths supported in GET /api/enrollments

---

## Summary

| Aspect | OLD | NEW ✅ |
|--------|-----|--------|
| Enrollments per student | N (one per instrument) | 1 (student-level) |
| `instrument_id` in enrollment | Required | NULL (deprecated) |
| Classes tracking | Per instrument | Total across all |
| Batch assignment | Via enrollment_batches | Via enrollment_batches (same) |
| Reporting clarity | "15 enrollments" (confusing) | "15 students enrolled" (clear) |
| Adding an instrument | Create new enrollment | Add enrollment_batch |

---

**Status:** New model implemented and tested ✅  
**Next:** Update frontend to use new APIs (`/api/instruments`, `/api/batches`)
