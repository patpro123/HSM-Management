// JWT Middleware for Token Verification and User Authentication
const jwt = require('jsonwebtoken')
const pool = require('../db')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

/**
 * Generate JWT token for a user
 */
const generateToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    roles: user.roles || []
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'hsm-management',
    audience: 'hsm-api'
  })
}

/**
 * Generate refresh token
 */
const generateRefreshToken = async (userId) => {
  const token = require('crypto').randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // 30 days

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  )

  return token
}

/**
 * Verify refresh token and generate new access token
 */
const refreshAccessToken = async (refreshToken) => {
  const result = await pool.query(
    `SELECT rt.*, u.id, u.email, u.name, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token = $1 
     AND rt.revoked_at IS NULL 
     AND rt.expires_at > now()`,
    [refreshToken]
  )

  if (result.rows.length === 0) {
    throw new Error('Invalid or expired refresh token')
  }

  const tokenData = result.rows[0]

  if (!tokenData.is_active) {
    throw new Error('User account is inactive')
  }

  // Get user roles
  const rolesResult = await pool.query(
    `SELECT role FROM user_roles 
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [tokenData.user_id]
  )

  const user = {
    id: tokenData.user_id,
    email: tokenData.email,
    name: tokenData.name,
    roles: rolesResult.rows.map(row => row.role)
  }

  // Generate new access token
  const accessToken = generateToken(user)

  return { accessToken, user }
}

/**
 * Revoke refresh token (for logout)
 */
const revokeRefreshToken = async (token, reason = 'logout') => {
  await pool.query(
    `UPDATE refresh_tokens 
     SET revoked_at = now(), revoked_reason = $1
     WHERE token = $2`,
    [reason, token]
  )
}

/**
 * Middleware to authenticate JWT token
 */
const authenticateJWT = async (req, res, next) => {
  // DEVELOPMENT BYPASS: Skip authentication if DISABLE_AUTH is set
  if (process.env.DISABLE_AUTH === 'true') {
    req.user = {
      id: 'dev-user',
      email: 'dev@localhost',
      roles: ['admin'], // Give admin role for development
      name: 'Development User'
    }
    return next()
  }

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided. Please login.'
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'hsm-management',
      audience: 'hsm-api'
    })

    // Get user from database with current roles
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    )

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found or inactive'
      })
    }

    const user = userResult.rows[0]

    // Get fresh roles from database (in case they changed)
    const rolesResult = await pool.query(
      `SELECT role FROM user_roles 
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [user.id]
    )

    user.roles = rolesResult.rows.map(row => row.role)

    // Attach user to request object
    req.user = user

    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.'
      })
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication failed. Please login again.'
      })
    }

    console.error('JWT authentication error:', error)
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    })
  }
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work for both authenticated and unauthenticated users
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue without authentication
    req.user = null
    return next()
  }

  // Token provided - try to authenticate
  return authenticateJWT(req, res, next)
}

module.exports = {
  generateToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  authenticateJWT,
  optionalAuth,
  JWT_SECRET,
  JWT_EXPIRES_IN
}
