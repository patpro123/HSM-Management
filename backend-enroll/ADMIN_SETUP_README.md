# Admin Setup Complete! ✅

## Your Admin Account

- **Email**: partho.protim@gmail.com
- **Name**: Parthoprotim Mukherjee
- **Roles**: admin, parent
- **Status**: ✅ Active

## Quick Commands

### Manage Users

```bash
# List all users
node list-users.js

# Make someone admin
node setup-admin.js <email@example.com>

# Get JWT token for testing
node get-token.js <email@example.com>
```

### Test API with Token

```bash
# Load token
TOKEN=$(cat admin-token.txt)

# Test profile endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/profile

# Test admin endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/stats

# Test protected endpoint (should work)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/students

# Test without token (should fail)
curl http://localhost:3000/api/students
```

## Authentication Flow

### For Development (using script):

```bash
# Generate a fresh token
node get-token.js partho.protim@gmail.com
# Copy the token and use it in your requests
```

### For Production (using OAuth):

1. Navigate to: `http://localhost:3000/api/auth/google`
2. Login with your Google account
3. You'll be redirected to frontend with token in URL
4. Frontend extracts token and stores it
5. Frontend includes token in all API requests

## Backend Status

```bash
# Check if backend is running
lsof -ti:3000

# View logs
tail -f backend.log

# Restart backend
lsof -ti:3000 | xargs kill
nohup node index.js > backend.log 2>&1 &

# Check server is responsive
curl http://localhost:3000/api/auth/google -I
```

## Role-Based Access

### Admin (You!)
- ✅ Full access to all endpoints
- ✅ Create/update students, teachers, batches
- ✅ View all data
- ✅ Manage payments
- ✅ View stats dashboard

### Teacher
- ✅ View their own batches only
- ✅ Mark attendance (today only)
- ✅ View their students
- ✅ View their payouts
- ❌ Cannot create/edit students or batches

### Parent
- ✅ View their linked students only
- ✅ View their children's payments
- ✅ View their children's attendance
- ❌ Cannot access other students' data

## Linking Accounts

### Link a Teacher to a User

```bash
# First, teacher logs in via Google OAuth
# Then, as admin, link their Google account to teacher record:

curl -X POST http://localhost:3000/api/auth/link/teacher \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<user-uuid>",
    "teacher_id": <teacher-id-number>
  }'
```

### Link a Student/Guardian to a User

```bash
curl -X POST http://localhost:3000/api/auth/link/student \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<user-uuid>",
    "student_id": <student-id-number>,
    "relationship": "father"
  }'
```

## Token Expiry

- **Access Token**: 7 days
- **Refresh Token**: 30 days

When token expires, generate a new one with:
```bash
node get-token.js partho.protim@gmail.com
```

## Environment Variables

Your current setup:
- `GOOGLE_CLIENT_ID`: ✅ Configured
- `GOOGLE_CLIENT_SECRET`: ✅ Configured
- `JWT_SECRET`: ✅ Configured
- `SESSION_SECRET`: ✅ Configured
- `FRONTEND_URL`: http://localhost:5173
- `GOOGLE_CALLBACK_URL`: http://localhost:3000/api/auth/google/callback

## Next Steps

1. ✅ **Backend Authentication** - COMPLETE
2. ✅ **Admin Setup** - COMPLETE
3. ✅ **Backend Running** - Port 3000
4. 🔄 **Frontend Implementation** - Next phase
   - Add login button
   - Handle OAuth callback
   - Store JWT token
   - Add auth context
   - Protect routes
5. 🔄 **Account Linking** - Link existing teachers/students to Google accounts

## Useful Queries

```bash
# Get your user ID
node -e "const pool = require('./db'); (async () => { const r = await pool.query('SELECT id, email FROM users WHERE email = \$1', ['partho.protim@gmail.com']); console.log(r.rows[0]); await pool.end(); })()"

# List all teachers
node -e "const pool = require('./db'); (async () => { const r = await pool.query('SELECT id, name, email FROM teachers'); console.log(r.rows); await pool.end(); })()"

# List all students
node -e "const pool = require('./db'); (async () => { const r = await pool.query('SELECT id, name FROM students LIMIT 5'); console.log(r.rows); await pool.end(); })()"
```

## Troubleshooting

**Token expired?**
```bash
node get-token.js partho.protim@gmail.com > admin-token.txt
```

**Backend not responding?**
```bash
lsof -ti:3000 | xargs kill
cd /Users/srinikamukherjee/Documents/HSM-Management/backend-enroll
nohup node index.js > backend.log 2>&1 &
```

**Check for errors?**
```bash
tail -50 backend.log | grep -i error
```

---

🎉 **Your backend authentication is fully configured and ready to use!**
