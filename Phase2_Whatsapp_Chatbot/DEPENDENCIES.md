# WhatsApp Chatbot - Dependencies & Prerequisites
## Hyderabad School of Music Management System

**Version:** 1.0  
**Date:** January 18, 2026

---

## 1. Technical Dependencies

### 1.1 Core Infrastructure

#### WhatsApp Business Platform
- **Requirement:** Meta Cloud API access
- **Prerequisites:**
  - Facebook Business Manager account
  - Verified business entity
  - WhatsApp Business Account
  - Phone number (dedicated, not personal)
  - Business verification documents (GST, PAN, business registration)
- **Setup Time:** 3-7 days for verification
- **Documentation:** [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)

#### Node.js Runtime
- **Version:** Node.js 18.x or higher
- **Reason:** ES modules support, modern async features
- **Installation:** `nvm install 18 && nvm use 18`

#### Database (PostgreSQL)
- **Current:** Neon (existing)
- **Requirements:**
  - PostgreSQL 14+
  - Additional tables for WhatsApp data (~500MB initial storage)
  - Connection pooling support
- **Migration:** Schema changes needed (see Section 3)

#### Redis (Session Management)
- **Provider:** Upstash (recommended) or Redis Cloud
- **Requirements:**
  - Redis 6.0+
  - Persistent storage
  - SSL/TLS support
- **Purpose:** Session state, rate limiting, temporary caching

---

### 1.2 External APIs & Services

#### OpenAI API
- **Requirement:** GPT-4 Turbo access
- **Prerequisites:**
  - OpenAI account with billing enabled
  - API key with GPT-4 access
  - Usage limits configured
- **Alternatives:**
  - GPT-3.5-Turbo (cheaper, less accurate)
  - Open-source LLMs (Llama 3, Mistral) via Hugging Face
- **Cost:** ~$0.0065 per conversation
- **Documentation:** [OpenAI Platform](https://platform.openai.com/docs)

#### Payment Gateway (Razorpay)
- **Current:** Assumed to be integrated in Phase 1
- **Requirements:**
  - Razorpay account
  - Payment Links API access
  - Webhook endpoint for payment confirmations
- **Purpose:** Generate payment links via bot

---

### 1.3 Development Tools & Libraries

#### npm Packages (package.json)

```json
{
  "name": "hsm-whatsapp-bot",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "ioredis": "^5.3.2",
    "pg": "^8.11.3",
    "openai": "^4.20.0",
    "jsonwebtoken": "^9.0.2",
    "bullmq": "^4.15.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "rate-limit-redis": "^4.1.2",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "eslint": "^8.55.0",
    "prettier": "^3.1.1"
  }
}
```

#### Development Environment
- **Code Editor:** VS Code (recommended)
- **VS Code Extensions:**
  - ESLint
  - Prettier
  - REST Client
  - Thunder Client (API testing)
- **Git:** Version control
- **Postman/Insomnia:** API testing

---

### 1.4 Deployment & Hosting

#### Hosting Platform (Vercel Recommended)
- **Requirements:**
  - Vercel account
  - GitHub repository connected
  - Vercel CLI installed: `npm i -g vercel`
- **Alternatives:**
  - AWS Lambda + API Gateway
  - Google Cloud Run
  - DigitalOcean App Platform

#### Domain & SSL
- **Domain:** whatsapp.hsm-school.com (example)
- **SSL:** Automatic with Vercel/Cloudflare
- **DNS:** Configure webhook URL

#### CI/CD Pipeline
- **Platform:** GitHub Actions
- **Requirements:**
  - GitHub repository
  - Secrets configured (API keys, tokens)
- **Workflow:** See `.github/workflows/` in implementation

---

## 2. Business Dependencies

### 2.1 WhatsApp Business Account Setup

#### Step 1: Create Facebook Business Manager
1. Go to [business.facebook.com](https://business.facebook.com)
2. Create new business account
3. Add business details (name, address, website)
4. Verify business identity (upload GST/PAN/registration docs)

#### Step 2: Set Up WhatsApp Business API
1. Navigate to WhatsApp section in Business Manager
2. Click "Get Started" on Cloud API
3. Add phone number (must be new or migrate existing WhatsApp Business)
4. Verify phone number via OTP

#### Step 3: Configure Webhooks
1. Set webhook URL: `https://your-domain.vercel.app/api/whatsapp/webhook`
2. Set verify token (random secure string)
3. Subscribe to `messages` and `message_status` events

#### Step 4: Create Message Templates
WhatsApp requires pre-approved templates for business-initiated messages.

**Required Templates:**

1. **Payment Reminder**
   ```
   Hi {{1}},
   
   Your monthly payment of ₹{{2}} for {{3}} classes is due on {{4}}.
   
   Pay now: {{5}}
   
   Thank you!
   - HSM Team
   ```

2. **Class Reminder**
   ```
   Hi {{1}},
   
   Reminder: Your {{2}} class with {{3}} is at {{4}} today.
   
   See you soon! 🎵
   ```

3. **Payment Confirmation**
   ```
   Hi {{1}},
   
   ✅ Payment received! ₹{{2}} for {{3}} classes.
   
   Receipt: {{4}}
   
   Thank you!
   - HSM Team
   ```

**Template Approval Time:** 24-48 hours

---

### 2.2 User Onboarding

#### Teachers
- Collect WhatsApp numbers (consent required)
- Assign unique teacher IDs
- Send onboarding message with instructions
- Training session: 30 minutes

#### Students/Parents
- Collect WhatsApp numbers during enrollment
- Send welcome message with bot number
- Opt-in consent for notifications
- FAQs document shared

#### Admins
- Dedicated admin WhatsApp number or dashboard access
- Training on broadcast features
- Access to analytics dashboard

---

## 3. Database Dependencies

### 3.1 Schema Changes Required

#### New Tables (SQL)

```sql
-- WhatsApp Sessions
CREATE TABLE whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    user_id UUID,
    user_type VARCHAR(20) CHECK (user_type IN ('student', 'teacher', 'admin', 'prospect')),
    context JSONB NOT NULL DEFAULT '{}',
    last_intent VARCHAR(100),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX idx_whatsapp_sessions_expires ON whatsapp_sessions(expires_at);

-- WhatsApp Messages (Audit Log)
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    phone_number VARCHAR(15) NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(20),
    content TEXT,
    metadata JSONB DEFAULT '{}',
    whatsapp_message_id VARCHAR(255) UNIQUE,
    status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- WhatsApp Subscriptions
CREATE TABLE whatsapp_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    user_id UUID,
    user_type VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    opted_in_at TIMESTAMPTZ DEFAULT NOW(),
    opted_out_at TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Drafts
CREATE TABLE attendance_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    session_id UUID REFERENCES whatsapp_sessions(id),
    attendance_date DATE NOT NULL,
    parsed_data JSONB NOT NULL,
    original_message TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);
```

#### Existing Table Modifications

```sql
-- Add WhatsApp phone to teachers
ALTER TABLE teachers 
ADD COLUMN whatsapp_phone VARCHAR(15),
ADD COLUMN whatsapp_verified BOOLEAN DEFAULT false;

-- Add WhatsApp phone to students (if not exists)
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(15),
ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT false;

-- Create index for phone lookups
CREATE INDEX idx_teachers_whatsapp ON teachers(whatsapp_phone);
CREATE INDEX idx_students_whatsapp ON students(whatsapp_phone);
```

---

### 3.2 Data Migration

#### Step 1: Export Existing Phone Numbers
```sql
-- Export teachers with phone numbers
SELECT id, first_name, last_name, phone 
FROM teachers 
WHERE phone IS NOT NULL;

-- Export students with phone numbers
SELECT id, first_name, last_name, phone 
FROM students 
WHERE phone IS NOT NULL;
```

#### Step 2: Validate Phone Format
- Ensure all phone numbers are in E.164 format: `+919876543210`
- Clean data: remove spaces, dashes, parentheses
- Script: `scripts/validate-phones.js`

#### Step 3: Populate whatsapp_subscriptions
```sql
-- For teachers
INSERT INTO whatsapp_subscriptions (phone_number, user_id, user_type, is_active)
SELECT 
    phone AS phone_number,
    id AS user_id,
    'teacher' AS user_type,
    true AS is_active
FROM teachers
WHERE phone IS NOT NULL;

-- For students
INSERT INTO whatsapp_subscriptions (phone_number, user_id, user_type, is_active)
SELECT 
    phone AS phone_number,
    id AS user_id,
    'student' AS user_type,
    true AS is_active
FROM students
WHERE phone IS NOT NULL;
```

---

## 4. Integration Dependencies

### 4.1 Backend API Requirements

#### Existing Endpoints (Must Be Available)
- `GET /api/teachers/:id` - Teacher details
- `GET /api/teachers/:id/batches` - Teacher's batches
- `GET /api/students/:id` - Student details
- `GET /api/students/:id/enrollments` - Student enrollments
- `GET /api/batches/:id` - Batch details
- `GET /api/batches/:id/students` - Students in batch
- `POST /api/attendance` - Submit attendance
- `GET /api/payments/due` - Payments due soon

#### New Endpoints (To Be Created)
- `POST /api/whatsapp/webhook` - Receive WhatsApp messages
- `POST /api/whatsapp/send` - Send outbound messages
- `POST /api/attendance/draft` - Create attendance draft
- `POST /api/attendance/confirm` - Confirm draft attendance
- `POST /api/leads` - Create enrollment lead
- `GET /api/broadcasts/history` - Broadcast message history

#### Authentication
- **Method:** JWT tokens
- **Header:** `Authorization: Bearer <token>`
- **Scopes:** `teacher`, `student`, `admin`

---

### 4.2 Frontend Dashboard Integration (Optional)

#### Admin Dashboard Features
- **Broadcast Interface:**
  - Compose message
  - Select recipients (all students, all teachers, custom list)
  - Schedule send time
  - View delivery status

- **Analytics Dashboard:**
  - Messages sent/received count
  - Intent detection accuracy
  - Popular queries
  - Response time metrics

- **User Management:**
  - Link phone numbers to accounts
  - View conversation history
  - Manage subscriptions (opt-in/opt-out)

---

## 5. Environment Configuration

### 5.1 Environment Variables (.env)

```bash
# ============================================
# WhatsApp Configuration
# ============================================
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secret_verify_token_12345
WHATSAPP_API_VERSION=v18.0

# ============================================
# OpenAI Configuration
# ============================================
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7

# ============================================
# Database Configuration
# ============================================
DATABASE_URL=postgresql://user:password@host:5432/hsm_db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true

# ============================================
# Redis Configuration
# ============================================
REDIS_URL=redis://default:password@host:6379
REDIS_TLS=true
REDIS_SESSION_TTL=1800  # 30 minutes

# ============================================
# Backend API Configuration
# ============================================
BACKEND_API_URL=https://hsm-backend.vercel.app/api
BACKEND_API_KEY=your_backend_api_key_here
BACKEND_API_TIMEOUT=10000  # milliseconds

# ============================================
# Application Configuration
# ============================================
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
SESSION_EXPIRY_MINUTES=30
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_HOUR=100

# ============================================
# Payment Gateway (Razorpay)
# ============================================
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxx

# ============================================
# Monitoring & Logging
# ============================================
DATADOG_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
ENABLE_ANALYTICS=true

# ============================================
# Security
# ============================================
JWT_SECRET=your_jwt_secret_key_min_32_chars
WEBHOOK_SECRET=your_webhook_secret_for_signature_verification
ALLOWED_ORIGINS=https://hsm-dashboard.com,https://hsm-enroll.com

# ============================================
# Feature Flags
# ============================================
ENABLE_VOICE_MESSAGES=false
ENABLE_MULTILINGUAL=false
ENABLE_AI_FALLBACK=true
```

---

## 6. Compliance & Legal Dependencies

### 6.1 Data Privacy (GDPR/DPDPA)

#### User Consent
- **Requirement:** Explicit consent for WhatsApp communication
- **Implementation:**
  - Consent checkbox during enrollment
  - Opt-in message: "Reply YES to receive updates via WhatsApp"
  - Opt-out mechanism: "Reply STOP to unsubscribe"

#### Data Storage
- **Requirement:** Store only necessary data
- **Retention Policy:**
  - Message logs: 90 days
  - Session data: 30 days
  - User preferences: Until opt-out
- **Deletion:** Provide "Delete my data" feature

#### Privacy Policy
- Update school privacy policy to include:
  - WhatsApp data collection
  - Third-party services (OpenAI, Meta)
  - Data retention and deletion
  - User rights

---

### 6.2 WhatsApp Business Policy Compliance

#### Do's
✅ Use approved message templates for business-initiated messages  
✅ Respond within 24-hour window to user messages  
✅ Provide clear opt-out mechanism  
✅ Use official WhatsApp Business API  
✅ Keep business verification details updated  

#### Don'ts
❌ Send spam or unsolicited messages  
❌ Use automated scraping or unauthorized access  
❌ Share WhatsApp access with third parties  
❌ Mislead users about business identity  
❌ Send promotional content without consent  

**Violation Consequences:** Account suspension, permanent ban

---

## 7. Team Dependencies & Skills

### 7.1 Required Team Roles

| Role | Responsibilities | Time Commitment | Skills Required |
|------|------------------|-----------------|-----------------|
| **Backend Developer** | Build bot service, API integration, database | 60% (6 weeks) | Node.js, PostgreSQL, REST APIs, WebSockets |
| **Frontend Developer** | Admin dashboard for broadcasts, analytics | 20% (2 weeks) | React/Vue, Charts, UI/UX |
| **DevOps Engineer** | Deployment, CI/CD, monitoring | 20% (2 weeks) | Vercel/AWS, Docker, GitHub Actions |
| **QA Engineer** | Test flows, write test cases, UAT | 30% (3 weeks) | Jest, Postman, Manual testing |
| **Product Manager** | Requirements, user stories, prioritization | 20% (ongoing) | Product strategy, User research |
| **Conversation Designer** | Message templates, conversation flows | 10% (1 week) | UX writing, Chatbot design |

---

### 7.2 Training Requirements

#### Technical Training (Development Team)
- **WhatsApp Cloud API:** 4 hours
  - Webhook setup
  - Message formats
  - Template management
- **OpenAI GPT Integration:** 3 hours
  - Prompt engineering
  - Context management
  - Cost optimization
- **Redis & Session Management:** 2 hours

#### Operational Training (School Staff)
- **Teachers:** 30-minute session
  - How to mark attendance via WhatsApp
  - Handling bot responses
  - Troubleshooting
- **Admin Staff:** 1-hour session
  - Sending broadcasts
  - Viewing analytics
  - Managing user subscriptions

---

## 8. Testing Dependencies

### 8.1 Test Environments

#### Development Environment
- Local Node.js server
- ngrok for webhook testing
- Mock WhatsApp responses

#### Staging Environment
- Dedicated WhatsApp test number
- Staging database (copy of production schema)
- Test users (teachers, students)

#### Production Environment
- Live WhatsApp Business Account
- Production database
- Real users (pilot group first)

---

### 8.2 Test Data

#### Seed Data Requirements
```sql
-- Test teachers (3)
INSERT INTO teachers (id, first_name, last_name, phone, whatsapp_verified) VALUES
    (uuid_generate_v4(), 'Test', 'Teacher1', '+919000000001', true),
    (uuid_generate_v4(), 'Test', 'Teacher2', '+919000000002', true);

-- Test students (10)
-- Test batches (5)
-- Test enrollments (20)
```

#### Test Phone Numbers
- WhatsApp provides test numbers for development
- Document: [Test Numbers](https://developers.facebook.com/docs/whatsapp/test-numbers)

---

## 9. Third-Party Service Accounts

### Required Accounts Checklist

- [ ] Meta Business Manager account
- [ ] WhatsApp Business Account
- [ ] Facebook Developer account
- [ ] OpenAI account with billing
- [ ] Upstash Redis account
- [ ] Vercel account (hosting)
- [ ] GitHub account (CI/CD)
- [ ] Datadog account (monitoring) - Optional
- [ ] Sentry account (error tracking) - Optional
- [ ] Razorpay account (payment links) - Existing

---

## 10. Rollout Dependencies

### 10.1 Pilot Phase (Week 1-2)

**Participants:**
- 2 teachers
- 10 students (and their parents)
- 1 admin

**Goals:**
- Validate core flows
- Gather feedback
- Identify bugs
- Measure adoption rate

**Success Criteria:**
- 80% of teachers mark attendance via WhatsApp
- < 5% error rate
- Positive user feedback (NPS > 40)

---

### 10.2 Full Rollout (Week 3-4)

**Prerequisites:**
- [ ] Pilot phase completed successfully
- [ ] All bugs fixed
- [ ] User documentation ready
- [ ] Training sessions conducted
- [ ] Templates approved by WhatsApp
- [ ] Monitoring dashboards set up

**Communication Plan:**
- Week 1: Announce feature to all users via email
- Week 2: Send onboarding WhatsApp message to all
- Week 3: Conduct live Q&A session
- Week 4: Full launch announcement

---

## 11. Documentation Dependencies

### 11.1 Technical Documentation
- [ ] API Reference (Swagger/OpenAPI)
- [ ] Database Schema Documentation
- [ ] Deployment Guide
- [ ] Environment Setup Guide
- [ ] Troubleshooting Guide

### 11.2 User Documentation
- [ ] Teacher User Guide (PDF/Video)
- [ ] Student User Guide
- [ ] Admin Dashboard Manual
- [ ] FAQ Document
- [ ] Video Tutorials (3-5 minutes each)

---

## 12. Monitoring & Observability Dependencies

### 12.1 Logging Infrastructure
- **Tool:** Winston or Pino (Node.js)
- **Destinations:** 
  - Console (development)
  - File (production)
  - Datadog (optional)

### 12.2 Metrics to Track
- Message throughput (msg/sec)
- Intent detection accuracy (%)
- API response time (ms)
- Error rate (%)
- User engagement (DAU, MAU)

### 12.3 Alerting
- **Critical:** API down, database connection lost
- **Warning:** Error rate > 5%, response time > 3s
- **Info:** Daily summary report

---

## 13. Risk Mitigation Dependencies

### 13.1 Backup & Recovery

#### Database Backups
- **Frequency:** Daily automated backups
- **Retention:** 30 days
- **Tool:** Neon built-in backups or pg_dump

#### Code Backups
- **Repository:** GitHub (private repo)
- **Branches:** main, develop, feature/*
- **Tags:** v1.0.0, v1.1.0, etc.

#### Configuration Backups
- Store `.env.example` in repo
- Actual `.env` in secure vault (Vercel secrets, AWS Secrets Manager)

---

### 13.2 Disaster Recovery Plan

**Scenario 1: WhatsApp API Down**
- **Fallback:** Dashboard-only mode
- **Communication:** Email/SMS notification to users
- **ETA:** WhatsApp SLA (99.9% uptime)

**Scenario 2: OpenAI API Down**
- **Fallback:** Menu-driven bot (keyword matching)
- **Impact:** Reduced UX, basic functionality maintained

**Scenario 3: Database Down**
- **Fallback:** Read-only mode with cached data
- **Recovery:** Restore from backup (RTO: 4 hours, RPO: 24 hours)

---

## 14. Final Checklist Before Launch

### Pre-Launch Checklist

#### Business
- [ ] WhatsApp Business Account verified
- [ ] Message templates approved
- [ ] Privacy policy updated
- [ ] User consent collected
- [ ] Training sessions completed

#### Technical
- [ ] All dependencies installed
- [ ] Database migrations run
- [ ] Environment variables configured
- [ ] Webhook endpoint verified
- [ ] API authentication tested
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Backups configured

#### Testing
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] End-to-end tests passing
- [ ] Load testing completed (100 concurrent users)
- [ ] Security audit completed
- [ ] Pilot phase successful

#### Documentation
- [ ] API documentation published
- [ ] User guides ready
- [ ] FAQ document created
- [ ] Video tutorials recorded
- [ ] Troubleshooting guide ready

#### Operations
- [ ] On-call rotation defined
- [ ] Incident response plan documented
- [ ] Support email/channel set up
- [ ] Analytics dashboard configured
- [ ] Rollback plan documented

---

## 15. Ongoing Dependencies (Post-Launch)

### Monthly
- [ ] Review WhatsApp API usage and costs
- [ ] Check OpenAI API costs and optimize
- [ ] Analyze user feedback and feature requests
- [ ] Update message templates if needed
- [ ] Security patches and updates

### Quarterly
- [ ] Performance review and optimization
- [ ] User satisfaction survey
- [ ] Feature roadmap review
- [ ] Cost-benefit analysis
- [ ] Disaster recovery drill

---

**Document Version:** 1.0  
**Last Updated:** January 18, 2026  
**Owner:** Technical & Operations Teams  
**Review Cycle:** Quarterly
