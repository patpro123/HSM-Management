# HSM Backend API (Express + PostgreSQL)

Comprehensive Node.js backend for the HSM Management System with 35+ RESTful API endpoints.

## Quick Start

```bash
cd backend-enroll
npm install
node index.js
```

API runs on `http://localhost:3000`

## API Modules

### 🎓 Student Management
- `GET /api/students` — List all students with enrollments
- `GET /api/students/:id` — Get student details with batch assignments
- `POST /api/students` — Create new student
- `PUT /api/students/:id` — Update student profile
- `DELETE /api/students/:id` — Delete student
- `POST /api/students/:id/image` — Upload student profile image
- `POST /api/students/:id/enroll` — Enroll existing student in batches

### 📝 Enrollment
- `POST /api/enroll` — New student enrollment with multiple instruments
- `GET /api/enrollments` — List all enrollments with batch details
- `POST /api/agent/enroll` — AI-assisted enrollment (LLM-powered)

### 🎹 Instruments & Batches
- `GET /api/instruments` — List all instruments
- `GET /api/batches` — List all batches with teacher/instrument info
- `GET /api/batches/:instrumentId` — Filter batches by instrument
- `GET /api/batches/:id/students` — Get students in a specific batch
- `POST /api/batches` — Create new batch
- `PUT /api/batches/:id` — Update batch details

### 👨‍🏫 Teacher Management
- `GET /api/teachers` — List all teachers with batch assignments
- `GET /api/teachers/:id` — Get teacher details
- `GET /api/teachers/:id/batches` — Get batches for specific teacher
- `GET /api/teachers/:id/payouts` — Calculate teacher payouts
- `POST /api/teachers` — Create new teacher
- `PUT /api/teachers/:id` — Update teacher profile

### 📊 Attendance Tracking
- `POST /api/attendance` — Mark attendance (bulk)
- `GET /api/attendance` — Get attendance records (with filters)
- `GET /api/attendance/batch/:id` — Attendance for specific batch

### 💰 Payments
- `POST /api/payments` — Record payment
- `GET /api/payments` — List all payments
- `GET /api/payments/student/:id` — Payment history for student

### 📈 Statistics
- `GET /api/stats` — Dashboard statistics (enrollments, revenue, capacity)

## Features

✅ **PostgreSQL Integration** — Full database persistence with connection pooling  
✅ **Transaction Management** — ACID compliance for critical operations  
✅ **Input Validation** — Comprehensive request validation  
✅ **Error Handling** — Structured error responses  
✅ **CORS Enabled** — Cross-origin support for frontend  
✅ **UUID Primary Keys** — Secure identifiers  
✅ **Batch Processing** — Bulk operations support  
✅ **LLM Integration Ready** — Ollama support for AI features  

## Database Connection

Connects to PostgreSQL via environment variables or defaults:
- Host: `localhost`
- Port: `5432`
- User: `hsm_admin`
- Password: `secret`
- Database: `hsm_dev`

## Testing

Run automated API tests:
```bash
node test-api.js
```

## Documentation

See [API.md](./API.md) for detailed endpoint specifications, request/response formats, and examples.
