# Domain Migration Plan
## Separate Admin Portal + Public Site — Zero Cost

**Goal:**
- `hsm.org.in` → Public-facing landing page (SEO-optimised, eventually Next.js)
- `portal.hsm.org.in` → Admin portal (existing React SPA, unchanged)
- `api.hsm.org.in` → Backend API (optional but clean for future)

**Cost:** $0 — uses existing GoDaddy domain, Vercel free tier, Render free tier.

---

## Current Architecture

```
[Browser]
    │
    ▼
hsm-management.vercel.app         ← React SPA (landing + admin in one app)
    │
    └── /api/* → hsm-management.onrender.com   ← Express backend
```

**Problem:** Everything is on Vercel's auto-generated domain. Googlebot can't index
the landing page because it's client-side rendered. No branded domain.

---

## Target Architecture

```
[Browser]
    │
    ├── hsm.org.in              → Vercel Project A (landing page — Next.js, SSG)
    │
    ├── portal.hsm.org.in       → Vercel Project B (admin React SPA — existing)
    │
    └── api.hsm.org.in          → Render backend (optional custom domain)
```

---

## Phase 1: Migrate Admin Portal to portal.hsm.org.in
*Prerequisite for Phase 2 — do this first.*
*Estimated time: ~30 minutes. Zero cost.*

### Step 1 — Add custom domain in Vercel

1. Go to [vercel.com](https://vercel.com) → your project (`hsm-management` or similar)
2. Settings → Domains → Add Domain
3. Enter: `portal.hsm.org.in`
4. Vercel will show you a DNS record to add — it will look like:

   | Type  | Name   | Value                  |
   |-------|--------|------------------------|
   | CNAME | portal | cname.vercel-dns.com   |

5. Keep this tab open.

### Step 2 — Add DNS record in GoDaddy

1. Log into [GoDaddy](https://godaddy.com) → My Products → DNS → `hsm.org.in`
2. Click **Add New Record**
3. Fill in:
   - **Type:** CNAME
   - **Name:** `portal`
   - **Value:** `cname.vercel-dns.com`
   - **TTL:** 600 (10 min, so changes propagate fast)
4. Save.

### Step 3 — Verify in Vercel

1. Back in Vercel → Domains — click **Verify** or wait ~2–5 minutes
2. Vercel auto-provisions a free SSL certificate (Let's Encrypt)
3. Test: visit `https://portal.hsm.org.in` — you should see the app

### Step 4 — Update VITE_API_BASE_URL (if needed)

Currently the frontend falls back to `https://hsm-management.onrender.com`. No
change needed for Phase 1 since the backend URL doesn't change — the portal just
gets a new domain on top.

If you later move the backend to `api.hsm.org.in`, update in Vercel:
- Project Settings → Environment Variables
- `VITE_API_BASE_URL` = `https://api.hsm.org.in`

### Step 5 — (Optional) Redirect old Vercel domain

In Vercel, you can mark `portal.hsm.org.in` as the primary domain. The old
`*.vercel.app` URL will redirect automatically.

---

## Phase 2: Public Landing Page on hsm.org.in
*Do this after Phase 1 is stable. Requires the Next.js migration.*

### DNS setup for apex domain (hsm.org.in)

Apex domains (no subdomain) cannot use CNAME records in standard DNS.
GoDaddy supports an **A record** pointing to Vercel's IP.

In GoDaddy DNS, add:

| Type  | Name | Value         | TTL |
|-------|------|---------------|-----|
| A     | @    | 76.76.21.21   | 600 |
| CNAME | www  | cname.vercel-dns.com | 600 |

> `76.76.21.21` is Vercel's anycast IP — stable, no cost, no sign-up needed.
> The `www` CNAME ensures `www.hsm.org.in` also works and redirects to apex.

Then in Vercel (new project for the Next.js landing page):
- Settings → Domains → Add `hsm.org.in` and `www.hsm.org.in`
- Set `hsm.org.in` as primary (www redirects to it)

### What the Next.js project will look like

```
frontend-landing/           ← new Next.js project (separate from frontend-enroll)
├── app/
│   ├── layout.tsx          ← <html>, <head> with SEO meta tags
│   ├── page.tsx            ← LandingPage component (copy from current)
│   └── sitemap.ts          ← auto-generated sitemap.xml
├── components/
│   └── LandingPage/        ← same 12 components, copied verbatim
├── public/
└── next.config.ts
```

Key differences from current Vite app:
- `getStaticProps` fetches teachers + batches at build time → full HTML for Google
- `<head>` gets proper title, description, OG tags, JSON-LD schema
- Same CSS (`LandingPage.css`) copied over — no visual changes
- Booking modal + Cleff chatbot remain client-side (unchanged)

---

## Phase 3: (Optional) Backend on api.hsm.org.in

Render.com free tier supports one custom domain per service.

1. In Render dashboard → your backend service → Settings → Custom Domain
2. Add `api.hsm.org.in`
3. Render gives you a CNAME value — add to GoDaddy:

   | Type  | Name | Value                         | TTL |
   |-------|------|-------------------------------|-----|
   | CNAME | api  | your-service.onrender.com     | 600 |

4. Update `VITE_API_BASE_URL` in Vercel env vars for both projects:
   - `portal.hsm.org.in` → `https://api.hsm.org.in`
   - `hsm.org.in` → `https://api.hsm.org.in` (Next.js uses this at build + runtime)

---

## Cost Breakdown

| Service         | What you use          | Cost  |
|-----------------|-----------------------|-------|
| GoDaddy         | Domain you already own| $0    |
| Vercel          | Free tier (2 projects)| $0    |
| Render.com      | Free tier (backend)   | $0    |
| Neon PostgreSQL | Free tier (DB)        | $0    |
| SSL certs       | Let's Encrypt via Vercel/Render | $0 |
| **Total**       |                       | **$0/mo** |

> Vercel free tier: unlimited deployments, custom domains, 100 GB bandwidth/mo.
> Render free tier: 750 instance hours/mo (enough for 1 always-on service), custom domain.

---

## Visual Changes Summary

| Phase | Change | Visual Impact |
|-------|--------|---------------|
| Phase 1 | Admin portal moves to `portal.hsm.org.in` | None — same app, new URL |
| Phase 2 | Landing page on `hsm.org.in` via Next.js | None — same components, same CSS |
| Phase 3 | Backend on `api.hsm.org.in` | None — internal URL only |

---

## Execution Checklist

### Phase 1 (Do today — ~30 min)
- [ ] Add `portal.hsm.org.in` custom domain in Vercel
- [ ] Add CNAME record in GoDaddy (`portal` → `cname.vercel-dns.com`)
- [ ] Wait for DNS propagation + Vercel SSL (2–10 min)
- [ ] Verify `https://portal.hsm.org.in` loads the app
- [ ] Verify Google login still works (check OAuth redirect URIs — see note below)

### Phase 1 — Google OAuth note
When you add a new domain, you must add it to your **Google Cloud Console**
OAuth allowed redirect URIs:
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Click your OAuth 2.0 client
3. Under "Authorised redirect URIs", add:
   `https://portal.hsm.org.in/api/auth/google/callback`
4. Under "Authorised JavaScript origins", add:
   `https://portal.hsm.org.in`
5. Save — takes ~5 minutes to propagate

### Phase 2 (After Phase 1 stable — ~1 day)
- [ ] Scaffold `frontend-landing/` Next.js project
- [ ] Copy 12 LandingPage components + CSS
- [ ] Wire `getStaticProps` for teachers + batches
- [ ] Add SEO meta tags to `layout.tsx`
- [ ] Create new Vercel project for `frontend-landing/`
- [ ] Add A record in GoDaddy (`@` → `76.76.21.21`)
- [ ] Add `hsm.org.in` + `www.hsm.org.in` in new Vercel project
- [ ] Verify `https://hsm.org.in` loads landing page
- [ ] Test Google crawl with [Google Search Console](https://search.google.com/search-console)

### Phase 3 (Optional — ~20 min)
- [ ] Add custom domain in Render dashboard
- [ ] Add CNAME in GoDaddy (`api` → Render CNAME)
- [ ] Update `VITE_API_BASE_URL` in both Vercel projects
- [ ] Redeploy both frontend projects
