const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../db');

// Ensure environment variables are present
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('⚠️ Google OAuth credentials missing in .env');
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'missing-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'missing-secret',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const googleId = profile.id;
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      const name = profile.displayName;
      const picture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

      if (!email) {
        await client.query('ROLLBACK');
        return done(new Error('No email found in Google profile'));
      }

      // 1. Upsert User
      const userQuery = `
        INSERT INTO users (google_id, email, name, profile_picture, email_verified, last_login)
        VALUES ($1, $2, $3, $4, true, NOW())
        ON CONFLICT (email) DO UPDATE SET
          google_id = EXCLUDED.google_id,
          name = EXCLUDED.name,
          profile_picture = EXCLUDED.profile_picture,
          last_login = NOW()
        RETURNING id, email, name, is_active
      `;
      const userResult = await client.query(userQuery, [googleId, email, name, picture]);
      const user = userResult.rows[0];

      if (!user.is_active) {
        await client.query('ROLLBACK');
        return done(null, false, { message: 'Account is disabled' });
      }

      // 2. Fetch Roles
      const roleCheck = await client.query('SELECT role FROM user_roles WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);
      let roles = roleCheck.rows.map(r => r.role);

      // Always apply any unused provisioned entry for this email (even if user already has other roles)
      const provision = await client.query(
        'SELECT * FROM provisioned_users WHERE email = $1 AND used_at IS NULL',
        [email.toLowerCase()]
      );

      if (provision.rows.length > 0) {
        const prov = provision.rows[0];

        // Add the provisioned role if not already present
        if (!roles.includes(prov.role)) {
          await client.query(
            'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [user.id, prov.role]
          );
          roles = [...roles, prov.role];
        }

        // Link to the appropriate entity (admin users have no entity to link)
        if (prov.entity_type === 'teacher') {
          await client.query(
            `INSERT INTO teacher_users (user_id, teacher_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [user.id, prov.entity_id]
          );
        } else if (prov.entity_type === 'student') {
          await client.query(
            `INSERT INTO student_guardians (user_id, student_id, relationship)
             VALUES ($1, $2, 'self')
             ON CONFLICT DO NOTHING`,
            [user.id, prov.entity_id]
          );
        }
        // entity_type === 'admin': no entity linking needed

        // Mark provision as used
        await client.query(
          'UPDATE provisioned_users SET used_at = NOW() WHERE id = $1',
          [prov.id]
        );
      } else if (roles.length === 0) {
        // No roles and no provisioned entry — block login
        await client.query('ROLLBACK');
        return done(null, false, { message: 'not_provisioned' });
      }

      // 3. Log Login History
      await client.query(
        'INSERT INTO login_history (user_id, login_method, success, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [user.id, 'google_oauth', true, req.ip || '0.0.0.0', req.headers['user-agent'] || 'unknown']
      );

      await client.query('COMMIT');
      
      user.roles = roles;
      return done(null, user);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Google Auth Strategy Error:', err);
      return done(err);
    } finally {
      client.release();
    }
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));