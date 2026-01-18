# 🎯 OAuth End-to-End Testing Guide

## Server Status

✅ **Backend**: http://localhost:3000  
✅ **Frontend**: http://localhost:5173  
✅ **OAuth Test Page**: http://localhost:5173/auth-test.html

## Quick Test Instructions

### Step 1: Open the OAuth Test Page

Open your browser and navigate to:
```
http://localhost:5173/auth-test.html
```

You should see a clean login page with a "Sign in with Google" button.

### Step 2: Click "Sign in with Google"

1. Click the blue "Sign in with Google" button
2. You'll be redirected to Google's login page
3. Select your account: **partho.protim@gmail.com**
4. Grant permissions to HSM Management System

### Step 3: Verify Success

After successful authentication, you'll be redirected back to the test page with:

✅ **Your Profile Information**:
- Email: partho.protim@gmail.com
- User ID: (your UUID)
- Roles: admin, parent
- Token expiration date

✅ **JWT Token**: Displayed in a box (use for API testing)

### Step 4: Test API Access

On the success page, you have three buttons:

1. **Test API Call** - Makes a call to `/api/auth/profile` 
   - Should show "API call successful!"
   - Check browser console for full response

2. **Copy Token** - Copies JWT token to clipboard
   - Use this token for manual API testing

3. **Logout** - Clears the stored token
   - Click "Sign in with Google" to login again

## Manual API Testing

After getting your token, test protected endpoints:

```bash
# Get your token from the test page (or use the saved one)
TOKEN=$(cat /Users/srinikamukherjee/Documents/HSM-Management/backend-enroll/admin-token.txt)

# Test profile endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/profile

# Test admin endpoint (should work - you're admin!)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/stats

# Test teacher endpoint (should work - admins have access)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/teachers

# Test without token (should fail with 401)
curl http://localhost:3000/api/students
```

## Expected Results

### ✅ Success Case:

1. Google login works smoothly
2. Redirected back to test page with token
3. User info displays correctly showing:
   - Your email
   - Admin and parent roles
   - Token expiration (7 days from now)
4. "Test API Call" button returns your profile
5. All protected endpoints respond with data (not errors)

### ❌ Failure Cases to Check:

**401 Unauthorized**: Token missing or invalid
```json
{
  "error": "Authentication required",
  "message": "No token provided. Please login."
}
```

**403 Forbidden**: User doesn't have required role
```json
{
  "error": "Access denied",
  "message": "This action requires one of the following roles: admin"
}
```

**Token Expired**: Token is older than 7 days
```json
{
  "error": "Token expired",
  "message": "Please login again"
}
```

## OAuth Flow Verification

The complete flow should work as follows:

```
1. User clicks "Sign in with Google"
   ↓
2. Browser → http://localhost:3000/api/auth/google
   ↓
3. Backend redirects → Google OAuth consent page
   ↓
4. User authenticates with Google
   ↓
5. Google redirects → http://localhost:3000/api/auth/google/callback?code=...
   ↓
6. Backend:
   - Exchanges code for Google profile
   - Creates/updates user in database
   - Generates JWT token (7 days)
   - Generates refresh token (30 days)
   - Sets refresh token as httpOnly cookie
   ↓
7. Backend redirects → http://localhost:5173/auth-test.html?token=...
   ↓
8. Frontend JavaScript:
   - Extracts token from URL
   - Decodes JWT to display user info
   - Stores token in localStorage
   - Shows success message
   ↓
9. User can now make authenticated API calls
```

## Troubleshooting

### Issue: "redirect_uri_mismatch"

**Cause**: Google OAuth callback URL doesn't match  
**Fix**: Check Google Console has: `http://localhost:3000/api/auth/google/callback`

### Issue: "Invalid token" or token doesn't work

**Cause**: JWT_SECRET mismatch or token expired  
**Fix**: Generate fresh token:
```bash
cd /Users/srinikamukherjee/Documents/HSM-Management/backend-enroll
node get-token.js partho.protim@gmail.com
```

### Issue: Can't access test page

**Cause**: Frontend not running  
**Fix**: 
```bash
cd /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll
npm run dev
```

### Issue: Backend errors in console

**Check logs**:
```bash
tail -50 /Users/srinikamukherjee/Documents/HSM-Management/backend-enroll/backend.log
```

### Issue: CORS errors

**Cause**: Frontend/backend URL mismatch  
**Fix**: Verify `.env.local` has `VITE_API_BASE_URL=http://localhost:3000`

## Database Verification

Check what's in the database after OAuth:

```bash
cd /Users/srinikamukherjee/Documents/HSM-Management/backend-enroll

# List all users
node list-users.js

# Check login history
node -e "const pool = require('./db'); (async () => { 
  const r = await pool.query('SELECT * FROM login_history ORDER BY timestamp DESC LIMIT 5'); 
  console.log(r.rows); 
  await pool.end(); 
})()"

# Check refresh tokens
node -e "const pool = require('./db'); (async () => { 
  const r = await pool.query('SELECT user_id, created_at, expires_at, is_revoked FROM refresh_tokens ORDER BY created_at DESC LIMIT 5'); 
  console.log(r.rows); 
  await pool.end(); 
})()"
```

## Test Checklist

- [ ] Backend running on port 3000
- [ ] Frontend running on port 5173
- [ ] OAuth test page loads correctly
- [ ] Click "Sign in with Google" redirects to Google
- [ ] Google login accepts your account
- [ ] Redirected back with token in URL
- [ ] User info displays correctly (email, roles, expiry)
- [ ] "Test API Call" button works
- [ ] Token can be copied to clipboard
- [ ] Manual curl commands work with token
- [ ] Logout clears token and allows re-login
- [ ] Refresh token cookie is set (check browser DevTools)
- [ ] Login history recorded in database

## Security Verification

✅ **Tokens**:
- Access token expires in 7 days
- Refresh token expires in 30 days
- Refresh token stored as httpOnly cookie (not accessible via JavaScript)

✅ **Database**:
- Login history tracks all authentication events
- User roles stored separately and can be revoked
- Passwords NOT stored (OAuth only)

✅ **API Protection**:
- All 25 endpoints require authentication
- Role-based authorization enforced
- Teachers can only see their data
- Parents can only see their children's data

## Next Steps After Successful Test

1. **Link Teacher Accounts**: Connect existing teachers to Google accounts
2. **Link Student/Guardian Accounts**: Connect parents to their children
3. **Frontend Integration**: Build proper login UI in main app
4. **Production OAuth**: Configure for production URLs
5. **Token Refresh**: Implement automatic token refresh in frontend

---

🎉 **Happy Testing!**

For questions or issues, check:
- Backend logs: `backend-enroll/backend.log`
- Frontend logs: Browser console (F12)
- Database: `node list-users.js`
