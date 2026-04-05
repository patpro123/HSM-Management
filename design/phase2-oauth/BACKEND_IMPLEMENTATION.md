# Phase 2 Authentication - Backend Implementation

This document describes the backend authentication layer implementation for HSM Management System Phase 2.

## Overview

The authentication system provides:
- Google OAuth 2.0 login (no username/password)
- JWT-based API authentication
- Role-based access control (RBAC)
- Refresh token management
- Login history tracking

## Architecture

### Components

1. **Google OAuth Strategy** (`auth/googleStrategy.js`)
   - Handles Google OAuth 2.0 flow
   - Creates/updates users on successful login
   - Tracks login history
   - Default role: `parent` for new users

2. **JWT Middleware** (`auth/jwtMiddleware.js`)
   - Generates JWT access tokens (7-day expiry)
   - Generates refresh tokens (30-day expiry)
   - Validates and refreshes tokens
   - Revokes tokens on logout

3. **RBAC Middleware** (`auth/rbacMiddleware.js`)
   - Role-based authorization
   - Data filtering for teachers and parents
   - Batch ownership verification
   - Student access verification

4. **Authentication Routes** (`routes/auth.js`)
   - `/api/auth/google` - Initiate OAuth
   - `/api/auth/google/callback` - OAuth callback
   - `/api/auth/profile` - Get user profile
   - `/api/auth/refresh` - Refresh access token
   - `/api/auth/logout` - Revoke tokens
   - `/api/auth/link/teacher` - Link teacher account
   - `/api/auth/link/student` - Link student/guardian

## Database Schema

### New Tables (Migration 004)

- `users` - OAuth user accounts
- `user_roles` - Role assignments (admin, teacher, parent, student)
- `teacher_users` - Links users to teacher records
- `student_guardians` - Links users to student records
- `refresh_tokens` - JWT refresh tokens
- `login_history` - Authentication audit trail

See: `db/migrations/004_add_authentication_tables.sql`

## Setup Instructions

### 1. Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
5. Copy Client ID and Client Secret to `.env`

### 2. Environment Variables

Update `backend-enroll/.env`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# JWT Configuration
JWT_SECRET=generate-with-crypto-randomBytes-32
JWT_ISSUER=hsm-management
JWT_AUDIENCE=hsm-api

# Session Secret (for OAuth flow)
SESSION_SECRET=generate-with-crypto-randomBytes-32

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

**Generate secure secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Apply Database Migration

If not already applied:

```bash
cd backend-enroll
node apply_migration_004.js
node verify_migration_004.js
```

### 4. Start Backend Server

```bash
cd backend-enroll
npm install  # if not already done
node index.js
```

Server runs on `http://localhost:3000`

## Usage

### Authentication Flow

1. **Login**
   ```
   Frontend redirects to: GET /api/auth/google
   User authenticates with Google
   Callback: GET /api/auth/google/callback
   Redirects to frontend with access token: http://localhost:5173/auth/callback?token=<jwt>
   ```

2. **API Requests**
   ```
   Authorization: Bearer <access_token>
   ```

3. **Token Refresh**
   ```
   POST /api/auth/refresh
   Cookie: refreshToken=<token>
   Returns: { accessToken: "<new_token>" }
   ```

4. **Logout**
   ```
   POST /api/auth/logout
   Authorization: Bearer <access_token>
   ```

### Protecting API Endpoints

#### Require Authentication

```javascript
const { authenticateJWT } = require('./auth/jwtMiddleware')

app.get('/api/students', authenticateJWT, async (req, res) => {
  // req.user is available
  // req.user.id, req.user.email, req.user.roles
})
```

#### Require Specific Role

```javascript
const { authenticateJWT } = require('./auth/jwtMiddleware')
const { authorizeRole } = require('./auth/rbacMiddleware')

// Only admins
app.post('/api/admin/settings', 
  authenticateJWT, 
  authorizeRole(['admin']),
  async (req, res) => {
    // Only admin users reach here
  }
)

// Admin or teacher
app.get('/api/batches', 
  authenticateJWT, 
  authorizeRole(['admin', 'teacher']),
  async (req, res) => {
    // Admin or teacher users
  }
)
```

#### Filter Data by Role

```javascript
const { authenticateJWT } = require('./auth/jwtMiddleware')
const { filterTeacherData } = require('./auth/rbacMiddleware')

app.get('/api/batches', 
  authenticateJWT,
  filterTeacherData,
  async (req, res) => {
    // req.dataFilter contains:
    // { isAdmin: true } - for admins
    // { isTeacher: true, teacherId: 123 } - for teachers
    
    if (req.dataFilter.isAdmin) {
      // Return all batches
    } else if (req.dataFilter.isTeacher) {
      // Filter: WHERE teacher_id = req.dataFilter.teacherId
    }
  }
)
```

#### Verify Batch Ownership

```javascript
const { authenticateJWT } = require('./auth/jwtMiddleware')
const { verifyBatchOwnership } = require('./auth/rbacMiddleware')

app.post('/api/attendance/:batchId', 
  authenticateJWT,
  verifyBatchOwnership,  // Checks if teacher owns this batch
  async (req, res) => {
    // Only the teacher of this batch or admin can mark attendance
  }
)
```

## Role Management

### Default Roles

- New Google OAuth users get `parent` role by default
- Admins must link users to teacher/student records

### Linking Accounts

#### Link Teacher Account

```bash
POST /api/auth/link/teacher
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "user_id": 1,
  "teacher_id": 5
}
```

This:
1. Creates entry in `teacher_users` table
2. Adds `teacher` role to user
3. Teacher can now access their batches

#### Link Student/Guardian Account

```bash
POST /api/auth/link/student
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "user_id": 2,
  "student_id": 10,
  "relationship": "father"
}
```

This:
1. Creates entry in `student_guardians` table
2. Adds `parent` role to user (if not already present)
3. Parent can now access their child's data

### Manual Role Assignment

Directly in database (for admin users):

```sql
-- Make user an admin
INSERT INTO user_roles (user_id, role_name, assigned_by)
VALUES (1, 'admin', 1);  -- assigned_by = admin user id
```

## Security Features

1. **HTTPS in Production**: Cookies marked secure in production
2. **HttpOnly Cookies**: Refresh tokens stored as httpOnly cookies
3. **Token Expiry**: Access tokens expire in 7 days, refresh in 30 days
4. **Token Revocation**: Logout revokes refresh tokens
5. **Login History**: All logins tracked with IP and user agent
6. **Active User Check**: JWT middleware validates user is still active

## JWT Token Structure

### Access Token Payload

```json
{
  "id": 1,
  "email": "user@example.com",
  "roles": ["parent", "teacher"],
  "iat": 1234567890,
  "exp": 1235172690,
  "iss": "hsm-management",
  "aud": "hsm-api"
}
```

### Refresh Token

- UUID v4 stored in database
- Links to user_id
- Can be revoked
- 30-day expiry

## Testing

### Test OAuth Flow (Manual)

1. Start backend: `node index.js`
2. Navigate to: `http://localhost:3000/api/auth/google`
3. Login with Google account
4. Check redirect to frontend with token
5. Decode JWT at [jwt.io](https://jwt.io) to verify payload

### Test Protected Endpoint

```bash
# Get token from OAuth flow
TOKEN="your-jwt-token"

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/auth/profile
```

### Test Role Authorization

```bash
# Admin endpoint (should fail for non-admin)
curl -H "Authorization: Bearer $TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"user_id": 2, "teacher_id": 5}' \
  http://localhost:3000/api/auth/link/teacher
```

## Next Steps

1. **Frontend Implementation**
   - Create login page with "Sign in with Google" button
   - Implement auth context and token storage
   - Add protected routes
   - Create role-specific dashboards

2. **Existing API Protection**
   - Add `authenticateJWT` to all endpoints
   - Add role checks where appropriate
   - Implement data filtering for teachers/parents

3. **Testing**
   - Write automated tests for auth flows
   - Test role-based access scenarios
   - Test token refresh and expiry

4. **Production Deployment**
   - Update Google OAuth callback URL
   - Use environment-specific secrets
   - Enable HTTPS
   - Configure secure cookies

## Troubleshooting

### Google OAuth Errors

**Error: redirect_uri_mismatch**
- Check `GOOGLE_CALLBACK_URL` in `.env` matches Google Console
- Ensure URL includes protocol (http:// or https://)

**Error: invalid_client**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Check Google+ API is enabled

### JWT Errors

**Error: jwt malformed**
- Token format should be: `Bearer <token>`
- Check JWT_SECRET matches between generation and verification

**Error: jwt expired**
- Token expired, use refresh token to get new access token
- Check system time is synchronized

### Database Errors

**Error: relation "users" does not exist**
- Apply migration 004: `node apply_migration_004.js`

**Error: refresh token not found**
- Token may have been revoked or expired
- User needs to login again

## File Structure

```
backend-enroll/
├── auth/
│   ├── googleStrategy.js      # Google OAuth config
│   ├── jwtMiddleware.js        # JWT token management
│   └── rbacMiddleware.js       # Role-based access control
├── routes/
│   └── auth.js                 # Authentication endpoints
├── index.js                    # Updated with Passport config
├── .env                        # Environment variables
└── package.json                # Added auth dependencies
```

## References

- [Design Document](../Phase2_OAuthEnhancement_Design/PHASE2_AUTH_DESIGN.md)
- [Sequence Diagrams](../Phase2_OAuthEnhancement_Design/PHASE2_AUTH_SEQUENCES.md)
- [Database Migration 004](../db/migrations/004_add_authentication_tables.sql)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
