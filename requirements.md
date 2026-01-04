# Hyderabad School of Music — Requirements (MVP)

> Status: Prioritizing Enrollment, Payments and AI-assisted Attendance (WhatsApp-based). This document captures functional and non-functional requirements, data model, workflows, and acceptance criteria for the initial MVP.

---

## 1. Summary ✨
Hyderabad School of Music (HSM) offers courses in Keyboard, Guitar, Piano, Drums, Tabla, Violin, Hindustani vocals, and Carnatic vocals. Most classes are offline at the school; online options exist for Guitar and Keyboard.

Priority for the MVP: 1) Enrollment, 2) Payments, 3) Attendance (AI-assisted via WhatsApp).

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
- Admin registers students (or bulk import CSV). Required fields: name, DOB, phone, guardian contact, selected instrument(s), preferred batch choices.
- A student may enroll in multiple instruments; each enrollment links to one or more batch assignments (two batches per instrument by default).
- System enforces batch capacity; offers waitlist if batch is full (optional).
- Enrollment creates an invoice or ties to an existing prepaid package.

Acceptance criteria:
- Admin can create a student with multiple instrument enrollments and assign them to batches.
- System prevents assignment when batch capacity would be exceeded.

### 3.2 Payments
- Support two package types for MVP:
  - **Monthly:** 8 classes per month
  - **Quarterly:** 24 classes (discounted per-class compared to monthly)
- Payment gateway integration (recommended: Razorpay or Stripe based on region).
- Payment record updates `classes_remaining` for student/enrollment upon successful payment.
- Generate receipts/invoices and store transactions for reconciliation.
- Track payments to teachers (payout ledger): the system supports both fixed-salary and per-class payout models. Current school setup: 2 teachers on fixed salary and 3 teachers on per-class basis.

Acceptance criteria:
- Can define packages per instrument with price and classes_count.
- On payment success, classes_remaining is set/updated and a receipt is generated.

### 3.3 Attendance (AI-assisted via WhatsApp)
- Teachers submit attendance via WhatsApp text to the school number (WhatsApp Business API / Twilio WhatsApp webhook).
- The system ingests the text message and generates a **draft attendance** (present list) using an AI/parsing pipeline.
- Drafts are sent back to the teacher for quick confirmation OR are visible in the admin dashboard for review.
- Absentees are **finalized at end-of-day** (e.g., 23:59 local time) if no cancel/holiday flag exists for the class.
- Holidays and teacher leaves are stored in a central calendar and **do not** decrement `classes_remaining` for that day.

Edge behavior & acceptance criteria:
- Misspellings / ambiguous names are flagged for confirmation.
- System finalizes absentees automatically at cutoff; finalized attendance decrements classes for presented students only.
- Admin can reopen or correct finalized attendance with an audit trail.

---

## 4. Data Model (Core Entities) 🧭
- Student { id, name, dob, phone, guardian_contact, metadata }
- Teacher { id, name, phone, roles }
- Instrument { id, name, max_batch_size, online_supported }
- Batch { id, instrument_id, teacher_id, recurrence (days/times), capacity, is_makeup }
- Enrollment { id, student_id, instrument_id, batch_ids[], status, classes_remaining }
- AttendanceRecord { id, date, batch_id, student_id, status (present/absent/excused), source, finalized_at }
- Payment { id, student_id, package_id, amount, method, transaction_id, timestamp }
- Package / FeeStructure { id, instrument_id, name, classes_count, price }
- Holiday / Leave { id, date, type (school/teacher-specific), notes }
- AuditLog { id, actor, action, payload, timestamp }

---

## 5. AI & Integration Design (Attendance) 🤖
- Ingest: WhatsApp Business Cloud API (webhook) or Twilio.
- Parsing pipeline:
  1. Preprocess teacher message (normalize punctuation, known tokens like "present:").
  2. Use regex + light NER parsing to extract name tokens.
  3. Fuzzy match tokens to enrolled students for the day's related batches (Levenshtein, token set ratio).
  4. Create draft attendance with confidence scores; ambiguous matches flagged.
- UX: send a quick interactive WhatsApp message with proposed `Present` list and options: Confirm / Edit / Reject (or use a small reply flow). Alternative web dashboard approval is available.
- Finalization: system waits until cutoff and finalizes absentees (unless holiday/leave flag set for that batch/day).
- Privacy & compliance: collect teacher consent for WhatsApp processing; minimize PII in LLM prompts; store logs for audits.

Notes:
- Optional enhancements: audio-to-text parsing, automated face matching for in-person classes (requires explicit consent), and automated feedback for student recordings.

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

## 8. MVP Roadmap (3 phases) 🗺️
- Phase 1 (MVP): Enrollment, Packages & Payments, WhatsApp ingestion + AI draft attendance, end-of-day finalization, holiday handling, basic reports.
- Phase 2: Teacher payouts automation, parent portal, improved attendance UIs and interactive WhatsApp confirmations, recurring invoices.
- Phase 3: Automated feedback on student recordings, analytics (churn prediction), advanced scheduling & marketplace features.

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
