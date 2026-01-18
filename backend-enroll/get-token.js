// Get a fresh JWT token for testing
// This script simulates what happens after OAuth login
require('dotenv').config()
const pool = require('./db')
const { generateToken } = require('./auth/jwtMiddleware')

async function getToken() {
  const email = process.argv[2]
  
  if (!email) {
    console.error('Usage: node get-token.js <email@example.com>')
    console.error('Example: node get-token.js partho.protim@gmail.com')
    process.exit(1)
  }

  try {
    // Get user with roles
    const userResult = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        COALESCE(
          (SELECT array_agg(DISTINCT role::text) 
           FROM user_roles 
           WHERE user_id = u.id AND revoked_at IS NULL),
          ARRAY[]::text[]
        ) as roles
      FROM users u
      WHERE u.email = $1 AND u.is_active = true
    `, [email])

    if (userResult.rows.length === 0) {
      console.error(`User not found: ${email}`)
      process.exit(1)
    }

    const user = userResult.rows[0]
    console.log(`\nGenerating token for:`)
    console.log(`Email: ${user.email}`)
    console.log(`Name: ${user.name}`)
    console.log(`Roles: ${user.roles.join(', ')}`)
    
    // Generate JWT token
    const token = generateToken(user)
    
    console.log(`\n✅ JWT Token Generated:\n`)
    console.log(token)
    console.log(`\n\nTo use in API requests:`)
    console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/auth/profile`)
    console.log(`\nOr test an admin endpoint:`)
    console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/stats`)

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

getToken()
