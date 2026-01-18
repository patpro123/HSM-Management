// Google OAuth 2.0 Strategy Configuration
const GoogleStrategy = require('passport-google-oauth20').Strategy
const pool = require('../db')

// Configure Google OAuth strategy
const configureGoogleStrategy = (passport) => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id
          const email = profile.emails[0].value
          const name = profile.displayName
          const profilePicture = profile.photos[0]?.value || null
          const emailVerified = profile.emails[0].verified

          // Check if user already exists
          let userResult = await pool.query(
            'SELECT * FROM users WHERE google_id = $1',
            [googleId]
          )

          let user

          if (userResult.rows.length > 0) {
            // User exists - update last login and profile info
            user = userResult.rows[0]
            
            await pool.query(
              `UPDATE users 
               SET last_login = now(), 
                   profile_picture = $1, 
                   email_verified = $2,
                   name = $3,
                   updated_at = now()
               WHERE id = $4`,
              [profilePicture, emailVerified, name, user.id]
            )
          } else {
            // New user - create account with 'parent' role by default
            const client = await pool.connect()
            
            try {
              await client.query('BEGIN')

              // Insert new user
              const newUserResult = await client.query(
                `INSERT INTO users (
                  google_id, email, name, profile_picture, 
                  email_verified, last_login, is_active
                ) VALUES ($1, $2, $3, $4, $5, now(), true)
                RETURNING *`,
                [googleId, email, name, profilePicture, emailVerified]
              )

              user = newUserResult.rows[0]

              // Assign default 'parent' role
              await client.query(
                `INSERT INTO user_roles (user_id, role)
                 VALUES ($1, 'parent')`,
                [user.id]
              )

              await client.query('COMMIT')
            } catch (error) {
              await client.query('ROLLBACK')
              throw error
            } finally {
              client.release()
            }
          }

          // Get user's roles
          const rolesResult = await pool.query(
            `SELECT role FROM user_roles 
             WHERE user_id = $1 AND revoked_at IS NULL`,
            [user.id]
          )

          user.roles = rolesResult.rows.map(row => row.role)

          // Log successful login
          await pool.query(
            `INSERT INTO login_history (
              user_id, login_method, success
            ) VALUES ($1, 'google_oauth', true)`,
            [user.id]
          )

          return done(null, user)
        } catch (error) {
          console.error('Google OAuth error:', error)
          
          // Log failed login attempt
          try {
            await pool.query(
              `INSERT INTO login_history (
                user_id, login_method, success, failure_reason
              ) VALUES (NULL, 'google_oauth', false, $1)`,
              [error.message]
            )
          } catch (logError) {
            console.error('Failed to log login failure:', logError)
          }
          
          return done(error, null)
        }
      }
    )
  )

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id)
  })

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [id]
      )

      if (userResult.rows.length === 0) {
        return done(null, false)
      }

      const user = userResult.rows[0]

      // Get user's roles
      const rolesResult = await pool.query(
        `SELECT role FROM user_roles 
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [user.id]
      )

      user.roles = rolesResult.rows.map(row => row.role)

      done(null, user)
    } catch (error) {
      done(error, null)
    }
  })
}

module.exports = { configureGoogleStrategy }
