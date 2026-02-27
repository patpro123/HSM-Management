# HSM Management — Claude Context File

> Hyderabad School of Music (HSM) — Full-Stack School Management System
> Version: 1.0 (Production-deployed MVP)

---

## 1. Project Overview

HSM Management is a web application for managing the Hyderabad School of Music. It handles student enrollment, batch/class scheduling, attendance tracking, payments, teacher payouts, and school finances.

**Core priorities (in order):** Enrollment → Payments → Attendance → Teacher Payouts

**Business Context:**
- ~100–200 active students, up to 10 teachers
- Instruments offered: Keyboard, Guitar, Piano, Drums, Tabla, Violin, Hindustani Vocals, Carnatic Vocals
- School is **closed on Mondays**
- School timings: Tue–Fri 17:00–21:00 | Saturday 15:00–21:00 | Sunday 10:00–13:00 and 17:00–21:00
- Classes run twice weekly per instrument; each student can enroll in multiple instruments
- Two payout models: 2 teachers on fixed salary, 3 on per-class basis
- Payment packages: Monthly (8 classes) or Quarterly (24 classes)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 18+ / Express.js 4.18 |
| Frontend | React 19 + TypeScript 5.8 |
| Build Tool | Vite 6.2 |
| Styling | TailwindCSS (inline) |
| Charts | Recharts 3.6 |
| Database | PostgreSQL 15 |
| DB Client | node-postgres (pg) |
| Auth | Google OAuth 2.0 + JWT (7d) + Refresh Tokens (30d) |
| Dev DB | Docker Compose (PostgreSQL + pgAdmin) |
| Prod DB | Neon PostgreSQL (serverless) |
| Frontend Deploy | Vercel (auto-deploy on push to `main`) |
| Backend Deploy | Render.com (auto-deploy on push to `main`) |

---

## 3. Directory Structure

```
HSM-Management/
├── backend-enroll/          # Express.js API server
│   ├── index.js             # Entry point — registers routes, auth bypass, LLM agent
│   ├── db.js                # PostgreSQL pool (dual mode: URL or individual params)
│   ├── auth/
│   │   ├── jwtMiddleware.js # JWT generation, validation, refresh
│   │   ├── rbacMiddleware.js# Role-based access control
│   │   └── googleStrategy.js# Passport Google OAuth strategy
│   └── routes/
│       ├── auth.js          # /api/auth/* — OAuth, JWT, profile
│       ├── students.js      # /api/students GET/POST
│       ├── students-put.js  # /api/students PUT (profile, enrollments)
│       ├── teachers.js      # /api/teachers CRUD + payouts
│       ├── payments.js      # /api/payments CRUD
│       ├── finance.js       # /api/finance/* (expenses, budgets, reports)
│       ├── student360.js    # /api/students/:id/360 and evaluations
│       ├── documents.js     # /api/documents (upload, retrieve)
│       └── users.js         # /api/users — role management
│
├── frontend-enroll/         # React + TypeScript SPA
│   └── src/
│       ├── App.tsx          # Root — tab navigation, state, OAuth callback
│       ├── config.ts        # API_BASE_URL configuration
│       ├── api.ts           # apiGet/apiPost/apiPut/apiDelete wrappers
│       ├── auth.ts          # Token management, getCurrentUser()
│       ├── types.ts         # TypeScript interfaces (Student, Batch, etc.)
│       ├── pages/
│       │   ├── AdminPage.jsx       # Admin dashboard
│       │   ├── StudentsPage.jsx    # Student listing page
│       │   ├── EnrollPage.jsx      # New enrollment flow
│       │   └── StudentProfile.tsx  # Individual student profile
│       └── components/
│           ├── StudentManagement.tsx
│           ├── TeacherManagement.tsx
│           ├── PaymentModule.tsx
│           ├── EnrollmentForm.tsx   # Multi-step enrollment wizard
│           ├── AttendanceDashboard.tsx
│           ├── FinanceModule.tsx
│           ├── StatsOverview.tsx
│           ├── Student360View.tsx
│           ├── LoginPage.jsx
│           ├── UserManagement.tsx
│           ├── TodaysClasses.tsx
│           └── Attendance/
│               ├── AttendanceTab.jsx
│               ├── BatchSelector.jsx
│               ├── AttendanceList.jsx
│               └── HistoricalAttendance.jsx
│
├── db/
│   ├── schema.sql            # Full DDL — source of truth
│   ├── seed.sql              # Sample data (8 instruments, 5 teachers)
│   ├── seed_evaluations.sql  # Student evaluations seed
│   └── migrations/           # Sequential migration scripts (001–...)
│
├── docker-compose.yml        # Local dev DB (PostgreSQL + pgAdmin)
├── scripts/
│   ├── start-db.sh           # Init Docker DB with schema + seed
│   └── verify-db.sh          # Verify tables and data counts
├── requirements.md           # Business rules and functional requirements
├── DATA_MODEL_REFERENCE.md   # Data model documentation
└── ER_Diagram.md             # Entity-relationship diagram
```

---

## 4. Database Schema (Core Tables)

### Key Relationships

```
students (1) ──→ enrollments (1) ──→ enrollment_batches (many)
                                              ↓
                                          batches
                                     (instrument + teacher)
```

### Table Reference

| Table | Purpose |
|---|---|
| `students` | Student profiles. PII in `metadata` JSONB (email, address, guardian info, image base64) |
| `enrollments` | One per student. Tracks `status` (active/paused/completed), `classes_remaining` (aggregate) |
| `enrollment_batches` | Join table. Per-instrument tracking: `batch_id`, `payment_frequency`, `classes_remaining` |
| `batches` | Class schedules. `recurrence` text (e.g., "Tue/Thu 17:00–18:00"), `is_makeup` flag |
| `instruments` | 8 instruments. `max_batch_size`, `online_supported` |
| `teachers` | Profiles + payout config. `payout_type` (fixed/per_class), `rate`, `payout_terms` JSONB |
| `packages` | Fee structures per instrument. `classes_count`, `price`, `payment_frequency` |
| `payments` | Transactions. Links student → package. `metadata` JSONB stores instrument/type |
| `attendance_records` | Daily per-student-per-batch. `status` (present/absent/excused), `source` (web/whatsapp/manual) |
| `teacher_payouts` | Payout ledger per teacher per period |
| `holidays` | School/teacher holidays. `scope` (school/teacher/batch) |
| `users` | Auth identities (Google ID, email, name) |
| `user_roles` | RBAC multi-role: admin, teacher, parent, student |
| `refresh_tokens` | JWT refresh token rotation store |
| `expenses` | Finance: cost tracking by category |
| `monthly_budgets` | Finance: revenue targets + expense limits (JSONB) |
| `audit_logs` | Actor, action, payload (JSONB) for all sensitive operations |

### Critical Business Logic in DB

- **Attendance deduction:** Mark present → `classes_remaining -= 1` (on `enrollment_batches`). Change present → absent → `+1` refund.
- **Makeup classes:** `is_makeup=true` batches only decrement when student attends (not on cancellation).
- **One enrollment per student:** Multi-instrument handled via `enrollment_batches`.

---

## 5. API Endpoints

### Inline in `index.js`

| Method | Path | Description |
|---|---|---|
| GET | `/api/instruments` | All instruments |
| GET | `/api/batches` | All batches with teacher + instrument |
| GET | `/api/batches/:instrumentId` | Batches for specific instrument |
| POST | `/api/batches` | Create batch |
| PUT | `/api/batches/:id` | Update batch |
| DELETE | `/api/batches/:id` | Delete batch |
| GET | `/api/batches/:batchId/students` | Students in batch with attendance status |
| POST | `/api/enroll` | Atomic enrollment (student + enrollment + batch assignments) |
| GET | `/api/enrollments` | All enrollments with batch details |
| GET | `/api/attendance` | Attendance records (filterable) |
| POST | `/api/attendance` | Mark/update attendance |
| GET | `/api/portal/student/:email` | Student self-service 360 view |
| POST | `/api/students/:id/image` | Upload base64 profile image |
| GET | `/api/auth/config` | Auth state for frontend (dev bypass info) |
| POST | `/api/agent/enroll` | Conversational LLM enrollment (Ollama) |

### From Route Modules

| Prefix | Module | Key Endpoints |
|---|---|---|
| `/api/auth` | auth.js | Google OAuth flow, JWT refresh, logout |
| `/api/students` | students.js | CRUD for students |
| `/api/students` | students-put.js | Update profile, update enrollments |
| `/api/students/:id` | student360.js | `/360` view, `/evaluations` CRUD |
| `/api/teachers` | teachers.js | CRUD + `/payouts` history |
| `/api/payments` | payments.js | CRUD + `/status/:studentId` |
| `/api/finance` | finance.js | expenses, budgets, reports, today's batches |
| `/api/users` | users.js | List users, grant/revoke roles |
| `/api/documents` | documents.js | Upload + retrieve student documents |

---

## 6. Authentication Flow

```
User → GET /api/auth/google
  → Google consent screen
  → GET /api/auth/google/callback
  → Backend: creates/updates users + user_roles
  → Generates JWT (7d) + Refresh Token (30d)
  → Redirects to: http://localhost:5173/?token=<jwt>
  → Frontend: extracts token from URL → stores in localStorage
  → All subsequent requests: Authorization: Bearer <jwt>
```

**Roles:** `admin`, `teacher`, `parent`, `student`

**Local dev bypass:** Set `DISABLE_AUTH=true` in backend `.env`. Set `DEV_PROFILE=admin` or `student`.

---

## 7. Frontend Architecture

### State Flow

- `App.tsx` manages all top-level state (students, batches, teachers, etc.)
- `fetchData()` called on mount and after mutations
- Data passed as props to sub-components
- All API calls use `apiGet/apiPost/apiPut/apiDelete` from `api.ts` (adds Bearer token automatically)

### Main Tabs (role-gated)

| Tab | Roles |
|---|---|
| Stats | admin |
| Students | admin, teacher |
| Attendance | admin, teacher |
| Payments | admin |
| Teachers | admin |
| Finance | admin |
| Users | admin |
| Student Profile | student, parent (own data only) |

### API Config

```typescript
// frontend-enroll/src/config.ts
API_BASE_URL = VITE_API_BASE_URL || (DEV ? 'http://localhost:3000' : 'https://hsm-management.onrender.com')
```

---

## 8. Environment Variables

### Backend (`backend-enroll/.env`)

```bash
# Database (use one or the other)
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname?sslmode=require
# OR individual params (local dev):
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hsm_dev
DB_USER=hsm_admin
DB_PASSWORD=secret

PORT=3000
NODE_ENV=production

JWT_SECRET=<min-32-char-secret>
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
GOOGLE_CALLBACK_URL=https://backend.example.com/api/auth/google/callback
FRONTEND_URL=https://hsm-management-frontend.vercel.app

# LLM (optional — conversational enrollment agent)
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3

# Dev only
DISABLE_AUTH=false
DEV_PROFILE=admin
```

### Frontend (`frontend-enroll/.env`)

```bash
VITE_API_BASE_URL=https://hsm-management-backend.onrender.com
```

---

## 9. Local Development

```bash
# 1. Start database
docker compose up -d
./scripts/start-db.sh

# 2. Start backend
cd backend-enroll && npm install && node index.js
# → http://localhost:3000

# 3. Start frontend
cd frontend-enroll && npm install && npm run dev
# → http://localhost:5173

# 4. pgAdmin
# → http://localhost:8080
```

**NPM Scripts:**
- Backend: `npm start` (= `node index.js`)
- Frontend: `npm run dev` | `npm run build` | `npm run preview`

**API tests:** `cd backend-enroll && node test-api.js`

---

## 10. Production Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | https://hsm-management-frontend.vercel.app |
| Backend | Render.com | https://hsm-management-backend.onrender.com |
| Database | Neon PostgreSQL | (connection string in Render env vars) |

- Auto-deploy on push to `main` branch for both Vercel and Render
- Apply DB migrations: `psql $DATABASE_URL < db/migrations/00N_*.sql`

---

## 11. Features Status

### Implemented ✅

- Student registration and profile management (with photo upload)
- Multi-instrument enrollment via wizard form
- Batch management (CRUD, capacity, recurrence, makeup batches)
- Attendance marking (batch-centric, daily, bulk actions, history)
- Payment recording (monthly/quarterly packages, class balance)
- Teacher management + payout calculation (fixed + per-class models)
- Finance module (expenses, budgets, revenue/expense reports)
- Student 360 view (attendance summary, payment status, evaluations)
- Google OAuth + JWT authentication
- Role-based access control (admin/teacher/parent/student)
- User management (grant/revoke roles)
- Stats/dashboard overview

### Planned (Phase 2) 🔄

- AI-assisted attendance via WhatsApp (currently paused)
- Automated recurring invoices
- Parent portal dashboard
- Holiday management calendar
- SMS/Email notifications

### Future (Phase 3) 📅

- Automated student feedback on recordings
- Churn prediction analytics
- Mobile app (iOS/Android)

---

## 12. Key Architectural Decisions

1. **One enrollment per student, many `enrollment_batches`** — solves multi-instrument cleanly
2. **`classes_remaining` tracked at `enrollment_batches` level** — per-instrument credit isolation
3. **JSONB for flexible metadata** — student image (base64), guardian info, payment metadata
4. **JWT rotation** — refresh token revoked on use; access token 7d, refresh 30d
5. **Dual DB config** — `DATABASE_URL` (prod) or individual params (local); auto-SSL for prod URLs
6. **Auth bypass for local dev** — `DISABLE_AUTH=true` skips Passport entirely
7. **Makeup batch logic** — `is_makeup=true` batches don't deduct credits until student attends

---

## 13. Common Patterns

### Adding a New API Route

1. Create or edit a file in `backend-enroll/routes/`
2. Register in `backend-enroll/index.js`: `app.use('/api/prefix', require('./routes/newRoute'))`
3. Add TypeScript types in `frontend-enroll/src/types.ts`
4. Add API calls in `frontend-enroll/src/api.ts` or inline with `apiGet/apiPost`

### Database Migrations

1. Create `db/migrations/00N_description.sql`
2. Apply: `psql $DATABASE_URL < db/migrations/00N_description.sql`
3. Update `db/schema.sql` to reflect the new state

### Role-Gating UI

```typescript
// In App.tsx or components — check user roles
const isAdmin = user?.roles?.includes('admin')
const isTeacher = user?.roles?.includes('teacher')
```

---

## 14. File Paths Quick Reference

| What | Path |
|---|---|
| Backend entry | [backend-enroll/index.js](backend-enroll/index.js) |
| DB connection | [backend-enroll/db.js](backend-enroll/db.js) |
| JWT middleware | [backend-enroll/auth/jwtMiddleware.js](backend-enroll/auth/jwtMiddleware.js) |
| RBAC middleware | [backend-enroll/auth/rbacMiddleware.js](backend-enroll/auth/rbacMiddleware.js) |
| Frontend entry | [frontend-enroll/src/App.tsx](frontend-enroll/src/App.tsx) |
| API wrappers | [frontend-enroll/src/api.ts](frontend-enroll/src/api.ts) |
| Auth utils | [frontend-enroll/src/auth.ts](frontend-enroll/src/auth.ts) |
| TypeScript types | [frontend-enroll/src/types.ts](frontend-enroll/src/types.ts) |
| API config | [frontend-enroll/src/config.ts](frontend-enroll/src/config.ts) |
| DB schema (DDL) | [db/schema.sql](db/schema.sql) |
| Business requirements | [requirements.md](requirements.md) |
| ER diagram | [ER_Diagram.md](ER_Diagram.md) |
| Data model reference | [DATA_MODEL_REFERENCE.md](DATA_MODEL_REFERENCE.md) |
