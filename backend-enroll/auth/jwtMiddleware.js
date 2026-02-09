const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-prod';
const ACCESS_TOKEN_EXPIRY = '7d';

// Generate Access Token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles || []
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// Generate Refresh Token
const generateRefreshToken = async (userId) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );

  return token;
};

// Refresh Access Token
const refreshAccessToken = async (refreshToken) => {
  try {
    const result = await pool.query(
      `SELECT rt.*, u.id as user_id, u.email, u.name, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid or expired refresh token' };
    }

    const tokenData = result.rows[0];

    if (!tokenData.is_active) {
      return { success: false, error: 'User account is disabled' };
    }

    // Get roles
    const roleResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND revoked_at IS NULL',
      [tokenData.user_id]
    );
    const roles = roleResult.rows.map(r => r.role);

    // Rotate token (revoke old, issue new)
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = $1 WHERE token = $2',
      ['token_rotation', refreshToken]
    );

    const newRefreshToken = await generateRefreshToken(tokenData.user_id);
    const newAccessToken = generateToken({
      id: tokenData.user_id,
      email: tokenData.email,
      name: tokenData.name,
      roles: roles
    });

    return { success: true, accessToken: newAccessToken, refreshToken: newRefreshToken };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { success: false, error: 'Internal server error' };
  }
};

// Revoke Refresh Token
const revokeRefreshToken = async (token, reason = 'manual_revoke') => {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW(), revoked_reason = $1 WHERE token = $2',
    [reason, token]
  );
};

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  } else {
    // Check for local dev bypass if configured
    if (req.user && process.env.DISABLE_AUTH === 'true') {
      return next();
    }
    res.status(401).json({ error: 'Authentication required' });
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  refreshAccessToken,
  revokeRefreshToken,
  authenticateJWT
};