# Design Documentation

All design, planning, and marketing artifacts for HSM. Not deployed code.

## Folders

### `phase2-landing-page/`
Design specs and prototypes for the Phase 2 public-facing landing page redesign.

Contains: component specs, 3 prototype variations (dark/light), color palette, asset images, content strategy.

**Status:** In progress — design phase.

---

### `phase2-oauth/`
Architecture and sequence diagrams for the Phase 2 OAuth enhancement.

Contains:
- `PHASE2_AUTH_DESIGN.md` — full auth flow design
- `PHASE2_AUTH_SEQUENCES.md` — sequence diagrams
- `er_diagram_phase2.*` — ER diagrams for new auth tables

**Status:** Planned — not yet implemented.

---

### `marketing/`
Marketing strategy and campaign documentation for the HSM website launch.

Contains: SEO strategy, social media playbook, campaign plans, metrics dashboard, redesign specs, roadmap.

**Status:** Planning phase.

---

### `DOMAIN_MIGRATION_PLAN.md`
Step-by-step plan to split the app across two domains using GoDaddy DNS + Vercel free tier.

- Phase 1: Admin portal → `portal.hsm.org.in` (~30 min, $0)
- Phase 2: Public landing page → `hsm.org.in` (Next.js SSG)
- Phase 3: Backend API → `api.hsm.org.in` (optional)

**Status:** Ready to execute Phase 1.
