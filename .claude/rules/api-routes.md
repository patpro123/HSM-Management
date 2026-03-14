# API Routes

## Inline in `index.js`

| Method | Path | Description |
|---|---|---|
| GET | `/api/instruments` | All instruments |
| GET | `/api/batches` | All batches (non-makeup) with teacher + instrument |
| GET | `/api/batches/:instrumentId` | Batches for instrument |
| POST | `/api/batches` | Create batch |
| PUT | `/api/batches/:id` | Update batch |
| DELETE | `/api/batches/:id` | Delete batch |
| GET | `/api/batches/:batchId/students` | Students in batch |
| POST | `/api/enroll` | Atomic enrollment (student + enrollment + batch assignments) |
| GET | `/api/enrollments` | All enrollments with batch details |
| GET | `/api/attendance` | Attendance records (filterable by date, batch) |
| POST | `/api/attendance` | Mark/update attendance (bulk) |
| GET | `/api/portal/student/:email` | Student self-service 360 |
| POST | `/api/students/:id/image` | Upload base64 profile image |
| GET | `/api/auth/config` | Auth state for frontend |
| POST | `/api/agent/enroll` | LLM conversational enrollment |

## Route Modules

| Prefix | File | Key Endpoints |
|---|---|---|
| `/api/auth` | `auth.js` | Google OAuth flow, JWT refresh, logout, profile |
| `/api/students` | `students.js` | GET (list), POST (create) |
| `/api/students` | `students-put.js` | PUT (update profile/enrollments), DELETE |
| `/api/students/:id` | `student360.js` | `/360` view, `/evaluations` CRUD |
| `/api/teachers` | `teachers.js` | CRUD for teacher profiles |
| `/api/teachers` | `teacher360.js` | `/:id/360`, `/:id/students`, `/me/360`, `/attendance` |
| `/api/payments` | `payments.js` | CRUD + `/status/:studentId` |
| `/api/finance` | `finance.js` | Expenses, budgets, reports, today's batches |
| `/api/users` | `users.js` | List users, grant/revoke roles |
| `/api/documents` | `documents.js` | Upload + retrieve student documents |

## Response Patterns

- Success: `{ success: true }` or `{ students: [...] }` / `{ teacher: {...} }`
- Error: `{ error: "message" }` with appropriate HTTP status (400/401/404/500)
