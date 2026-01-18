// Admin Setup Script
// This script promotes a user to admin role
require('dotenv').config()
const pool = require('./db')

async function setupAdmin() {
  const email = process.argv[2]
  
  if (!email) {
    console.error('Usage: node setup-admin.js <email@example.com>')
    console.error('Example: node setup-admin.js admin@hsmmusic.com')
    process.exit(1)
  }

  try {
    console.log(`Setting up admin access for: ${email}`)
    
    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email]
    )

    if (userResult.rows.length === 0) {
      console.error(`\n❌ User not found with email: ${email}`)
      console.error('\nPlease login via Google OAuth first:')
      console.error('1. Open browser to: http://localhost:3000/api/auth/google')
      console.error('2. Login with your Google account')
      console.error('3. Then run this script again')
      process.exit(1)
    }

    const user = userResult.rows[0]
    console.log(`\n✅ Found user:`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.name}`)

    // Check existing roles
    const rolesResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND revoked_at IS NULL',
      [user.id]
    )

    const currentRoles = rolesResult.rows.map(r => r.role)
    console.log(`\n📋 Current roles: ${currentRoles.length > 0 ? currentRoles.join(', ') : 'none'}`)

    if (currentRoles.includes('admin')) {
      console.log('\n✅ User already has admin role!')
    } else {
      // Add admin role
      await pool.query(
        `INSERT INTO user_roles (user_id, role, granted_by)
         VALUES ($1, 'admin', $1)
         ON CONFLICT (user_id, role) 
         DO UPDATE SET revoked_at = NULL, granted_at = now()`,
        [user.id]
      )
      
      console.log('\n✅ Admin role assigned successfully!')
    }

    // Show final roles
    const finalRolesResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND revoked_at IS NULL',
      [user.id]
    )
    
    const finalRoles = finalRolesResult.rows.map(r => r.role)
    console.log(`\n🎉 Final roles: ${finalRoles.join(', ')}`)
    
    console.log('\n✅ Setup complete! You can now login and access admin features.')
    console.log('\nNext steps:')
    console.log('1. Login at: http://localhost:3000/api/auth/google')
    console.log('2. Copy the JWT token from the redirect URL')
    console.log('3. Use it in API requests: Authorization: Bearer <token>')

  } catch (error) {
    console.error('Error setting up admin:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

setupAdmin()
