# Hyderabad School of Music — Management System

**Version 1.3** — Production-Ready

Full-stack school management platform for music education. Covers the entire student lifecycle: inquiry → enrollment → attendance → payments → teacher payouts → analytics.

## Live Deployment

- **Frontend:** https://hsm-management-frontend.vercel.app
- **Backend API:** https://hsm-management-backend.onrender.com
- **Database:** Neon PostgreSQL (Serverless)

| Service | Platform |
|---|---|
| Frontend | Vercel — auto-deploy on push to `main` |
| Backend | Render.com — auto-deploy on push to `main` |
| Database | Neon PostgreSQL (serverless, SSL required) |

---

## Features

### Public Landing Page
- Full marketing website (hero, instrument showcase, teacher profiles, testimonials, alumni, schedule, FAQ, location)
- Dark/light mode toggle
- Demo class booking modal with email notifications to admin on new booking
- Instrument-specific booking flow

### Student Management
- Student registration with comprehensive profile (name, DOB, phone, guardian contact, address, profile photo)
- Multi-instrument enrollment — one enrollment record per student, one batch assignment per instrument
- Student card grid and table views with search and filter (by name, instrument, batch, status)
- Edit, soft-delete, and reactivate students
- Student 360 view: personal details, academic batches, payment history, attendance summary, documents
- Document upload and retrieval per student
- Student self-service portal (JWT-gated student/parent login)

### Prospect & CRM
- Standalone intake form (`/intake`) — personal info, guardian details, instrument selection, branch location, lead source, free-text notes
- Live schedule chart on intake page showing available slots per instrument per day
- Intake form embedded as an iframe in the landing page trial booking modal
- Prospect capture from landing page booking form
- Prospect list in admin panel with branch filter tabs (All / HSM Main / PBEL City) with per-tab counts and location badge per card
- Email notification to admins on every new inquiry, enriched with guardian details, availability, notes, and branch
- Lead source tracking (landing page, referral, etc.)

### Enrollment
- Multi-step enrollment wizard: student info → instrument selection → batch assignment → payment package
- Day 1 (required) / Day 2 (optional) dropdown selectors per instrument — Day 2 unlocks after Day 1 is chosen and filters out the selected batch
- Backend enforces max 2 batches per instrument
- Multi-instrument support in a single enrollment flow
- Batch capacity enforcement
- Conversational AI enrollment agent (LLM-assisted, experimental)

### Batch Management
- Create and configure batches (instrument + teacher + schedule + capacity + WhatsApp group link)
- Recurrence patterns (e.g., `TUE 17:00-18:00, THU 17:00-18:00`)
- Makeup batch support (deduct credits only when student attends)
- Batch schedule grid view
- Per-batch student lists
- **BatchManager board** — Kanban-style board to move students between batches; drag-and-drop on desktop, tap-to-select on mobile; optimistic UI with revert on failure
- Post-move WhatsApp sync modal to notify affected group chats
- Today's Classes: per-student WhatsApp deep links and group notification modal (editable message, copy-to-clipboard, one-tap group open)

### Attendance Tracking
- Daily attendance marking, batch-centric workflow
- Bulk mark all present / absent
- Out-of-turn (guest) student attendance — add students from other batches to a session
- Extra sessions tracking per student
- Auto-deduction of `classes_remaining` on marking present; refund on reverting to absent
- Historical attendance view with date picker
- Credit report — per-student credit balance across all instruments
- Teacher attendance records (conducted / not conducted) with monthly view

### Payment Processing
- Record payments against monthly or quarterly packages
- Auto-calculate classes added based on package type (monthly = 8, quarterly = 24)
- Payment history per student with student name search, instrument filter, and teacher filter
- Paginated payment list (10 records/page)
- Per-instrument class balance tracking
- Next payment date inference from payment period

### Teacher Management
- Teacher profiles (name, contact, bio, expertise, profile image, metadata)
- Payout type configuration: fixed salary or per-student-monthly
- Batch assignments per teacher
- Teacher 360 view: profile, batches, students, payout history
- Teacher self-service portal (JWT-gated teacher login)

### Finance Module
- **Overview tab:** Real vs projected revenue, teacher expense vs fixed costs, profit/loss for any month, 12-month rolling chart (Recharts)
- **Expenses tab:** Log and manage one-off expenses by category and date
- **Budget tab:** Set monthly revenue targets and per-category expense limits; budget vs actual variance table
- **Payslips tab:** Generate teacher payslips for a selected month with email delivery via SMTP

### Teacher Payout Engine
- Trinity grade tracking per student per batch (Initial, Grade 1–8, Fixed)
- School-wide rate table: per-student payout rate by instrument × Trinity grade
- Teacher-level rate overrides (supersede school-wide rates for specific instrument+grade combos)
- Monthly payout report with per-teacher student list and totals
- Email payout report to admins

### Statistics & Dashboard
- Active student count, batch capacity utilization, revenue totals
- Today's classes view

### Authentication & Authorization
- Google OAuth 2.0 login
- JWT access tokens (7-day) + refresh tokens (30-day, httpOnly cookie)
- Role-based access control: `admin`, `teacher`, `parent`, `student`
- Admin user provisioning and role assignment UI
- Dev bypass mode (`DISABLE_AUTH=true DEV_PROFILE=admin`)

### Student Evaluations
- CRUD for student evaluations/reviews attached to the student 360 view

### Data Migration Tools
- Filter students by teacher (teacher dropdown auto-loads enrolled students) for bulk credit migrations
- Carry-forward credits formula UI: `carry_forward + new_classes_bought − attended_since_payment = credits`

### Document Management
- Upload and retrieve student documents (certificates, ID proofs, etc.)

### Notifications
- In-app notifications panel
- Email alerts: new prospect bookings, payout reports

---

## Architecture

```
HSM-Management/
├── backend-enroll/          # Express.js API (Node 18+)
│   ├── index.js             # Entry + inline routes
│   ├── db.js                # PostgreSQL pool (Neon / Docker)
│   ├── auth/                # JWT, RBAC, Google OAuth
│   ├── routes/              # 19 route modules
│   └── services/            # payoutService (payout calculations)
├── frontend-enroll/         # React 19 + TypeScript + Vite + TailwindCSS
│   └── src/
│       ├── App.tsx          # Root — tab nav, auth, state
│       ├── api.ts           # Authenticated fetch wrappers
│       ├── auth.ts          # Token management
│       ├── types.ts         # TypeScript interfaces
│       └── components/      # Feature components + LandingPage
├── db/
│   ├── schema.sql           # Full DDL — source of truth
│   ├── seed.sql             # Sample data
│   └── migrations/          # Sequential SQL migrations (001–026)
├── enrollment-agent-frontend/ # Experimental AI enrollment agent
└── docker-compose.yml       # Local dev DB + pgAdmin
```

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 18+, Express.js |
| Frontend | React 19, TypeScript 5.8, Vite 6, TailwindCSS, Recharts |
| Database | PostgreSQL 15 (Neon serverless in prod, Docker locally) |
| Auth | Google OAuth 2.0, JWT, refresh tokens |
| Email | Nodemailer (Gmail SMTP) |
| Hosting | Vercel (frontend), Render (backend), Neon (database) |

---

## Quick Start

### Local Development

```bash
# 1. Database
docker compose up -d
./scripts/start-db.sh

# 2. Backend (port 3000)
cd backend-enroll
npm install
DISABLE_AUTH=true DEV_PROFILE=admin node index.js

# 3. Frontend (port 5173)
cd frontend-enroll
npm install
npm run dev

# 4. Apply a migration
psql $DATABASE_URL < db/migrations/00N_description.sql
```

### Environment Variables

**Backend** (`backend-enroll/.env`):
```env
DATABASE_URL=postgresql://...        # Neon connection string (prod)
# Or local DB params:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hsm_dev
DB_USER=hsm_admin
DB_PASSWORD=secret
PORT=3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
JWT_SECRET=...
SMTP_USER=...                        # Gmail address for email notifications
SMTP_PASS=...                        # Gmail App Password
```

**Frontend** (`frontend-enroll/.env`):
```env
VITE_API_BASE_URL=http://localhost:3000
```

> **LAN / mobile testing:** Vite binds to all interfaces (`host: true`) and Express binds to `0.0.0.0`. The auth client resolves the backend URL from the current browser hostname, so devices on the same network can connect using the machine's local IP (e.g. `http://192.168.x.x:5173`).

---

## Database Migrations

| # | Description |
|---|---|
| 001 | Update enrollment schema |
| 002 | Add teacher payout columns |
| 003 | Add enrollment_batches columns |
| 004 | Authentication tables (users, roles, refresh tokens) |
| 005 | Student evaluations |
| 006 | Student 360 enhancements |
| 007 | Soft delete for students |
| 008 | Teacher metadata |
| 009 | Student documents table |
| 010 | Remove negative constraint on classes_remaining |
| 011 | Finance tables (expenses, fee structure, budgets) |
| 012 | Teacher attendance view |
| 013 | Teacher attendance records |
| 014 | Update payout enum |
| 015 | is_extra flag on attendance records |
| 016 | Prospect notes |
| 017 | Provisioned users |
| 018 | Admin provisioning |
| 019 | Trinity grade on enrollment_batches |
| 020 | Instrument × grade rate table |
| 021 | Teacher-level grade rate overrides |
| 022 | Branches and instrument split |
| 023 | Fee structures table |
| 024 | Seed 2026 fee data |
| 025 | Migrate Keyboard/Piano instruments to unified Keyboard |
| 026 | WhatsApp group link column on batches |

---

## School Details

**Instruments:** Keyboard, Guitar, Piano, Drums, Tabla, Violin, Hindustani Vocals, Carnatic Vocals

**Schedule:**
- Closed Mondays
- Tue–Fri: 17:00–21:00
- Saturday: 15:00–21:00
- Sunday: 10:00–13:00, 17:00–21:00

**Packages:** Monthly (8 classes) | Quarterly (24 classes)

**Payout models:** Fixed salary | Per-student-monthly (with Trinity grade rate tiers)

---

## License

Proprietary — Hyderabad School of Music

---

**Last Updated:** 2026-04-13
