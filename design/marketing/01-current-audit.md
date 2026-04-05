# 01 — Current Landing Page Audit

## Page Structure (from LandingPage.tsx source)

### Navbar
- Logo (HSM_Logo_Horizontal.png), dark/light mode aware
- Nav links: Curriculum, Our Instructors, Success
- Actions: Sign In (outline button), Book Trial (CTA button), Dark mode toggle
- **Gap:** No phone number, no WhatsApp icon, no location anchor

### Section 1: Hero
**Headline:** "Discover Your True Musical Voice."
**Subheadline:** "From eager beginners to advanced artists, HSM offers a nurturing environment to perfect your craft with world-renowned instructors."
**CTAs:** "Start Your Music Journey" (primary) + "Explore Programs" (secondary)
**Visual:** Piano image (static)

| Issue | Impact |
|---|---|
| Headline is generic — every music school says something similar | Low differentiation |
| No Hyderabad/location mention in hero | Poor local SEO + trust |
| Static image instead of video | Missed emotional engagement |
| "world-renowned instructors" — unsubstantiated claim | Trust damage if no evidence below |
| Two equal-weight CTAs compete with each other | Reduced primary CTA clicks |

### Section 2: Social Proof Logos
Trinity College London, Berklee College of Music, Royal Academy, Juilliard School
**Verdict:** ✅ Good aspirational positioning — but needs context ("Our students have gone on to..."). Currently reads as if HSM is affiliated with these institutions, which could mislead.

### Section 3: Curriculum (id="curriculum")
**Headline:** "Unlocking Learning Potential"
**Copy:** "Every student is unique. We tailor our private and group lessons..."
**Bullets:** Personalised 1-on-1, Interactive group labs, Bi-annual showcase recitals
**Image:** Guitar (static)
**CTA:** "Take Private Lessons"

| Issue | Impact |
|---|---|
| No mention of which instruments are taught | Visitor doesn't know if their instrument is available |
| Generic benefits (every school claims personalisation) | No differentiation |
| "Bi-annual showcase recitals" is the most specific claim — bury it! | Should be prominent social proof |

### Section 4: Faculty (id="faculty")
**Headline:** "Nurturing Their Artistic Talent"
**Copy:** "Our instructors aren't just teachers; they are active touring musicians..."
**Badge:** "15+ Dedicated Maestros"
**Image:** Vocals (static)
**CTA:** "Meet Our Instructors" → links to #curriculum (broken! Should link to a faculty section)

| Issue | Impact |
|---|---|
| No teacher names, photos, or bios | Zero personal trust signal |
| "active touring musicians, recording artists, symphony players" — unverified | Could feel hollow without proof |
| CTA links to wrong section | UX failure |

### Section 5: Success (id="success")
**Headline:** "The Power of Perseverance"
**Copy:** "Learning music builds grit and determination. Join our ensemble..."
**Image:** Drums (static)
**CTA:** "Take Group Lessons"

| Issue | Impact |
|---|---|
| No actual student success stories | Section title promises "success" but delivers generic copy |
| No testimonials, no before/after | Missed conversion opportunity |

### Section 6: Footer CTA (id="trial")
**Headline:** "Begin your musical journey today."
**CTA:** "Schedule a Free Trial"
**Verdict:** ✅ Exists — but lacks urgency and social proof near the decision point

### Real Footer
Logo, Explore links (Curriculum, Faculty, Ensembles), Connect links (Contact Us, Enrollment, Careers)
**Gap:** No address, no phone, no social media links, no copyright/year

---

## Trial Booking Modal
**Fields:** Full Name (required), Address, Phone (required), Email, Instrument (select), How did you hear about us (select)

| Issue | Impact |
|---|---|
| `address` field at first touch creates friction | Reduces form completions |
| Instrument select has disabled "Select an instrument..." | Some browsers show this as selected value — UX bug |
| No WhatsApp opt-in | Misses primary Indian communication channel |
| Success message disappears after 2 seconds | Visitor doesn't know what happens next |
| No follow-up expectation set ("We'll call you within 24 hours") | Anxiety post-submission |

---

## What's Completely Missing

| Missing Element | Business Impact |
|---|---|
| Teacher names + photos + bios | Trust — parents choose teachers before schools |
| Student testimonials | Conversion — social proof is #1 conversion driver |
| Instrument showcase (all 8) | Awareness — visitors don't know the full offering |
| Pricing (even "Starting from ₹XXXX") | Conversion — pricing anxiety kills decisions |
| Class schedule | Conversion — "Can I even attend?" is unanswered |
| FAQ | Reduces friction for hesitant parents |
| Google Maps / location | Trust + local SEO |
| WhatsApp button | Indian market expectation |
| Social media links | Brand extension + following |
| Video content | Emotional engagement — critical for performing arts |
| Google review badge | Social proof + local SEO signal |

---

## Competitor Benchmark

| Feature | HSM | Philips School of Music | Fusion School of Music |
|---|---|---|---|
| Teacher profiles | ❌ | ✅ | ✅ |
| Video content | ❌ | Partial | ✅ |
| Pricing visible | ❌ | ❌ | Partial |
| WhatsApp button | ❌ | ✅ | ✅ |
| Testimonials | ❌ | ✅ | ✅ |
| Instrument showcase | ❌ | ✅ | ✅ |
| Instagram active | ⚠️ Low | ✅ | ✅ |
| Google reviews | ⚠️ Few | ✅ | ✅ |

**Verdict:** HSM has a strong USP (dual classical + western) but presents it worse than all major competitors. Page redesign alone can close most of this gap.

---

## Digital Presence Summary

**Justdial:** 4.9★ (24 reviews) — Bandlaguda Jagir-Kismatpura location listed (Opposite Kritunga Restaurant)
**Instagram:** @hyderabadschoolofmusic — 133 followers, 170 posts, low engagement
**Facebook:** Business page exists (needs audit)
**Google Business:** Needs claim/optimisation verification
**YouTube:** Not found — opportunity
**UrbanPro / Sulekha:** Listings may exist but likely unclaimed
