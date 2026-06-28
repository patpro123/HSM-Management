# HSM Management System — Feature Inventory

**Hyderabad School of Music** | Full-stack school management platform  
Stack: Node.js/Express · React 19 + TypeScript · PostgreSQL (Neon) · Google OAuth + JWT

---

## How to Read This Document

Features are organized in two dimensions:
- **By Persona** — what each role can see and do
- **By Functional Area** — grouped by domain

Role abbreviations used in functional area tables: **A** = Admin · **T** = Teacher · **S** = Student · **P** = Parent

---

## 1. By Persona

### 1.1 Admin

Admins have unrestricted access to all modules. The admin interface is a tab-based SPA with role-gated navigation.

#### Student & Enrollment
- View all students across all instruments and batches
- Create new students with full enrollment in a single atomic transaction (student record + enrollment + batch assignments + first payment)
- Edit student profile details: name, DOB, phone, guardian contact, email, address
- Upload and manage student profile photos (stored in Google Drive)
- Soft-delete students (preserves attendance history, snapshots batch context)
- Restore soft-deleted students
- Convert landing page prospects and exit-intent inquiries into enrolled students
- Perform bulk operations on selected students (bulk homework assignment, batch reassignment)
- View each student's 360 profile: personal details, payment history, attendance summary, active batches, classes remaining, evaluations

#### Batch & Instrument Management
- Create batches: assign instrument, teacher, recurrence schedule (days + time slots), capacity
- Update and delete batches
- Mark batches as makeup batches (only deduct credits when student attends)
- Link WhatsApp group to a batch for notifications
- Move students between batches
- View student roster per batch with dynamic credit balance
- Manage instruments (CRUD)

#### Attendance
- View attendance records across all batches, teachers, and date ranges
- Mark student attendance (present / absent / excused) for any batch
- Mark extra sessions for students with corresponding credit deductions
- Remove extra sessions with automatic credit refunds
- Mark teacher attendance per session (conducted / not conducted)
- Filter attendance history by teacher, batch, or date

#### Payments
- View all payments across all students
- Record new payments: link to student, package, amount, payment method
- Update existing payment records
- View payment status per student: last payment date, amount, classes remaining per instrument, overdue flag
- Track projected next payment dates based on class consumption
- View overdue payment alerts

#### Finance
- Revenue reports broken down by instrument, teacher, and month
- Expense tracking: create, update, delete expense entries by category and date
- Monthly budget management: set revenue targets and expense limits per month
- Fee structure management: package pricing by instrument, payment frequency, and date range
- Grade-based rate configurations for teacher payout calculations
- Teacher payout parameter setup (fixed salary or per-student-monthly rate)
- Generate teacher payslips for selected periods
- Process and record teacher payouts with method tracking
- View today's batch schedule for financial planning

#### Teacher Management
- Create teacher profiles: name, phone, email, payout type (fixed / per_student_monthly), rate
- Edit and delete teacher profiles
- View teacher 360 profile: assigned batches, student roster, earnings, payouts
- View batch counts per teacher

#### Homework & Practice
- Assign homework to individual students: title, instructions, due date, total marks, marking breakdown
- Bulk assign homework to multiple students simultaneously
- Upload theory prompt sheets (PDF) per homework assignment
- Record audio instructions for homework tasks
- Review student submissions and grade homework
- Delete homework assignments
- Define habit targets linked to homework (number of practice logs required)

#### Habits & Practice Tracking (Admin/Teacher oversight)
- View students' active habits and 30-day practice logs
- Create habits for students: icon, display order, type, level tracking
- Bulk assign predefined practice items from the instrument/grade catalogue
- Bulk update and archive habits
- Listen to student voice note recordings from practice sessions

#### Parent-Teacher Meetings (PTM)
- Create PTM sessions with date, time, and location
- Schedule individual appointments within a session (teacher + student pairs)
- Bulk-create appointments for an entire batch
- Track action items and follow-ups from meetings
- Capture Minutes of Meeting (MOM) notes
- Send group notifications to guardians and teachers for upcoming sessions
- View PTM statistics: sessions held, participation rate
- Carry forward unresolved action items to next PTM session
- View PTM history per student and per teacher

#### Prospect & Lead Management
- View all prospects (inquiries from landing page form)
- View intentful users captured by exit-intent modal
- Convert intentful users to full prospects
- View and update prospect details and status
- Add and manage notes per prospect
- Send WhatsApp nudge notifications to prospects
- Receive email notifications when new inquiries arrive

#### User & Access Management
- View all registered users with their roles
- Pre-provision accounts for students, teachers, or admins before first login
- Activate provisioned accounts
- Assign roles to users: admin, teacher, parent, student
- Revoke roles from users
- Link user accounts to teacher profiles
- Link user accounts to student/guardian profiles
- Unlink users from profiles

#### Settings & Landing Page Configuration
- Edit the landing page flash banner (content, visibility toggle, type: demo-day / announcement)
- Set banner activation and expiry window
- View current banner configuration

#### AI Assistant (Cleff)
- Query any student's attendance, payment status, batch assignments, and credits via natural language
- Access school-wide stats through conversational interface
- Rate limit: higher daily message quota than other roles

#### Notifications
- Receive all system-level notifications (new enrollment, prospect signup, low credits, PTM reminders)
- View notification history and mark as read

#### Data Migration / Corrections
- Apply bulk credit adjustments for students
- Correct payment data discrepancies
- Run one-off data migration scripts via the admin UI

---

### 1.2 Teacher

Teachers see only their own batches and students. The tab navigation is filtered to teacher-relevant sections.

#### My Batches & Students
- View all batches assigned to them
- View student roster for each batch with classes remaining per student
- View student profile details (name, contact, instrument, batches)

#### Attendance
- Mark attendance for students in their own batches (present / absent / excused) for any date
- View attendance history for their batches
- Mark their own teacher attendance per session (conducted / not conducted)
- Cannot view or mark attendance for other teachers' batches

#### Homework & Practice
- Assign homework to students in their batches (same fields as admin)
- Record audio instructions for homework assignments
- Review and grade student homework submissions
- View student practice habit logs for their students
- Listen to student voice note practice recordings

#### PTM
- View scheduled PTM appointments for their sessions
- Add MOM notes and action items for their own appointments
- Receive PTM notifications

#### Teacher 360 (Self View)
- View personal teaching schedule and batch details
- View student roster across all assigned batches
- View own earnings: payout history, upcoming payout, pay period breakdown
- View own payslips

#### AI Assistant (Cleff)
- Query attendance records for own students
- Query student payment status for their cohort
- Rate limit: moderate daily quota

#### Notifications
- Receive notifications for their batches and students (low credits, attendance, PTM)

---

### 1.3 Student / Parent

Students access a read-only 360 view of their own data. Parents can see data for linked students.

#### Student 360 View
- View personal profile: name, DOB, phone, guardian contact, enrolled instruments
- View all active batches with schedule and teacher
- View classes remaining per instrument
- View payment history: dates, amounts, packages, methods
- View attendance record: date-level present/absent/excused history per batch
- View homework assignments: title, due date, marks breakdown, submission status
- View feedback and grades on submitted homework

#### Practice & Habits
- View assigned practice habits with daily tracking history
- Log daily practice sessions
- Record voice notes for practice sessions
- Answer teacher-assigned theory questions (auto-grading hints provided)
- View current streak and longest streak per habit
- View XP points and gamification progress

#### Homework Submission
- View assigned homework with instructions, due date, and marks structure
- Submit homework (text responses, uploaded work)
- View graded feedback from teacher

#### PTM
- Parents receive PTM appointment notifications
- Parents attend PTM sessions (appointments booked by admin/teacher)

#### AI Assistant (Cleff)
- Query own attendance balance, classes remaining, next payment due
- Student context limited to own data only
- Rate limit: limited daily quota

#### Notifications
- Receive personal notifications: low credits, payment reminders, PTM appointments, homework assigned

---

## 2. By Functional Area

---

### 2.1 Student Management

| Feature | A | T | S | P |
|---|---|---|---|---|
| View student list (all students) | ✓ | — | — | — |
| View own students (teacher's batches) | — | ✓ | — | — |
| View own/child profile | — | — | ✓ | ✓ |
| Create student with full enrollment | ✓ | — | — | — |
| Edit student profile details | ✓ | — | — | — |
| Upload student profile photo | ✓ | — | — | — |
| Soft-delete and restore students | ✓ | — | — | — |
| View student 360 (full detail) | ✓ | partial | ✓ (self) | ✓ (child) |
| Bulk operations on students | ✓ | — | — | — |
| Convert prospects to students | ✓ | — | — | — |

**Detail:**
- Student records carry: name, DOB, phone, guardian contact, email, address, profile image
- Metadata stored as JSONB for flexibility (email, address, image URL)
- Soft-delete preserves attendance and payment history, snapshots the batch context at deletion time
- One enrollment record per student; multiple instruments handled via `enrollment_batches` join table

---

### 2.2 Enrollment

| Feature | A | T | S | P |
|---|---|---|---|---|
| Atomic enrollment (student + batch + payment) | ✓ | — | — | — |
| View all enrollments with batch details | ✓ | — | — | — |
| View own enrollment / child enrollment | — | — | ✓ | ✓ |
| Multi-instrument enrollment | ✓ | — | — | — |
| AI-assisted enrollment (conversational) | ✓ | — | — | — |
| Landing page self-inquiry form | public | public | public | public |

**Detail:**
- Enrollment creation is transactional: student record → enrollment → one or more enrollment_batch entries → initial payment record, all in a single DB transaction
- `classes_remaining` is tracked separately per `enrollment_batch` (per instrument), not at the enrollment level
- Payment frequency can be monthly (8 classes) or quarterly (24 classes)
- AI agent enrollment route enables conversational form filling via LLM

---

### 2.3 Attendance

| Feature | A | T | S | P |
|---|---|---|---|---|
| View attendance (all batches) | ✓ | — | — | — |
| View attendance (own batches only) | — | ✓ | — | — |
| View own/child attendance | — | — | ✓ | ✓ |
| Mark student attendance | ✓ | ✓ (own) | — | — |
| Mark teacher attendance (conducted) | ✓ | ✓ (self) | — | — |
| Extra session marking (credit deduction) | ✓ | ✓ (own) | — | — |
| Remove extra session (credit refund) | ✓ | ✓ (own) | — | — |
| WhatsApp notification on mark | auto | auto | — | notified |
| Filter by date / batch / teacher | ✓ | ✓ | ✓ | ✓ |

**Detail:**
- Marking a student present decrements `classes_remaining` on `enrollment_batches` by 1
- Reversing a present mark (to absent) refunds the credit (+1)
- Makeup batches (`is_makeup = true`) only deduct credits when the student actually attends
- Teacher attendance is separate: per-session `conducted / not_conducted` flag for payout calculations
- WhatsApp notification sent to guardian on attendance marking and when credits fall below threshold

---

### 2.4 Payments

| Feature | A | T | S | P |
|---|---|---|---|---|
| View all payment records | ✓ | — | — | — |
| View own payment history | — | — | ✓ | ✓ |
| Record a new payment | ✓ | — | — | — |
| Update payment record | ✓ | — | — | — |
| View classes remaining per instrument | ✓ | ✓ (own) | ✓ | ✓ |
| Payment status: last payment, overdue flag | ✓ | — | ✓ | ✓ |
| Projected next payment date | ✓ | — | ✓ | ✓ |
| Overdue payment alerts | ✓ | — | — | — |

**Detail:**
- `classes_remaining` displayed is dynamically calculated: credits_bought minus actual present-attendance count (not purely from the counter, guarded against drift)
- Payment status per student shows: last payment date, amount, payment method, per-instrument breakdown, days since last payment, projected renewal date
- Overdue detection based on expected payment interval vs. date of last payment
- Supported payment methods: cash, bank transfer, UPI (recorded via metadata)

---

### 2.5 Finance

| Feature | A | T | S | P |
|---|---|---|---|---|
| Revenue reports (by instrument / teacher / month) | ✓ | — | — | — |
| Expense tracking (CRUD) | ✓ | — | — | — |
| Monthly budget management | ✓ | — | — | — |
| Fee structure management | ✓ | — | — | — |
| Teacher payout parameter config | ✓ | — | — | — |
| Generate and process teacher payslips | ✓ | — | — | — |
| View own payslips / payout history | — | ✓ | — | — |
| Grade-based rate overrides | ✓ | — | — | — |
| Today's batch schedule | ✓ | — | — | — |

**Detail:**
- Two payout models: fixed monthly salary or per-student-monthly (rate × active students in their batches)
- Grade-based rates allow different per-student rates for beginner / intermediate / advanced students
- Fee structures are versioned by date range and branch, allowing historical pricing queries
- Monthly budgets track: revenue target, expense limit, actuals, and variance
- Expenses categorised (rent, utilities, marketing, etc.)

---

### 2.6 Teacher Management

| Feature | A | T | S | P |
|---|---|---|---|---|
| View all teachers with batch counts | ✓ | — | — | — |
| View own teacher profile | — | ✓ | — | — |
| Create teacher profile | ✓ | — | — | — |
| Edit teacher profile | ✓ | — | — | — |
| Delete teacher profile | ✓ | — | — | — |
| View teacher 360 (batches, students, earnings) | ✓ | ✓ (self) | — | — |
| Set payout type and rate | ✓ | — | — | — |

**Detail:**
- Teacher profiles store: name, phone, email, payout type, rate, metadata JSONB
- Teacher 360 aggregates: all batches, enrolled student counts per batch, current period payout estimate, historical payouts
- Admin can impersonate the teacher 360 view to see exactly what a teacher sees

---

### 2.7 Batch & Schedule Management

| Feature | A | T | S | P |
|---|---|---|---|---|
| View all batches | ✓ | — | — | — |
| View own batches | — | ✓ | — | — |
| View enrolled batches | — | — | ✓ | ✓ |
| Create / edit / delete batches | ✓ | — | — | — |
| Assign teacher to batch | ✓ | — | — | — |
| Set capacity and recurrence | ✓ | — | — | — |
| Mark batch as makeup batch | ✓ | — | — | — |
| Move students between batches | ✓ | — | — | — |
| Link WhatsApp group to batch | ✓ | — | — | — |

**Detail:**
- Recurrence is stored as a text string (e.g., `"TUE 17:00-18:00, THU 17:00-18:00"`) and parsed in JS
- Capacity management: batches have a max headcount
- Makeup batches exist for rescheduled lessons; credit deduction only applies when student attends

---

### 2.8 Homework & Assignments

| Feature | A | T | S | P |
|---|---|---|---|---|
| Assign homework to individual student | ✓ | ✓ | — | — |
| Bulk assign homework to multiple students | ✓ | ✓ | — | — |
| Upload theory prompt sheet (PDF) | ✓ | ✓ | — | — |
| Record audio instructions | ✓ | ✓ | — | — |
| Play back audio instructions | ✓ | ✓ | ✓ | ✓ |
| View assigned homework | ✓ | ✓ | ✓ | ✓ |
| Submit homework | — | — | ✓ | — |
| Grade homework and add feedback | ✓ | ✓ | — | — |
| Delete homework | ✓ | ✓ | — | — |
| Habit target on homework | ✓ | ✓ | — | — |

**Detail:**
- Homework fields: title, instructions text, due date, total marks, per-criterion marking breakdown
- Audio instructions stored as files, streamed on playback
- Theory prompt sheet: PDF uploaded per assignment, accessible to student
- Habit target: specifies how many practice logs the student must complete as part of the homework

---

### 2.9 Habits & Practice Tracking

| Feature | A | T | S | P |
|---|---|---|---|---|
| View student habits and 30-day log | ✓ | ✓ (own) | ✓ (self) | ✓ (child) |
| Create habits for student | ✓ | ✓ | — | — |
| Bulk assign habits from catalogue | ✓ | ✓ | — | — |
| Update / archive habits | ✓ | ✓ | — | — |
| Log daily practice | — | — | ✓ | — |
| Record voice note for session | — | — | ✓ | — |
| Play back student voice note | ✓ | ✓ | ✓ | — |
| Answer theory question | — | — | ✓ | — |
| Auto-grading hints on theory | auto | — | ✓ | — |
| View streak (current / longest) | ✓ | ✓ | ✓ | ✓ |
| View XP gamification progress | — | — | ✓ | ✓ |

**Detail:**
- Habits have: icon, display order, type (music practice / theory / other), level
- Predefined practice item catalogue organised by instrument and student grade
- Streaks computed from consecutive days of habit logs
- XP awarded for logging practice, completing homework, streaks
- Voice notes stored as audio files and streamed on playback

---

### 2.10 Parent-Teacher Meetings (PTM)

| Feature | A | T | S | P |
|---|---|---|---|---|
| Create PTM sessions | ✓ | — | — | — |
| Schedule appointments | ✓ | — | — | — |
| Bulk create appointments for a batch | ✓ | — | — | — |
| Add MOM notes and action items | ✓ | ✓ | — | — |
| Track and carry forward action items | ✓ | — | — | — |
| Send group notifications for PTM | ✓ | — | — | — |
| View PTM history (student / teacher) | ✓ | ✓ | — | — |
| View PTM stats | ✓ | — | — | — |
| Receive PTM notifications | ✓ | ✓ | — | ✓ |

**Detail:**
- Sessions have: date, time, venue
- Appointments link a teacher + student pair within a session
- Action items support carry-forward to the next PTM session
- MOM is free-text per appointment
- Group notifications sent via in-app notifications to all relevant guardians for a batch's PTM

---

### 2.11 Prospect & Lead Management

| Feature | A | T | S | P |
|---|---|---|---|---|
| View prospect list from landing page | ✓ | — | — | — |
| View intentful users (exit intent) | ✓ | — | — | — |
| Convert intentful user to prospect | ✓ | — | — | — |
| View / edit prospect details | ✓ | — | — | — |
| Add prospect notes | ✓ | — | — | — |
| Send WhatsApp nudge to prospect | ✓ | — | — | — |
| Email notification on new inquiry | auto | — | — | — |
| Convert prospect to enrolled student | ✓ | — | — | — |

**Detail:**
- Prospects captured from the public landing page enrollment form
- Intentful users captured via exit-intent modal on the landing page (separate funnel)
- Notes are timestamped per prospect for CRM-style tracking
- WhatsApp nudge sends a template message to the prospect's phone number
- Admin receives email when a new form submission arrives

---

### 2.12 User & Access Management

| Feature | A | T | S | P |
|---|---|---|---|---|
| View all users and roles | ✓ | — | — | — |
| Pre-provision user accounts | ✓ | — | — | — |
| Activate provisioned accounts | ✓ | — | — | — |
| Assign / revoke roles | ✓ | — | — | — |
| Link user to teacher profile | ✓ | — | — | — |
| Link user to student / guardian profile | ✓ | — | — | — |

**Detail:**
- New users who sign in via Google OAuth get `parent` role by default
- Admin must explicitly assign `teacher`, `student`, or `admin` roles
- Provisioning allows admin to pre-create accounts before the user logs in
- Accounts can be deactivated without deletion

---

### 2.13 WhatsApp Integration

| Feature | A | T | S | P |
|---|---|---|---|---|
| Receive inbound WhatsApp messages | ✓ | — | — | — |
| View WhatsApp contact list | ✓ | — | — | — |
| View message history per contact | ✓ | — | — | — |
| Auto-notify on attendance marked | auto | — | — | receives |
| Auto-notify on low credits | auto | — | — | receives |
| Batch WhatsApp group linking | ✓ | — | — | — |
| Send nudges to prospects | ✓ | — | — | — |

**Detail:**
- WhatsApp Business API integration via webhook
- Inbound messages captured and stored per contact
- Outbound notifications triggered by attendance marking and credit threshold events
- Batch-level WhatsApp group linking for group notifications

---

### 2.14 AI Assistant (Cleff)

| Feature | A | T | S | P |
|---|---|---|---|---|
| Conversational queries about school data | ✓ | ✓ | ✓ | ✓ |
| Role-scoped data access | ✓ | scoped | scoped | scoped |
| Tool use (DB lookups mid-chat) | ✓ | ✓ | ✓ | ✓ |
| Session persistence (7-day TTL) | ✓ | ✓ | ✓ | ✓ |
| Daily rate limit | high | medium | low | low |
| Public inquiry chat (unauthenticated) | — | — | — | public |

**Detail:**
- Powered by Groq / Claude backend
- Tool-use system allows LLM to query live DB data mid-conversation
- Context is role-scoped: teachers only see their student data, students only see their own
- Public chat endpoint for unauthenticated prospective parent inquiries on the landing page

---

### 2.15 Notifications

| Feature | A | T | S | P |
|---|---|---|---|---|
| Real-time push via SSE | ✓ | ✓ | ✓ | ✓ |
| Global system notifications | ✓ | — | — | — |
| User-specific notifications | ✓ | ✓ | ✓ | ✓ |
| Unread count badge | ✓ | ✓ | ✓ | ✓ |
| Mark notifications as read | ✓ | ✓ | ✓ | ✓ |
| Heartbeat keep-alive (SSE) | auto | auto | auto | auto |

**Detail:**
- Server-Sent Events maintain a persistent connection for real-time delivery
- Notification types: new enrollment, low credits, PTM reminder, homework assigned, system events
- Unread count polled as fallback when SSE connection drops

---

### 2.16 Landing Page (Public)

| Feature | Audience |
|---|---|
| Student inquiry / enrollment form | Prospective students / parents |
| Instrument selection | Public |
| Class frequency and batch preference | Public |
| Payment frequency selection (monthly / quarterly) | Public |
| Demo day spot booking toggle | Public |
| Terms of service acceptance | Public |
| Exit intent modal capture | Public |
| Flash banner (demo day promo / announcements) | Public |
| AI chat widget for inquiries (unauthenticated) | Public |

**Detail:**
- Form submissions create prospect records in the database
- Exit-intent modal fires when the user moves to leave the page; captures intentful users in a separate table
- Flash banner is admin-configurable: content, type (demo-day / announcement), visibility toggle, date window
- Landing page is decoupled from the main app (separate public URL)

---

### 2.17 Documents & File Management

| Feature | A | T | S | P |
|---|---|---|---|---|
| Upload student documents | ✓ | ✓ | — | — |
| Retrieve student documents | ✓ | ✓ | ✓ | ✓ |
| Delete student documents | ✓ | — | — | — |
| Upload theory prompt sheets (PDF) | ✓ | ✓ | — | — |
| Upload student profile images | ✓ | — | — | — |
| Voice note upload and streaming | ✓ | ✓ | ✓ | — |

**Detail:**
- Files stored in a `file_storage` table and synced to Google Drive
- Documents are linked to student records
- Theory sheets are linked to homework assignments
- Voice notes are linked to habit logs and homework instructions
- Streaming endpoint for audio files ensures low-latency playback

---

## 3. Feature Count Summary

| Functional Area | Admin Features | Teacher Features | Student/Parent Features |
|---|---|---|---|
| Student Management | 10 | 2 | 2 |
| Enrollment | 5 | 0 | 2 |
| Attendance | 8 | 5 | 2 |
| Payments | 8 | 0 | 4 |
| Finance | 9 | 2 | 0 |
| Teacher Management | 7 | 2 | 0 |
| Batch & Schedule | 9 | 1 | 1 |
| Homework | 9 | 8 | 4 |
| Habits & Practice | 8 | 5 | 7 |
| PTM | 9 | 3 | 2 |
| Prospect / Lead Mgmt | 8 | 0 | 0 |
| User & Access | 6 | 0 | 0 |
| WhatsApp | 7 | 0 | 1 |
| AI Assistant | 4 | 3 | 3 |
| Notifications | 5 | 4 | 4 |
| Landing Page | admin-config | — | public |
| Documents & Files | 6 | 4 | 2 |

---

*Generated: 2026-06-20. Based on codebase at commit `79d5abc`.*
