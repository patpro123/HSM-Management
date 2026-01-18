const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');

// Get all users with their roles (admin only)
router.get('/', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id,
        u.google_id,
        u.email,
        u.name,
        u.profile_picture,
        u.email_verified,
        u.last_login,
        u.is_active,
        u.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'role', ur.role,
              'granted_at', ur.granted_at,
              'granted_by', ur.granted_by
            )
          ) FILTER (WHERE ur.role IS NOT NULL AND ur.revoked_at IS NULL),
          '[]'
        ) as roles,
        tu.teacher_id,
        sg.student_id
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.revoked_at IS NULL
      LEFT JOIN teacher_users tu ON u.id = tu.user_id
      LEFT JOIN student_guardians sg ON u.id = sg.user_id
      GROUP BY u.id, tu.teacher_id, sg.student_id
      ORDER BY u.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get a single user by ID
router.get('/:id', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        u.id,
        u.google_id,
        u.email,
        u.name,
        u.profile_picture,
        u.email_verified,
        u.last_login,
        u.is_active,
        u.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'role', ur.role,
              'granted_at', ur.granted_at,
              'granted_by', ur.granted_by
            )
          ) FILTER (WHERE ur.role IS NOT NULL AND ur.revoked_at IS NULL),
          '[]'
        ) as roles,
        tu.teacher_id,
        sg.student_id
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.revoked_at IS NULL
      LEFT JOIN teacher_users tu ON u.id = tu.user_id
      LEFT JOIN student_guardians sg ON u.id = sg.user_id
      WHERE u.id = $1
      GROUP BY u.id, tu.teacher_id, sg.student_id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user (activate/deactivate)
router.put('/:id', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }
    
    await client.query('BEGIN');
    
    const result = await client.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *',
      [is_active, id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  } finally {
    client.release();
  }
});

// Assign role to user
router.post('/:id/roles', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Validate role
    const validRoles = ['admin', 'teacher', 'parent', 'student'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: admin, teacher, parent, student' });
    }
    
    await client.query('BEGIN');
    
    // Check if user exists
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if role already exists and is not revoked
    const existingRole = await client.query(
      'SELECT * FROM user_roles WHERE user_id = $1 AND role = $2 AND revoked_at IS NULL',
      [id, role]
    );
    
    if (existingRole.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User already has this role' });
    }
    
    // Insert new role
    const result = await client.query(
      `INSERT INTO user_roles (user_id, role, granted_by) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [id, role, req.user.id]
    );
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  } finally {
    client.release();
  }
});

// Revoke role from user
router.delete('/:id/roles/:role', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id, role } = req.params;
    
    await client.query('BEGIN');
    
    // Update role to mark as revoked
    const result = await client.query(
      `UPDATE user_roles 
       SET revoked_at = now() 
       WHERE user_id = $1 AND role = $2 AND revoked_at IS NULL
       RETURNING *`,
      [id, role]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Role not found or already revoked' });
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Role revoked successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error revoking role:', error);
    res.status(500).json({ error: 'Failed to revoke role' });
  } finally {
    client.release();
  }
});

// Link user to teacher or student
router.post('/:id/link', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;
    const { entity_type, entity_id } = req.body;
    
    // Validate input
    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id are required' });
    }
    
    if (!['teacher', 'student'].includes(entity_type)) {
      return res.status(400).json({ error: 'entity_type must be either "teacher" or "student"' });
    }
    
    await client.query('BEGIN');
    
    // Check if user exists
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (entity_type === 'teacher') {
      // Check if teacher exists
      const teacherCheck = await client.query('SELECT id FROM teachers WHERE id = $1', [entity_id]);
      if (teacherCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Teacher not found' });
      }
      
      // Check if link already exists
      const existingLink = await client.query(
        'SELECT * FROM teacher_users WHERE user_id = $1',
        [id]
      );
      
      if (existingLink.rows.length > 0) {
        // Update existing link
        await client.query(
          'UPDATE teacher_users SET teacher_id = $1 WHERE user_id = $2',
          [entity_id, id]
        );
      } else {
        // Insert new link
        await client.query(
          'INSERT INTO teacher_users (user_id, teacher_id) VALUES ($1, $2)',
          [id, entity_id]
        );
      }
      
      // Ensure user has teacher role
      const teacherRole = await client.query(
        'SELECT * FROM user_roles WHERE user_id = $1 AND role = $2 AND revoked_at IS NULL',
        [id, 'teacher']
      );
      
      if (teacherRole.rows.length === 0) {
        await client.query(
          'INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1, $2, $3)',
          [id, 'teacher', req.user.id]
        );
      }
    } else {
      // entity_type === 'student'
      // Check if student exists
      const studentCheck = await client.query('SELECT id FROM students WHERE id = $1', [entity_id]);
      if (studentCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found' });
      }
      
      // Check if link already exists
      const existingLink = await client.query(
        'SELECT * FROM student_guardians WHERE user_id = $1 AND student_id = $2',
        [id, entity_id]
      );
      
      if (existingLink.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'User already linked to this student' });
      }
      
      // Insert new link
      await client.query(
        'INSERT INTO student_guardians (user_id, student_id, relationship) VALUES ($1, $2, $3)',
        [id, entity_id, 'parent']
      );
      
      // Ensure user has parent role
      const parentRole = await client.query(
        'SELECT * FROM user_roles WHERE user_id = $1 AND role = $2 AND revoked_at IS NULL',
        [id, 'parent']
      );
      
      if (parentRole.rows.length === 0) {
        await client.query(
          'INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1, $2, $3)',
          [id, 'parent', req.user.id]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: 'User linked successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error linking user:', error);
    res.status(500).json({ error: 'Failed to link user' });
  } finally {
    client.release();
  }
});

// Unlink user from teacher or student
router.delete('/:id/link/:entityType/:entityId', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id, entityType, entityId } = req.params;
    
    await client.query('BEGIN');
    
    if (entityType === 'teacher') {
      const result = await client.query(
        'DELETE FROM teacher_users WHERE user_id = $1 AND teacher_id = $2 RETURNING *',
        [id, entityId]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Link not found' });
      }
    } else if (entityType === 'student') {
      const result = await client.query(
        'DELETE FROM student_guardians WHERE user_id = $1 AND student_id = $2 RETURNING *',
        [id, entityId]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Link not found' });
      }
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'entityType must be either "teacher" or "student"' });
    }
    
    await client.query('COMMIT');
    res.json({ message: 'User unlinked successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error unlinking user:', error);
    res.status(500).json({ error: 'Failed to unlink user' });
  } finally {
    client.release();
  }
});

module.exports = router;
