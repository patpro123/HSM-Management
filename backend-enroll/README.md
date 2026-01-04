# Enrollment Backend (Express)

Quick start:

1. cd backend-enroll
2. npm install
3. npm run dev

Endpoints:
- POST /api/enroll  — accepts { answers: { firstName, lastName, email, dob, address, guardianName, telephone, streams, dateOfJoining } }
  - Note: `streams` is an array of objects: `{ instrument, batch, payment }` where `instrument` must be one of Keyboard, Guitar, Piano, Drums, Tabla, Violin, Hindustani vocals, Carnatic vocals; `batch` must be one of the allowed batch slots; `payment` must be `Monthly` or `Quarterly`.
  - `telephone` must be a valid phone number format (international format recommended, e.g., +1 555-555-5555)
- GET /api/enrollments — read all saved enrollments

Notes:
- Data is persisted to `enrollments.json` in this folder. For production use a proper DB (Postgres, SQLite, etc.).
- CORS enabled for dev convenience.
