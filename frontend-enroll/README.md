# HSM Management Frontend (React + TypeScript)

Comprehensive web application for managing students, teachers, batches, attendance, and payments at Hyderabad School of Music.

## Tech Stack

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite (fast HMR, optimized builds)
- **Styling:** CSS Modules + responsive mobile-first design
- **State Management:** React hooks (useState, useEffect)
- **API Client:** Fetch API with error handling
- **Type Safety:** TypeScript interfaces for all data models

## Quick Start

```bash
cd frontend-enroll
npm install
npm run dev
```

Application runs on `http://localhost:5173`

## Application Structure

### Pages
- **AdminPage** (`/admin`) — Main dashboard with statistics and module navigation
- **StudentsPage** (`/students`) — Student management interface
- **EnrollPage** (`/enroll`) — Multi-step enrollment wizard

### Core Components

#### 👨‍🎓 StudentManagement.tsx
Comprehensive student management with:
- Search and filter (by name, email, instrument, batch)
- Card and table view modes
- Add/Edit/Delete operations
- Profile image upload
- Multi-batch enrollment
- Enrollment history tracking

#### 👨‍🏫 TeacherManagement.tsx
Teacher profile and payout management:
- Teacher directory with profiles
- Batch assignments per teacher
- Monthly payout calculations
- Attendance-based earnings
- Payment status tracking
- Add/Edit teacher operations

#### 📝 EnrollmentForm.tsx
Step-by-step enrollment wizard:
- Student information collection
- Multi-instrument selection
- Dynamic batch assignment
- Payment package selection
- Form validation
- Success confirmation

#### 💰 PaymentModule.tsx
Payment recording and tracking:
- Record new payments
- View payment history
- Filter by student/date range
- Calculate class additions
- Transaction management

#### 📊 AttendanceDashboard.tsx
Attendance marking interface:
- Date selection (current or backdated)
- Batch-centric workflow
- Student status toggles (Present/Absent/Makeup)
- Bulk actions (Mark All Present/Absent)
- Auto-deduction of classes
- Historical attendance viewing
- Mobile-responsive design

#### 📈 StatsOverview.tsx
Dashboard statistics:
- Total students enrolled
- Active batches count
- Revenue tracking
- Batch capacity utilization
- Recent activity feed

### Attendance Module Components

#### AttendanceTab.jsx
Main attendance marking interface with:
- Date picker for session selection
- Batch selector grid
- Student attendance list
- Bulk marking actions
- Success/error notifications

#### BatchSelector.jsx
Visual batch selection cards showing:
- Instrument name
- Teacher name
- Schedule (recurrence)
- Student count

#### AttendanceList.jsx
Student list with:
- Individual status toggles
- Present/Absent/Makeup options
- Real-time status updates

#### HistoricalAttendance.jsx
Past attendance records:
- Filter by batch/date range
- View-only mode for historical data
- Export capabilities (future)

## Features

### Implemented ✅
- **Responsive Design** — Mobile-first, works on all devices
- **Type Safety** — Full TypeScript coverage
- **Error Handling** — User-friendly error messages
- **Form Validation** — Client-side validation
- **Search & Filter** — Across all modules
- **Bulk Operations** — Attendance marking, batch assignments
- **Image Upload** — Student profile photos
- **Real-time Updates** — Automatic data refresh
- **Role-based UI** — Admin vs teacher views

### Planned 🔄
- **Offline Support** — Service worker for offline access
- **Dark Mode** — Theme toggle
- **Export/Import** — CSV/Excel support
- **Notifications** — Real-time alerts
- **Mobile App** — Native wrapper with Capacitor

## API Integration

Connects to backend API at `http://localhost:3000/api/*`

All components use fetch API with:
- Automatic JSON parsing
- Error boundary handling
- Loading states
- Success notifications

## Development

### Build for Production
```bash
npm run build
```

Outputs to `dist/` directory

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## Configuration

### API Base URL
Update in component files or create `.env` file:
```
VITE_API_BASE_URL=http://localhost:3000
```

### Vite Config
See `vite.config.js` for build and dev server settings

## Mobile Deployment

To package as native app:
```bash
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari 12+, Chrome Android

## TypeScript Types

All data models defined in `src/types.ts`:
- Student
- Teacher
- Batch
- Instrument
- Enrollment
- Payment
- Attendance

See file for complete interface definitions.
