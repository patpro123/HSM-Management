# WhatsApp Chatbot Integration - Design Document
## Hyderabad School of Music Management System

**Version:** 1.0  
**Date:** January 18, 2026  
**Status:** Design Phase

---

## 1. Executive Summary

This document outlines the design and implementation approach for integrating a WhatsApp chatbot into the Hyderabad School of Music (HSM) Management System. The chatbot will serve as a conversational interface for teachers, students, and administrators to interact with the system for attendance tracking, enrollment queries, payment reminders, and general information.

### Key Objectives
- **Primary:** Enable AI-assisted attendance capture via WhatsApp for teachers
- **Secondary:** Provide self-service enrollment inquiries and payment status for students/parents
- **Tertiary:** Automate notifications and reminders for classes, payments, and events

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────┐
│  WhatsApp User  │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────┐
│   WhatsApp Business API / Cloud API │
│   (Meta/Twilio/360Dialog)           │
└────────────┬────────────────────────┘
             │ Webhook (HTTPS)
             ↓
┌─────────────────────────────────────┐
│   WhatsApp Bot Service              │
│   - Message Router                  │
│   - Session Manager                 │
│   - NLP/AI Processing               │
│   - Business Logic Handler          │
└────────────┬────────────────────────┘
             │
      ┌──────┴──────┐
      ↓             ↓
┌──────────┐  ┌──────────────┐
│ Backend  │  │ PostgreSQL   │
│ API      │  │ (Neon)       │
│ (Node.js)│  │              │
└──────────┘  └──────────────┘
```

### 2.2 Component Breakdown

#### A. WhatsApp Business API Layer
- **Purpose:** Official interface to WhatsApp platform
- **Responsibilities:**
  - Send/receive messages
  - Media handling (images, documents)
  - Message templates management
  - Delivery status tracking

#### B. WhatsApp Bot Service (New Component)
- **Technology:** Node.js + Express
- **Key Modules:**
  1. **Webhook Handler:** Receives incoming messages from WhatsApp
  2. **Message Router:** Routes messages to appropriate handlers based on user role and intent
  3. **Session Manager:** Maintains conversation context using Redis/PostgreSQL
  4. **NLP Engine:** Natural language understanding for intent detection (OpenAI/Dialogflow)
  5. **Response Generator:** Formats responses and constructs WhatsApp message payloads
  6. **Integration Layer:** Communicates with existing backend API

#### C. Database Extensions
- New tables required:
  - `whatsapp_sessions`: Track conversation state
  - `whatsapp_messages`: Message audit log
  - `whatsapp_subscriptions`: User preferences and opt-in status
  - `whatsapp_templates`: Approved message templates

---

## 3. Use Cases & User Flows

### 3.1 Teacher Use Cases

#### UC-1: Mark Attendance via WhatsApp
**Actor:** Teacher  
**Precondition:** Teacher has registered WhatsApp number and has classes scheduled today

**Flow:**
1. Teacher sends message: "Mark attendance for Guitar batch 5pm"
2. Bot identifies teacher, retrieves today's Guitar 5pm batch
3. Bot sends student list with quick reply buttons: "Who was present today?"
4. Teacher replies: "All present" OR lists present students: "John, Mary, Ahmed"
5. Bot parses response and generates draft attendance
6. Bot sends confirmation: "Confirming attendance: John ✓, Mary ✓, Ahmed ✓, Sarah ✗. Is this correct?"
7. Teacher confirms: "Yes" OR corrects: "Sarah was also present"
8. Bot submits finalized attendance to backend API
9. Bot confirms: "Attendance saved for Guitar 5pm batch ✓"

**Alternative Flows:**
- Teacher lists absent students: "Sarah was absent"
- Teacher needs to mark makeup class: "Mark makeup attendance for John"
- Error handling: "I couldn't find a Guitar batch at 5pm today. Please check and try again."

#### UC-2: Check Today's Schedule
**Actor:** Teacher  
**Trigger:** "What's my schedule today?"  
**Response:** 
```
📅 Your schedule for Tuesday, Jan 18:
• Guitar Beginner - 5:00 PM (8 students)
• Piano Advanced - 7:00 PM (5 students)
```

#### UC-3: Report Leave/Absence
**Actor:** Teacher  
**Trigger:** "I'm on leave tomorrow"  
**Flow:**
1. Bot asks for confirmation and reason
2. Bot marks teacher as absent in system
3. Bot notifies admin via WhatsApp
4. Bot sends cancellation notifications to affected students

---

### 3.2 Student/Parent Use Cases

#### UC-4: Check Class Schedule
**Actor:** Student/Parent  
**Trigger:** "When is my next class?"  
**Response:**
```
🎵 Your upcoming classes:
• Keyboard (Ms. Priya) - Today 6:00 PM
• Guitar (Mr. Rahul) - Thursday 5:30 PM
```

#### UC-5: Check Classes Remaining
**Actor:** Student/Parent  
**Trigger:** "How many classes left?"  
**Response:**
```
📊 Classes Remaining:
• Keyboard: 12 classes
• Guitar: 8 classes

💳 Next payment due: Feb 15, 2026
```

#### UC-6: Enrollment Inquiry
**Actor:** Prospective Student/Parent  
**Trigger:** "I want to enroll my child in piano classes"  
**Flow:**
1. Bot provides general information about piano courses
2. Bot asks relevant questions: age, experience level, preferred timings
3. Bot shows available batches with timing and teacher info
4. Bot offers to connect with admin: "Would you like me to have an administrator call you?"
5. If yes, bot creates lead record and notifies admin

#### UC-7: Payment Reminder Response
**Actor:** Student/Parent  
**Trigger:** Bot sends: "💰 Your monthly payment of ₹2000 for Keyboard is due on Jan 20"  
**User Response:** "I'll pay today" OR "Send payment link"  
**Bot Action:** Sends Razorpay payment link

---

### 3.3 Admin Use Cases

#### UC-8: Broadcast Announcements
**Actor:** Admin  
**Trigger:** Admin uses dashboard to send broadcast  
**Bot Action:** Sends message to all subscribed users:
```
🏫 HSM Announcement:
School will be closed on Jan 26 (Republic Day).
All classes will be rescheduled. Check with your teacher.
```

#### UC-9: Query Student Information
**Actor:** Admin  
**Trigger:** "Show me John Doe's enrollment details"  
**Response:**
```
👤 John Doe
📧 john.doe@email.com
📞 +91-9876543210

🎵 Enrolled in:
• Keyboard (Monthly) - 15 classes left
• Guitar (Quarterly) - 22 classes left

💰 Payment Status: All paid up
📅 Last payment: Dec 28, 2025
```

#### UC-10: Attendance Override
**Actor:** Admin  
**Trigger:** "Mark John Doe as present in yesterday's Guitar class"  
**Flow:**
1. Bot verifies admin role
2. Bot finds the specific attendance record
3. Bot updates attendance with audit log entry
4. Bot confirms action

---

## 4. Technical Design

### 4.1 Technology Stack

#### WhatsApp Integration Options

| Provider | Pros | Cons | Cost |
|----------|------|------|------|
| **Meta Cloud API** (Recommended) | Free tier, direct from Meta, official | Requires Facebook Business Manager | Free up to 1000 conversations/month |
| **Twilio WhatsApp API** | Reliable, great docs, easy setup | Higher cost, template approval needed | $0.005-0.013 per message |
| **360Dialog** | Good for EU, GDPR compliant | Regional focus, moderate cost | €0.008 per message |

**Recommendation:** Start with **Meta Cloud API** for cost-effectiveness and scalability.

#### Bot Service Stack
- **Runtime:** Node.js 18+ with Express
- **NLP/AI:** OpenAI GPT-4 API for intent detection and response generation
- **Session Storage:** Redis (for ephemeral sessions) + PostgreSQL (for persistent state)
- **Message Queue:** Bull/BullMQ for async processing (optional, for scale)
- **Hosting:** Vercel Serverless Functions OR AWS Lambda OR dedicated VPS

#### Libraries & SDKs
```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.5.0",  // Alternative: open-source WhatsApp lib
    "openai": "^4.20.0",
    "ioredis": "^5.3.2",
    "bull": "^4.12.0",
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "axios": "^1.6.2",
    "pg": "^8.11.3",
    "jsonwebtoken": "^9.0.2"
  }
}
```

---

### 4.2 Database Schema Extensions

#### Table: `whatsapp_sessions`
```sql
CREATE TABLE whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) NOT NULL,
    user_id UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    admin_id UUID,  -- If admin user
    context JSONB NOT NULL DEFAULT '{}',  -- Conversation state
    last_intent VARCHAR(100),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX idx_whatsapp_sessions_expires ON whatsapp_sessions(expires_at);
```

#### Table: `whatsapp_messages`
```sql
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    phone_number VARCHAR(15) NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(20) CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video')),
    content TEXT,
    media_url TEXT,
    metadata JSONB DEFAULT '{}',
    whatsapp_message_id VARCHAR(255) UNIQUE,
    status VARCHAR(20) CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);
```

#### Table: `whatsapp_subscriptions`
```sql
CREATE TABLE whatsapp_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    user_id UUID,  -- Can link to student, teacher, or admin
    user_type VARCHAR(20) CHECK (user_type IN ('student', 'teacher', 'admin', 'prospect')),
    is_active BOOLEAN DEFAULT true,
    opted_in_at TIMESTAMPTZ DEFAULT NOW(),
    opted_out_at TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}',  -- e.g., {"receive_reminders": true, "receive_announcements": true}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_subscriptions_phone ON whatsapp_subscriptions(phone_number);
CREATE INDEX idx_whatsapp_subscriptions_user ON whatsapp_subscriptions(user_id);
```

#### Table: `whatsapp_templates`
```sql
CREATE TABLE whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) UNIQUE NOT NULL,
    template_type VARCHAR(50) CHECK (template_type IN ('reminder', 'notification', 'confirmation', 'query')),
    language VARCHAR(10) DEFAULT 'en',
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',  -- e.g., ["student_name", "class_time"]
    status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    meta_template_id VARCHAR(255),  -- ID from WhatsApp Business API
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `attendance_drafts`
```sql
CREATE TABLE attendance_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    session_id UUID REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    parsed_data JSONB NOT NULL,  -- {"present": ["uuid1", "uuid2"], "absent": ["uuid3"]}
    original_message TEXT,
    status VARCHAR(20) CHECK (status IN ('draft', 'confirmed', 'rejected')) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_attendance_drafts_batch ON attendance_drafts(batch_id);
CREATE INDEX idx_attendance_drafts_teacher ON attendance_drafts(teacher_id);
```

---

### 4.3 API Endpoints (New Bot Service)

#### Base URL: `/api/whatsapp`

**POST /api/whatsapp/webhook**
- Purpose: Receive incoming messages from WhatsApp Business API
- Authentication: Webhook signature verification
- Payload: WhatsApp message object
- Response: 200 OK (immediate response required by WhatsApp)

**GET /api/whatsapp/webhook**
- Purpose: Webhook verification during setup
- Query params: hub.mode, hub.verify_token, hub.challenge
- Response: hub.challenge value

**POST /api/whatsapp/send**
- Purpose: Send outbound messages (called by backend or admin dashboard)
- Authentication: JWT token
- Body:
  ```json
  {
    "to": "+919876543210",
    "type": "text",
    "text": {
      "body": "Your class starts in 30 minutes!"
    }
  }
  ```

**GET /api/whatsapp/sessions/:phone**
- Purpose: Retrieve active session for a phone number
- Authentication: JWT token
- Response: Session object with context

**POST /api/whatsapp/sessions/clear**
- Purpose: Clear session (logout user)
- Body: `{ "phone": "+919876543210" }`

**GET /api/whatsapp/messages/:phone**
- Purpose: Retrieve message history
- Query params: limit, offset
- Response: Array of messages

**POST /api/whatsapp/broadcast**
- Purpose: Send bulk messages (admin only)
- Authentication: JWT token with admin role
- Body:
  ```json
  {
    "recipient_type": "all_students" | "all_teachers" | "custom",
    "recipient_list": ["+919876543210"],
    "template_name": "payment_reminder",
    "parameters": {"student_name": "John", "amount": "2000"}
  }
  ```

---

### 4.4 NLP & Intent Detection

#### Intent Categories

| Intent | Example Phrases | Required Entities | Handler |
|--------|----------------|-------------------|---------|
| `mark_attendance` | "Mark attendance", "Present: John, Mary" | batch_id, students, status | AttendanceHandler |
| `check_schedule` | "My schedule", "When is my next class" | user_id, date | ScheduleHandler |
| `classes_remaining` | "How many classes left", "Class balance" | student_id, instrument | PaymentHandler |
| `enrollment_inquiry` | "I want to enroll", "Piano classes info" | instrument, student_age | EnrollmentHandler |
| `payment_status` | "Payment due", "Send payment link" | student_id | PaymentHandler |
| `report_leave` | "I'm on leave tomorrow", "Can't make it" | teacher_id, date, reason | LeaveHandler |
| `general_query` | "School timings", "Fees structure" | N/A | InfoHandler |

#### AI Pipeline
1. **Message Preprocessing:** Clean text, normalize phone format
2. **Entity Extraction:** Extract names, dates, batch info using NER
3. **Intent Classification:** OpenAI GPT-4 prompt:
   ```
   You are an assistant for a music school. Classify the intent of this message:
   
   Message: "{user_message}"
   User Role: {teacher|student|unknown}
   
   Possible intents: [mark_attendance, check_schedule, classes_remaining, ...]
   
   Respond with JSON:
   {
     "intent": "mark_attendance",
     "confidence": 0.95,
     "entities": {
       "students": ["John", "Mary"],
       "status": "present"
     }
   }
   ```
4. **Context Awareness:** Consider previous messages in session
5. **Response Generation:** Template-based or AI-generated response

---

### 4.5 Security & Privacy

#### Authentication
- **Phone Number Verification:** Use WhatsApp's built-in verification
- **User Linking:** First-time users must verify identity:
  - Teacher: "Hi! I'm {teacher_name}. My employee ID is {id}."
  - Student: "I'm {student_name}. My enrollment ID is {id}."
  - Bot sends verification link/OTP via email or SMS

#### Authorization
- Role-based access control (RBAC)
- Teachers can only access their batches
- Students can only access their own data
- Admins have full access with audit logging

#### Data Privacy
- **GDPR Compliance:** Provide opt-out mechanism
- **Data Retention:** Delete messages after 90 days (configurable)
- **Encryption:** All data at rest encrypted, TLS for transmission
- **PII Handling:** Mask sensitive data in logs

#### Rate Limiting
- 10 messages per minute per user
- 100 messages per minute per phone number globally
- Exponential backoff for repeated failures

---

## 5. Message Flow Diagrams

### 5.1 Attendance Marking Flow

```
Teacher                  Bot Service              Backend API          Database
  |                           |                        |                  |
  |-- "Mark attendance" ----->|                        |                  |
  |                           |                        |                  |
  |                           |-- Identify teacher --->|                  |
  |                           |<-- Teacher data -------|                  |
  |                           |                        |                  |
  |                           |-- Get today's batches >|                  |
  |                           |<-- Batch list ---------|                  |
  |                           |                        |                  |
  |<-- "Which batch?" --------|                        |                  |
  |                           |                        |                  |
  |-- "Guitar 5pm" ---------->|                        |                  |
  |                           |                        |                  |
  |                           |-- Get students in batch>|                  |
  |                           |<-- Student list -------|                  |
  |                           |                        |                  |
  |<-- "Who was present?" ----|                        |                  |
  |                           |                        |                  |
  |-- "John, Mary, Ahmed" --->|                        |                  |
  |                           |-- Parse names (AI) --->|                  |
  |                           |                        |                  |
  |                           |-- Create draft --------|----------------->|
  |                           |                        |                  |
  |<-- "Confirm: J✓ M✓ A✓?" --|                        |                  |
  |                           |                        |                  |
  |-- "Yes" ------------------>|                        |                  |
  |                           |                        |                  |
  |                           |-- Submit attendance -->|                  |
  |                           |                        |-- Save --------->|
  |                           |                        |<-- OK -----------|
  |                           |<-- Success ------------|                  |
  |                           |                        |                  |
  |<-- "Attendance saved ✓" --|                        |                  |
```

### 5.2 Enrollment Inquiry Flow

```
Parent                   Bot Service              Backend API          Admin Dashboard
  |                           |                        |                  |
  |-- "Piano classes info" -->|                        |                  |
  |                           |                        |                  |
  |                           |-- Check subscription ->|                  |
  |                           |<-- Status: New user ---|                  |
  |                           |                        |                  |
  |<-- "Great! Let me help" --|                        |                  |
  |                           |                        |                  |
  |<-- "What's child's age?" -|                        |                  |
  |                           |                        |                  |
  |-- "8 years old" ---------->|                        |                  |
  |                           |                        |                  |
  |<-- "Experience level?" ---|                        |                  |
  |                           |                        |                  |
  |-- "Beginner" ------------->|                        |                  |
  |                           |                        |                  |
  |                           |-- Get available batches>|                  |
  |                           |<-- Batch data ---------|                  |
  |                           |                        |                  |
  |<-- "Available batches..." |                        |                  |
  |                           |                        |                  |
  |<-- "Connect with admin?" -|                        |                  |
  |                           |                        |                  |
  |-- "Yes, please" ---------->|                        |                  |
  |                           |                        |                  |
  |                           |-- Create lead -------->|                  |
  |                           |                        |-- Notify ------->|
  |                           |<-- Lead created -------|                  |
  |                           |                        |                  |
  |<-- "Admin will call soon" |                        |                  |
```

---

## 6. Implementation Approach

### 6.1 Development Phases

#### **Phase 1: Foundation (Weeks 1-2)**
- Set up WhatsApp Business API account and verify phone number
- Develop webhook receiver and message router
- Implement session management (Redis + PostgreSQL)
- Create database schema and migrations
- Build basic text message send/receive functionality
- Deploy bot service to staging environment

**Deliverables:**
- Bot can receive and respond to simple text messages
- Session management working
- Database tables created

#### **Phase 2: Core Features (Weeks 3-5)**
- Implement attendance marking flow with draft/confirm pattern
- Integrate OpenAI for NLP and intent detection
- Build schedule query handler
- Develop classes remaining handler
- Create admin dashboard integration for broadcasts
- Implement user authentication and linking

**Deliverables:**
- Teachers can mark attendance via WhatsApp
- Students can check schedules and class balance
- Admin can send broadcasts

#### **Phase 3: Advanced Features (Weeks 6-7)**
- Enrollment inquiry handler with lead generation
- Payment reminder automation
- Teacher leave reporting
- Makeup class scheduling via WhatsApp
- Rich media support (images, PDFs for receipts)
- Template message creation and approval

**Deliverables:**
- Complete enrollment inquiry flow
- Automated payment reminders
- Teacher leave management

#### **Phase 4: Testing & Optimization (Week 8)**
- End-to-end testing with real users
- Performance optimization
- Error handling and recovery
- Load testing (simulate 100+ concurrent users)
- Security audit
- Documentation

**Deliverables:**
- Production-ready bot
- Test reports
- User documentation
- Admin guide

#### **Phase 5: Launch & Monitoring (Week 9+)**
- Production deployment
- User onboarding (teachers first, then students)
- Monitor metrics and user feedback
- Iterate based on feedback

---

### 6.2 Deployment Architecture

#### Option 1: Serverless (Recommended for MVP)
- **Platform:** Vercel Serverless Functions
- **Pros:** Auto-scaling, no infrastructure management, cost-effective
- **Cons:** Cold starts (mitigated with provisioned concurrency)
- **Cost:** ~$20-50/month for moderate usage

#### Option 2: Containerized
- **Platform:** AWS ECS/Fargate or Google Cloud Run
- **Pros:** More control, better for long-running processes
- **Cons:** More complex setup, higher base cost
- **Cost:** ~$50-100/month

#### Option 3: VPS (Traditional)
- **Platform:** DigitalOcean/Linode VPS
- **Pros:** Full control, predictable pricing
- **Cons:** Manual scaling, server maintenance required
- **Cost:** ~$20-40/month

**Recommendation:** Start with **Vercel Serverless** for simplicity and scale. Migrate to containerized if needed.

---

### 6.3 CI/CD Pipeline

```yaml
# .github/workflows/whatsapp-bot-deploy.yml
name: Deploy WhatsApp Bot

on:
  push:
    branches: [main]
    paths:
      - 'whatsapp-bot/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 7. Testing Strategy

### 7.1 Test Pyramid

#### Unit Tests (60%)
- Intent detection accuracy
- Message parsing logic
- Session management
- Entity extraction

#### Integration Tests (30%)
- WhatsApp API integration
- Backend API calls
- Database operations
- OpenAI API responses

#### End-to-End Tests (10%)
- Complete user flows
- Multi-message conversations
- Error recovery scenarios

### 7.2 Key Test Scenarios

1. **Attendance Marking**
   - Teacher marks all present
   - Teacher lists absent students
   - Teacher corrects draft
   - Invalid student names
   - Multiple batches same day

2. **Session Management**
   - Session expiry
   - Context preservation across messages
   - Concurrent sessions for different users

3. **Error Handling**
   - WhatsApp API downtime
   - Backend API errors
   - Invalid user input
   - Malformed messages

4. **Security**
   - Unauthorized access attempts
   - Rate limiting enforcement
   - SQL injection attempts
   - XSS in message content

---

## 8. Monitoring & Observability

### 8.1 Key Metrics

#### Functional Metrics
- **Messages Processed:** Total inbound/outbound
- **Intent Detection Accuracy:** % correctly classified
- **Response Time:** p50, p95, p99 latency
- **Attendance Submissions:** Success rate via WhatsApp
- **Session Duration:** Average conversation length
- **User Satisfaction:** Explicit feedback (thumbs up/down)

#### Technical Metrics
- **API Uptime:** 99.9% SLA target
- **Error Rate:** < 1% of requests
- **WhatsApp Delivery Rate:** % messages delivered
- **Database Query Performance:** Slow query log
- **Cache Hit Rate:** Redis session cache

#### Business Metrics
- **Daily Active Users:** Unique phone numbers
- **Adoption Rate:** % of teachers using WhatsApp vs dashboard
- **Cost per Conversation:** WhatsApp API costs / total conversations
- **Time Saved:** Attendance marking time vs traditional method

### 8.2 Logging & Alerting

**Log Aggregation:** Datadog / CloudWatch / Papertrail

**Alert Rules:**
- Error rate > 5% for 5 minutes → PagerDuty alert
- Response time p95 > 3 seconds → Slack notification
- WhatsApp delivery rate < 95% → Email alert
- Daily message volume > 10,000 → Budget warning

**Log Levels:**
- `ERROR`: Failed API calls, unhandled exceptions
- `WARN`: Retry attempts, rate limiting triggered
- `INFO`: Message received/sent, intent detected
- `DEBUG`: Session state changes, entity extraction

---

## 9. Cost Analysis

See [COST_ANALYSIS.md](./COST_ANALYSIS.md) for detailed breakdown.

### Summary

| Component | Monthly Cost (100 users) | Monthly Cost (500 users) | Notes |
|-----------|--------------------------|--------------------------|-------|
| WhatsApp API (Meta) | $0 (free tier) | $50-100 | After 1000 free conversations |
| OpenAI API (GPT-4) | $50-100 | $200-300 | Intent detection + NER |
| Hosting (Vercel) | $0-20 | $50-100 | Serverless functions |
| Redis (Upstash) | $10 | $30 | Session management |
| Database (Neon) | Included | Included | Existing PostgreSQL |
| Monitoring (Datadog) | $15 | $50 | APM + logs |
| **Total** | **$75-145/month** | **$380-580/month** |

**Annual Cost:** $900-1,740 (100 users) to $4,560-6,960 (500 users)

---

## 10. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **WhatsApp API Policy Changes** | High | Medium | Use official Meta API; stay updated on policy changes |
| **NLP Accuracy Issues** | Medium | Medium | Implement fallback to menu-driven flow; continuous training |
| **User Resistance to Bot** | Medium | Medium | Keep dashboard as primary; WhatsApp as optional convenience |
| **Cost Overruns (AI API)** | Medium | Low | Set usage quotas; cache common queries; optimize prompts |
| **Privacy/Data Breach** | High | Low | Encrypt data; regular security audits; GDPR compliance |
| **WhatsApp Account Suspension** | High | Low | Follow WhatsApp business policies; proper template approval |
| **Poor Message Delivery** | Medium | Low | Monitor delivery rates; implement retry logic |
| **Scalability Bottlenecks** | Medium | Low | Load testing; use message queues; auto-scaling |

---

## 11. Success Criteria

### MVP Success Metrics (3 months post-launch)
- ✓ 60%+ of teachers use WhatsApp for attendance at least once/week
- ✓ 30%+ of students use WhatsApp for queries
- ✓ < 2 second average response time
- ✓ 95%+ intent detection accuracy
- ✓ < 1% error rate
- ✓ Positive user feedback (NPS > 40)

### Business Impact
- Reduce attendance marking time by 50%
- Increase payment collection rate by 20% (via timely reminders)
- Reduce admin workload for routine queries by 30%
- Improve parent engagement and satisfaction

---

## 12. Future Enhancements (Post-MVP)

1. **Voice Messages:** Support voice-based attendance marking
2. **Multimedia:** Share class videos, performance recordings
3. **AI Tutoring:** Basic music theory Q&A via chatbot
4. **Multilingual Support:** Hindi, Telugu, Tamil interfaces
5. **Student Progress Reports:** Automated monthly summaries
6. **Event Management:** RSVPs for recitals and concerts via WhatsApp
7. **Feedback Collection:** Post-class NPS surveys
8. **Gamification:** Badges and streaks for attendance
9. **Integration with LMS:** Link to online learning resources
10. **Chatbot Analytics Dashboard:** Conversation insights for admins

---

## 13. References & Resources

### Documentation
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Meta Cloud API Guide](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)

### Libraries
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - Open-source alternative
- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) - Full-featured WA library
- [OpenAI Node SDK](https://github.com/openai/openai-node)

### Tutorials
- [Building a WhatsApp Chatbot with Node.js](https://www.twilio.com/blog/build-whatsapp-chatbot-nodejs)
- [NLP with GPT-4 for Intent Detection](https://platform.openai.com/docs/guides/chat)

---

## 14. Team & Responsibilities

| Role | Responsibilities | Time Commitment |
|------|------------------|-----------------|
| **Backend Developer** | Bot service, API integration, DB schema | 60% (6 weeks) |
| **Frontend Developer** | Admin dashboard updates, broadcast UI | 20% (2 weeks) |
| **DevOps Engineer** | Deployment, monitoring, CI/CD setup | 20% (2 weeks) |
| **QA Engineer** | Testing, user acceptance testing | 30% (3 weeks) |
| **Product Manager** | Requirements, user flows, prioritization | 20% (ongoing) |
| **Designer** | Message templates, conversation design | 10% (1 week) |

**External Costs:**
- WhatsApp Business Account verification: One-time $50 (if using Meta directly)
- OpenAI API credits: See cost analysis

---

## Appendix A: Environment Variables

```bash
# WhatsApp Configuration
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secret_verify_token_here

# OpenAI Configuration
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=500

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://default:pass@host:6379

# Backend API Configuration
BACKEND_API_URL=https://hsm-backend.vercel.app
BACKEND_API_KEY=your_backend_api_key

# Application Configuration
NODE_ENV=production
PORT=3000
SESSION_EXPIRY_MINUTES=30
RATE_LIMIT_PER_MINUTE=10

# Monitoring
DATADOG_API_KEY=xxxxxxxxxxxxx
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

---

**Document Status:** ✅ Ready for Review  
**Next Steps:** Cost analysis, sequence diagrams, implementation plan  
**Owner:** Technical Team  
**Stakeholders:** Admin, Teachers, Product Team
