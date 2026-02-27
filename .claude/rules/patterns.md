# Common Patterns

## Adding a New API Route

1. Create/edit file in `backend-enroll/routes/`
2. Register in `backend-enroll/index.js`: `app.use('/api/prefix', require('./routes/file'))`
3. Add TypeScript interfaces in `frontend-enroll/src/types.ts`
4. Call with `apiGet/apiPost/apiPut/apiDelete` from `frontend-enroll/src/api.ts`

## Adding a Database Migration

1. Create `db/migrations/00N_description.sql` (next sequential number)
2. Apply: `psql $DATABASE_URL < db/migrations/00N_description.sql`
3. Update `db/schema.sql` to reflect the new state

## Adding a Frontend Tab

1. Add tab key to the union type in `App.tsx`
2. Add menu item (with role check) to the sidebar
3. Add render condition in the main content area
4. Create/import the component

## Environment Variables

Backend: `backend-enroll/.env` — see `.env.example`
Frontend: `frontend-enroll/.env` — only `VITE_API_BASE_URL`

## Deployment

Push to `main` auto-deploys both frontend (Vercel) and backend (Render).
DB migrations must be applied manually via `psql`.
