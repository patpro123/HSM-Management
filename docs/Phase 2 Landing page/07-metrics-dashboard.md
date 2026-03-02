# 07 — Metrics Dashboard

## Philosophy

Measure what matters for a local music school: **trial bookings**, **enrollment conversion**, and **retention**. Avoid vanity metrics (total Instagram impressions, Facebook page likes) unless they connect to these outcomes.

---

## Primary KPIs (The Only Numbers That Really Matter)

| KPI | Baseline | 30-day Target | 90-day Target | How to Measure |
|---|---|---|---|---|
| Monthly trial bookings | Unknown — set baseline in Week 1 | Baseline + 20% | Baseline + 40% | Prospects table in admin dashboard |
| Trial → enrollment rate | Unknown | Measure first | >30% | (Enrolled in 60 days) ÷ (trial bookings) |
| Active enrolled students | ~100 (est.) | Maintain | +15% | Students table (active enrollments) |
| Monthly churn (students who leave) | Unknown | Measure first | <5%/month | Lapsed/completed enrollments per month |
| WhatsApp enquiries | 0 (new channel) | 5+/month | 15+/month | WhatsApp Business message count |

---

## Channel Metrics

### Google & Local SEO

| Metric | Tool | Target (90 days) |
|---|---|---|
| Google Business impressions | Google Business Profile dashboard | Trending up month-on-month |
| Calls from GBP | GBP dashboard → Calls | 20+/month |
| Direction requests | GBP dashboard → Directions | 10+/month |
| Google reviews count | GBP / Google Search | 25+ reviews |
| Average rating | Google | Maintain 4.5+ |
| Organic search clicks | Google Search Console | Trending up |
| Target keyword rankings | Search Console / manual check | Appear in top 10 for "music school Hyderabad" |

**How to check keyword rankings (free):**
Open a fresh Incognito browser window → search "music classes Hyderabad" → note HSM's position. Do this for 5 target keywords monthly and log results.

---

### Website Analytics (Google Analytics 4)

| Metric | Target (Month 1) | Target (Month 3) |
|---|---|---|
| Monthly unique visitors | Set baseline | +50% vs Month 1 |
| Trial form submissions | Set baseline | +40% vs Month 1 |
| Form conversion rate | Measure | >3% (industry: 1–5%) |
| Bounce rate | Measure | <65% |
| Time on page | Measure | >1m 30s |
| Top traffic source | Measure | Organic or social |
| Mobile vs desktop split | Measure | Expect 70%+ mobile |

**Events to track in GA4:**
- `trial_form_submitted` — trigger on successful form POST
- `whatsapp_click` — trigger on WhatsApp button click
- `phone_click` — trigger on click-to-call links
- `instrument_card_click` — trigger on "Enquire" from instrument cards

**Conversion funnel to monitor:**
```
Landing page visit
    → Hero CTA click (or instrument card click)
        → Trial modal open
            → Trial form submitted ✅
```

Drop-off at each step tells you what to fix next.

---

### Instagram

| Metric | Baseline | 30-day | 90-day | Tool |
|---|---|---|---|---|
| Followers | 133 | 200 | 500+ | Instagram Insights |
| Reach per Reel | Measure | 500+ avg | 1,500+ avg | Instagram Insights |
| Reels plays | Measure | Trending up | Trending up | Instagram Insights |
| Profile link clicks | Measure | 20+/month | 50+/month | Instagram Insights |
| Story views | Measure | 50+ avg | 150+ avg | Instagram Insights |
| DMs received | Measure | 5+/month | 15+/month | WhatsApp Business / DM count |

**What to look at weekly:**
- Which Reel got the most reach? → Create more like it
- Are profile visits going up? → Good sign
- Are link-in-bio clicks happening? → Shows intent

**What NOT to obsess over:**
- Likes (saves and shares matter more for reach)
- Follower count alone (without checking if they're local)

---

### Facebook

| Metric | Target | Tool |
|---|---|---|
| Page reach | Trending up | Facebook Page Insights |
| Event RSVPs | 20+ per Showcase | Facebook Events |
| Group members (HSM Families) | 30+ enrolled families | Facebook Groups |
| WhatsApp clicks from Facebook | Measure | Meta Business Suite |

---

### WhatsApp Business

| Metric | Target | How to Track |
|---|---|---|
| Inbound enquiries/month | 15+ by Month 3 | Manual count in WhatsApp Business |
| Opt-ins from trial form | Track monthly | Prospects table (whatsapp_consent field) |
| Broadcast open rate | >60% (WhatsApp is high) | WhatsApp Business analytics |
| Response rate | 100% within 4 hours | Internal SLA |

---

## Conversion Funnel Dashboard

Track this monthly in a simple spreadsheet or the HSM admin dashboard:

```
Month: ___________

AWARENESS
  Instagram reach (total): ________
  Website visitors:         ________
  GBP impressions:          ________

INTEREST
  Trial form opens:         ________
  WhatsApp enquiries:       ________
  Phone calls (from GBP):   ________

CONVERSION
  Trial bookings submitted: ________
  Trials conducted:         ________  (% of submitted: ___%)
  Enrolled after trial:     ________  (% of conducted: ___%)

RETENTION
  Active students (end of month): ________
  Students who paused/left:       ________
  Churn rate:                     ____%

REVENUE PROXY
  New enrollments × avg monthly fee: ₹________
  Renewals this month:               ₹________
```

---

## Review Cadence

| Frequency | Review | Owner |
|---|---|---|
| Daily | Trial bookings submitted yesterday | Admin |
| Weekly | Instagram reach + Reels performance | Marketing owner |
| Weekly | WhatsApp enquiries received | Admin |
| Monthly | Full funnel: visitor → trial → enrolled → retained | Admin |
| Monthly | GBP: calls, directions, reviews | Admin |
| Monthly | GA4: traffic sources, conversion rate, top pages | Admin |
| Quarterly | Cohort analysis: do students from Instagram convert differently than Google? | Admin |

---

## 90-Day Dashboard Template

| Metric | Month 1 | Month 2 | Month 3 | Trend |
|---|---|---|---|---|
| Trial bookings | — | — | — | — |
| Trial → enrolled % | — | — | — | — |
| Active students | — | — | — | — |
| Instagram followers | 133 | — | — | — |
| Google reviews | ~4 | — | — | — |
| GBP calls | — | — | — | — |
| Website visitors | — | — | — | — |
| Form conversion % | — | — | — | — |
| WhatsApp enquiries | 0 | — | — | — |

**Fill in Month 1 baseline in Week 1** before any changes are made — this is your before/after comparison point.

---

## Red Flags (Act Immediately If You See These)

| Signal | Likely Cause | Action |
|---|---|---|
| Trial bookings drop 2 months in a row | Posting stopped / offer changed | Review posting schedule + reactivate campaign |
| Form conversion rate <1% | Too many fields / page load slow | Simplify modal, run PageSpeed test |
| Instagram reach declining | Not using Reels / inconsistent posting | Post Reel immediately, check posting schedule |
| No WhatsApp enquiries for 2 weeks | Button broken or not visible | Test WhatsApp link, move button above fold |
| Google reviews not growing | Never asked families | Send review request broadcast immediately |
| High trial booking, low enrollment | Follow-up call not happening | Enforce 24h call SLA for every trial booking |

---

## Tools Summary

| Tool | Cost | Purpose |
|---|---|---|
| Google Analytics 4 | Free | Website traffic + conversions |
| Google Search Console | Free | SEO + keyword rankings |
| Google Business Profile | Free | Local SEO + reviews + GBP stats |
| Instagram Insights | Free | Reach, followers, Reel performance |
| Meta Business Suite | Free | Facebook + Instagram unified analytics |
| WhatsApp Business | Free | Enquiry tracking + broadcasts |
| Microsoft Clarity | Free | Heatmaps + session recordings on website |
| HSM Admin Dashboard | In-repo | Trial bookings, enrollment, student data |
| Spreadsheet (Google Sheets) | Free | Monthly funnel consolidation |
