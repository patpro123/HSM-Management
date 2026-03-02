# 02 — Landing Page Redesign Specifications

## Design Principles
- **Mobile-first:** 82%+ of Indian internet traffic is mobile; every section must be thumb-friendly
- **Conversion-first:** Every section has one job — move the visitor closer to booking
- **Authenticity over polish:** Real student photos/videos beat stock imagery every time
- **Speed:** Target <2s load on 4G; use WebP images, lazy loading, no heavy libraries

---

## Section 1: Navbar

### Current → New
| Element | Current | New |
|---|---|---|
| Logo | ✅ Keep | ✅ Keep |
| Nav links | Curriculum, Instructors, Success | Programs, Teachers, Stories, Schedule |
| Left of Sign In | Nothing | 📱 +91 XXXXX XXXXX (click-to-call on mobile) |
| CTA | "Book Trial" | "Book Free Class" (more specific) |
| Mobile | Sign In hidden on small screens | WhatsApp icon instead of full phone |

**Sticky navbar:** Ensure it remains visible on scroll with a subtle box shadow.

---

## Section 2: Hero — Major Redesign

### Layout
```
┌─────────────────────────────────────────────────────┐
│  [VIDEO BACKGROUND — 15s looping, muted]            │
│  Dark overlay 50%                                   │
│                                                     │
│  Hyderabad's Home for Music                         │
│  8 instruments. Expert teachers.                    │
│  Your first class is free.                          │
│                                                     │
│  [Book Your Free Demo Class →]  [See Programs ↓]   │
│                                                     │
│  ⭐ 4.9★  |  100+ Students  |  8 Instruments       │
│  📍 Kismatpur, Hyderabad                            │
└─────────────────────────────────────────────────────┘
```

### Copy
- **H1:** "Hyderabad's Home for Music"
- **Subheadline:** "8 instruments. Expert teachers. Your first class is free."
- **Primary CTA:** "Book Your Free Demo Class →" (orange, full-width on mobile)
- **Secondary CTA:** "See Our Programs ↓" (ghost button, scroll anchor to #programs)
- **Trust strip:** ⭐ 4.9★ Rating · 100+ Active Students · 8 Instruments · Kismatpur, Hyderabad

### Video Content (to be recorded)
15-second montage: guitar chord → tabla beat → vocal note → students smiling → HSM logo
Shot on phone in good natural light is sufficient for initial launch.

---

## Section 3: Instrument Showcase — New

### Headline: "What Would You Like to Learn?"
### Sub: "Classical Indian. Contemporary Western. Under one roof."

8 cards in a 4×2 grid (2×4 on mobile):

| Card | Icon | "Why Learn?" copy | CTA |
|---|---|---|---|
| Keyboard | 🎹 | Build musical foundations fast — ideal first instrument | Enquire |
| Piano | 🎹 | Classical elegance; read music, compose, perform | Enquire |
| Guitar | 🎸 | Most popular worldwide — acoustic to electric | Enquire |
| Drums | 🥁 | Rhythm, coordination, and confidence on stage | Enquire |
| Tabla | 🪘 | India's heartbeat — rhythm, tradition, discipline | Enquire |
| Violin | 🎻 | Versatile across classical, folk, and film music | Enquire |
| Hindustani Vocals | 🎤 | North Indian classical — raga, taal, expression | Enquire |
| Carnatic Vocals | 🎤 | South Indian classical — precise, devotional, powerful | Enquire |

Each "Enquire" button opens the trial modal pre-filled with that instrument.

---

## Section 4: Why HSM — 4 Value Props

### Headline: "Why families choose HSM"

```
[🎓 Expert Teachers]    [🎵 8 Instruments]
10+ faculty trained     India's most complete
at leading music        music school offering
conservatories          classical + western

[🆓 First Class Free]   [🏡 Community-First]
No commitment.          Bi-annual recitals,
No credit card.         workshops & events
Just music.             in Hyderabad
```

---

## Section 5: Meet Our Teachers — New

### Headline: "Learn from working musicians"
### Sub: "Our teachers are performers first, educators always."

Teacher card layout (pull from backend `/api/teachers`):
```
[Photo — 80×80px circle]
Name: Ravi Kumar
Speciality: Guitar · Drums
Experience: 8 years teaching
Quote: "Every student has music inside them — I just help bring it out."
```

Display 4 cards on desktop, 2 on mobile with "See all teachers →" link.

**Content needed from admin:** For each teacher — headshot, full name, instruments, years teaching, one personal quote.

---

## Section 6: Student Testimonials — New

### Headline: "What our families say"

Carousel of 5 cards (auto-advance every 4 seconds, manual arrows):
```
"My daughter went from complete beginner to performing on stage
 in just 6 months. The teachers at HSM are incredibly patient."
— Priya M., parent of Tabla student

[★★★★★]
```

**Content needed:** 5-7 testimonials collected from current families via WhatsApp or Google Form. Offer 1 free class in exchange for a written or video testimonial.

---

## Section 7: Alumni / Aspiration (Refine Existing)

### Headline: "Our students go on to achieve great things"
Keep Trinity, Berklee, Royal Academy, Juilliard logos.
Add beneath: 3 student achievement photos (blurred names if privacy needed) + instruments.

---

## Section 8: Class Schedule Overview — New

### Headline: "Find your perfect slot"

Simple table:
| Instrument | Days | Timings | Age Group |
|---|---|---|---|
| Guitar | Tue, Thu | 5PM–8PM | All ages |
| Tabla | Sat, Sun | 10AM–1PM | 6+ |
| Hindustani Vocals | Tue, Thu, Sat | 5PM–9PM | All ages |
| ... | ... | ... | ... |

Source: Pull from `GET /api/batches` (already exists in backend).
Add badge: "Online classes available for all instruments"
CTA: "Book your slot →" (scroll to trial modal)

---

## Section 9: FAQ — New

Accordion-style, 6 questions:

1. **Does my child need prior experience?**
   Not at all. We start from the very beginning and move at your child's pace.

2. **What age groups do you teach?**
   We welcome students from age 5 to 60+. Music has no age limit.

3. **Are online classes available?**
   Yes — all 8 instruments are available online and in-person at our Kismatpur centre.

4. **How soon will my child play a real song?**
   Most students play their first song within 4–6 weeks. We make early wins a priority.

5. **What is the monthly fee?**
   Classes start from ₹XXXX/month. Your first demo class is completely free.

6. **What if we need to pause or stop?**
   No problem. We have a flexible pause policy — life happens and we understand.

---

## Section 10: Location + Contact — New

### Headline: "Come visit us in Kismatpur"

Two columns:
- Left: Google Maps embed (Flat No 1, 3rd Floor, House No 7-214, Abhyudaya Nagar, Bandlaguda Jagir-Kismatpura, Hyderabad 500086)
- Right:
  ```
  📍 Flat No 1, 3rd Floor, House No 7-214
     Abhyudaya Nagar, Kishan Nagar Colony
     Bandlaguda Jagir-Kismatpura
     Hyderabad — 500086
     (Opposite Kritunga Restaurant)

  📱 +91 XXXXX XXXXX

  [WhatsApp us now →]   [Call us →]
  ```

WhatsApp button: `https://wa.me/91XXXXXXXXXX?text=Hi%20HSM%2C%20I%27d%20like%20to%20book%20a%20demo%20class`

---

## Section 11: Footer CTA (Enhance Existing)

### Headline: "Your first class is free. No strings attached."
### Sub: "Limited demo slots available each week."
### CTA: "Book Your Free Demo Now →"

Footer links: add Instagram, Facebook, YouTube icons + © 2026 Hyderabad School of Music

---

## Trial Modal — Simplified

### Fields (in order):
1. **Full Name** * (required)
2. **Phone Number** * (required, tel input, +91 hint)
3. **Instrument of Interest** (select, pre-filled if opened from instrument card)
4. **Email** *(optional)*
5. **How did you hear about us?** *(optional)*
6. **WhatsApp opt-in checkbox:** "✓ It's ok to contact me on WhatsApp"

### Post-submission screen:
```
🎉 Demo class booked!
We'll call you within 24 hours to confirm your slot.

[Chat with us on WhatsApp →]
```

### Technical addition:
Read `?utm_source=instagram` (or google, facebook, whatsapp) from URL and auto-fill the `lead_source` field — zero user effort, full attribution data.
