# 06 — Implementation Roadmap

## Approach

Work in three monthly sprints, each with a clear theme:
- **Month 1 (March–April 2026):** Foundation — fix the website, start social, collect early proof
- **Month 2 (April–May 2026):** Content & reach — build the SEO base, scale Instagram, launch referrals
- **Month 3 (May–June 2026):** Scale & measure — Summer Rhythm prep, first Showcase, review results

---

## Month 1 — Foundation (March–April 2026)

### Theme: Fix what's broken. Add what's missing. Start moving.

### Website (Priority 1 this month)

- [ ] **Update Hero section**
  - New headline: "Hyderabad's Home for Music"
  - New subheadline: "8 instruments. Expert teachers. Your first class is free."
  - Add trust strip: ⭐ 4.9★ · 100+ Students · 8 Instruments · Kismatpur
  - Replace static piano image with video background (even a 15s phone recording works)
  - CTAs: "Book Your Free Demo Class →" (primary) + "See Our Programs ↓" (secondary)

- [ ] **Add Instrument Showcase section** (8 cards, 4×2 grid)
  - Keyboard, Piano, Guitar, Drums, Tabla, Violin, Hindustani Vocals, Carnatic Vocals
  - Each card: instrument name + emoji icon + "Why learn?" copy + "Enquire" button
  - "Enquire" opens trial modal pre-filled with that instrument

- [ ] **Add "Why HSM" value props section**
  - 4 blocks: Expert Teachers, 8 Instruments, Free First Class, Community-First

- [ ] **Fix broken "Meet Our Instructors" link** (currently points to #curriculum)

- [ ] **Improve Trial Modal**
  - Remove `address` field (reduce friction)
  - Make email and "how did you hear" optional
  - Add WhatsApp opt-in checkbox
  - Post-submission: "We'll call you within 24 hours!" + WhatsApp chat link
  - Auto-capture UTM params from URL → `lead_source` field (zero user effort)

- [ ] **Add WhatsApp button** — floating bottom-right, links to WhatsApp Business chat
  - URL: `https://wa.me/91XXXXXXXXXX?text=Hi%20HSM%2C%20I%27d%20like%20to%20book%20a%20demo%20class`

- [ ] **Add SEO meta tags** (title, description, Open Graph, canonical)

- [ ] **Add LocalBusiness JSON-LD structured data** in `<head>` of index.html

- [ ] **Navbar update**
  - Add phone number (click-to-call) visible on desktop
  - Add WhatsApp icon on mobile (replace phone text)
  - Update CTA text: "Book Free Class" (was "Book Trial")

### Google Business Profile

- [ ] Claim/verify listing at business.google.com
- [ ] Set primary category: "Music School", secondary: "Performing Arts School"
- [ ] Add address, phone, website, hours (exact from spec)
- [ ] Upload 10+ photos: exterior, classrooms per instrument, teacher photos
- [ ] Add all 8 instruments as services
- [ ] Set up FAQ answers (fee, trial, age)
- [ ] Write first Google Post ("Free demo class available — book now")

### Review Campaign

- [ ] Create Google review direct link (Google Business → Get More Reviews)
- [ ] WhatsApp message to all current enrolled families asking for a Google review
  - Message template: see `03-seo-strategy.md`
- [ ] **Target:** 10+ new Google reviews by end of Month 1

### Social Media — Instagram

- [ ] Update Instagram bio (new text from playbook)
- [ ] Switch posting to 3x/week schedule starting Week 1
- [ ] Film first batch of Reels (minimum 4 — enough for 2 weeks)
  - 2× student spotlight Reels
  - 1× teacher intro Reel
  - 1× "Why music?" educational Reel
- [ ] Begin daily Stories (poll or behind-the-scenes)

### WhatsApp Business

- [ ] Create WhatsApp Business account
- [ ] Set up profile, auto-reply, and Quick Replies
- [ ] Build broadcast list of all current enrolled families

### Content Collection (Urgent)

- [ ] Contact 10 current families via WhatsApp — request a 2-sentence written testimonial
- [ ] Collect 1 headshot + bio from each teacher (name, instruments, years teaching, one quote)
- [ ] Confirm class schedule data (days, times, age groups) for all 8 instruments

---

## Month 2 — Content & Reach (April–May 2026)

### Theme: Fill in the remaining sections. Build organic reach. Launch referrals.

### Website Additions

- [ ] **Add Teacher Profiles section** (pull from backend `/api/teachers`)
  - 4 cards on desktop, 2 on mobile
  - Each card: circular photo, name, instrument specialities, years teaching, quote
  - "See all teachers →" expands or links to full list

- [ ] **Add Student Testimonials carousel**
  - 5 testimonial cards, auto-advance every 4s, manual arrows
  - Content collected in Month 1

- [ ] **Add Class Schedule Overview section**
  - Table: Instrument | Days | Times | Age Group
  - Source: `GET /api/batches` (already exists)
  - "Online classes available for all instruments" badge
  - CTA: "Book your slot →"

- [ ] **Add FAQ section** (accordion, 6 questions from spec)

- [ ] **Add Location + Contact section**
  - Embedded Google Map (Flat No 1, 3rd Floor, House No 7-214, Abhyudaya Nagar, Bandlaguda Jagir-Kismatpura)
  - Address block + landmark ("Opposite Kritunga Restaurant")
  - WhatsApp button + Call button

- [ ] **Enhance Footer**
  - Add Instagram, Facebook, YouTube icons
  - Add "© 2026 Hyderabad School of Music"
  - Add address line in footer

- [ ] **Update Alumni section** — add caption: "Our students have gone on to study at world-class institutions"

### SEO

- [ ] Submit sitemap to Google Search Console (if not already done)
- [ ] Claim/update listings on UrbanPro, Sulekha, Bing Places
- [ ] Update Justdial listing: add photos, respond to existing reviews, add instruments list
- [ ] Write first 2 blog articles:
  - "5 Benefits of Learning Tabla for Children"
  - "Guitar vs Keyboard: Which Should Your Child Learn First?"
- [ ] Run PageSpeed Insights test → fix any issues below 80 score on mobile

### Social Media — Instagram

- [ ] Maintain 3x/week Reel schedule
- [ ] Launch "Refer & Earn" campaign via WhatsApp broadcast and Instagram Story
- [ ] Outreach to 3 Hyderabad parent/mom influencers (DM offer: free month for a mention/reel)
- [ ] Analyse top 3 Reels from Month 1 → double down on what worked

### WhatsApp

- [ ] Send monthly newsletter to all enrolled families
- [ ] Send re-engagement message to any cold prospect leads from past 3 months
- [ ] Build separate broadcast list for prospects who didn't convert

### Facebook

- [ ] Fully populate Facebook Business page (photo, description, hours, services)
- [ ] Create "HSM Families" Facebook Group — invite all enrolled families
- [ ] Create Facebook Event for Month 3 Showcase

### Analytics Setup

- [ ] Add Google Analytics 4 to the landing page (free)
- [ ] Set up conversion event for trial form submission
- [ ] Install Hotjar or Microsoft Clarity (free) for heatmap data
- [ ] Review: where do visitors drop off? Which sections do they scroll past?

---

## Month 3 — Scale & Measure (May–June 2026)

### Theme: Summer Rhythm launch. First Showcase. Review the data.

### Summer Rhythm Camp

- [ ] Finalise camp format (duration, instruments, price)
- [ ] Build camp registration form (can reuse trial modal with "camp" instrument selection)
- [ ] Open registration 1 May — Instagram + Facebook + WhatsApp broadcast
- [ ] Outreach to 5–10 school WhatsApp groups via parent connections
- [ ] "Last 5 seats" urgency post in last 2 weeks before camp
- [ ] Plan mini-performance for final day — invite parents
- [ ] Film all performances (content for next 2 months of Reels)

### Student Showcase (Quarterly Event)

- [ ] Book venue (HSM premises or nearby community hall)
- [ ] Schedule performances: 1 student per instrument minimum
- [ ] Create Facebook Event + Instagram countdown
- [ ] WhatsApp broadcast to all contacts 2 weeks before
- [ ] Film event for Reels + testimonial collection

### Website

- [ ] Add Summer Rhythm camp section to landing page
- [ ] A/B test hero headline: "Hyderabad's Home for Music" vs "Your First Class Is Free" (use Clarity heatmap)
- [ ] Review and update testimonials with new quotes from Showcase event

### Analytics Review

- [ ] Pull Month 1–3 data from GA4:
  - Monthly unique visitors
  - Trial form submissions (conversion rate)
  - Top traffic sources (organic, direct, social)
  - Top-performing pages/sections
- [ ] Review Instagram growth: follower count, reach per Reel, saves
- [ ] Review Google Business: impressions, clicks, calls, direction requests
- [ ] Assess trial → enroll conversion rate (from prospects table in admin)
- [ ] Decision: which channel gets more investment in Month 4?

### Paid Ads Assessment

- [ ] Review readiness for Google Ads (local intent keywords)
- [ ] Review readiness for Facebook/Instagram Ads (retargeting website visitors)
- [ ] Minimum budget to test: ₹5,000/month; scale if ROAS is positive

---

## Quick Wins (Do This Week)

These take under an hour each and have immediate impact:

1. **Fix the broken "Meet Our Instructors" link** on the current page
2. **Add WhatsApp icon/button** to the landing page footer (even before the full redesign)
3. **Update Instagram bio** with new text and trial booking link
4. **Claim Google Business Profile** and add hours + phone + website
5. **Send WhatsApp review request** to 5 enrolled families you know well
6. **Remove `address` field from trial modal** — this alone may increase form completions
7. **Post first Instagram Reel** — film a 15-second student practice clip on your phone today

---

## Resource Requirements

| Item | Who | Cost |
|---|---|---|
| Landing page redesign | Developer (in-house via this repo) | ₹0 (dev time) |
| Video filming | Any smartphone, ring light | ₹1,500 (ring light) |
| Editing (Reels) | CapCut or InShot | ₹0 (free apps) |
| WhatsApp Business | WhatsApp app | ₹0 |
| Google Business | Google account | ₹0 |
| UrbanPro / Sulekha listings | Sign up + fill profile | ₹0 |
| Google Analytics 4 | Google account | ₹0 |
| Hotjar / Clarity | Free tier | ₹0 |
| Summer camp venue | HSM premises (Month 1) | ₹0 |
| Showcase venue | HSM or community hall | ₹3,000–5,000 |
| Facebook Ads (Month 2+) | Meta Ads Manager | ₹3,000–5,000/month |
| **Total Month 1** | | ~₹1,500 |
| **Total Month 2** | | ~₹3,000 |
| **Total Month 3** | | ~₹8,000–10,000 |
