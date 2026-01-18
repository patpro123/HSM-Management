# WhatsApp Chatbot - Implementation Roadmap
## Hyderabad School of Music Management System

**Version:** 1.0  
**Date:** January 18, 2026  
**Timeline:** 9 weeks from kickoff to production launch

---

## Executive Summary

This document provides a detailed week-by-week implementation plan for the WhatsApp chatbot integration. The project is divided into 5 major phases over 9 weeks, with clearly defined milestones, deliverables, and success criteria.

**Total Duration:** 9 weeks  
**Team Size:** 4-5 people (1 backend, 0.5 frontend, 0.5 DevOps, 1 QA, 0.5 PM)  
**Budget:** $18,249 (Year 1)  
**Break-Even:** Month 16

---

## Phase 1: Foundation & Setup (Weeks 1-2)

### Week 1: Business Setup & Infrastructure

#### Day 1-2: WhatsApp Business Account Setup
**Owner:** Project Manager + Backend Developer

**Tasks:**
- [ ] Create Facebook Business Manager account
- [ ] Submit business verification documents
- [ ] Set up WhatsApp Business Account
- [ ] Register dedicated phone number
- [ ] Configure business profile (name, description, logo)

**Deliverables:**
- WhatsApp Business Account (pending verification)
- Phone number registered
- Business profile completed

**Blockers/Risks:**
- Business verification can take 3-7 days
- **Mitigation:** Start this immediately, parallel to other tasks

---

#### Day 3-4: Development Environment Setup
**Owner:** Backend Developer + DevOps

**Tasks:**
- [ ] Create GitHub repository (private)
- [ ] Set up project structure
  ```
  whatsapp-bot/
  ├── src/
  │   ├── handlers/
  │   ├── services/
  │   ├── utils/
  │   └── index.js
  ├── tests/
  ├── .env.example
  ├── package.json
  └── README.md
  ```
- [ ] Install dependencies (see DEPENDENCIES.md)
- [ ] Set up ESLint and Prettier
- [ ] Configure VS Code workspace settings
- [ ] Create development and staging branches

**Deliverables:**
- Git repository with boilerplate code
- Development environment working locally
- README with setup instructions

---

#### Day 5: Database Schema Design & Migration
**Owner:** Backend Developer

**Tasks:**
- [ ] Review existing database schema
- [ ] Write migration scripts for new tables:
  - `whatsapp_sessions`
  - `whatsapp_messages`
  - `whatsapp_subscriptions`
  - `attendance_drafts`
  - `whatsapp_templates`
- [ ] Add columns to existing tables (teachers, students)
- [ ] Create database indexes for performance
- [ ] Test migrations on local database

**Deliverables:**
- Migration SQL files in `db/migrations/`
- Rollback scripts for each migration
- Test data seed scripts

**SQL Example:**
```sql
-- db/migrations/005_add_whatsapp_tables.sql
BEGIN;

CREATE TABLE whatsapp_sessions (
    -- schema from DEPENDENCIES.md
);

CREATE TABLE whatsapp_messages (
    -- schema from DEPENDENCIES.md
);

-- Add indexes
CREATE INDEX idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);

COMMIT;
```

---

### Week 2: Core Bot Service Development

#### Day 6-7: Webhook Handler & Message Router
**Owner:** Backend Developer

**Tasks:**
- [ ] Create Express server
- [ ] Implement webhook verification endpoint (GET /api/whatsapp/webhook)
- [ ] Implement webhook receiver (POST /api/whatsapp/webhook)
- [ ] Verify WhatsApp signature for security
- [ ] Parse incoming message payload
- [ ] Implement message router (route by intent)
- [ ] Set up environment variables

**Deliverables:**
- Webhook endpoint working
- Can receive and log WhatsApp messages
- Message router skeleton in place

**Code Example:**
```javascript
// src/index.js
import express from 'express';
import whatsappRouter from './routes/whatsapp.js';

const app = express();
app.use(express.json());
app.use('/api/whatsapp', whatsappRouter);

app.listen(process.env.PORT || 3000);
```

---

#### Day 8-9: Session Management
**Owner:** Backend Developer

**Tasks:**
- [ ] Set up Redis connection (Upstash)
- [ ] Implement session creation/retrieval
- [ ] Implement session expiry (30 minutes)
- [ ] Store conversation context in Redis
- [ ] Implement session cleanup cron job
- [ ] Write unit tests for session manager

**Deliverables:**
- Session Manager service
- Redis integration working
- Sessions persist across messages
- Unit tests passing (>80% coverage)

**Code Example:**
```javascript
// src/services/sessionManager.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getSession(phoneNumber) {
    const key = `session:${phoneNumber}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
}

export async function saveSession(phoneNumber, sessionData) {
    const key = `session:${phoneNumber}`;
    const ttl = 30 * 60; // 30 minutes
    await redis.setex(key, ttl, JSON.stringify(sessionData));
}
```

---

#### Day 10: OpenAI Integration & Intent Detection
**Owner:** Backend Developer

**Tasks:**
- [ ] Set up OpenAI API client
- [ ] Create intent classification prompt
- [ ] Implement entity extraction (names, dates, batch IDs)
- [ ] Test with sample messages
- [ ] Implement confidence scoring
- [ ] Add fallback for low-confidence intents
- [ ] Write unit tests

**Deliverables:**
- OpenAI service module
- Intent classifier working
- Entity extraction working
- Test cases covering major intents

**Code Example:**
```javascript
// src/services/intentDetector.js
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function detectIntent(message, userRole, context) {
    const prompt = `
        You are an AI assistant for a music school.
        User Role: ${userRole}
        Context: ${JSON.stringify(context)}
        Message: "${message}"
        
        Classify the intent and extract entities.
        Respond with JSON:
        {
            "intent": "mark_attendance" | "check_schedule" | ...,
            "confidence": 0.95,
            "entities": {...}
        }
    `;
    
    const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
    });
    
    return JSON.parse(response.choices[0].message.content);
}
```

---

### Phase 1 Milestones

✅ **Milestone 1.1:** WhatsApp Business Account approved (End of Week 1)  
✅ **Milestone 1.2:** Database migrations complete (End of Week 1)  
✅ **Milestone 1.3:** Bot can receive messages and detect intents (End of Week 2)

**Demo:** Show incoming message → session created → intent detected → logged

---

## Phase 2: Core Features (Weeks 3-5)

### Week 3: Attendance Marking Flow

#### Day 11-12: Attendance Handler - Basic Flow
**Owner:** Backend Developer

**Tasks:**
- [ ] Create AttendanceHandler class
- [ ] Implement "Mark attendance" intent handler
- [ ] Integrate with Backend API (`GET /api/teachers/:id/batches`)
- [ ] Fetch today's batches for teacher
- [ ] Display batch list with quick reply buttons
- [ ] Store selected batch in session context

**Deliverables:**
- Teacher can trigger attendance flow
- Bot lists today's batches
- Selection stored in session

**User Flow:**
```
Teacher: "Mark attendance"
Bot: "Which batch?
     1. Guitar 5:00 PM (8 students)
     2. Piano 7:00 PM (5 students)
     
     Reply with batch number."
```

---

#### Day 13-14: Attendance Handler - Student Parsing & Draft
**Owner:** Backend Developer

**Tasks:**
- [ ] Fetch students in selected batch (`GET /api/batches/:id/students`)
- [ ] Parse teacher's message (list of present students)
- [ ] Use OpenAI to match names to student IDs
- [ ] Create attendance draft in database
- [ ] Generate confirmation message
- [ ] Send confirmation with "Yes/No" quick reply

**Deliverables:**
- Bot parses "John, Mary, Ahmed were present"
- Creates draft attendance
- Asks for confirmation

**Code Example:**
```javascript
// src/handlers/attendanceHandler.js
export async function handleAttendanceSubmission(session, message) {
    const batchId = session.context.selected_batch_id;
    const students = await getStudentsInBatch(batchId);
    
    // Parse names using OpenAI
    const presentStudents = await parseStudentNames(message, students);
    
    // Create draft
    const draft = await createAttendanceDraft({
        batch_id: batchId,
        teacher_id: session.user_id,
        date: new Date(),
        present: presentStudents.map(s => s.id),
        absent: students.filter(s => !presentStudents.includes(s)).map(s => s.id)
    });
    
    // Update session
    session.context.draft_id = draft.id;
    await saveSession(session.phone_number, session);
    
    return formatConfirmationMessage(presentStudents, absentStudents);
}
```

---

#### Day 15: Attendance Handler - Confirmation & Finalization
**Owner:** Backend Developer

**Tasks:**
- [ ] Handle "Yes" confirmation
- [ ] Submit finalized attendance to Backend API
- [ ] Update `classes_remaining` for present students
- [ ] Handle "No" correction flow
- [ ] Allow teacher to modify attendance
- [ ] Write integration tests

**Deliverables:**
- Complete attendance marking flow
- Attendance saved to database
- Integration tests passing

---

### Week 4: Query Handlers

#### Day 16-17: Schedule Query Handler
**Owner:** Backend Developer

**Tasks:**
- [ ] Create ScheduleHandler class
- [ ] Implement "check_schedule" intent
- [ ] Fetch user's upcoming classes
- [ ] Format response with emojis and clear layout
- [ ] Handle different user roles (teacher vs student)
- [ ] Write unit tests

**Deliverables:**
- Users can query "When is my next class?"
- Bot responds with schedule

**Response Example:**
```
🎵 Your upcoming classes:
• Keyboard (Ms. Priya) - Today 6:00 PM
• Guitar (Mr. Rahul) - Thursday 5:30 PM
• Piano (Mr. Khan) - Saturday 10:00 AM
```

---

#### Day 18-19: Payment & Classes Remaining Handler
**Owner:** Backend Developer

**Tasks:**
- [ ] Create PaymentHandler class
- [ ] Implement "classes_remaining" intent
- [ ] Fetch student enrollment data
- [ ] Calculate remaining classes per instrument
- [ ] Fetch next payment due date
- [ ] Generate Razorpay payment link
- [ ] Handle "send payment link" request

**Deliverables:**
- Students can query class balance
- Students can request payment link
- Payment link sent via WhatsApp

---

#### Day 20: Response Generator & Templates
**Owner:** Backend Developer

**Tasks:**
- [ ] Create response template engine
- [ ] Design message templates for common responses
- [ ] Implement dynamic variable substitution
- [ ] Add support for emojis and formatting
- [ ] Create error message templates
- [ ] Implement fallback responses

**Deliverables:**
- Consistent message formatting
- Template library for all response types

---

### Week 5: Advanced Features & Polish

#### Day 21-22: Enrollment Inquiry Handler
**Owner:** Backend Developer

**Tasks:**
- [ ] Create EnrollmentHandler class
- [ ] Implement multi-turn conversation flow
- [ ] Ask questions: child's age, experience, instrument
- [ ] Fetch available batches based on input
- [ ] Display batch options with fees
- [ ] Create lead record in database
- [ ] Notify admin via WhatsApp

**Deliverables:**
- Prospective parents can inquire about enrollment
- Lead records created
- Admin notified of new leads

---

#### Day 23-24: Teacher Leave & Broadcast Features
**Owner:** Backend Developer

**Tasks:**
- [ ] Implement "report_leave" intent
- [ ] Store leave record in database
- [ ] Notify admin of teacher absence
- [ ] Send cancellation messages to affected students
- [ ] Implement broadcast API endpoint
- [ ] Create broadcast message queue
- [ ] Handle delivery status tracking

**Deliverables:**
- Teachers can report leave via WhatsApp
- Admin can send broadcast messages
- Delivery tracking working

---

#### Day 25: Error Handling & Edge Cases
**Owner:** Backend Developer

**Tasks:**
- [ ] Implement comprehensive error handling
- [ ] Handle WhatsApp API errors gracefully
- [ ] Handle OpenAI API rate limits
- [ ] Implement retry logic with exponential backoff
- [ ] Add user-friendly error messages
- [ ] Log all errors to monitoring system

**Deliverables:**
- Robust error handling
- User never sees cryptic error messages
- All errors logged for debugging

---

### Phase 2 Milestones

✅ **Milestone 2.1:** Attendance marking fully functional (End of Week 3)  
✅ **Milestone 2.2:** Query handlers working (End of Week 4)  
✅ **Milestone 2.3:** All core features complete (End of Week 5)

**Demo:** End-to-end demo of all major flows

---

## Phase 3: Testing & Optimization (Week 6)

### Day 26-27: Unit & Integration Testing
**Owner:** QA Engineer + Backend Developer

**Tasks:**
- [ ] Write unit tests for all handlers (target: >80% coverage)
- [ ] Write integration tests for API endpoints
- [ ] Test database transactions (rollback scenarios)
- [ ] Test Redis session management
- [ ] Test OpenAI integration (mock responses for CI/CD)
- [ ] Set up Jest with GitHub Actions

**Deliverables:**
- Test suite with >80% code coverage
- CI/CD pipeline running tests automatically
- Test report generated

---

### Day 28-29: End-to-End Testing
**Owner:** QA Engineer

**Tasks:**
- [ ] Create test plan for all user flows
- [ ] Test with real WhatsApp test numbers
- [ ] Test multi-turn conversations
- [ ] Test concurrent users (10+ simultaneous)
- [ ] Test edge cases (invalid input, timeout, etc.)
- [ ] Document bugs and create tickets

**Test Scenarios:**
```
Scenario 1: Teacher marks attendance for multiple batches
Scenario 2: Student queries schedule then payment link
Scenario 3: Parent inquires about enrollment
Scenario 4: Admin sends broadcast to 100 users
Scenario 5: Network failure mid-conversation
Scenario 6: Session expires, user resumes later
```

**Deliverables:**
- Test report with pass/fail results
- Bug list prioritized by severity
- Test documentation

---

### Day 30: Performance Optimization
**Owner:** Backend Developer + DevOps

**Tasks:**
- [ ] Profile application performance (memory, CPU)
- [ ] Optimize database queries (add indexes if needed)
- [ ] Implement caching for frequent queries
- [ ] Optimize OpenAI prompt tokens (reduce cost)
- [ ] Load test with 100 concurrent users (Artillery/k6)
- [ ] Monitor response times (target: p95 < 2 seconds)

**Deliverables:**
- Performance test results
- Optimization recommendations implemented
- Caching strategy documented

---

### Phase 3 Milestones

✅ **Milestone 3.1:** All tests passing (End of Week 6)  
✅ **Milestone 3.2:** Performance targets met (End of Week 6)

---

## Phase 4: Admin Dashboard & Deployment (Week 7)

### Day 31-32: Admin Dashboard - Broadcast Interface
**Owner:** Frontend Developer

**Tasks:**
- [ ] Create broadcast UI in admin dashboard
- [ ] Form to compose message
- [ ] Recipient selector (all students, all teachers, custom)
- [ ] Schedule send time (optional)
- [ ] Preview message before sending
- [ ] Send button triggers POST /api/whatsapp/broadcast
- [ ] Display delivery status

**Deliverables:**
- Broadcast feature in admin dashboard
- Admin can send messages to groups

---

### Day 33: Admin Dashboard - Analytics
**Owner:** Frontend Developer

**Tasks:**
- [ ] Create analytics page
- [ ] Display key metrics:
  - Total messages sent/received
  - Active users (DAU, MAU)
  - Intent distribution (pie chart)
  - Response time histogram
- [ ] Fetch data from backend API
- [ ] Auto-refresh every 30 seconds

**Deliverables:**
- Analytics dashboard with charts
- Real-time data updates

---

### Day 34-35: Deployment Setup
**Owner:** DevOps Engineer

**Tasks:**
- [ ] Set up Vercel project
- [ ] Configure environment variables in Vercel dashboard
- [ ] Set up custom domain (whatsapp.hsm-school.com)
- [ ] Configure SSL certificate
- [ ] Set up GitHub Actions for CI/CD
- [ ] Create staging and production environments
- [ ] Deploy to staging and test

**Deliverables:**
- Staging environment live
- CI/CD pipeline working
- Auto-deploy on git push

**GitHub Actions Workflow:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
```

---

### Phase 4 Milestones

✅ **Milestone 4.1:** Admin dashboard complete (End of Week 7)  
✅ **Milestone 4.2:** Deployed to staging (End of Week 7)

---

## Phase 5: Pilot & Launch (Weeks 8-9)

### Week 8: Pilot Testing

#### Day 36-37: Pilot User Onboarding
**Owner:** Project Manager

**Tasks:**
- [ ] Select pilot users (2 teachers, 10 students, 1 admin)
- [ ] Send onboarding email with instructions
- [ ] Conduct 30-minute training session (Zoom/in-person)
- [ ] Send welcome message via WhatsApp
- [ ] Share FAQ document and video tutorial

**Deliverables:**
- Pilot users trained and ready
- Support channel set up (WhatsApp group or Slack)

---

#### Day 38-40: Pilot Testing & Feedback
**Owner:** QA Engineer + Product Manager

**Tasks:**
- [ ] Monitor pilot users' interactions
- [ ] Track key metrics:
  - Adoption rate (% using WhatsApp)
  - Error rate
  - Response time
  - User satisfaction (NPS survey)
- [ ] Collect feedback via survey
- [ ] Conduct 1-on-1 interviews with pilot users
- [ ] Identify bugs and UX issues

**Deliverables:**
- Pilot test report
- Bug list with priorities
- User feedback summary
- Go/no-go decision for full launch

---

#### Day 41-42: Bug Fixes & Improvements
**Owner:** Backend Developer + Frontend Developer

**Tasks:**
- [ ] Fix critical bugs from pilot
- [ ] Implement quick UX improvements
- [ ] Update message templates based on feedback
- [ ] Re-test fixed issues
- [ ] Deploy fixes to staging and re-test

**Deliverables:**
- All critical bugs fixed
- P0/P1 improvements implemented
- Staging environment stable

---

### Week 9: Production Launch

#### Day 43: Production Deployment
**Owner:** DevOps Engineer + Backend Developer

**Tasks:**
- [ ] Final smoke tests on staging
- [ ] Run database migrations on production
- [ ] Deploy to production
- [ ] Verify all environment variables
- [ ] Test webhook endpoint with real WhatsApp messages
- [ ] Monitor logs and error rates closely (first 2 hours)

**Deployment Checklist:**
- [ ] Backup production database
- [ ] Run migrations: `npm run migrate:prod`
- [ ] Deploy code: `vercel --prod`
- [ ] Test webhook: Send test message
- [ ] Verify Redis connection
- [ ] Check OpenAI API calls working
- [ ] Monitor Datadog/Sentry for errors

**Deliverables:**
- Production deployment successful
- All services healthy

---

#### Day 44-45: Gradual Rollout
**Owner:** Product Manager

**Tasks:**
- [ ] **Phase 1:** Onboard all teachers (5 teachers)
  - Send welcome message
  - Training session
  - Support for first week
- [ ] **Phase 2:** Onboard students in batches (50 per day)
  - Send welcome message
  - FAQs shared
- [ ] **Phase 3:** Full onboarding (all users)
- [ ] Monitor adoption rate daily
- [ ] Address support tickets promptly

**Communication Schedule:**
- Day 44 morning: Email to teachers
- Day 44 afternoon: WhatsApp welcome message to teachers
- Day 45 morning: Email to students
- Day 45 afternoon: WhatsApp welcome message (batch 1)
- Day 46: WhatsApp welcome (batch 2)
- Day 47: WhatsApp welcome (batch 3)

**Deliverables:**
- All users onboarded
- Support tickets resolved
- Adoption tracking dashboard

---

#### Day 46-47: Monitoring & Optimization
**Owner:** DevOps Engineer + Backend Developer

**Tasks:**
- [ ] Monitor key metrics 24/7 for first 3 days
- [ ] Set up alerts for critical issues
- [ ] Analyze usage patterns
- [ ] Optimize based on real-world data
- [ ] Scale infrastructure if needed (upgrade Vercel plan)

**Metrics to Watch:**
- Error rate (target: <1%)
- Response time p95 (target: <2 seconds)
- WhatsApp API delivery rate (target: >95%)
- User adoption rate (target: >60% for teachers)

**Deliverables:**
- Stable production system
- Metrics within target ranges
- Incident response plan tested (if any issues arise)

---

#### Day 48: Post-Launch Review
**Owner:** All Team Members

**Tasks:**
- [ ] Conduct post-launch retrospective
- [ ] Review what went well and what didn't
- [ ] Document lessons learned
- [ ] Create backlog for Phase 2 enhancements
- [ ] Celebrate success! 🎉

**Deliverables:**
- Post-launch report
- Retrospective notes
- Updated roadmap for next features

---

### Phase 5 Milestones

✅ **Milestone 5.1:** Pilot testing complete with positive feedback (End of Week 8)  
✅ **Milestone 5.2:** Production launch successful (Day 43)  
✅ **Milestone 5.3:** All users onboarded (Day 45)  
✅ **Milestone 5.4:** System stable and metrics healthy (End of Week 9)

---

## Success Criteria Summary

### Technical Success Criteria
- ✅ Bot responds to messages within 2 seconds (p95)
- ✅ Intent detection accuracy > 80%
- ✅ Error rate < 1%
- ✅ Uptime > 99.5%
- ✅ WhatsApp message delivery rate > 95%

### Business Success Criteria
- ✅ 60%+ teachers use WhatsApp for attendance (within 1 month)
- ✅ 30%+ students use WhatsApp for queries
- ✅ Positive user feedback (NPS > 40)
- ✅ Reduce attendance marking time by 50%
- ✅ Increase payment collection rate by 20%

### Adoption Targets
| Milestone | Teachers | Students | Timeframe |
|-----------|----------|----------|-----------|
| Week 1 | 20% | 5% | End of launch week |
| Week 2 | 50% | 15% | 2 weeks post-launch |
| Month 1 | 60% | 30% | 1 month post-launch |
| Month 3 | 80% | 50% | 3 months post-launch |

---

## Risk Management

### High-Priority Risks

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| WhatsApp verification delay (>7 days) | High | Start early (Week 1 Day 1) | PM |
| OpenAI API cost overruns | Medium | Set budget alerts, optimize prompts | Backend Dev |
| Low user adoption | High | Training, incentives, ongoing support | PM |
| Critical bug in production | High | Thorough testing, rollback plan | DevOps |
| Performance issues at scale | Medium | Load testing, auto-scaling | DevOps |

---

## Resource Allocation

### Backend Developer (6 weeks full-time)
- Week 1-2: Foundation (webhook, sessions, intent detection)
- Week 3-5: Core features (handlers, API integration)
- Week 6: Testing support and optimization
- Week 7: Deployment support
- Week 8-9: Bug fixes, monitoring

### Frontend Developer (2 weeks part-time)
- Week 7: Admin dashboard (broadcast + analytics)
- Week 8-9: UI improvements based on feedback

### DevOps Engineer (2 weeks part-time)
- Week 2: Environment setup
- Week 7: Deployment and CI/CD
- Week 8-9: Monitoring and scaling

### QA Engineer (3 weeks full-time)
- Week 5: Create test plan
- Week 6: Execute tests
- Week 8: Pilot testing and UAT

### Project Manager (ongoing part-time)
- Week 1-9: Requirements, coordination, stakeholder updates
- Week 8-9: User onboarding and training

---

## Budget Breakdown by Phase

| Phase | Duration | Development Cost | Infrastructure Cost | Total |
|-------|----------|------------------|---------------------|-------|
| Phase 1 | 2 weeks | $2,400 | $0 | $2,400 |
| Phase 2 | 3 weeks | $4,800 | $50 | $4,850 |
| Phase 3 | 1 week | $1,500 | $20 | $1,520 |
| Phase 4 | 1 week | $1,500 | $50 | $1,550 |
| Phase 5 | 2 weeks | $2,000 | $100 | $2,100 |
| **Total** | **9 weeks** | **$12,200** | **$220** | **$12,420** |

**Note:** This is MVP budget. Full Year 1 budget including maintenance is $18,249 (see COST_ANALYSIS.md)

---

## Communication Plan

### Weekly Standups (Every Monday)
- **Attendees:** All team members
- **Duration:** 30 minutes
- **Agenda:** Progress update, blockers, plan for week

### Bi-Weekly Demos (End of Weeks 2, 4, 6, 8)
- **Attendees:** Team + stakeholders (school admin, 1-2 teachers)
- **Duration:** 45 minutes
- **Agenda:** Demo new features, gather feedback

### Daily Slack Updates
- **Channel:** #whatsapp-chatbot-dev
- **Format:** Brief text update on progress and blockers

### Launch Communication (Week 9)
- **Email announcement:** To all users (teachers, students, parents)
- **WhatsApp welcome message:** To each user individually
- **FAQ document:** Published on school website
- **Video tutorials:** Shared via email and WhatsApp

---

## Documentation Deliverables

### Week 2
- [ ] API Documentation (Swagger/OpenAPI spec)
- [ ] Database Schema Documentation

### Week 6
- [ ] Developer Onboarding Guide
- [ ] Deployment Runbook

### Week 8
- [ ] User Guide for Teachers (PDF + Video)
- [ ] User Guide for Students (PDF + Video)
- [ ] Admin Dashboard Manual

### Week 9
- [ ] FAQ Document
- [ ] Troubleshooting Guide
- [ ] Post-Launch Report

---

## Maintenance & Support (Post-Launch)

### Immediate Support (First 2 Weeks)
- **On-call:** Backend developer available 9 AM - 9 PM
- **Response Time:** Critical issues < 1 hour
- **Support Channel:** WhatsApp group for pilot users

### Ongoing Support (Month 1+)
- **Business Hours:** 9 AM - 6 PM Mon-Sat
- **Response Time:** Critical < 2 hours, Normal < 24 hours
- **Support Channels:** 
  - Email: whatsapp-support@hsm-school.com
  - WhatsApp: Dedicated support number
  - Dashboard: In-app help chat

### Monthly Maintenance (Hours per Month)
- Bug fixes: 10 hours
- New features: 8 hours
- Monitoring: 5 hours
- **Total:** 23 hours/month (~$690/month)

---

## Future Enhancements Roadmap (Post-MVP)

### Q2 2026 (3-6 Months After Launch)
- Voice message support
- Multilingual support (Hindi, Telugu)
- Student progress reports via WhatsApp
- Advanced analytics dashboard

### Q3 2026 (6-9 Months After Launch)
- AI tutoring (basic music theory Q&A)
- Event management (RSVPs for recitals)
- Feedback collection (post-class NPS)
- Integration with external calendar apps

### Q4 2026 (9-12 Months After Launch)
- Gamification (attendance streaks, badges)
- Parent portal integration
- Video lessons via WhatsApp
- Advanced payment workflows (installments)

---

## Appendix: Key Contacts

### Meta/WhatsApp Support
- Documentation: [developers.facebook.com/docs/whatsapp](https://developers.facebook.com/docs/whatsapp)
- Support: Business Manager Help Center

### OpenAI Support
- Documentation: [platform.openai.com/docs](https://platform.openai.com/docs)
- Support: help.openai.com

### Vercel Support
- Documentation: [vercel.com/docs](https://vercel.com/docs)
- Support: vercel.com/support

### Internal Team
- Project Manager: [pm@hsm-school.com]
- Backend Lead: [dev@hsm-school.com]
- DevOps: [devops@hsm-school.com]

---

**Document Status:** ✅ Ready for Execution  
**Last Updated:** January 18, 2026  
**Next Review:** Weekly during implementation  
**Owner:** Project Manager
