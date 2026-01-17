# HSM Management System - Complete Setup Guide

**Version:** 1.3  
**Last Updated:** 2026-01-17

## Quick Start (5 minutes)

```bash
# 1. Clone and navigate to project
cd /path/to/HSM-Management

# 2. Start database (PostgreSQL + pgAdmin)
docker compose up -d

# 3. Apply schema and seed data
./scripts/start-db.sh

# 4. Verify database setup
./scripts/verify-db.sh

# 5. Start backend API
cd backend-enroll
npm install
node index.js

# 6. Start frontend (in new terminal)
cd frontend-enroll
npm install
npm run dev
```

**Access the application:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- pgAdmin: http://localhost:8080

---

## Prerequisites

### Required Software

1. **Docker Desktop** (for database)
   - macOS: Download from https://www.docker.com/products/docker-desktop
   - Verify: `docker --version` and `docker compose version`

2. **Node.js 18+** (for backend and frontend)
   - macOS: `brew install node@18`
   - Verify: `node --version` (should be 18.x or higher)

3. **Git** (for version control)
   - macOS: `brew install git`
   - Verify: `git --version`

### Optional Tools

- **TablePlus** or **DBeaver** - GUI database management
- **Postman** or **Insomnia** - API testing
- **VS Code** - Code editor with recommended extensions

---

## Detailed Setup

### Step 1: Database Setup

#### Option A: Docker Compose (Recommended)

```bash
# Start PostgreSQL and pgAdmin containers
docker compose up -d

# Check containers are running
docker ps

# You should see:
# - hsm-postgres (PostgreSQL 15)
# - hsm-pgadmin (pgAdmin 4)
```

**Database Credentials:**
- Host: `localhost`
- Port: `5432`
- User: `hsm_admin`
- Password: `secret`
- Database: `hsm_dev`

**pgAdmin Access:**
- URL: http://localhost:8080
- Email: `admin@hsm.local`
- Password: `admin`

#### Option B: Homebrew (Local PostgreSQL)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database and user
createdb hsm_dev
createuser -s hsm_admin
psql -c "ALTER USER hsm_admin WITH PASSWORD 'secret';"

# Apply schema
psql -U hsm_admin -d hsm_dev -f db/schema.sql
psql -U hsm_admin -d hsm_dev -f db/seed.sql
```

### Step 2: Apply Database Schema

The `start-db.sh` script automatically applies schema and seed data:

```bash
./scripts/start-db.sh
```

This script:
1. Starts Docker containers
2. Waits for PostgreSQL to be ready
3. Applies `db/schema.sql` (creates all tables, indexes, enums)
4. Applies `db/seed.sql` (inserts sample data)

**What gets created:**
- ✅ 12 tables (students, teachers, batches, enrollments, etc.)
- ✅ 6 enums (attendance_status, payment_frequency, etc.)
- ✅ 5 indexes for performance
- ✅ 8 instruments (Keyboard, Guitar, Piano, etc.)
- ✅ 5 teachers with sample data
- ✅ 2 payment packages (Monthly, Quarterly)
- ✅ Sample batches and enrollments

### Step 3: Verify Database

```bash
./scripts/verify-db.sh
```

Expected output:
```
✅ Database Tables:
   attendance_records, audit_logs, batches, enrollment_batches,
   enrollments, holidays, instruments, packages, payments,
   students, teacher_payouts, teachers

✅ Sample Data:
   8 instruments
   5 teachers
   2 packages
   4+ batches
```

### Step 4: Backend API Setup

```bash
# Navigate to backend directory
cd backend-enroll

# Install dependencies
npm install

# Start the server
node index.js
```

**Expected output:**
```
Server running on http://localhost:3000
Database connected successfully
```

**API Endpoints Available:**
- 35+ RESTful endpoints
- Student management (CRUD)
- Teacher management (CRUD)
- Batch management
- Enrollment processing
- Attendance tracking
- Payment recording

Test the API:
```bash
# In another terminal
curl http://localhost:3000/api/instruments
curl http://localhost:3000/api/students
curl http://localhost:3000/api/teachers
```

### Step 5: Frontend Application Setup

```bash
# Navigate to frontend directory (in new terminal)
cd frontend-enroll

# Install dependencies
npm install

# Start development server
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open browser to: **http://localhost:5173**

**Available Pages:**
- `/` - Home/Dashboard
- `/students` - Student Management
- `/admin` - Admin Dashboard with all modules
- `/enroll` - New Student Enrollment

---

## Verification Checklist

### Database ✓
- [ ] Docker containers running (`docker ps`)
- [ ] Can connect to pgAdmin (http://localhost:8080)
- [ ] 12 tables created (`./scripts/verify-db.sh`)
- [ ] Sample data loaded (8 instruments, 5 teachers)

### Backend API ✓
- [ ] Server starts without errors
- [ ] Can fetch instruments (`curl http://localhost:3000/api/instruments`)
- [ ] Can fetch students (`curl http://localhost:3000/api/students`)
- [ ] No database connection errors in logs

### Frontend ✓
- [ ] Vite dev server running
- [ ] Can access http://localhost:5173
- [ ] Dashboard loads without errors
- [ ] Can navigate between pages
- [ ] Can see sample data from backend

---

## Troubleshooting

### Database Issues

**Problem:** Docker containers won't start
```bash
# Check if ports are already in use
lsof -i :5432  # PostgreSQL
lsof -i :8080  # pgAdmin

# Stop conflicting services
brew services stop postgresql

# Restart containers
docker compose down
docker compose up -d
```

**Problem:** Can't connect to database
```bash
# Check container logs
docker logs hsm-postgres

# Test connection
docker exec -i hsm-postgres psql -U hsm_admin -d hsm_dev -c "SELECT 1;"

# Restart containers
docker compose restart
```

**Problem:** Schema not applied
```bash
# Manually apply schema
docker exec -i hsm-postgres psql -U hsm_admin -d hsm_dev < db/schema.sql
docker exec -i hsm-postgres psql -U hsm_admin -d hsm_dev < db/seed.sql
```

### Backend Issues

**Problem:** "Database connection failed"
```bash
# Verify database is running
docker ps | grep postgres

# Check environment variables (backend uses hardcoded values by default)
# Default: localhost:5432, hsm_admin/secret, hsm_dev

# Test connection manually
docker exec -i hsm-postgres psql -U hsm_admin -d hsm_dev -c "\dt"
```

**Problem:** Port 3000 already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in backend-enroll/index.js
# const PORT = process.env.PORT || 3001;
```

**Problem:** Module not found
```bash
# Reinstall dependencies
cd backend-enroll
rm -rf node_modules package-lock.json
npm install
```

### Frontend Issues

**Problem:** Port 5173 already in use
```bash
# Vite will automatically try next available port
# Or manually specify port in vite.config.js
```

**Problem:** API calls failing (CORS/Network errors)
```bash
# Check backend is running on http://localhost:3000
curl http://localhost:3000/api/instruments

# Check browser console for CORS errors
# Backend already has CORS enabled for localhost
```

**Problem:** Build fails
```bash
# Clear cache and reinstall
cd frontend-enroll
rm -rf node_modules dist .vite package-lock.json
npm install
npm run dev
```

---

## Reset Everything

If you need to start fresh:

```bash
# Stop all services
docker compose down -v  # -v removes volumes (deletes data)

# Remove node_modules
rm -rf backend-enroll/node_modules
rm -rf frontend-enroll/node_modules

# Start fresh
docker compose up -d
./scripts/start-db.sh
cd backend-enroll && npm install && node index.js &
cd frontend-enroll && npm install && npm run dev
```

---

## Production Deployment

### Database

**Recommended:** Use managed PostgreSQL service
- AWS RDS PostgreSQL
- Azure Database for PostgreSQL
- Google Cloud SQL for PostgreSQL
- DigitalOcean Managed PostgreSQL

**Configuration:**
1. Create database with PostgreSQL 15+
2. Apply `db/schema.sql`
3. Apply `db/seed.sql` (or custom production data)
4. Configure SSL connections
5. Set up automated backups
6. Enable query performance monitoring

### Backend API

**Options:**
- Docker container on AWS ECS/EKS
- Node.js on Heroku/Railway/Render
- VM with PM2 process manager
- Serverless with AWS Lambda + API Gateway

**Environment Variables:**
```bash
DATABASE_HOST=your-db-host.amazonaws.com
DATABASE_PORT=5432
DATABASE_USER=hsm_admin
DATABASE_PASSWORD=your-secure-password
DATABASE_NAME=hsm_production
PORT=3000
NODE_ENV=production
```

**Process Manager (PM2):**
```bash
npm install -g pm2
cd backend-enroll
pm2 start index.js --name hsm-backend
pm2 save
pm2 startup
```

### Frontend

**Build for production:**
```bash
cd frontend-enroll
npm run build
```

This creates `dist/` folder with static files.

**Deploy options:**
- Vercel (recommended for Vite apps)
- Netlify
- AWS S3 + CloudFront
- Nginx/Apache static hosting

**Configure API URL:**
Create `.env.production`:
```
VITE_API_BASE_URL=https://api.yourdomain.com
```

---

## Development Workflow

### Starting Development Session

```bash
# Terminal 1: Database (if not already running)
docker compose up -d

# Terminal 2: Backend
cd backend-enroll
node index.js

# Terminal 3: Frontend
cd frontend-enroll
npm run dev

# Terminal 4: Available for commands, tests, git, etc.
```

### Making Changes

**Database changes:**
1. Create migration file in `db/migrations/`
2. Apply to dev database
3. Update `db/schema.sql` with changes
4. Document in `db/SCHEMA_STATUS.md`

**Backend changes:**
1. Edit files in `backend-enroll/`
2. Server auto-restarts are NOT enabled by default
3. Stop (Ctrl+C) and restart `node index.js`
4. Test with curl or Postman

**Frontend changes:**
1. Edit files in `frontend-enroll/src/`
2. Vite HMR automatically updates browser
3. Check browser console for errors

### Testing

**Backend API:**
```bash
cd backend-enroll
node test-api.js
```

**Manual API testing:**
```bash
# Get instruments
curl http://localhost:3000/api/instruments

# Get students
curl http://localhost:3000/api/students

# Create enrollment
curl -X POST http://localhost:3000/api/enroll \
  -H "Content-Type: application/json" \
  -d @test-enrollment.json
```

---

## Useful Commands

### Database

```bash
# Connect to database
docker exec -it hsm-postgres psql -U hsm_admin -d hsm_dev

# List tables
\dt

# Describe table
\d students

# Run query
SELECT * FROM students LIMIT 5;

# Exit
\q

# Backup database
docker exec hsm-postgres pg_dump -U hsm_admin hsm_dev > backup.sql

# Restore database
docker exec -i hsm-postgres psql -U hsm_admin -d hsm_dev < backup.sql
```

### Docker

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View logs
docker logs hsm-postgres
docker logs hsm-postgres -f  # Follow logs

# Stop containers
docker compose stop

# Start containers
docker compose start

# Restart containers
docker compose restart

# Remove containers (keeps volumes)
docker compose down

# Remove containers and volumes (deletes data!)
docker compose down -v
```

### Git

```bash
# Check status
git status

# Stage changes
git add .

# Commit
git commit -m "Your message"

# Push to remote
git push

# Pull latest
git pull
```

---

## Next Steps

After setup is complete:

1. **Explore the Application**
   - Navigate through different pages
   - Try creating a student
   - Enroll a student in batches
   - Mark attendance
   - Record payments

2. **Customize Data**
   - Add real teachers in Teacher Management
   - Configure actual batches with schedules
   - Set up payment packages for your pricing

3. **Configure Production**
   - Set up production database
   - Configure environment variables
   - Deploy backend API
   - Deploy frontend application

4. **Set Up Monitoring**
   - Database query performance
   - API response times
   - Error tracking
   - User analytics

---

## Support & Documentation

- **Main README:** [README.md](README.md)
- **API Documentation:** [backend-enroll/API.md](backend-enroll/API.md)
- **Database Schema:** [db/SCHEMA_STATUS.md](db/SCHEMA_STATUS.md)
- **Implementation Summary:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Requirements:** [requirements.md](requirements.md)

For issues or questions, check the documentation files or create an issue in the repository.
