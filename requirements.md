# Hyderabad School of Music — Requirements (Core App)

> Status: Prioritizing Enrollment, Payments, and Core Attendance (Dashboard). AI/WhatsApp features are paused. This document captures functional and non-functional requirements for the Core App.

---

## 1. Summary ✨
Hyderabad School of Music (HSM) offers courses in Keyboard, Guitar, Piano, Drums, Tabla, Violin, Hindustani vocals, and Carnatic vocals. Most classes are offline at the school; online options exist for Guitar and Keyboard.

Priority for the Core App: 1) Enrollment, 2) Payments, 3) Attendance (Dashboard-based), 4) Teacher Payouts.

---

## 2. Business rules & Schedule 📋
- School closed on Mondays.
- School timings:
  - Weekdays (Tue–Fri): 17:00–21:00
  - Saturday: 15:00–21:00
  - Sunday: 10:00–13:00 and 17:00–21:00
- Each student can enroll in one or more instruments/vocal streams.
- Classes typically run twice weekly for each instrument (two batches per student).
- Batches are recurring weekly slots; makeup/adhoc batches allowed (admin-only creation).
- Each instrument has a maximum batch size (configurable per instrument).

---

## 3. Core Functional Requirements ✅

### 3.1 Enrollment
- Admin registers students via an interactive web form with validation. Required fields: name (first/last), email, DOB, mailing address, guardian name, phone (WhatsApp-enabled), date of joining.
- **Instrument Selection:** Dynamically fetched from the database via `/api/instruments`. Displays instrument names with online availability indicator.
- **Batch Selection:** For each selected instrument, batches are dynamically fetched from `/api/batches/:instrumentId` and displayed with teacher name and recurrence details.
- **Payment Plan:** For each instrument, user selects payment frequency (Monthly or Quarterly).
- **Data Model:** One enrollment record per student with multiple batch assignments. Each batch assignment includes `instrument_id`, `batch_id`, and `payment_frequency`.
- System uses UUID references for instruments and batches throughout the enrollment flow (frontend and backend).
- Enrollment payload is submitted to `/api/enroll` with all student details and an array of batch assignments.
- System enforces batch capacity; offers waitlist if batch is full (optional - future enhancement).

Acceptance criteria:
- Enrollment form dynamically loads instruments and batches from the database.
- Frontend uses instrument/batch UUIDs for all API communication.
- Single enrollment record created per student with multiple batch assignments.
- System validates all required fields and prevents submission with incomplete data.
- Backend creates student, enrollment, and batch assignment records atomically.

### 3.2 Payments
- Support two package types for MVP:
  - **Monthly:** 8 classes per month
  - **Quarterly:** 24 classes (discounted per-class compared to monthly)
- Payment gateway integration (recommended: Razorpay or Stripe based on region).
- Payment record updates `classes_remaining` for the specific **Batch Assignment** (Instrument) upon successful payment.
- Generate receipts/invoices and store transactions for reconciliation.
- Track payments to teachers (payout ledger): the system supports both fixed-salary and per-class payout models. Current school setup: 2 teachers on fixed salary and 3 teachers on per-class basis.

Acceptance criteria:
- Can define packages per instrument with price and classes_count.
- On payment success, `classes_remaining` for the specific instrument/batch is updated.

### 3.3 Attendance Capture (Hybrid: Dashboard + WhatsApp)

**Primary Flow (Dashboard/Mobile UI):**
- **Batch-Centric Interface:** Teachers/admin open today's scheduled batches, select a batch, and see list of enrolled students.
- **Mobile-First Design:** Large tap targets, swipe gestures optional, optimized for phone screens.
- **Quick Actions:** "Mark All Present" button for efficiency; toggle individual students to Absent/Excused.
- **Default State:** All students default to Present; teacher marks exceptions (absences/excused).
- **Submission:** Teacher submits attendance after class ends. System timestamps and locks the record.
- **Role-Based Access:**
  - Teachers: Mark attendance only for current day and their assigned batches.
  - Admin: Mark/edit attendance for any past or current day, any batch (with audit trail).

**Secondary Flow (WhatsApp AI-Assisted) — [PAUSED]:**
- Feature deferred. Focus is currently on the Dashboard UI.

**Makeup Classes:**
- **Scenario:** Occurs when the school is closed or the teacher is not present (class cancelled).
- **Student Logic:** The cancelled class does not decrement `classes_remaining`. The credit is preserved for the makeup class.
- **Teacher Logic:** Teachers are **not** paid for the cancelled/missed session. They are paid only for the makeup class (replacement).
- **Execution:** Admin schedules a batch with `is_makeup=true`. When the student attends this makeup class (marked Present), `classes_remaining` is decremented.

**Attendance Finalization:**
- Attendance records finalized at end-of-day (23:59 local time) or on teacher submission.
- Finalized attendance decrements `classes_remaining` for Present students.
- Holidays/teacher leaves stored in central calendar; classes on these days do not decrement `classes_remaining`.

**Future Enhancement (Low Priority):**
- Offline support: Allow teachers to mark attendance offline and sync when connection restored.

Acceptance criteria:
- Mobile-responsive batch attendance UI with "Mark All Present" and individual toggle options.
- Teachers can mark attendance for current day; admin can mark/edit any day with audit log.
- Makeup classes tracked separately; `classes_remaining` logic correctly handles cancelled vs makeup attendance.
- System prevents duplicate attendance for same student/batch/date.
- Finalized attendance cannot be edited by teachers; admin can reopen with audit trail.

### 3.4 Student 360 View & Evaluations

**Student 360 View:**
- A comprehensive dashboard view accessible to Admins, Teachers, and Parents/Students.
- **Key Metrics:**
  - Total classes attended (Attendance history).
  - Classes remaining (Current balance).
  - Current Payment Plan (Monthly/Quarterly).
  - Next scheduled class.
- **Evaluations & Reports:**
  - Teachers provide monthly feedback/progress reports.
  - Track major milestones (e.g., Trinity certifications).
  - Upload capability for external report files (PDF/Images).
  - "Upcoming Evaluation" indicator.

Acceptance criteria:
- Clicking a student card opens the 360 view.
- Teachers can add/edit evaluations.
- Parents see read-only view of evaluations and stats.

---

## 4. Data Model (Core Entities) 🧭
- Student { id (UUID), first_name, last_name, email, dob, address, guardian_name, telephone, date_of_joining, created_at, updated_at }
- Teacher { id (UUID), name, phone, email, payout_type (fixed/per_class), rate, created_at }
- Instrument { id (UUID), name, online_supported, max_batch_size, created_at }
- Batch { id (UUID), instrument_id (FK), teacher_id (FK), recurrence (e.g., "Monday 5-6 PM"), day_of_week, start_time, end_time, capacity, is_makeup, created_at }
- Enrollment { id (UUID), student_id (FK), status (active/inactive/waitlist), date_of_enrollment, created_at, updated_at }
- BatchAssignment { id (UUID), enrollment_id (FK), batch_id (FK), payment_frequency (monthly/quarterly), classes_remaining, created_at }
- AttendanceRecord { id (UUID), date, batch_id (FK), student_id (FK), status (present/absent/excused), source (whatsapp/admin), finalized_at, created_at }
- Payment { id (UUID), student_id (FK), batch_assignment_id (FK), amount, classes_count, method, transaction_id, timestamp }
- Package / FeeStructure { id (UUID), instrument_id (FK), name, frequency (monthly/quarterly), classes_count, price, created_at }
- Holiday / Leave { id (UUID), date, type (school/teacher-specific), teacher_id (FK nullable), notes, created_at }
- AuditLog { id (UUID), actor, action, entity_type, entity_id, payload (JSONB), timestamp }

**Key Changes from Initial Design:**
- UUIDs used for all primary keys for better distribution and security.
- Enrollment refactored: one enrollment per student, with separate BatchAssignment table for multiple instrument/batch enrollments.
- BatchAssignment tracks payment_frequency and classes_remaining per batch (not per enrollment).
- Student model expanded with first_name, last_name, email, address fields.
- Batch model includes structured time fields (day_of_week, start_time, end_time) in addition to recurrence string.

---

## 5. AI & Integration Design (Attendance) — [PAUSED] 🤖
- This module is deferred to a future phase.
- Focus is on manual attendance entry via the Web Dashboard.

---

## 6. Non-functional requirements (NFRs) ⚙️
- Availability: 99.5% for core services (enrollment, payment processing, attendance ingestion), with maintenance windows scheduled outside class hours.
- Data retention: attendance and payment records retained per local regulations; sensitive fields encrypted at rest.
- Security: role-based access control (Admin, Accountant, Teacher, Parent), CSRF & XSS protections, secure webhooks for WhatsApp and payment gateways.
- Performance: attendance parsing should respond to inbound WhatsApp messages in < 10 seconds for draft generation.

---

## 7. Reporting & KPIs 📊
- Classes remaining per student (real-time)
- Attendance per batch / per student (daily, monthly)
- Revenue by instrument and month
- Teacher payouts / classes taught

---

## 8. Roadmap 🗺️
- Phase 1 (Core): Enrollment, Packages & Payments, Dashboard Attendance, Teacher Payouts, Holiday handling.
- Phase 2 (Growth): Parent portal, Recurring invoices, WhatsApp AI Attendance.
- Phase 3 (Advanced): Automated feedback on student recordings, analytics (churn prediction).

---

## 9. Open Questions / Assumptions ❓
- Payment packaging: **Resolved** — Monthly (8 classes) and Quarterly (24 classes) packages will be supported in the MVP.
- Teacher compensation model: **Captured** — current mix: 2 fixed-salary teachers, 3 per-class teachers. System supports both.
- WhatsApp phone: **Resolved** — the school already has a WhatsApp Business number; the platform will use this number for ingestion and notifications.
- Parent/guardian accounts: **Deferred** — parent logins and portal are planned for Phase 2; MVP will include admin and teacher roles only.
- Scale estimate: **Answered** — expect ~100–200 active students and up to 10 teachers for the first year. This will guide capacity planning and hosting.
- Consent and privacy: collect consent from parents for storing PII and AI processing of attendance messages.

---

## 10. Next steps 🔜
- Confirm the open questions above.
- Choose the next deliverable: ER diagram or API contract for the MVP.
- After confirmation, design the database schema and endpoints for Enrollment → Payment → Attendance.

---

*Document created from discussions on 03-Jan-2026.*
