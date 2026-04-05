# Authentication & Authorization Flow Diagrams

## Overview
This document contains sequence diagrams for all authentication and authorization flows in Phase 2.

---

## Diagram 1: Google OAuth Login Flow

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│  User    │     │  Frontend   │     │   Backend    │     │  Google OAuth│     │ Database │
│ (Browser)│     │  React App  │     │  Express API │     │   Service    │     │PostgreSQL│
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └──────┬───────┘     └────┬─────┘
     │                  │                    │                    │                  │
     │ 1. Click "Login │                    │                    │                  │
     │    with Google" │                    │                    │                  │
     ├────────────────>│                    │                    │                  │
     │                  │                    │                    │                  │
     │                  │ 2. Redirect to Google OAuth            │                  │
     │                  │    with client_id, scope, redirect_uri │                  │
     │                  ├────────────────────────────────────────>│                  │
     │                  │                    │                    │                  │
     │<─────────────────┴────────────────────────────────────────┤                  │
     │                  Google Login Page                         │                  │
     │                  (User enters credentials & grants consent)│                  │
     ├────────────────────────────────────────────────────────────>│                  │
     │                  │                    │                    │                  │
     │                  │ 3. OAuth Callback with authorization code                  │
     │                  │    /auth/google/callback?code=ABC123   │                  │
     │<─────────────────┴────────────────────────────────────────┤                  │
     │                  │                    │                    │                  │
     │                  │ 4. POST /api/auth/google/callback      │                  │
     │                  │    { code: "ABC123" }                  │                  │
     │                  ├────────────────────>│                  │                  │
     │                  │                    │                    │                  │
     │                  │                    │ 5. Exchange authorization code        │
     │                  │                    │    for access_token & id_token        │
     │                  │                    ├───────────────────>│                  │
     │                  │                    │                    │                  │
     │                  │                    │ 6. Return tokens + user profile       │
     │                  │                    │    {                                  │
     │                  │                    │      sub: "google_12345",             │
     │                  │                    │      email: "user@gmail.com",         │
     │                  │                    │      name: "John Doe",                │
     │                  │                    │      picture: "https://..."           │
     │                  │                    │    }                                  │
     │                  │                    │<───────────────────┤                  │
     │                  │                    │                    │                  │
     │                  │                    │ 7. Query: SELECT * FROM users         │
     │                  │                    │    WHERE google_id = 'google_12345'   │
     │                  │                    ├──────────────────────────────────────>│
     │                  │                    │                    │                  │
     │                  │                    │ 8a. IF USER EXISTS: Return user data │
     │                  │                    │<──────────────────────────────────────┤
     │                  │                    │     Skip to step 12                   │
     │                  │                    │                    │                  │
     │                  │                    │ 8b. IF NEW USER:   │                  │
     │                  │                    │ BEGIN TRANSACTION  │                  │
     │                  │                    │                    │                  │
     │                  │                    │ 9. INSERT INTO users (                │
     │                  │                    │      google_id, email, name,          │
     │                  │                    │      profile_picture, email_verified, │
     │                  │                    │      is_active                        │
     │                  │                    │    ) VALUES (...)                     │
     │                  │                    ├──────────────────────────────────────>│
     │                  │                    │                    │                  │
     │                  │                    │ 10. INSERT INTO user_roles (          │
     │                  │                    │       user_id, role                   │
     │                  │                    │     ) VALUES (user_id, 'parent')      │
     │                  │                    ├──────────────────────────────────────>│
     │                  │                    │                    │                  │
     │                  │                    │ 11. COMMIT TRANSACTION                │
     │                  │                    │                    │                  │
     │                  │                    │ 12. Generate JWT:  │                  │
     │                  │                    │     payload = {                       │
     │                  │                    │       userId: uuid,                   │
     │                  │                    │       email: "...",                   │
     │                  │                    │       iat: now,                       │
     │                  │                    │       exp: now + 7d                   │
     │                  │                    │     }                                 │
     │                  │                    │     jwt = sign(payload, JWT_SECRET)   │
     │                  │                    │                    │                  │
     │                  │                    │ 13. Generate Refresh Token (UUID)     │
     │                  │                    │                    │                  │
     │                  │                    │ 14. INSERT INTO refresh_tokens (      │
     │                  │                    │       user_id, token, expires_at      │
     │                  │                    │     ) VALUES (..., now + 30d)         │
     │                  │                    ├──────────────────────────────────────>│
     │                  │                    │                    │                  │
     │                  │                    │ 15. INSERT INTO login_history (       │
     │                  │                    │       user_id, login_timestamp,       │
     │                  │                    │       ip_address, user_agent,         │
     │                  │                    │       login_method, success           │
     │                  │                    │     ) VALUES (..., true)              │
     │                  │                    ├──────────────────────────────────────>│
     │                  │                    │                    │                  │
     │                  │ 16. Response: {    │                    │                  │
     │                  │       accessToken: jwt,                 │                  │
     │                  │       refreshToken: uuid,               │                  │
     │                  │       user: {                           │                  │
     │                  │         id, email, name, roles,         │                  │
     │                  │         profile_picture                 │                  │
     │                  │       }                                 │                  │
     │                  │     }              │                    │                  │
     │                  │<────────────────────┤                    │                  │
     │                  │                    │                    │                  │
     │                  │ 17. Store tokens in localStorage:       │                  │
     │                  │     - accessToken (for API requests)    │                  │
     │                  │     - refreshToken (for token renewal)  │                  │
     │                  │     - user profile                      │                  │
     │                  │                    │                    │                  │
     │                  │ 18. Redirect based on role:             │                  │
     │                  │     - admin → /admin/dashboard          │                  │
     │                  │     - teacher → /teacher/dashboard      │                  │
     │                  │     - parent → /student-portal          │                  │
     │                  │                    │                    │                  │
     │ 19. Display      │                    │                    │                  │
     │     Dashboard    │                    │                    │                  │
     │<─────────────────┤                    │                    │                  │
     │                  │                    │                    │                  │
```

---

## Diagram 2: Authenticated API Request with Authorization

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  User    │     │  Frontend   │     │   Backend    │     │ Database │
│ (Teacher)│     │  React App  │     │  Express API │     │PostgreSQL│
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └────┬─────┘
     │                  │                    │                  │
     │ 1. Navigate to   │                    │                  │
     │    Attendance Tab│                    │                  │
     ├─────────────────>│                    │                  │
     │                  │                    │                  │
     │                  │ 2. GET /api/batches/my-today          │
     │                  │    Authorization: Bearer <JWT>        │
     │                  ├────────────────────>│                  │
     │                  │                    │                  │
     │                  │                    │ ════════════════════════════════════ │
     │                  │                    │ ║ AUTHENTICATION MIDDLEWARE        ║ │
     │                  │                    │ ════════════════════════════════════ │
     │                  │                    │                  │
     │                  │                    │ 3. Extract JWT from Authorization header
     │                  │                    │    token = req.headers.authorization  │
     │                  │                    │            .replace('Bearer ', '')    │
     │                  │                    │                  │
     │                  │                    │ 4. Verify JWT:   │                  │
     │                  │                    │    decoded = jwt.verify(token, SECRET)│
     │                  │                    │    → Extract userId, exp             │
     │                  │                    │                  │
     │                  │                    │ 5. Check expiration:                 │
     │                  │                    │    if (decoded.exp < now) {          │
     │                  │                    │      return 401 Unauthorized         │
     │                  │                    │    }                                 │
     │                  │                    │                  │
     │                  │                    │ 6. Query user & roles:               │
     │                  │                    │    SELECT u.*, array_agg(ur.role)    │
     │                  │                    │    FROM users u                      │
     │                  │                    │    JOIN user_roles ur ON u.id=ur.user_id│
     │                  │                    │    WHERE u.id = decoded.userId       │
     │                  │                    │    AND u.is_active = true            │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │ 7. User data:    │                  │
     │                  │                    │    {                                 │
     │                  │                    │      id, email, name,                │
     │                  │                    │      roles: ['teacher', 'parent']    │
     │                  │                    │    }                                 │
     │                  │                    │<─────────────────────────────────────┤
     │                  │                    │                  │
     │                  │                    │ 8. Attach to request:                │
     │                  │                    │    req.user = { ...userData }        │
     │                  │                    │    next() // Continue to next middleware│
     │                  │                    │                  │
     │                  │                    │ ════════════════════════════════════ │
     │                  │                    │ ║ AUTHORIZATION MIDDLEWARE         ║ │
     │                  │                    │ ════════════════════════════════════ │
     │                  │                    │                  │
     │                  │                    │ 9. Check role:   │                  │
     │                  │                    │    requiredRoles = ['admin', 'teacher']│
     │                  │                    │    hasRole = req.user.roles.some(r =>│
     │                  │                    │      requiredRoles.includes(r)       │
     │                  │                    │    )                                 │
     │                  │                    │    if (!hasRole) {                   │
     │                  │                    │      return 403 Forbidden            │
     │                  │                    │    }                                 │
     │                  │                    │                  │
     │                  │                    │ ════════════════════════════════════ │
     │                  │                    │ ║ DATA FILTERING MIDDLEWARE        ║ │
     │                  │                    │ ════════════════════════════════════ │
     │                  │                    │                  │
     │                  │                    │ 10. If role = 'teacher':             │
     │                  │                    │     Get teacher_id for this user     │
     │                  │                    │     SELECT teacher_id FROM teacher_users│
     │                  │                    │     WHERE user_id = req.user.id      │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │<─ teacher_id ────┤                  │
     │                  │                    │                  │
     │                  │                    │ ════════════════════════════════════ │
     │                  │                    │ ║ ROUTE HANDLER                    ║ │
     │                  │                    │ ════════════════════════════════════ │
     │                  │                    │                  │
     │                  │                    │ 11. Query batches:                   │
     │                  │                    │     SELECT b.*, i.name as instrument,│
     │                  │                    │            t.name as teacher_name    │
     │                  │                    │     FROM batches b                   │
     │                  │                    │     JOIN instruments i ON b.instrument_id=i.id│
     │                  │                    │     JOIN teachers t ON b.teacher_id=t.id│
     │                  │                    │     WHERE b.teacher_id = $1          │
     │                  │                    │     AND b.recurrence LIKE '%Tue%'    │
     │                  │                    │     (if today is Tuesday)            │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │ 12. Batches:     │                  │
     │                  │                    │     [                                │
     │                  │                    │       {                              │
     │                  │                    │         id, instrument: "Keyboard",  │
     │                  │                    │         recurrence: "Tue/Thu 5-6pm", │
     │                  │                    │         teacher_name: "Ravi Kumar"   │
     │                  │                    │       }                              │
     │                  │                    │     ]                                │
     │                  │                    │<─────────────────────────────────────┤
     │                  │                    │                  │
     │                  │ 13. Response: {    │                  │
     │                  │       batches: [...] }                │
     │                  │<────────────────────┤                  │
     │                  │                    │                  │
     │ 14. Display      │                    │                  │
     │     Today's      │                    │                  │
     │     Batches      │                    │                  │
     │<─────────────────┤                    │                  │
     │                  │                    │                  │
```

---

## Diagram 3: Authorization Failure Scenario

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  User    │     │  Frontend   │     │   Backend    │
│ (Parent) │     │  React App  │     │  Express API │
└────┬─────┘     └──────┬──────┘     └──────┬───────┘
     │                  │                    │
     │ 1. Try to access │                    │
     │    Teachers page │                    │
     ├─────────────────>│                    │
     │                  │                    │
     │                  │ 2. GET /api/teachers                
     │                  │    Authorization: Bearer <JWT>      
     │                  ├────────────────────>│              
     │                  │                    │              
     │                  │                    │ ═══════════════════════════════════
     │                  │                    │ ║ AUTHENTICATION: ✓ JWT Valid    ║
     │                  │                    │ ═══════════════════════════════════
     │                  │                    │              
     │                  │                    │ User: {              
     │                  │                    │   id: "uuid",              
     │                  │                    │   email: "parent@example.com",              
     │                  │                    │   roles: ['parent']              
     │                  │                    │ }              
     │                  │                    │              
     │                  │                    │ ═══════════════════════════════════
     │                  │                    │ ║ AUTHORIZATION: ✗ Role Check   ║
     │                  │                    │ ═══════════════════════════════════
     │                  │                    │              
     │                  │                    │ 3. Required roles: ['admin']
     │                  │                    │    User roles: ['parent']
     │                  │                    │              
     │                  │                    │ 4. Permission denied!
     │                  │                    │              
     │                  │ 5. 403 Forbidden   │              
     │                  │    {                              
     │                  │      "error": "Access denied",              
     │                  │      "message": "Admin role required",              
     │                  │      "requiredRoles": ["admin"],              
     │                  │      "userRoles": ["parent"]              
     │                  │    }                              
     │                  │<────────────────────┤              
     │                  │                    │              
     │                  │ 6. Display error toast:              
     │                  │    "Access Denied: Admin role required"              
     │                  │                    │              
     │                  │ 7. Redirect to /student-portal              
     │                  │                    │              
     │ 8. Show error    │                    │              
     │    message       │                    │              
     │<─────────────────┤                    │              
     │                  │                    │              
```

---

## Diagram 4: Admin Links Teacher to User Account

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Admin   │     │  Frontend   │     │   Backend    │     │ Database │
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └────┬─────┘
     │                  │                    │                  │
     │ 1. Navigate to   │                    │                  │
     │    User Management│                   │                  │
     ├─────────────────>│                    │                  │
     │                  │                    │                  │
     │                  │ 2. GET /api/admin/users/unlinked     │
     │                  │    Authorization: Bearer <JWT>        │
     │                  ├────────────────────>│                  │
     │                  │                    │                  │
     │                  │                    │ 3. Auth + Authorize (admin only)
     │                  │                    │                  │
     │                  │                    │ 4. Query:        │
     │                  │                    │    SELECT u.*, t.name as teacher_name│
     │                  │                    │    FROM users u  │
     │                  │                    │    LEFT JOIN teacher_users tu        │
     │                  │                    │      ON u.id = tu.user_id            │
     │                  │                    │    LEFT JOIN teachers t              │
     │                  │                    │      ON tu.teacher_id = t.id         │
     │                  │                    │    WHERE tu.id IS NULL               │
     │                  │                    │    (users without teacher link)      │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │ 5. Also query available teachers:    │
     │                  │                    │    SELECT t.*    │
     │                  │                    │    FROM teachers t                   │
     │                  │                    │    WHERE NOT EXISTS (                │
     │                  │                    │      SELECT 1 FROM teacher_users     │
     │                  │                    │      WHERE teacher_id = t.id         │
     │                  │                    │    )                                 │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │ 6. Return:         │                  │
     │                  │    {                                  │
     │                  │      unlinkedUsers: [...],            │
     │                  │      availableTeachers: [...]         │
     │                  │    }                                  │
     │                  │<────────────────────┤                  │
     │                  │                    │                  │
     │ 7. Display UI:   │                    │                  │
     │    - Dropdown: Select User            │                  │
     │    - Dropdown: Select Teacher         │                  │
     │    - Button: "Link Teacher Account"   │                  │
     │<─────────────────┤                    │                  │
     │                  │                    │                  │
     │ 8. Admin selects:│                    │                  │
     │    User: ravi@gmail.com               │                  │
     │    Teacher: Ravi Kumar                │                  │
     │    Clicks "Link" │                    │                  │
     ├─────────────────>│                    │                  │
     │                  │                    │                  │
     │                  │ 9. POST /api/admin/users/link-teacher│
     │                  │    {                                  │
     │                  │      user_id: "user-uuid",            │
     │                  │      teacher_id: "teacher-uuid"       │
     │                  │    }                                  │
     │                  ├────────────────────>│                  │
     │                  │                    │                  │
     │                  │                    │ 10. Auth + Authorize (admin only)
     │                  │                    │                  │
     │                  │                    │ 11. BEGIN TRANSACTION               │
     │                  │                    │                  │
     │                  │                    │ 12. Verify no existing link:        │
     │                  │                    │     SELECT * FROM teacher_users     │
     │                  │                    │     WHERE teacher_id = $1 OR user_id = $2│
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │<─ NULL (no conflict)                 │
     │                  │                    │                  │
     │                  │                    │ 13. INSERT INTO teacher_users (     │
     │                  │                    │       teacher_id, user_id,          │
     │                  │                    │       linked_by, linked_at          │
     │                  │                    │     ) VALUES ($1, $2, admin_id, now)│
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │ 14. INSERT INTO user_roles (        │
     │                  │                    │       user_id, role, granted_by     │
     │                  │                    │     ) VALUES (user_id, 'teacher', admin_id)│
     │                  │                    │     ON CONFLICT DO NOTHING          │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │ 15. INSERT INTO audit_log (         │
     │                  │                    │       actor_id, action, entity_type,│
     │                  │                    │       entity_id, payload            │
     │                  │                    │     ) VALUES (                      │
     │                  │                    │       admin_id,                     │
     │                  │                    │       'link_teacher_account',       │
     │                  │                    │       'teacher_user',               │
     │                  │                    │       link_id,                      │
     │                  │                    │       jsonb_build_object(...)       │
     │                  │                    │     )                               │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │ 16. COMMIT       │                  │
     │                  │                    │                  │
     │                  │ 17. Success:       │                  │
     │                  │     {                                 │
     │                  │       "message": "Teacher linked",    │
     │                  │       "teacherId": "...",             │
     │                  │       "userId": "...",                │
     │                  │       "userEmail": "ravi@gmail.com"   │
     │                  │     }                                 │
     │                  │<────────────────────┤                  │
     │                  │                    │                  │
     │ 18. Show success │                    │                  │
     │     toast        │                    │                  │
     │<─────────────────┤                    │                  │
     │                  │                    │                  │
     │ 19. Refresh user list                 │                  │
     │     (removes linked user from list)   │                  │
     │                  │                    │                  │
```

---

## Diagram 5: Parent Views Student Portal

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Parent  │     │  Frontend   │     │   Backend    │     │ Database │
└────┬─────┘     └──────┬──────┘     └──────┬───────┘     └────┬─────┘
     │                  │                    │                  │
     │ 1. After login   │                    │                  │
     │    redirect to   │                    │                  │
     │    /student-portal│                   │                  │
     │<─────────────────┤                    │                  │
     │                  │                    │                  │
     │                  │ 2. GET /api/portal/my-students       │
     │                  │    Authorization: Bearer <JWT>        │
     │                  ├────────────────────>│                  │
     │                  │                    │                  │
     │                  │                    │ 3. Auth (extract user_id)
     │                  │                    │    Authorize (role: parent)
     │                  │                    │                  │
     │                  │                    │ 4. Get student IDs for this parent:  │
     │                  │                    │    SELECT student_id                 │
     │                  │                    │    FROM student_guardians            │
     │                  │                    │    WHERE user_id = $1                │
     │                  │                    │    AND is_active = true              │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │<─ [student_id1, student_id2]         │
     │                  │                    │                  │
     │                  │                    │ 5. Get student details + enrollments:│
     │                  │                    │    SELECT s.*, e.classes_remaining,  │
     │                  │                    │           e.status, e.enrolled_on,   │
     │                  │                    │           array_agg(i.name) as instruments,│
     │                  │                    │           array_agg(b.recurrence) as schedules│
     │                  │                    │    FROM students s                   │
     │                  │                    │    JOIN enrollments e ON s.id=e.student_id│
     │                  │                    │    JOIN enrollment_batches eb        │
     │                  │                    │      ON e.id=eb.enrollment_id        │
     │                  │                    │    JOIN batches b ON eb.batch_id=b.id│
     │                  │                    │    JOIN instruments i                │
     │                  │                    │      ON b.instrument_id=i.id         │
     │                  │                    │    WHERE s.id = ANY($1)              │
     │                  │                    │    GROUP BY s.id, e.id               │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │ 6. Student data: │                  │
     │                  │                    │    [                                 │
     │                  │                    │      {                               │
     │                  │                    │        id, name: "Aarav Kumar",      │
     │                  │                    │        dob, phone,                   │
     │                  │                    │        enrollment: {                 │
     │                  │                    │          status: "active",           │
     │                  │                    │          classes_remaining: 25,      │
     │                  │                    │          instruments: ["Keyboard", "Guitar"],│
     │                  │                    │          schedules: ["Tue/Thu 5-6pm", ...]│
     │                  │                    │        }                             │
     │                  │                    │      }                               │
     │                  │                    │    ]                                 │
     │                  │                    │<─────────────────────────────────────┤
     │                  │                    │                  │
     │                  │ 7. Response:       │                  │
     │                  │    { students: [...] }                │
     │                  │<────────────────────┤                  │
     │                  │                    │                  │
     │ 8. Display Portal:│                   │                  │
     │    ┌─────────────────────────────────┐│                  │
     │    │ Student: Aarav Kumar            ││                  │
     │    │ ─────────────────────────────── ││                  │
     │    │ Instruments: Keyboard, Guitar   ││                  │
     │    │ Classes Remaining: 25           ││                  │
     │    │ Status: Active                  ││                  │
     │    │                                 ││                  │
     │    │ [View Attendance] [View Payments││                  │
     │    └─────────────────────────────────┘│                  │
     │<─────────────────┤                    │                  │
     │                  │                    │                  │
     │ 9. Click "View   │                    │                  │
     │    Attendance"   │                    │                  │
     ├─────────────────>│                    │                  │
     │                  │                    │                  │
     │                  │ 10. GET /api/attendance?student_id=X │
     │                  │     Authorization: Bearer <JWT>       │
     │                  ├────────────────────>│                  │
     │                  │                    │                  │
     │                  │                    │ 11. Auth + Authorize
     │                  │                    │     - Verify user is guardian of X   │
     │                  │                    │     SELECT 1 FROM student_guardians  │
     │                  │                    │     WHERE user_id=$1 AND student_id=$2│
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │<─ 1 (authorized) ┤                  │
     │                  │                    │                  │
     │                  │                    │ 12. Query attendance:                │
     │                  │                    │     SELECT ar.*, b.recurrence,       │
     │                  │                    │            i.name as instrument      │
     │                  │                    │     FROM attendance_records ar       │
     │                  │                    │     JOIN batches b ON ar.batch_id=b.id│
     │                  │                    │     JOIN instruments i               │
     │                  │                    │       ON b.instrument_id=i.id        │
     │                  │                    │     WHERE ar.student_id = $1         │
     │                  │                    │     ORDER BY ar.session_date DESC    │
     │                  │                    │     LIMIT 100                        │
     │                  │                    ├─────────────────────────────────────>│
     │                  │                    │                  │
     │                  │                    │<─ attendance records                 │
     │                  │                    │                  │
     │                  │ 13. Response:      │                  │
     │                  │     { attendance: [...] }             │
     │                  │<────────────────────┤                  │
     │                  │                    │                  │
     │ 14. Display      │                    │                  │
     │     Calendar with│                    │                  │
     │     P/A markers  │                    │                  │
     │<─────────────────┤                    │                  │
     │                  │                    │                  │
```

---

## Key Security Points

### Authentication (Who are you?)
- JWT token verification on EVERY API request
- Token expiry check (7-day validity)
- Refresh token mechanism (30-day validity)
- Login history tracking for security audits

### Authorization (What can you do?)
- Role-based access control (RBAC)
- Middleware checks `requiredRoles` vs `user.roles`
- Data filtering at database query level
- Defense in depth (frontend + backend checks)

### Data Isolation
- **Admin**: No filter (all data accessible)
- **Teacher**: Filtered by `teacher_users.teacher_id` → only assigned batches
- **Parent**: Filtered by `student_guardians.user_id` → only own children
- **Student**: Filtered by `student_guardians.user_id` → only self (if self-linked)

### Audit Trail
- All auth events logged (`login_history`)
- All sensitive operations logged (`audit_log`)
- Actor tracking (who performed the action)
- Timestamp and IP address recording
