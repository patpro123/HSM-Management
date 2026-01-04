# Enrollment Data Model - Quick Reference

## Relationships Overview

```
Student (1) ──── (1) Enrollment
                      │
                      │ (via enrollment_batches)
                      │
                      └──── (many) Batches
                                    │
                                    ├── (1) Instrument
                                    └── (1) Teacher

Payment (many) ──── (1) Student
Payment (many) ──── (1) Package ──── (1) Instrument
```

## Key Tables

### `students`
One record per student (person).

### `enrollments`
**One record per student** (not per instrument).
- `instrument_id`: NULL (deprecated, kept for backward compatibility)
- `classes_remaining`: Total classes across all instruments

### `enrollment_batches` (join table)
Links enrollments to batches. **One record per instrument/batch assignment**.
- `enrollment_id` → references the student's single enrollment
- `batch_id` → references a specific batch (instrument + teacher + schedule)

### `batches`
Defines a class schedule with specific instrument, teacher, and time.
- `instrument_id` → which instrument is taught
- `teacher_id` → who teaches it
- `recurrence` → when it happens (e.g., "Tue/Thu 17:00-18:00")

### `instruments`
Master list of available instruments (Keyboard, Guitar, etc.)

### `packages`
Prepaid class bundles per instrument.
- Example: "Keyboard - Monthly (8)" = 8 classes for ₹2000

### `payments`
Tracks financial transactions linking students to packages.

---

## Example Scenario

**Student:** Priya enrolls in Keyboard + Guitar

### Records Created:

1. **students table:**
   - `id`: uuid-1
   - `name`: "Priya Singh"

2. **enrollments table:** (ONE record)
   - `id`: enrollment-1
   - `student_id`: uuid-1
   - `instrument_id`: NULL
   - `classes_remaining`: 32 (8 from Keyboard Monthly + 24 from Guitar Quarterly)
   - `status`: 'active'

3. **enrollment_batches table:** (TWO records)
   - Record 1:
     - `enrollment_id`: enrollment-1
     - `batch_id`: batch-keyboard-tue-thu (Keyboard, Tue/Thu 17:00, Teacher: Ravi)
   - Record 2:
     - `enrollment_id`: enrollment-1
     - `batch_id`: batch-guitar-wed-fri (Guitar, Wed/Fri 18:00, Teacher: Suresh)

4. **payments table:** (TWO records)
   - Payment 1: Student uuid-1, Package "Keyboard - Monthly", ₹2000
   - Payment 2: Student uuid-1, Package "Guitar - Quarterly", ₹4800

---

## Query Examples

### Get all batches for a student:
```sql
SELECT 
  i.name as instrument,
  b.recurrence,
  t.name as teacher
FROM enrollment_batches eb
JOIN batches b ON eb.batch_id = b.id
JOIN instruments i ON b.instrument_id = i.id
LEFT JOIN teachers t ON b.teacher_id = t.id
WHERE eb.enrollment_id = 'enrollment-1';
```

### Get student's classes remaining:
```sql
SELECT classes_remaining 
FROM enrollments 
WHERE student_id = 'uuid-1';
```

### Get all students in a batch:
```sql
SELECT 
  s.name,
  s.phone,
  e.classes_remaining
FROM enrollment_batches eb
JOIN enrollments e ON eb.enrollment_id = e.id
JOIN students s ON e.student_id = s.id
WHERE eb.batch_id = 'batch-keyboard-tue-thu';
```

---

## Benefits of This Model

✅ **No duplication:** Student info stored once, not per instrument  
✅ **Flexible:** Easy to add/remove instruments for a student  
✅ **Accurate tracking:** Total classes remaining in one place  
✅ **Scalable:** Can handle students in 1 to N instruments  
✅ **Clear semantics:** Enrollment = student registration, enrollment_batches = actual class assignments

---

See `IMPLEMENTATION_SUMMARY.md` for API details and testing results.
