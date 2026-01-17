# Hyderabad School of Music — Management System 🎵

Complete school management software for music education with enrollment, batch management, attendance tracking, payment processing, and teacher payouts.

## 📋 Quick Links

- [Requirements](requirements.md) — Full MVP requirements and business rules
- [ER Diagram](ER_Diagram.md) — Database schema visualization
- [API Documentation](backend-enroll/API.md) — Comprehensive backend API reference
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) — Latest changes and testing
- [Checklist](CHECKLIST.md) — Development status and next steps
- [Database Setup](db/README.md) — PostgreSQL setup and migrations

## 🎯 Features

### Core Modules — ✅ Fully Implemented

#### 👨‍🎓 Student Management
- ✅ **Student Registration** with comprehensive profile management
- ✅ **Multi-instrument Enrollment** (one enrollment per student)
- ✅ **Dynamic Batch Assignment** (multiple batches per student)
- ✅ **Student Profile Images** (upload and display)
- ✅ **Search & Filter** (by name, email, instrument, batch)
- ✅ **Edit & Delete Operations** with validation
- ✅ **Enrollment History** tracking per student

#### 🎹 Batch Management
- ✅ **Batch Creation & Configuration** (instrument + teacher + schedule)
- ✅ **Capacity Management** (max students per batch)
- ✅ **Dynamic Batch Listing** (with teacher and instrument details)
- ✅ **Batch-specific Student Lists**
- ✅ **Schedule Management** (recurrence patterns, time slots)
- ✅ **Makeup Batch Support**

#### 📊 Attendance Tracking
- ✅ **Daily Attendance Marking** (batch-centric workflow)
- ✅ **Bulk Actions** (Mark All Present/Absent)
- ✅ **Historical Attendance Records**
- ✅ **Auto-deduction of Classes** on attendance marking
- ✅ **Date Picker** for backdated attendance
- ✅ **Mobile-responsive Design**
- ✅ **Role-based Access** (teachers vs admins)

#### 💰 Payment Processing
- ✅ **Payment Recording** (manual and package-based)
- ✅ **Payment Frequency** (Monthly/Quarterly packages)
- ✅ **Auto-calculation of Classes** based on package type
- ✅ **Payment History** per student
- ✅ **Class Balance Tracking**
- ✅ **Transaction Management**

#### 👨‍🏫 Teacher Management
- ✅ **Teacher Profiles** (name, contact, bio, expertise)
- ✅ **Batch Assignment** (view all batches per teacher)
- ✅ **Payout Calculations** (per-session basis)
- ✅ **Monthly Payout Reports**
- ✅ **Payment Status Tracking** (pending/paid)
- ✅ **Attendance-based Earnings**

#### 🎼 Instrument Management
- ✅ **Dynamic Instrument Library** (Keyboard, Guitar, Piano, Drums, Tabla, Violin, Vocals)
- ✅ **Instrument Configuration** (max batch size, online support)
- ✅ **Instrument-specific Filtering**

### Additional Features
- ✅ **Dashboard & Statistics** (enrollment counts, batch capacity, revenue)
- ✅ **Search & Filter** across all modules
- ✅ **Responsive UI** (mobile-first design)
- ✅ **PostgreSQL Database** with migrations
- ✅ **RESTful API** (comprehensive endpoint coverage)
- ✅ **Error Handling & Validation** throughout

### Phase 2 (Planned)
- 🔄 AI-assisted Attendance via WhatsApp (LLM integration ready)
- 🔄 Automated Recurring Invoices
- 🔄 Parent Portal Dashboard
- 🔄 Holiday Management
- 🔄 SMS/Email Notifications

### Phase 3 (Future)
- 📅 Automated Student Feedback on Recordings
- 📅 Churn Prediction Analytics
- 📅 Advanced Scheduling & Marketplace
- 📅 Mobile App (iOS/Android)

## 🏗️ Architecture

```
HSM-Management/
├── backend-enroll/                    # Node.js + Express API
│   ├── index.js                       # Main server (35+ endpoints)
│   ├── db.js                          # PostgreSQL connection pool
│   ├── API.md                         # Comprehensive API documentation
│   └── test-api.js                    # Automated API tests
│
├── frontend-enroll/                   # React + TypeScript UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── StudentManagement.tsx  # Student CRUD & filtering
│   │   │   ├── TeacherManagement.tsx  # Teacher profiles & payouts
│   │   │   ├── EnrollmentForm.tsx     # Multi-step enrollment wizard
│   │   │   ├── PaymentModule.tsx      # Payment recording & history
│   │   │   ├── AttendanceDashboard.tsx# Attendance overview
│   │   │   ├── StatsOverview.tsx      # Dashboard statistics
│   │   │   └── Attendance/
│   │   │       ├── AttendanceTab.jsx  # Daily attendance marking
│   │   │       ├── BatchSelector.jsx  # Batch selection UI
│   │   │       ├── AttendanceList.jsx # Student status toggles
│   │   │       └── HistoricalAttendance.jsx  # Past records
│   │   ├── pages/
│   │   │   ├── AdminPage.jsx          # Admin dashboard
│   │   │   ├── StudentsPage.jsx       # Student management
│   │   │   └── EnrollPage.jsx         # Enrollment flow
│   │   ├── types.ts                   # TypeScript type definitions
│   │   └── mockData.ts                # Development data
│   └── vite.config.js                 # Vite build configuration
│
├── db/
│   ├── schema.sql                     # Complete PostgreSQL DDL
│   ├── seed.sql                       # Sample data (8 instruments, 5 teachers)
│   ├── migrations/                    # Schema evolution
│   │   ├── 001_update_enrollment_schema.sql
│   │   ├── 002_add_teacher_payout_columns.sql
│   │   └── 003_add_enrollment_batches_columns.sql
│   └── README.md                      # Database setup guide
│
├── scripts/
│   ├── start-db.sh                    # Start PostgreSQL + apply schema
│   └── verify-db.sh                   # Verify DB tables and data
│
├── docker-compose.yml                 # PostgreSQL + pgAdmin containers
└── enrollment-agent-frontend/         # AI-assisted enrollment (experimental)
```

### Technology Stack
- **Backend:** Node.js 18+, Express.js, PostgreSQL 15
- **Frontend:** React 18, TypeScript, Vite
- **Database:** PostgreSQL with pgcrypto extension
- **DevOps:** Docker Compose, Shell scripts
- **Future:** Ollama LLM integration for WhatsApp attendance

## 🚀 Quick Start

### 1. Start the Database
```bash
# Using Docker Compose (recommended)
docker compose up -d

# Or using the script
./scripts/start-db.sh

# Verify database setup
./scripts/verify-db.sh
```

**Containers:**
- PostgreSQL: `localhost:5432` (user: `hsm_admin`, password: `secret`, database: `hsm_dev`)
- pgAdmin: `http://localhost:8080` (email: `admin@hsm.local`, password: `admin`)

### 2. Start the Backend API
```bash
cd backend-enroll
npm install
node index.js
```

API runs on `http://localhost:3000` with 35+ RESTful endpoints

### 3. Start the Frontend Application
```bash
cd frontend-enroll
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` (Vite dev server)

### 4. Test the API (Optional)
```bash
cd backend-enroll
node test-api.js
```

Expected output:
```
✅ All endpoints working!
1. GET /api/instruments - Found 8 instruments
2. GET /api/batches - Found 4+ batches
3. GET /api/students - Student management operational
4. GET /api/teachers - Teacher management operational
5. POST /api/attendance - Attendance tracking ready
```

### 5. Access the Application
- **Frontend Dashboard:** http://localhost:5173
- **API Endpoints:** http://localhost:3000/api/*
- **Database Admin:** http://localhost:8080

### 4. Start the Frontend (optional)
```bash
cd frontend-enroll
npm install
npm run dev
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instruments` | List all instruments for checkboxes |
| GET | `/api/batches` | List all batches with teacher details |
| GET | `/api/batches/:instrumentId` | List batches for specific instrument |
| POST | `/api/enroll` | Create student enrollment with batches |
| GET | `/api/enrollments` | List all enrollments with batch details |

See [API.md](backend-enroll/API.md) for detailed request/response schemas.

## 🗃️ Data Model

**Key Concepts:**
- **One enrollment per student** (not per instrument)
- **Multiple batches per enrollment** via `enrollment_batches` join table
- **Each batch** = specific instrument + teacher + schedule
- **Payments** linked to packages (instrument + class count)

See [DATA_MODEL_REFERENCE.md](DATA_MODEL_REFERENCE.md) for details.

### Core Tables
- `students` — Student information
- `enrollments` — One per student, tracks total classes remaining
- `enrollment_batches` — Links enrollments to batches (many-to-many)
- `batches` — Class schedule (instrument + teacher + time)
- `instruments` — Available instruments (Keyboard, Guitar, etc.)
- `teachers` — Teacher profiles and payout terms
- `packages` — Prepaid class bundles (Monthly/Quarterly)
- `payments` — Transaction records

## 🧪 Testing

### Automated Tests
```bash
cd backend-enroll
node test-api.js
```

### Manual API Tests
```bash
# Fetch instruments
curl http://localhost:3000/api/instruments

# Fetch batches
curl http://localhost:3000/api/batches

# Enroll a student
curl -X POST http://localhost:3000/api/enroll \
  -H "Content-Type: application/json" \
  -d '{"answers": {...}}'

# List enrollments
curl http://localhost:3000/api/enrollments
```

### Database Verification
```bash
./scripts/verify-db.sh
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [requirements.md](requirements.md) | MVP requirements, business rules, schedule |
| [ER_Diagram.md](ER_Diagram.md) | Database schema visualization |
| [backend-enroll/API.md](backend-enroll/API.md) | Complete API reference |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Latest implementation details |
| [DATA_MODEL_REFERENCE.md](DATA_MODEL_REFERENCE.md) | Data model quick reference |
| [BEFORE_AFTER_COMPARISON.md](BEFORE_AFTER_COMPARISON.md) | Enrollment model evolution |
| [CHECKLIST.md](CHECKLIST.md) | Development status & next steps |
| [db/README.md](db/README.md) | Local database setup guide |

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL 15
- pg (node-postgres driver)

**Frontend:**
- React
- Vite

**Infrastructure:**
- Docker + Docker Compose
- pgAdmin 4

**Future:**
- WhatsApp Business API / Twilio
- LLM (OpenAI/Anthropic) for attendance parsing
- Razorpay/Stripe for payments

## 📦 Packages

### Two Package Types
1. **Monthly:** 8 classes
2. **Quarterly:** 24 classes (discounted per-class rate)

Packages are prepaid and update `classes_remaining` upon payment.

## 🎓 Instruments Offered

1. Keyboard (online available ✅)
2. Guitar (online available ✅)
3. Piano
4. Drums
5. Tabla
6. Violin
7. Hindustani Vocals
8. Carnatic Vocals

## 🕒 School Schedule

- **Closed:** Mondays
- **Weekdays (Tue–Fri):** 17:00–21:00
- **Saturday:** 15:00–21:00
- **Sunday:** 10:00–13:00, 17:00–21:00

## 💰 Teacher Compensation

- **2 teachers:** Fixed salary
- **3 teachers:** Per-class payout

System supports both models via `payout_terms` JSONB field.

## 📊 Scale

- **Students:** 100–200 (first year estimate)
- **Teachers:** Up to 10

## 🔐 Environment Variables

Create `backend-enroll/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hsm_dev
DB_USER=hsm_admin
DB_PASSWORD=secret
PORT=3000
```

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill existing process
pkill -f "node index.js"
```

### Database connection fails
```bash
# Check Docker containers
docker ps

# Restart database
docker restart hsm-postgres

# Check logs
docker logs hsm-postgres --tail 100
```

### Missing dependencies
```bash
cd backend-enroll
npm install pg express cors morgan dotenv
```

## 🤝 Contributing

1. Create a feature branch
2. Update relevant documentation
3. Test with `node test-api.js`
4. Submit PR with description

## 📝 License

Proprietary — Hyderabad School of Music

---

**Status:** Phase 1 MVP Complete ✅  
**Next:** Frontend integration with new APIs  
**Last Updated:** 2026-01-04
