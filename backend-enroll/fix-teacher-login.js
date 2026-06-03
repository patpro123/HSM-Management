/**
 * Fix script: re-link teacher account when provisioning was consumed but setup failed.
 *
 * Usage: DATABASE_URL=<url> node fix-teacher-login.js
 *
 * What it does:
 *   1. Finds the user by email (tyson.mriganka@gmail.com)
 *   2. Finds the teacher profile by name (Mriganka Das)
 *   3. Ensures user is active
 *   4. Grants teacher role if missing / un-revokes if revoked
 *   5. Creates teacher_users link if missing
 *   6. Resets the provisioned_users entry so they can log in again if user doesn't exist yet
 */

require('dotenv').config();
const pool = require('./db');

const TEACHER_EMAIL = 'tyson.mriganka@gmail.com';
const TEACHER_NAME = 'Mriganka Das';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find teacher profile
    const teacherResult = await client.query(
      'SELECT id, name FROM teachers WHERE name = $1',
      [TEACHER_NAME]
    );
    if (teacherResult.rows.length === 0) {
      throw new Error(`Teacher profile not found: "${TEACHER_NAME}"`);
    }
    const teacher = teacherResult.rows[0];
    console.log(`Found teacher profile: ${teacher.name} (${teacher.id})`);

    // 2. Find user account
    const userResult = await client.query(
      'SELECT id, email, name, is_active FROM users WHERE email = $1',
      [TEACHER_EMAIL.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      // User has never logged in — reset provisioning so it fires on next login
      console.log(`No user account found for ${TEACHER_EMAIL}.`);
      const resetResult = await client.query(
        `UPDATE provisioned_users
         SET used_at = NULL
         WHERE email = $1 AND entity_type = 'teacher'
         RETURNING id`,
        [TEACHER_EMAIL.toLowerCase()]
      );
      if (resetResult.rows.length > 0) {
        console.log('Reset provisioned_users entry to Pending. Teacher can now log in with Google.');
      } else {
        // Create a fresh provisioning entry
        await client.query(
          `INSERT INTO provisioned_users (email, entity_type, entity_id, role)
           VALUES ($1, 'teacher', $2, 'teacher')`,
          [TEACHER_EMAIL.toLowerCase(), teacher.id]
        );
        console.log('Created new provisioned_users entry. Teacher can now log in with Google.');
      }
      await client.query('COMMIT');
      return;
    }

    const user = userResult.rows[0];
    console.log(`Found user account: ${user.name} (${user.id}), active=${user.is_active}`);

    // 3. Ensure user is active
    if (!user.is_active) {
      await client.query('UPDATE users SET is_active = true WHERE id = $1', [user.id]);
      console.log('Activated user account.');
    }

    // 4. Grant teacher role (or un-revoke if previously revoked)
    const roleResult = await client.query(
      'SELECT id, revoked_at FROM user_roles WHERE user_id = $1 AND role = $2',
      [user.id, 'teacher']
    );
    if (roleResult.rows.length === 0) {
      await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [user.id, 'teacher']
      );
      console.log('Granted teacher role.');
    } else if (roleResult.rows[0].revoked_at !== null) {
      await client.query(
        'UPDATE user_roles SET revoked_at = NULL, granted_at = now() WHERE user_id = $1 AND role = $2',
        [user.id, 'teacher']
      );
      console.log('Un-revoked teacher role.');
    } else {
      console.log('Teacher role already active — no change needed.');
    }

    // 5. Create teacher_users link if missing
    const linkResult = await client.query(
      'SELECT id, is_active FROM teacher_users WHERE user_id = $1',
      [user.id]
    );
    if (linkResult.rows.length === 0) {
      await client.query(
        'INSERT INTO teacher_users (user_id, teacher_id) VALUES ($1, $2)',
        [user.id, teacher.id]
      );
      console.log(`Linked user to teacher profile "${TEACHER_NAME}".`);
    } else if (!linkResult.rows[0].is_active) {
      await client.query(
        'UPDATE teacher_users SET is_active = true, teacher_id = $2 WHERE user_id = $1',
        [user.id, teacher.id]
      );
      console.log(`Re-activated teacher_users link to "${TEACHER_NAME}".`);
    } else {
      console.log('teacher_users link already exists — no change needed.');
    }

    await client.query('COMMIT');
    console.log('\nDone. The teacher should now be able to log in with Google.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
