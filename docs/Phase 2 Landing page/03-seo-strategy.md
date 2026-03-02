# 03 — SEO Strategy

## Priority: Local SEO First

For a physical music school in Hyderabad, local SEO delivers the fastest, highest-quality leads. A parent searching "guitar classes near me" or "music school Hyderabad" is already in buying mode.

---

## 1. Google Business Profile (GBP)

**Status:** Needs full audit — may be unclaimed or incomplete.

### Steps to optimise:
1. Claim/verify the listing at business.google.com
2. **Category:** Primary = "Music School", Secondary = "Performing Arts School"
3. **Name:** Hyderabad School of Music (exact, no keyword stuffing)
4. **Address:** Flat No 1, 3rd Floor, House No 7-214, Abhyudaya Nagar, Kishan Nagar Colony, Bandlaguda Jagir-Kismatpura, Hyderabad 500086
5. **Phone:** Add primary + WhatsApp number
6. **Website:** https://hsm-management.vercel.app (or custom domain when available)
7. **Hours:** Tue–Fri 5PM–9PM, Sat 3PM–9PM, Sun 10AM–1PM & 5PM–9PM, Mon CLOSED
8. **Photos to upload:** Exterior, reception, classrooms per instrument, teacher photos, student performances (10+ photos minimum)
9. **Services list:** Add each of the 8 instruments as a service
10. **Attributes:** "Identifies as women-led" (if applicable), "Online classes available"
11. **Weekly Google Posts:** Every week, post an update (student achievement, upcoming event, instrument spotlight)
12. **FAQ on GBP:** Answer "How much do classes cost?", "Do you offer trial classes?", "What age do you accept?"

### Review Campaign
- **Target:** 25+ reviews within 30 days
- **Approach:** WhatsApp message to all current enrolled families:
  > "Hi [Name], we'd love your feedback on Google! It takes 2 minutes and really helps other families find us. Here's the link: [direct Google review link]"
- **Incentive:** "Leave a review and get your next month 10% off" (use sparingly, against Google TOS if too explicit — keep it soft)
- **Respond to every review** — both positive and negative — within 24 hours

---

## 2. On-Page SEO for Landing Page

### Meta Tags to Add (in index.html or via react-helmet)

```html
<title>Music Classes in Hyderabad | Hyderabad School of Music — Guitar, Tabla, Piano & More</title>
<meta name="description" content="Join Hyderabad School of Music in Kismatpur for expert music classes — Guitar, Tabla, Piano, Drums, Vocals & more. First demo class FREE. Book now." />
<meta name="keywords" content="music classes Hyderabad, guitar classes Hyderabad, tabla classes Hyderabad, music school Kismatpur, piano lessons Hyderabad, Hindustani vocals Hyderabad" />
<link rel="canonical" href="https://hsm.org.in" />
```

### Open Graph Tags (for social sharing)
```html
<meta property="og:title" content="Hyderabad School of Music — Your First Class is Free" />
<meta property="og:description" content="8 instruments, expert teachers, and a free first class. Kismatpur, Hyderabad." />
<meta property="og:image" content="[URL to hero image or logo]" />
<meta property="og:url" content="https://hsm.org.in" />
<meta property="og:type" content="website" />
```

### LocalBusiness Structured Data (JSON-LD)
Add inside `<head>` of index.html:
```json
{
  "@context": "https://schema.org",
  "@type": "MusicSchool",
  "name": "Hyderabad School of Music",
  "image": "https://hsm.org.in/HSM_Logo_Horizontal.png",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Flat No 1, 3rd Floor, House No 7-214, Abhyudaya Nagar, Kishan Nagar Colony",
    "addressLocality": "Bandlaguda Jagir-Kismatpura",
    "addressRegion": "Hyderabad",
    "postalCode": "500086",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 17.3326,
    "longitude": 78.3927
  },
  "url": "https://hsm.org.in",
  "telephone": "+91XXXXXXXXXX",
  "priceRange": "₹₹",
  "openingHours": ["Tu-Fr 17:00-21:00", "Sa 15:00-21:00", "Su 10:00-13:00", "Su 17:00-21:00"],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "24"
  }
}
```

---

## 3. Target Keywords

### Tier 1 — High Intent (book now)
| Keyword | Monthly Searches (est.) | Competition |
|---|---|---|
| music classes in Hyderabad | High | High |
| music school Hyderabad | High | High |
| guitar classes Hyderabad | Medium | Medium |
| tabla classes Hyderabad | Medium | Low |
| piano lessons Hyderabad | Medium | Medium |
| hindustani vocal classes Hyderabad | Low | Low |

### Tier 2 — Research phase
| Keyword | Intent |
|---|---|
| best music school in Hyderabad | Comparison |
| music classes for kids Hyderabad | Parent research |
| learn guitar Hyderabad | Learner research |
| online music classes Hyderabad | Distance learner |
| music school near Kismatpur | Hyper-local |
| music school near Suncity Hyderabad | Hyper-local |
| music school near Rajendra Nagar | Nearby area |

### Tier 3 — Long tail (blog content)
- "How long does it take to learn tabla?"
- "Should my child learn guitar or keyboard first?"
- "Best age to start Carnatic vocal training"
- "Online vs offline music classes for kids"

---

## 4. Listing Sites to Claim

| Platform | Action |
|---|---|
| Justdial | ✅ Exists — update photos, respond to reviews, add instruments list |
| UrbanPro | Claim/create — very active for music tutors in Hyderabad |
| Sulekha | Claim/create — strong local service search traffic |
| IndiaMart | Not critical for music schools, skip |
| Google Maps | Optimise GBP (covered above) |
| Facebook Business | Fully populate — address, hours, category, services |
| Bing Places | Mirror Google Business listing (10 min setup) |

---

## 5. Technical SEO Checklist

- [ ] Page loads in <2 seconds on mobile (test at PageSpeed Insights)
- [ ] All images served as WebP with width/height attributes
- [ ] Lazy loading on below-fold images
- [ ] HTTPS (already on Vercel ✅)
- [ ] Mobile-responsive (test on 375px width minimum)
- [ ] No broken links (fix the "Meet Our Instructors" → #curriculum bug)
- [ ] Add Google Analytics 4 tracking (measure all trial form submissions as conversion events)
- [ ] Add Hotjar or Microsoft Clarity (free heatmap tool — see where users drop off)

---

## 6. Content SEO — Blog Articles (Month 2+)

Create a simple `/blog` or `/guides` section. These pages will rank for long-tail searches and drive organic traffic over time.

**Priority articles:**
1. "5 Benefits of Learning Tabla for Children" (targets: "tabla for kids", "tabla classes Hyderabad")
2. "Guitar vs Keyboard: Which Should Your Child Learn First?" (targets: comparison queries)
3. "Hindustani vs Carnatic Vocals: Understanding the Difference" (educational, low competition)
4. "How to Choose a Music School in Hyderabad: A Parent's Guide" (commercial intent, broad)
5. "Online vs In-Person Music Classes: What Works Best?" (high search intent, pandemic-era habit)

Each article: 600–900 words, one internal CTA to book demo, one relevant image.
