// List all users in the system
require('dotenv').config()
const pool = require('./db')

async function listUsers() {
  try {
    console.log('Fetching all users...\n')
    
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.is_active,
        u.created_at,
        u.last_login,
        COALESCE(
          (SELECT array_agg(DISTINCT role::text) 
           FROM user_roles 
           WHERE user_id = u.id AND revoked_at IS NULL),
          ARRAY[]::text[]
        ) as roles
      FROM users u
      ORDER BY u.created_at DESC
    `)

    if (result.rows.length === 0) {
      console.log('No users found in the database.')
      console.log('\nTo create your first user:')
      console.log('1. Open browser to: http://localhost:3000/api/auth/google')
      console.log('2. Login with your Google account')
      console.log('3. Run this script again')
    } else {
      console.log(`Found ${result.rows.length} user(s):\n`)
      
      result.rows.forEach((user, index) => {
        const roles = user.roles && Array.isArray(user.roles) && user.roles.length > 0 && user.roles[0] !== null 
          ? user.roles.join(', ') 
          : 'none'
        
        console.log(`${index + 1}. ${user.name || 'N/A'} <${user.email}>`)
        console.log(`   User ID: ${user.id}`)
        console.log(`   Status: ${user.is_active ? '✅ Active' : '❌ Inactive'}`)
        console.log(`   Roles: ${roles}`)
        console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`)
        console.log(`   Last Login: ${user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}`)
        console.log('')
      })

      console.log('\nTo make a user admin:')
      console.log('node setup-admin.js <email>')
    }

  } catch (error) {
    console.error('Error fetching users:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

listUsers()
