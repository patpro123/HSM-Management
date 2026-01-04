# Hyderabad School of Music — Management System 🎵

Complete school management software for music education with enrollment, batch management, AI-assisted attendance, and payment tracking.

## 📋 Quick Links

- [Requirements](requirements.md) — Full MVP requirements and business rules
- [ER Diagram](ER_Diagram.md) — Database schema visualization
- [API Documentation](backend-enroll/API.md) — Backend API reference
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) — Latest changes and testing
- [Checklist](CHECKLIST.md) — Development status and next steps

## 🎯 Features

### Phase 1 (MVP) — ✅ Completed
- ✅ **Student Enrollment** with multiple instruments
- ✅ **Batch Management** (instrument + teacher + schedule)
- ✅ **Payment Processing** (Monthly/Quarterly packages)
- ✅ **Dynamic Instruments API** (fetch from database)
- ✅ **Dynamic Batches API** (with teacher details)
- ✅ **One Enrollment Per Student** (flexible batch assignments)

### Phase 2 (Planned)
- AI-assisted Attendance via WhatsApp
- Teacher Payouts Automation
- Parent Portal
- Recurring Invoices
- Holiday Management

### Phase 3 (Future)
- Automated Student Feedback on Recordings
- Churn Prediction Analytics
- Advanced Scheduling & Marketplace

## 🏗️ Architecture

```
HSM-Management/
├── backend-enroll/          # Node.js + Express API
│   ├── index.js             # Main server (5 endpoints)
│   ├── db.js                # PostgreSQL connection pool
│   ├── API.md               # API documentation
│   └── test-api.js          # Automated tests
│
├── frontend-enroll/         # React enrollment UI
│   ├── src/
│   │   ├── components/
│   │   └── pages/
│   └── index.html
│
├── db/
│   ├── schema.sql           # PostgreSQL DDL
│   ├── seed.sql             # Sample data
│   ├── migrations/          # Schema migrations
│   └── README.md            # Local DB setup guide
│
├── scripts/
│   ├── start-db.sh          # Start PostgreSQL + apply schema
│   └── verify-db.sh         # Verify DB tables and data
│
└── docker-compose.yml       # PostgreSQL + pgAdmin
```

## 🚀 Quick Start

### 1. Start the Database
```bash
# Using Docker Compose
docker compose up -d

# Or using the script
./scripts/start-db.sh
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

API runs on `http://localhost:3000`

### 3. Test the API
```bash
cd backend-enroll
node test-api.js
```

Expected output:
```
✅ All endpoints working!
1. GET /api/instruments - Found 8 instruments
2. GET /api/batches - Found 4 batches
3. GET /api/enrollments - Found 2 enrollments
```

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
