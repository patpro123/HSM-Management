# Authentication & Authorization

## Auth Flow

```
Frontend → GET /api/auth/google → Google consent → callback
→ Backend upserts user + roles → generates JWT (7d) + refresh token (30d)
→ Redirects to frontend with ?token=<jwt>
→ Frontend stores in localStorage → sends Authorization: Bearer <jwt>
```

## Roles

`admin`, `teacher`, `parent`, `student` — stored in `user_roles` table (many-to-many).

Default role on first login: `parent`.

## Role Gating

```typescript
// Frontend — check user roles
const isAdmin = user?.roles?.includes('admin')
const isTeacher = user?.roles?.includes('teacher')
```

Backend RBAC middleware: `authorizeRole(['admin', 'teacher'])` on protected routes.

## Dev Bypass

```bash
DISABLE_AUTH=true DEV_PROFILE=admin node index.js
```

Profiles: `admin` (full access), `teacher` (teacher view), `student` (student view).

## Key Tables

| Table | Purpose |
|---|---|
| `users` | OAuth identities (Google ID, email, name) |
| `user_roles` | Role assignments (multi-role support) |
| `refresh_tokens` | Token rotation store |
| `login_history` | Audit trail |
| `teacher_users` | Links user accounts → teacher profiles |
| `student_guardians` | Links user accounts → student profiles |

## Token Details

- Access token: JWT, 7-day expiry, contains user ID + email + roles
- Refresh token: 30-day expiry, httpOnly cookie, rotation on use
- Refresh endpoint: `POST /api/auth/refresh`
