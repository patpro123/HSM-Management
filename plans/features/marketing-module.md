# Feature Plan: Marketing & Brand Building Module

**Status:** In Progress (P0 Complete)
**Planned:** 2026-06-28
**Priority:** High
**Vision:** Build HSM's brand from zero to world-class — comparable to Furtados, True School, and top global music schools.

---

## Context

HSM has a fully operational school management system but no marketing infrastructure. Growth today is primarily word-of-mouth. The goal of this module is to turn HSM's operational data (students, attendance, evaluations, milestones, prospects) into a brand-building and growth engine.

**Critical insight from codebase audit:** Most of the hard plumbing already exists — a lead pipeline (Prospects), WhatsApp Cloud API, Gmail SMTP, a DB-backed landing-page CMS, a real-time notification bus, and a milestone/evaluation store. The Marketing module orchestrates these into funnels, content, and analytics rather than reinventing them.

---

## What Already Exists (Reuse, Don't Rebuild)

| Capability | Where it lives | Marketing reuse |
|---|---|---|
| Lead pipeline + lead source + status | `backend-enroll/routes/prospects.js`, `students.student_type`, `students.metadata` JSONB | The CRM core. Add scoring, attribution, funnel stages on top. |
| Exit-intent lead capture | `frontend-enroll/src/components/ExitIntentModal.tsx` | Soft-lead capture. Feed into nurture campaigns. |
| WhatsApp Cloud API (send/receive, opt-in, audit) | `backend-enroll/services/whatsappService.js`, `routes/whatsapp.js`, `db/migrations/032_whatsapp_contacts.sql` | Broadcast + campaign channel. Opt-in compliance already built. |
| Transactional email (Gmail SMTP) | `nodemailer` in `routes/prospects.js` | Newsletter/campaign sender (swap to ESP for scale). |
| Landing-page CMS | `routes/landing.js`, `db/migrations/051_landing_config_table.sql`, `components/LandingPage.tsx`, `components/PromoBanner.tsx` | Generalize into multi-section CMS + campaign landing pages. |
| Milestones / achievements / ratings | `db/migrations/005_add_student_evaluations.sql` (`milestone_reached`, `rating`) | Source for testimonials, spotlights, milestone celebrations. |
| Real-time + DB notifications | `routes/notifications.js` (SSE + `notifications` table) | Trigger milestone celebrations, internal lead alerts. |
| MOM sharing via WhatsApp groups | PTM module, `batches.whatsapp_group_link` (`migration 026`) | Community engagement channel already in use. |
| Gamification (XP, habits, homework) | `routes/xp.js`, `habits.js`, `homework.js` | Shareable progress = organic content engine. |
| File storage | `db/migrations/039_file_storage.sql`, `routes/files.js` | Recital videos, brand assets, creatives, testimonial media. |
| LLM agent infra | `routes/agent.js`, `chat.js`, `publicChat.js` | AI content suggestions, lead chatbot (P3). |

---

## User Stories

### Admin / Marketing Manager
- As an admin, I want to see the full prospect funnel (lead → demo → enrolled) so I know where we're losing people.
- As an admin, I want to know where every lead came from (Google, Instagram, referral, walk-in) so I know which channels to invest in.
- As an admin, I want to flag overdue prospect follow-ups automatically so no lead goes cold.
- As an admin, I want to manage testimonials from student evaluations so I have consented, ready-to-publish social proof.
- As an admin, I want a central brand asset library so all teachers and staff use the right logo, colors, and taglines.
- As an admin, I want to send targeted WhatsApp broadcasts to opted-in segments so I can run campaigns without spamming everyone.
- As an admin, I want to track campaign spend vs attributed enrollments so I know ROI.
- As an admin, I want milestone celebrations to auto-trigger so no student anniversary goes unacknowledged.
- As an admin, I want to collect Google reviews at the right moment (post-PTM, post-milestone) so our public reputation grows.
- As an admin, I want a content calendar for social posts so our brand presence is consistent.

### Teacher
- As a teacher, I want to see which of my students have shareable milestones so I can nominate them for spotlights.

### Student / Parent
- As a parent, I want to receive a shareable progress card on my child's anniversary/milestone so I can post it naturally.

---

## Feature Priority Matrix

### P0 — Launch (Weeks 1–4): Make the existing funnel measurable

| Feature | Effort | Impact | Notes |
|---|---|---|---|
| Marketing tab shell (admin-gated) | S | M | New `marketing` tab in `App.tsx` |
| UTM + referrer + referral capture | S | H | Extend `LandingPage.tsx` + `POST /api/prospects` |
| Funnel dashboard widget | M | H | `routes/marketing.js` aggregating `students` by stage |
| Lead scoring (heuristic) | S | H | Score on instrument, demo type, recency — stored in `metadata` |
| Follow-up SLA alerts | S | H | SSE notifications for prospects with no contact in 24/48h |
| Referral tracking | S | M | `referred_by_student_id` column on `students` |
| Testimonials manager | M | H | Promote high-rating `student_evaluations` with consent flag |
| Brand asset library | S | M | Admin UI over existing file storage |

### P1 — 3 Months: Activate owned channels

| Feature | Effort | Impact | Notes |
|---|---|---|---|
| WhatsApp broadcast/campaign manager | M | H | Segment + template send on `whatsappService.sendTemplate` |
| Email newsletter campaigns | M | H | Campaign + audience + send log; migrate to ESP before bulk |
| Content calendar + social scheduler | M | M | Manual-publish first; drafts, scheduling, status tracking |
| Campaign-specific landing pages | M | H | Generalize `landing_config` into named pages per instrument |
| Milestone celebration automation | M | H | Cron/worker on `student_evaluations` + enrollment dates |
| Review collection workflow | S | H | One-click WhatsApp template → Google/Justdial/Sulekha deep link |
| GA4 + Meta Pixel integration | S | M | Public landing page only — never in authenticated app |
| Campaign audience segmentation | M | M | Segment by instrument, status, enrollment age |

### P2 — 6 Months: Optimize and retain

| Feature | Effort | Impact | Notes |
|---|---|---|---|
| Student LTV calculation | M | H | Joins `payments` + `enrollments` over time |
| Cohort retention analysis | M | H | Monthly cohort dropout rates |
| Campaign ROI tracking | M | H | Spend entry per campaign vs attributed enrollments × LTV |
| NPS collection | S | M | Post-PTM / quarterly pulse via WhatsApp |
| Faculty showcase / public profiles | S | M | From `teachers.metadata` |
| Events & recital calendar | M | M | Public + internal event management |
| Alumni network management | S | M | `student_type = 'alumni'` segment + lifecycle campaigns |
| AI content suggestions | M | M | Marketing prompts on existing LLM infra |

### P3 — Future

| Feature | Effort | Notes |
|---|---|---|
| AI-generated shareable progress reports | L | Evaluations + XP + attendance → parent-shareable image/PDF |
| Lead qualification chatbot | L | Extend `routes/publicChat.js` |
| Loyalty / referral rewards ledger | M | Redemption ledger, tiered rewards |
| SEO / blog publishing engine | L | Public-rendered blog from `content_posts` |
| Drag-and-drop landing page builder | L | Visual editor for `landing_pages.sections` JSONB |
| Multi-touch attribution modeling | L | Probabilistic attribution across UTM + referral chains |

---

## Quick Wins (< 1 week each, ship first)

### QW-1: UTM capture on intake form (1–2 days)
- In `frontend-enroll/src/components/LandingPage.tsx`, read UTM params from `window.location.search` and `document.referrer` on mount.
- Pass as hidden fields to the existing `POST /api/prospects`.
- In `backend-enroll/routes/prospects.js`, persist `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `referrer` into `students.metadata` JSONB.
- **Outcome:** Every future lead has a tracked source. Zero schema changes.

### QW-2: Funnel snapshot widget (2–3 days)
- New `GET /api/marketing/funnel` endpoint in `routes/marketing.js`.
- Aggregates `students` by `student_type` + `metadata.status` into stage counts.
- Renders as stat cards in the new `MarketingDashboard.tsx`.
- **Outcome:** Live funnel visibility on existing data. No new tables.

### QW-3: Follow-up SLA alerts (2 days)
- `GET /api/marketing/overdue-prospects` — finds prospects with `student_type IN ('prospect', 'demo_day')` and no `prospect_notes` entry in the last 24/48h.
- Push into `notifications` table → SSE bus (`routes/notifications.js`) delivers to admin.
- **Outcome:** No more cold leads.

### QW-4: Testimonials from evaluations (3–4 days)
- New `marketing_testimonials` table (migration 053).
- Admin view lists `student_evaluations` with `rating >= 4` or non-null `milestone_reached`.
- "Promote" button copies to `marketing_testimonials` with `consent_obtained = false` flag until admin confirms parent consent.
- Published testimonials surface on the landing page.
- **Outcome:** Turns existing teacher feedback into marketing collateral instantly.

### QW-5: Google review nudge (1 day)
- On PTM completion or payment record, show admin a "Send review request" button.
- Calls `whatsappService.sendTemplate` with a pre-approved template and Google Business Profile deep link.
- Logs to new `review_requests` table (migration 058).
- **Outcome:** Builds public social proof at the highest-satisfaction moments.

---

## Database Migrations

All follow the sequential pattern in `db/migrations/`. Update `db/schema.sql` after each.

### `052_marketing_attribution.sql`
```sql
-- Referral graph
ALTER TABLE students ADD COLUMN referred_by_student_id UUID REFERENCES students(id);

-- GIN index for UTM / funnel queries on metadata
CREATE INDEX idx_students_metadata_gin ON students USING gin(metadata);

-- Convention: store in metadata JSONB —
-- utm_source, utm_medium, utm_campaign, utm_content,
-- landing_page, referrer, lead_score (int), funnel_stage (text)
```

### `053_marketing_testimonials.sql`
```sql
CREATE TABLE marketing_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  evaluation_id UUID REFERENCES student_evaluations(id) ON DELETE SET NULL,
  quote TEXT NOT NULL,
  author_name TEXT NOT NULL,
  instrument TEXT,
  media_url TEXT,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  is_published BOOLEAN NOT NULL DEFAULT false,
  consent_obtained BOOLEAN NOT NULL DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `054_brand_assets.sql`
```sql
CREATE TABLE brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('logo', 'color', 'tagline', 'photo', 'doc', 'template')),
  name TEXT NOT NULL,
  value TEXT,
  file_id UUID REFERENCES file_storage(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `055_marketing_campaigns.sql` (Phase 2)
```sql
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'social', 'landing', 'paid')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'archived')),
  scheduled_at TIMESTAMPTZ,
  template_name TEXT,
  subject TEXT,
  body TEXT,
  utm_campaign TEXT,
  spend_amount NUMERIC(10, 2) DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  segment_def JSONB NOT NULL,
  recipient_count INT DEFAULT 0
);

CREATE TABLE campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  phone TEXT,
  email TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  wa_message_id TEXT,
  sent_at TIMESTAMPTZ,
  error TEXT
);
-- wa_message_id links to whatsapp_messages for free delivery tracking via existing webhook
```

### `056_content_calendar.sql` (Phase 2)
```sql
CREATE TABLE content_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'youtube', 'blog', 'whatsapp_status', 'twitter')),
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'draft', 'approved', 'scheduled', 'published')),
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  media_urls JSONB DEFAULT '[]',
  linked_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `057_landing_pages.sql` (Phase 2)
```sql
CREATE TABLE landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  utm_campaign TEXT,
  view_count INT DEFAULT 0,
  lead_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Generalizes landing_config (051); existing config row can seed a 'default' slug
```

### `058_events_reviews_nps.sql` (Phase 2/3)
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recital', 'competition', 'festival', 'workshop', 'masterclass')),
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('google', 'justdial', 'sulekha')),
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'clicked', 'completed')),
  clicked_at TIMESTAMPTZ
);

CREATE TABLE nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment TEXT,
  source TEXT CHECK (source IN ('ptm', 'quarterly', 'post_milestone')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `059_marketing_views.sql` (Phase 3)
```sql
-- Funnel view
CREATE OR REPLACE VIEW marketing_funnel AS
SELECT
  COALESCE(metadata->>'funnel_stage', student_type) AS stage,
  COUNT(*) AS count,
  MIN(created_at) AS oldest_in_stage,
  MAX(created_at) AS newest_in_stage
FROM students
WHERE student_type IN ('prospect', 'demo_day', 'active', 'intentful_user')
GROUP BY 1;

-- Student LTV view
CREATE OR REPLACE VIEW student_ltv AS
SELECT
  s.id, s.name,
  COUNT(p.id) AS payment_count,
  COALESCE(SUM(p.amount), 0) AS total_paid,
  MIN(p.created_at) AS first_payment,
  MAX(p.created_at) AS last_payment,
  EXTRACT(MONTH FROM AGE(MAX(p.created_at), MIN(p.created_at))) + 1 AS months_active,
  COALESCE(SUM(p.amount), 0) / NULLIF(EXTRACT(MONTH FROM AGE(MAX(p.created_at), MIN(p.created_at))) + 1, 0) AS avg_monthly_revenue
FROM students s
LEFT JOIN payments p ON p.student_id = s.id
GROUP BY s.id, s.name;
```

---

## New Files to Create

| File | Purpose |
|---|---|
| `backend-enroll/routes/marketing.js` | Funnel, testimonials, brand assets, overdue prospects, campaigns |
| `frontend-enroll/src/components/marketing/MarketingDashboard.tsx` | Root marketing tab component |
| `frontend-enroll/src/components/marketing/FunnelWidget.tsx` | Lead funnel stat cards |
| `frontend-enroll/src/components/marketing/TestimonialsManager.tsx` | Promote evaluations → testimonials |
| `frontend-enroll/src/components/marketing/BrandAssetLibrary.tsx` | Upload/manage brand assets |
| `frontend-enroll/src/components/marketing/OverdueProspects.tsx` | Follow-up SLA alert list |
| `frontend-enroll/src/components/marketing/ContentCalendar.tsx` | Social post scheduler (P1) |
| `frontend-enroll/src/components/marketing/CampaignManager.tsx` | WhatsApp/email campaigns (P1) |
| `db/migrations/052_marketing_attribution.sql` | Referral column + GIN index |
| `db/migrations/053_marketing_testimonials.sql` | Testimonials table |
| `db/migrations/054_brand_assets.sql` | Brand asset table |
| `db/migrations/055_marketing_campaigns.sql` | Campaigns + sends tables (P1) |
| `db/migrations/056_content_calendar.sql` | Content posts table (P1) |
| `db/migrations/057_landing_pages.sql` | Multi-slug landing pages (P1) |
| `db/migrations/058_events_reviews_nps.sql` | Events, review requests, NPS (P2) |
| `db/migrations/059_marketing_views.sql` | Funnel + LTV SQL views (P3) |

## Files to Modify

| File | Change |
|---|---|
| `frontend-enroll/src/App.tsx` | Add `marketing` tab to union type + sidebar + render condition |
| `backend-enroll/index.js` | Register `app.use('/api/marketing', require('./routes/marketing'))` |
| `frontend-enroll/src/components/LandingPage.tsx` | Capture UTM params + referrer on mount, pass to intake form |
| `backend-enroll/routes/prospects.js` | Persist UTM + referrer into `metadata` on `POST /api/prospects` |
| `frontend-enroll/src/types.ts` | Add `Testimonial`, `BrandAsset`, `MarketingFunnel`, `Campaign` interfaces |
| `db/schema.sql` | Update after each migration |

---

## Integration Requirements

| Need | Service | Status |
|---|---|---|
| WhatsApp broadcasts | Meta WhatsApp Cloud API | Integrated — needs marketing templates pre-approved in Meta Business Manager |
| Email (bulk) | Gmail SMTP → Resend / Amazon SES / Brevo | SMTP exists; migrate before bulk sends (Gmail: 500/day limit) |
| Web analytics | Google Analytics 4 + Meta Pixel | Not present; add to public landing page only |
| UTM tracking | Native (capture → `metadata`) | No third party needed |
| Review collection | Google Business Profile deep links | Manual deep links; no API for v1 |
| Social auto-publish | Meta Graph API | Defer to P3; manual calendar in P1 |
| AI content / chatbot | Existing LLM infra (`routes/agent.js`) | Reuse; add marketing-specific system prompts |
| Recital video hosting | YouTube unlisted or Cloudinary | Prefer over DB blobs for large video |

**New environment variables** (add to `backend-enroll/.env.example`):
```
ESP_API_KEY=           # Email service provider API key
GA4_MEASUREMENT_ID=    # Google Analytics 4
META_PIXEL_ID=         # Meta Pixel
GOOGLE_REVIEW_URL=     # Google Business Profile review link
```

---

## Competitive Positioning

HSM's structural moat is already in the data — the Marketing module surfaces it:

| Proof point | Data source | Content angle |
|---|---|---|
| Trinity grade progression | `migration 019` | "Certified, graded outcomes — not just classes" |
| Small batch sizes | `batches.capacity` | "Your child gets real teacher attention" |
| XP + milestone gamification | `routes/xp.js`, `student_evaluations` | "Track every breakthrough, celebrate every win" |
| Consistent attendance | `attendance_records` | "Show up — we'll show up for you" |
| Real recital footage | File storage / YouTube | "Performance-ready from Day 1" |

**Against chains (Furtados, True School):** Personal attention, hyper-local community, individual milestone tracking.
**Against online (Unacademy, Ustaad):** In-person performance, teacher relationships, graded progression.
**Against local independents:** Structured curriculum, digital tracking, professional brand consistency.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| WhatsApp ban / template rejection | Only opt-in contacts (`whatsapp_contacts.is_opted_in` enforced); get templates pre-approved; throttle sends; separate marketing from transactional templates |
| Privacy / consent for minors | `consent_obtained` flag on all student-linked content; never auto-publish; guardian opt-in recorded in DB |
| Gmail 500/day send limit | Cap P1 volume; migrate to ESP (Resend/SES/Brevo) with SPF/DKIM before bulk |
| Brand inconsistency from ad hoc posts | Central `brand_assets` + approval workflow (`content_posts.status`) |
| Attribution garbage-in (free-text lead_source) | Structured UTM capture + controlled `lead_source` enum; GIN index on `metadata` |
| Analytics scripts degrading authenticated app | Load GA4/Pixel only on public landing page (`LandingPage.tsx`), never inside authenticated React app |
| Scope creep on small team | Strict phasing — P0 ships with almost zero new infra; each feature independently mergeable |

---

## Success Criteria

- [ ] Every new prospect has a tracked source — 0% "unknown" within 1 month of launch
- [ ] Funnel dashboard shows live conversion at each stage (lead → demo → enrolled)
- [ ] Follow-up SLA alerts reduce average time-to-first-contact for new prospects
- [ ] At least 10 consented testimonials published from existing evaluations
- [ ] WhatsApp broadcast respects opt-in / STOP with delivery tracking via existing webhook
- [ ] Milestone celebrations auto-trigger for 1-year anniversaries and grade completions
- [ ] Campaign ROI view links spend → attributed enrollments → LTV
- [ ] No student media published without `consent_obtained = true`
- [ ] Google review count increases by 20+ within 3 months

---

## Implementation Notes (P0)

- Migration files: `052_marketing_attribution.sql`, `053_marketing_testimonials.sql`, `054_brand_assets.sql`
- Route: `backend-enroll/routes/marketing.js` registered at `/api/marketing`
- Components: `frontend-enroll/src/components/marketing/` (MarketingDashboard, FunnelWidget, OverdueProspects, TestimonialsManager, BrandAssetLibrary)
- Commit: `d348ca4` — 2026-06-28
- **DB migrations must be applied manually:** `psql $DATABASE_URL < db/migrations/052_marketing_attribution.sql` etc.

## Build Order (when approved)

1. Migrations 052, 053, 054 (P0 schema — additive, safe to run immediately)
2. `backend-enroll/routes/marketing.js` — funnel, testimonials, brand assets, overdue prospects endpoints
3. Register route in `backend-enroll/index.js`
4. `MarketingDashboard.tsx` shell + tab wiring in `App.tsx`
5. `FunnelWidget.tsx` + `OverdueProspects.tsx` (QW-2, QW-3)
6. UTM capture in `LandingPage.tsx` + `prospects.js` (QW-1)
7. `TestimonialsManager.tsx` (QW-4)
8. Review nudge button (QW-5)
9. Brand asset library UI
10. P1 features: campaigns, content calendar, landing pages, milestone automation
