# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hyderabad School of Music (HSM) — full-stack school management system. Production-deployed MVP.

**Stack:** Node.js/Express backend | React 19 + TypeScript + Vite frontend | PostgreSQL (Neon) | TailwindCSS | Google OAuth + JWT

## Dev Commands

```bash
# Backend (runs on :3000)
cd backend-enroll && npm install && node index.js

# Frontend (runs on :5173, proxies /api to :3000)
cd frontend-enroll && npm install && npm run dev

# Local DB
docker compose up -d && ./scripts/start-db.sh

# Auth bypass for local dev
DISABLE_AUTH=true DEV_PROFILE=admin node index.js

# API tests
cd backend-enroll && node test-api.js

# Apply migration
psql $DATABASE_URL < db/migrations/00N_description.sql
```

## Key File Paths

| What | Path |
|---|---|
| Backend entry | `backend-enroll/index.js` |
| DB connection | `backend-enroll/db.js` |
| Auth middleware | `backend-enroll/auth/jwtMiddleware.js` |
| RBAC middleware | `backend-enroll/auth/rbacMiddleware.js` |
| Route modules | `backend-enroll/routes/*.js` (13 files) |
| Frontend entry | `frontend-enroll/src/App.tsx` |
| API wrappers | `frontend-enroll/src/api.ts` |
| Auth client | `frontend-enroll/src/auth.ts` |
| Types | `frontend-enroll/src/types.ts` |
| Components | `frontend-enroll/src/components/` (21 files) |
| DB schema (DDL) | `db/schema.sql` |
| Migrations | `db/migrations/` (001–014) |

## Production

| Service | Platform |
|---|---|
| Frontend | Vercel — auto-deploy on push to `main` |
| Backend | Render.com — auto-deploy on push to `main` |
| Database | Neon PostgreSQL (serverless, SSL required) |

## Rules

See `.claude/rules/` for detailed guidance on:
- `architecture.md` — Directory structure, data model, key relationships
- `api-routes.md` — All API endpoints reference
- `auth.md` — Authentication, roles, dev bypass
- `frontend.md` — React architecture, tabs, state flow
- `database.md` — Schema, migrations, business logic
- `patterns.md` — Common patterns for adding features
