// Authentication Routes
const express = require('express')
const passport = require('passport')
const router = express.Router()
const pool = require('../db')
const {
  generateToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  authenticateJWT
} = require('../auth/jwtMiddleware')

/**
 * Initiate Google OAuth flow
 * GET /api/auth/google
 */
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
)

/**
 * Google OAuth callback
 * GET /api/auth/google/callback
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login?error=auth_failed',
    session: false  // We'll use JWT instead of sessions
  }),
  async (req, res) => {
    try {
      // Generate JWT tokens
      const accessToken = generateToken(req.user)
      const refreshToken = await generateRefreshToken(req.user.id)

      // Set refresh token as httpOnly cookie (more secure)
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      })

      // Redirect to frontend main app with access token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      res.redirect(`${frontendUrl}/?token=${accessToken}`)
    } catch (error) {
      console.error('Error in OAuth callback:', error)
      res.redirect('/login?error=token_generation_failed')
    }
  }
)

/**
 * Get current user profile
 * GET /api/auth/profile
 */
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.email,
        u.name,
        u.google_id,
        u.profile_picture,
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
      WHERE u.id = $1`,
      [req.user.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = result.rows[0]

    // Fetch additional role-specific data
    const additionalData = {}

    // If teacher, get teacher_id
    if (user.roles.includes('teacher')) {
      const teacherResult = await pool.query(
        `SELECT t.id as teacher_id, t.name, t.email as teacher_email, t.phone
         FROM teacher_users tu
         JOIN teachers t ON tu.teacher_id = t.id
         WHERE tu.user_id = $1`,
        [user.id]
      )
      if (teacherResult.rows.length > 0) {
        additionalData.teacherProfile = teacherResult.rows[0]
      }
    }

    // If parent, get linked students
    if (user.roles.includes('parent')) {
      const studentsResult = await pool.query(
        `SELECT 
          s.id as student_id,
          s.name as student_name,
          sg.relationship
         FROM student_guardians sg
         JOIN students s ON sg.student_id = s.id
         WHERE sg.user_id = $1`,
        [user.id]
      )
      additionalData.linkedStudents = studentsResult.rows
    }

    res.json({
      user: {
        ...user,
        ...additionalData
      }
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    res.status(500).json({ error: 'Failed to fetch user profile' })
  }
})

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies.refreshToken || req.body.refresh_token

    if (!refreshToken) {
      return res.status(401).json({ 
        error: 'Refresh token required',
        message: 'Please login again'
      })
    }

    // Generate new access token
    const result = await refreshAccessToken(refreshToken)

    if (!result.success) {
      return res.status(401).json({ 
        error: result.error,
        message: 'Please login again'
      })
    }

    res.json({
      accessToken: result.accessToken,
      message: 'Token refreshed successfully'
    })
  } catch (error) {
    console.error('Error refreshing token:', error)
    res.status(500).json({ error: 'Failed to refresh token' })
  }
})

/**
 * Logout - revoke refresh token
 * POST /api/auth/logout
 */
router.post('/logout', authenticateJWT, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refresh_token

    if (refreshToken) {
      await revokeRefreshToken(refreshToken, 'user_logout')
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken')

    res.json({ 
      message: 'Logged out successfully',
      success: true
    })
  } catch (error) {
    console.error('Error during logout:', error)
    res.status(500).json({ error: 'Failed to logout' })
  }
})

/**
 * Admin endpoint: Link teacher account to user
 * POST /api/auth/link/teacher
 */
router.post('/link/teacher', 
  authenticateJWT,
  async (req, res) => {
    try {
      const { user_id, teacher_id } = req.body

      if (!user_id || !teacher_id) {
        return res.status(400).json({ 
          error: 'user_id and teacher_id are required'
        })
      }

      // Check if user exists
      const userResult = await pool.query(
        'SELECT id, email FROM users WHERE id = $1',
        [user_id]
      )
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Check if teacher exists
      const teacherResult = await pool.query(
        'SELECT id, name, email FROM teachers WHERE id = $1',
        [teacher_id]
      )
      if (teacherResult.rows.length === 0) {
        return res.status(404).json({ error: 'Teacher not found' })
      }

      // Check if already linked
      const linkResult = await pool.query(
        'SELECT id FROM teacher_users WHERE user_id = $1 AND teacher_id = $2',
        [user_id, teacher_id]
      )

      let linkId
      if (linkResult.rows.length > 0) {
        // Reactivate if exists
        await pool.query(
          `UPDATE teacher_users 
           SET is_active = true, linked_at = now()
           WHERE user_id = $1 AND teacher_id = $2
           RETURNING id`,
          [user_id, teacher_id]
        )
        linkId = linkResult.rows[0].id
      } else {
        // Create new link
        const insertResult = await pool.query(
          `INSERT INTO teacher_users (user_id, teacher_id, linked_by)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [user_id, teacher_id, req.user.id]
        )
        linkId = insertResult.rows[0].id
      }

      // Add teacher role if not present
      await pool.query(
        `INSERT INTO user_roles (user_id, role_name, assigned_by)
         VALUES ($1, 'teacher', $2)
         ON CONFLICT (user_id, role_name) 
         DO UPDATE SET is_active = true, assigned_at = now()`,
        [user_id, req.user.id]
      )

      res.json({
        success: true,
        message: 'Teacher account linked successfully',
        linkId: linkId
      })
    } catch (error) {
      console.error('Error linking teacher account:', error)
      res.status(500).json({ error: 'Failed to link teacher account' })
    }
  }
)

/**
 * Admin endpoint: Link student/guardian account to user
 * POST /api/auth/link/student
 */
router.post('/link/student',
  authenticateJWT,
  async (req, res) => {
    try {
      const { user_id, student_id, relationship } = req.body

      if (!user_id || !student_id || !relationship) {
        return res.status(400).json({ 
          error: 'user_id, student_id, and relationship are required'
        })
      }

      // Check if user exists
      const userResult = await pool.query(
        'SELECT id, email FROM users WHERE id = $1',
        [user_id]
      )
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Check if student exists
      const studentResult = await pool.query(
        'SELECT id, name, email FROM students WHERE id = $1',
        [student_id]
      )
      if (studentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' })
      }

      // Check if already linked
      const linkResult = await pool.query(
        'SELECT id FROM student_guardians WHERE user_id = $1 AND student_id = $2',
        [user_id, student_id]
      )

      let linkId
      if (linkResult.rows.length > 0) {
        // Reactivate and update relationship if exists
        const updateResult = await pool.query(
          `UPDATE student_guardians 
           SET is_active = true, 
               relationship = $3,
               linked_at = now()
           WHERE user_id = $1 AND student_id = $2
           RETURNING id`,
          [user_id, student_id, relationship]
        )
        linkId = updateResult.rows[0].id
      } else {
        // Create new link
        const insertResult = await pool.query(
          `INSERT INTO student_guardians (user_id, student_id, relationship, linked_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [user_id, student_id, relationship, req.user.id]
        )
        linkId = insertResult.rows[0].id
      }

      // Add parent role if not present
      await pool.query(
        `INSERT INTO user_roles (user_id, role_name, assigned_by)
         VALUES ($1, 'parent', $2)
         ON CONFLICT (user_id, role_name) 
         DO UPDATE SET is_active = true, assigned_at = now()`,
        [user_id, req.user.id]
      )

      res.json({
        success: true,
        message: 'Student/guardian account linked successfully',
        linkId: linkId
      })
    } catch (error) {
      console.error('Error linking student account:', error)
      res.status(500).json({ error: 'Failed to link student account' })
    }
  }
)

module.exports = router
