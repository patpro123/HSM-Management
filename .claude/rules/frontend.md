# Frontend Architecture

## Stack

React 19 + TypeScript 5.8 + Vite 6 + TailwindCSS + Recharts 3.6

## State Management

- `App.tsx` manages all top-level state (students, batches, teachers, enrollments, etc.)
- `fetchData()` called on mount and after mutations
- Data passed as props to child components
- No external state library — React hooks only (useState, useEffect, useContext)

## API Integration

All calls go through `api.ts` wrappers that auto-attach JWT:
```typescript
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
```

API base URL configured in `config.ts`:
- Dev: `http://localhost:3000` (Vite proxies `/api`)
- Prod: `https://hsm-management-backend.onrender.com`

## Tab System (Role-Gated)

| Tab Key | Component | Roles |
|---|---|---|
| `stats` | StatsOverview | admin |
| `students` | StudentManagement | admin, teacher |
| `attendance` | AttendanceDashboard | admin, teacher |
| `payments` | PaymentModule | admin |
| `teachers` | TeacherManagement | admin |
| `finance` | FinanceModule | admin |
| `users` | UserManagement | admin |
| `student-profile` | Student360View | student, parent |
| `teacher-profile` | Teacher360View | teacher |
| `enrollment` | EnrollmentForm | admin |

## Key Components

- **Student360View / Teacher360View** — Multi-tab 360 views (Profile, Attendance, Payout/Payments)
- **EnrollmentForm** — Multi-step wizard (student info → instrument → batch → package)
- **AttendanceDashboard** — Batch selector → daily attendance marking + historical view
- **TeacherManagement** — Teacher cards with expandable batches/students, 360 modal
- **PaymentModule** — Record payments, view history, class balance tracking
