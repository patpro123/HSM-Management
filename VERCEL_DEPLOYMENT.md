# Vercel Deployment Guide

## Issue Resolved ✅

The frontend was calling APIs at `hsm-management.vercel.app/api/...` instead of your Render backend because:

1. **Hardcoded URLs**: Components had `http://localhost:3000/api/...` hardcoded
2. **Relative URLs**: Some used `/api/...` which defaults to same domain
3. **No Environment Variable Usage**: `VITE_API_BASE_URL` wasn't being read

## Changes Made

1. ✅ Created `src/config.ts` - Centralized API configuration
2. ✅ Updated ALL components to use `API_BASE_URL` from config
3. ✅ Modified `db.js` to support `DATABASE_URL` environment variable

## Deploy to Vercel

### Step 1: Set Environment Variable in Vercel

```bash
# Option A: Via Vercel CLI
vercel env add VITE_API_BASE_URL

# Enter your Render backend URL when prompted:
# https://your-app-name.onrender.com

# Option B: Via Vercel Dashboard
# 1. Go to your project settings
# 2. Navigate to "Environment Variables"
# 3. Add:
#    Name: VITE_API_BASE_URL
#    Value: https://your-app-name.onrender.com
#    Environments: Production, Preview, Development (check all)
```

### Step 2: Redeploy

```bash
# From frontend directory
cd frontend-enroll

# Deploy
vercel --prod

# Or trigger redeploy via dashboard
```

### Step 3: Verify

After deployment:
1. Open browser console on your Vercel URL
2. You should see: `API_BASE_URL configured as: https://your-app-name.onrender.com`
3. Check Network tab - all API calls should go to Render backend

## Local Development

```bash
# Create .env file (optional, defaults to localhost:3000)
cd frontend-enroll
cp .env.example .env

# Edit .env if needed
VITE_API_BASE_URL=http://localhost:3000

# Start dev server
npm run dev
```

## Troubleshooting

### Issue: Still seeing localhost URLs after deploy

**Solution:** Clear Vercel build cache
```bash
vercel --prod --force
```

### Issue: CORS errors

**Solution:** Update backend CORS settings in `backend-enroll/index.js`:
```javascript
const cors = require('cors')
app.use(cors({
  origin: ['https://your-app.vercel.app', 'http://localhost:5173'],
  credentials: true
}))
```

### Issue: Environment variable not working

**Check:**
1. Variable name starts with `VITE_` (required for Vite)
2. Set for all environments (Production, Preview, Development)
3. Redeploy after adding variable

### Issue: 404 on API calls

**Check:**
1. Backend URL doesn't have trailing slash
2. Backend is deployed and running
3. Backend health check: `curl https://your-backend.onrender.com/api/instruments`

## Backend Deployment (Render)

### Quick Deploy

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Configure:
   - **Build Command:** `cd backend-enroll && npm install`
   - **Start Command:** `cd backend-enroll && node index.js`
   - **Environment Variables:**
     - `DATABASE_URL` = Your Neon connection string
     - `NODE_ENV` = `production`
     - `PORT` = `10000` (Render default)

### Environment Variables for Render

```bash
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname?sslmode=require
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://your-app.vercel.app
```

## Complete URLs

After deployment, your URLs will be:

- **Frontend (Vercel):** `https://hsm-management.vercel.app`
- **Backend (Render):** `https://your-app-name.onrender.com`
- **Database (Neon):** Connection string from Neon dashboard

## Test Deployment

```bash
# Test backend directly
curl https://your-backend.onrender.com/api/instruments

# Should return JSON with instruments

# Test frontend
# Open https://your-app.vercel.app
# Check browser console for "API_BASE_URL configured as: ..."
# Test student management or enrollment
```

## Next Steps

1. ✅ Set `VITE_API_BASE_URL` in Vercel
2. ✅ Redeploy frontend: `vercel --prod`
3. ✅ Test API calls in browser Network tab
4. ✅ Update CORS in backend if needed
5. ✅ Consider custom domain for both services

## Files Updated

- `src/config.ts` - New centralized config
- `src/pages/AdminPage.jsx` - Updated
- `src/pages/StudentsPage.jsx` - Updated
- `src/components/StudentManagement.tsx` - Updated
- `src/components/TeacherManagement.tsx` - Updated
- `src/components/EnrollmentForm.tsx` - Updated
- `src/components/PaymentModule.tsx` - Updated
- `src/components/AttendanceDashboard.tsx` - Updated
- `src/components/Attendance/AttendanceTab.jsx` - Updated
- `src/components/Attendance/HistoricalAttendance.jsx` - Updated
- `src/components/QuestionFlow.jsx` - Updated
- `backend-enroll/db.js` - Updated to support DATABASE_URL
- `.env.example` - Created for reference
