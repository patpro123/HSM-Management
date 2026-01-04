# Enrollment Module API Documentation

## Overview
The enrollment module provides APIs for student registration with instrument selection, batch assignment, and payment processing.

## Data Model Changes (2026-01-04)
- **One enrollment per student** (not per instrument)
- Multiple batches per student via `enrollment_batches` table
- Each batch is specific to one instrument + teacher + time slot
- Payments are created per package (instrument + payment type)

---

## Endpoints

### 1. GET `/api/instruments`
Fetch all available instruments for checkbox display during enrollment.

**Response:**
```json
{
  "instruments": [
    {
      "id": "uuid",
      "name": "Keyboard",
      "max_batch_size": 8,
      "online_supported": true,
      "created_at": "timestamp",
      "updated_at": "timestamp"
    },
    ...
  ]
}
```

---

### 2. GET `/api/batches`
Fetch all batches with instrument and teacher details.

**Response:**
```json
{
  "batches": [
    {
      "id": "uuid",
      "recurrence": "Tue/Thu 17:00-18:00",
      "start_time": "17:00:00",
      "end_time": "18:00:00",
      "capacity": 8,
      "is_makeup": false,
      "instrument_id": "uuid",
      "instrument_name": "Keyboard",
      "teacher_id": "uuid",
      "teacher_name": "Ravi Kumar"
    },
    ...
  ]
}
```

---

### 3. GET `/api/batches/:instrumentId`
Fetch batches for a specific instrument.

**Path Parameters:**
- `instrumentId` (uuid) - The instrument ID

**Response:**
```json
{
  "batches": [
    {
      "id": "uuid",
      "recurrence": "Tue/Thu 17:00-18:00",
      "start_time": "17:00:00",
      "end_time": "18:00:00",
      "capacity": 8,
      "is_makeup": false,
      "instrument_name": "Keyboard",
      "teacher_id": "uuid",
      "teacher_name": "Ravi Kumar"
    },
    ...
  ]
}
```

---

### 4. POST `/api/enroll`
Create a new student enrollment with multiple instruments/batches.

**Request Body:**
```json
{
  "answers": {
    "firstName": "Priya",
    "lastName": "Singh",
    "email": "priya@example.com",
    "dob": "2010-05-12",
    "address": "123 Street Name, City",
    "guardianName": "Mrs. Singh",
    "telephone": "+91-9010000001",
    "dateOfJoining": "2026-01-05",
    "streams": [
      {
        "instrument": "Keyboard",
        "batch": "Tue/Thu 17:00-18:00",
        "payment": "Monthly"
      },
      {
        "instrument": "Guitar",
        "batch": "Wed/Fri 18:00-19:00",
        "payment": "Quarterly"
      }
    ]
  }
}
```

**Validation:**
- All required fields must be present
- Email must be valid format
- Telephone must match international format pattern
- Payment must be "Monthly" or "Quarterly"
- At least one stream is required

**Response (Success):**
```json
{
  "ok": true,
  "studentId": "uuid",
  "enrollmentId": "uuid",
  "message": "Enrollment successful"
}
```

**Response (Error):**
```json
{
  "error": "Error message"
}
```

**What happens:**
1. Creates student record
2. Creates ONE enrollment record per student
3. For each stream:
   - Finds instrument, package, and batch
   - Creates `enrollment_batches` record linking enrollment to batch
   - Creates payment record
4. Updates enrollment `classes_remaining` to sum of all packages

---

### 5. GET `/api/enrollments`
Fetch all enrollments with student details and assigned batches.

**Response:**
```json
{
  "enrollments": [
    {
      "student_id": "uuid",
      "name": "Priya Singh",
      "dob": "2010-05-12",
      "phone": "+91-9010000001",
      "guardian_contact": "Mrs. Singh",
      "metadata": {"email": "priya@example.com", "address": "..."},
      "enrollment_id": "uuid",
      "status": "active",
      "classes_remaining": 32,
      "enrolled_on": "2026-01-05",
      "batches": [
        {
          "batch_id": "uuid",
          "instrument": "Keyboard",
          "batch_recurrence": "Tue/Thu 17:00-18:00",
          "teacher": "Ravi Kumar",
          "start_time": "17:00:00",
          "end_time": "18:00:00"
        },
        {
          "batch_id": "uuid",
          "instrument": "Guitar",
          "batch_recurrence": "Wed/Fri 18:00-19:00",
          "teacher": "Suresh Patel",
          "start_time": "18:00:00",
          "end_time": "19:00:00"
        }
      ]
    },
    ...
  ]
}
```

---

## Environment Variables
See `.env.example`:
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: hsm_db)
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `PORT` - API port (default: 3000)

---

## Running the API

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. Apply migration (if schema was created before this change):
   ```bash
   psql -d hsm_dev -f db/migrations/001_update_enrollment_schema.sql
   ```

4. Start the server:
   ```bash
   npm start
   ```

Server will run on `http://localhost:3000` (or `PORT` from env).

---

## Testing

Example: Fetch instruments
```bash
curl http://localhost:3000/api/instruments
```

Example: Enroll a student
```bash
curl -X POST http://localhost:3000/api/enroll \
  -H "Content-Type: application/json" \
  -d '{
    "answers": {
      "firstName": "Test",
      "lastName": "Student",
      "email": "test@example.com",
      "dob": "2010-01-01",
      "address": "123 Test St",
      "guardianName": "Test Guardian",
      "telephone": "+91-9999999999",
      "dateOfJoining": "2026-01-04",
      "streams": [
        {
          "instrument": "Keyboard",
          "batch": "Tue/Thu 17:00-18:00",
          "payment": "Monthly"
        }
      ]
    }
  }'
```
