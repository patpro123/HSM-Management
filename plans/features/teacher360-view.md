# Feature Plan: Teacher360 View

**Status:** Completed — Shipped
**Planned:** 2026-02-27
**Priority:** High

---

## Context

HSM currently tracks student attendance but has no equivalent visibility for teachers. Admins need to know whether teachers are actually conducting their scheduled batches, what they are owed (projected), and what has been paid month-over-month. Teachers logging in with their Google accounts also need a self-service "My Profile" view.

This feature adds a `Teacher360View` component modeled directly after `Student360View.tsx`, accessible both as a modal from the TeacherManagement admin panel and as a dedicated tab for logged-in teachers.

---

## User Requirements (Confirmed)

| Question | Decision |
|---|---|
| What is "teacher attendance"? | **Class-based** — did the teacher conduct their scheduled batch? Derived from `attendance_records JOIN batches`. |
| How to calculate projected payout? | **Auto-select by `payout_type`** — fixed → salary, per_class → sessions × rate, per_student_monthly → students × rate |
| Where is it accessible? | **(1)** Click teacher card → modal (admin) **(2)** "My Profile" tab for logged-in teachers |

---

## What We're Building

A three-tab 360-degree panel for each teacher:

| Tab | Contents |
|---|---|
| **Profile** | Name, phone, email, payout type & rate, active status, assigned batches list |
| **Attendance** | Summary cards (conducted / expected / rate%) + monthly breakdown table, color-coded by shortfall |
| **Payout** | Projected payout card (current month, auto-formula) + month-over-month actual payment history table |

---

## Files to Create

| File | Purpose |
|---|---|
| `backend-enroll/routes/teacher360.js` | `GET /api/teachers/:id/360` endpoint |
| `frontend-enroll/src/components/Teacher360View.tsx` | New 3-tab component |
| `db/migrations/012_teacher_attendance_view.sql` | DB view for session-count queries |

## Files to Modify

| File | Change |
|---|---|
| `backend-enroll/index.js` | Register new teacher360 route |
| `frontend-enroll/src/components/TeacherManagement.tsx` | Add "360 View" button to TeacherCard + modal wiring |
| `frontend-enroll/src/App.tsx` | Add `'teacher-profile'` tab for teacher-role users |
| `frontend-enroll/src/types.ts` | Add `Teacher360Data` TypeScript interface |

---

## Backend: `GET /api/teachers/:id/360`

**File:** `backend-enroll/routes/teacher360.js`

### Response Shape

```json
{
  "profile": {
    "id": "...",
    "name": "...",
    "phone": "...",
    "email": "...",
    "payout_type": "per_class",
    "rate": 500,
    "is_active": true,
    "batch_count": 3,
    "batches": [
      { "id": "...", "instrument_name": "Guitar", "recurrence": "TUE 17:00-18:00, THU 17:00-18:00", "capacity": 8 }
    ]
  },
  "attendance": {
    "summary": {
      "total_sessions_conducted": 42,
      "current_month_sessions": 7,
      "current_month_expected": 8
    },
    "monthly_breakdown": [
      { "month": "2026-02", "conducted": 7, "expected": 8 },
      { "month": "2026-01", "conducted": 16, "expected": 16 }
    ]
  },
  "payout": {
    "projected": {
      "amount": 3500,
      "basis": "7 sessions × ₹500",
      "model": "per_class"
    },
    "history": [
      { "id": "...", "period": "Jan 2026", "amount": 8000, "method": "bank", "linked_classes_count": 16, "created_at": "..." }
    ]
  }
}
```

### Key Query Logic

**Sessions conducted** (SQL):
```sql
SELECT
  date_trunc('month', ar.session_date)::date AS month,
  COUNT(DISTINCT ar.session_date::text || '-' || ar.batch_id::text) AS sessions_conducted
FROM attendance_records ar
JOIN batches b ON ar.batch_id = b.id
WHERE b.teacher_id = $1
GROUP BY date_trunc('month', ar.session_date)
ORDER BY month DESC
LIMIT 12;
```

**Expected sessions** — computed in Node.js by parsing `batches.recurrence` (e.g., `"TUE 17:00-18:00, THU 17:00-18:00"` = 2 days/week → 8–9 sessions/month).

**Payout projection** (Node.js):
```js
if (payout_type === 'fixed')               projected = { amount: rate, basis: 'Fixed salary', model: 'fixed' }
if (payout_type === 'per_class')           projected = { amount: sessions_this_month * rate, basis: `${sessions} sessions × ₹${rate}`, model: 'per_class' }
if (payout_type === 'per_student_monthly') projected = { amount: active_students * rate, basis: `${students} students × ₹${rate}`, model: 'per_student_monthly' }
```

### Register in `index.js`:
```js
app.use('/api/teachers', require('./routes/teacher360'));
```

---

## Database Migration

**File:** `db/migrations/012_teacher_attendance_view.sql`

```sql
-- Helper view: sessions conducted per teacher per month
CREATE OR REPLACE VIEW teacher_session_counts AS
SELECT
  b.teacher_id,
  date_trunc('month', ar.session_date)::date AS month,
  COUNT(DISTINCT ar.session_date::text || '-' || ar.batch_id::text) AS sessions_conducted
FROM attendance_records ar
JOIN batches b ON ar.batch_id = b.id
WHERE b.teacher_id IS NOT NULL
GROUP BY b.teacher_id, date_trunc('month', ar.session_date);
```

> No new application tables required. All data derived from existing `attendance_records`, `batches`, `teachers`, and `teacher_payouts`.

---

## Frontend: `Teacher360View.tsx`

**Props:**
```typescript
interface Teacher360ViewProps {
  teacherId: string;
  onClose?: () => void;
  isModal?: boolean;
}

type TabType = 'profile' | 'attendance' | 'payout';
```

### Profile Tab
- Info card: name, phone, email, payout type label, rate, active badge
- Assigned batches list (instrument, recurrence schedule, capacity)

### Attendance Tab
- 3 summary cards: **Sessions Conducted** | **Expected This Month** | **Attendance Rate %**
- Monthly breakdown table: Month | Expected | Conducted | Delta
- Row color coding: green ≥ expected, amber = 1 short, red = 2+ short

### Payout Tab
- Projected payout hero card (current month) with basis string
- Month-over-month history table: Period | Classes Taught | Amount Paid | Method | Date
- "Total Paid (All Time)" summary card at bottom

---

## TeacherManagement.tsx Changes

```tsx
// In TeacherCard action buttons (alongside Edit/Delete):
<button onClick={onView360} className="text-blue-600 hover:text-blue-800 font-medium text-sm">
  360 View
</button>
```

State in `TeacherManagement`:
```tsx
const [show360Modal, setShow360Modal] = useState(false);
const [selected360Teacher, setSelected360Teacher] = useState<Teacher | null>(null);

// Render:
{show360Modal && selected360Teacher && (
  <Teacher360View
    teacherId={selected360Teacher.id}
    isModal
    onClose={() => { setShow360Modal(false); setSelected360Teacher(null); }}
  />
)}
```

---

## App.tsx Changes

```typescript
// Tab type union — add:
| 'teacher-profile'

// Menu items — for teacher-only users:
...(isTeacher && !isAdmin ? [{ key: 'teacher-profile', label: 'My Profile' }] : [])

// Render section:
{activeTab === 'teacher-profile' && currentUser?.teacherId && (
  <Teacher360View teacherId={currentUser.teacherId} isModal={false} />
)}
```

> Requires `/api/auth/profile` to return `teacher_id` via a `teacher_users` table JOIN for teacher-role users.

---

## TypeScript Interface (`types.ts`)

```typescript
export interface Teacher360Data {
  profile: {
    id: string;
    name: string;
    phone: string;
    email: string;
    payout_type: 'fixed' | 'per_class' | 'per_student_monthly';
    rate: number;
    is_active: boolean;
    batch_count: number;
    batches: Array<{
      id: string;
      instrument_name: string;
      recurrence: string;
      capacity: number;
    }>;
  };
  attendance: {
    summary: {
      total_sessions_conducted: number;
      current_month_sessions: number;
      current_month_expected: number;
    };
    monthly_breakdown: Array<{
      month: string;
      conducted: number;
      expected: number;
    }>;
  };
  payout: {
    projected: {
      amount: number;
      basis: string;
      model: string;
    };
    history: Array<{
      id: string;
      period: string;
      amount: number;
      method: string;
      linked_classes_count: number;
      created_at: string;
    }>;
  };
}
```

---

## Implementation Order

1. **Backend route** — `backend-enroll/routes/teacher360.js` + register in `index.js`
2. **DB migration** — `db/migrations/012_teacher_attendance_view.sql`
3. **TypeScript types** — add `Teacher360Data` to `types.ts`
4. **Teacher360View component** — `frontend-enroll/src/components/Teacher360View.tsx` (all 3 tabs)
5. **Wire into TeacherManagement** — "360 View" button + modal state
6. **Wire into App.tsx** — `'teacher-profile'` tab for logged-in teachers

---

## Verification Checklist

- [ ] Admin opens Teachers tab → clicks "360 View" → modal opens with all three tabs
- [ ] Attendance tab: sessions conducted matches actual `attendance_records` for teacher's batches
- [ ] Payout tab: projected amount uses correct formula for each `payout_type`
- [ ] Payout tab: history table lists all `teacher_payouts` records for that teacher
- [ ] Teacher self-view: login as teacher-role user → "My Profile" tab visible → shows own data
- [ ] Edge case: teacher with no attendance records → shows zeros, no crash
- [ ] Edge case: teacher with no payout history → empty state message shown
- [ ] Modal close (×) works cleanly from admin view
- [ ] Both modal and full-page modes render correctly

---

## Notes & Decisions Log

- **No new DB tables** — teacher session data fully derivable from `attendance_records + batches`
- **Expected sessions** calculated in JS/Node (not SQL) because `recurrence` is a free-text field
- Pattern mirrors `Student360View.tsx` for consistency across the app
- `teacher_users` join needed in auth profile endpoint for teacher self-view to work
