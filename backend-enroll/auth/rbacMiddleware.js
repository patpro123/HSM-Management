// Role-Based Access Control (RBAC) Middleware
const pool = require('../db')

/**
 * Middleware to check if user has required role(s)
 * Usage: authorizeRole(['admin']) or authorizeRole(['admin', 'teacher'])
 */
const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please login to access this resource'
      })
    }

    // Check if user has any of the allowed roles
    const userRoles = req.user.roles || []
    const hasPermission = allowedRoles.some(role => userRoles.includes(role))

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        userRoles: userRoles
      })
    }

    next()
  }
}

/**
 * Data filtering middleware for teachers
 * Ensures teachers can only access their assigned batches
 */
const filterTeacherData = async (req, res, next) => {
  if (!req.user) {
    return next()
  }

  const userRoles = req.user.roles || []

  // Admins see everything - no filter
  if (userRoles.includes('admin')) {
    req.dataFilter = { isAdmin: true }
    return next()
  }

  // Teachers see only their data
  if (userRoles.includes('teacher')) {
    try {
      const result = await pool.query(
        'SELECT teacher_id FROM teacher_users WHERE user_id = $1 AND is_active = true',
        [req.user.id]
      )

      if (result.rows.length > 0) {
        req.dataFilter = {
          isTeacher: true,
          teacherId: result.rows[0].teacher_id
        }
      } else {
        req.dataFilter = { isTeacher: true, teacherId: null }
      }
    } catch (error) {
      console.error('Error fetching teacher data:', error)
      return res.status(500).json({ error: 'Failed to load teacher data' })
    }
  }

  next()
}

/**
 * Data filtering middleware for parents
 * Ensures parents can only access their children's data
 */
const filterParentData = async (req, res, next) => {
  if (!req.user) {
    return next()
  }

  const userRoles = req.user.roles || []

  // Admins see everything - no filter
  if (userRoles.includes('admin')) {
    req.dataFilter = { ...req.dataFilter, isAdmin: true }
    return next()
  }

  // Parents see only their children
  if (userRoles.includes('parent')) {
    try {
      const result = await pool.query(
        `SELECT student_id FROM student_guardians 
         WHERE user_id = $1 AND is_active = true`,
        [req.user.id]
      )

      req.dataFilter = {
        ...req.dataFilter,
        isParent: true,
        studentIds: result.rows.map(row => row.student_id)
      }
    } catch (error) {
      console.error('Error fetching parent data:', error)
      return res.status(500).json({ error: 'Failed to load guardian data' })
    }
  }

  next()
}

/**
 * Verify that teacher owns the specified batch
 */
const verifyBatchOwnership = async (req, res, next) => {
  const batchId = req.params.batchId || req.params.id || req.body.batch_id

  if (!batchId) {
    return res.status(400).json({ error: 'Batch ID required' })
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const userRoles = req.user.roles || []

  // Admins can access any batch
  if (userRoles.includes('admin')) {
    return next()
  }

  // Teachers can only access their batches
  if (userRoles.includes('teacher')) {
    try {
      const teacherResult = await pool.query(
        'SELECT teacher_id FROM teacher_users WHERE user_id = $1 AND is_active = true',
        [req.user.id]
      )

      if (teacherResult.rows.length === 0) {
        return res.status(403).json({ error: 'Teacher account not linked' })
      }

      const teacherId = teacherResult.rows[0].teacher_id

      const batchResult = await pool.query(
        'SELECT id FROM batches WHERE id = $1 AND teacher_id = $2',
        [batchId, teacherId]
      )

      if (batchResult.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have permission to access this batch'
        })
      }

      next()
    } catch (error) {
      console.error('Error verifying batch ownership:', error)
      return res.status(500).json({ error: 'Failed to verify permissions' })
    }
  } else {
    return res.status(403).json({ error: 'Teacher or admin role required' })
  }
}

/**
 * Verify that parent has access to specified student
 */
const verifyStudentAccess = async (req, res, next) => {
  const studentId = req.params.studentId || req.params.id || req.query.student_id

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID required' })
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const userRoles = req.user.roles || []

  // Admins can access any student
  if (userRoles.includes('admin')) {
    return next()
  }

  // Parents can only access their children
  if (userRoles.includes('parent')) {
    try {
      const result = await pool.query(
        `SELECT 1 FROM student_guardians 
         WHERE user_id = $1 AND student_id = $2 AND is_active = true`,
        [req.user.id, studentId]
      )

      if (result.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have permission to access this student'
        })
      }

      next()
    } catch (error) {
      console.error('Error verifying student access:', error)
      return res.status(500).json({ error: 'Failed to verify permissions' })
    }
  } else {
    return res.status(403).json({ error: 'Parent or admin role required' })
  }
}

/**
 * Restrict attendance marking to today's date for teachers
 */
const restrictToTodayForTeachers = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const userRoles = req.user.roles || []

  // Admins can mark attendance for any date
  if (userRoles.includes('admin')) {
    return next()
  }

  // Teachers can only mark attendance for today
  if (userRoles.includes('teacher')) {
    const sessionDate = req.body.session_date || req.body.date
    const today = new Date().toISOString().split('T')[0]

    if (sessionDate && sessionDate !== today) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Teachers can only mark attendance for today. Contact admin to mark attendance for past dates.'
      })
    }
  }

  next()
}

module.exports = {
  authorizeRole,
  filterTeacherData,
  filterParentData,
  verifyBatchOwnership,
  verifyStudentAccess,
  restrictToTodayForTeachers
}
