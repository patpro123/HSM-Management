# Architecture

## Business Context

- ~100–200 active students, up to 10 teachers
- 8 instruments: Keyboard, Guitar, Piano, Drums, Tabla, Violin, Hindustani Vocals, Carnatic Vocals
- Closed on Mondays. Tue–Fri 17:00–21:00 | Sat 15:00–21:00 | Sun 10:00–13:00 & 17:00–21:00
- Classes run twice weekly per instrument; students can enroll in multiple instruments
- Payout models: fixed salary or per-student-monthly
- Payment packages: Monthly (8 classes) or Quarterly (24 classes)

## Directory Layout

```
HSM-Management/
├── backend-enroll/          # Express.js API
│   ├── index.js             # Entry + inline routes (batches, instruments, attendance, enroll)
│   ├── db.js                # PostgreSQL pool
│   ├── auth/                # JWT, RBAC, Google OAuth
│   └── routes/              # Modular route files (13)
├── frontend-enroll/         # React + TS SPA
│   └── src/
│       ├── App.tsx          # Root — tab nav, state, OAuth callback
│       ├── api.ts           # Authenticated fetch wrappers
│       ├── auth.ts          # Token management
│       ├── types.ts         # TS interfaces
│       ├── pages/           # Page components
│       └── components/      # Feature components (21)
├── db/
│   ├── schema.sql           # Full DDL — source of truth
│   ├── seed.sql             # Sample data
│   └── migrations/          # Sequential (001–014)
└── docker-compose.yml       # Local dev DB
```

## Core Data Model

```
students (1) → enrollments (1) → enrollment_batches (many) → batches → instruments
                                                                    → teachers
payments (many) → students
payments (many) → packages → instruments
attendance_records → batch + student + session_date
teacher_payouts → teacher + period
```

**Key design decisions:**
1. One enrollment per student, many `enrollment_batches` — handles multi-instrument
2. `classes_remaining` tracked at `enrollment_batches` level — per-instrument credit isolation
3. JSONB metadata on students/teachers for flexible data (email, image, guardian info)
4. `is_makeup` flag on batches — makeup batches only deduct on attendance
