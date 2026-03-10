// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken')
const db = require('../config/db')

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' })
  }
  
  const token = authHeader.split(' ')[1]
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')

    // Enforce active customer session for tokens that include jti.
    if (decoded.jti && (!decoded.type || decoded.type === 'user')) {
      const [sessions] = await db.promise().query(
        `SELECT id FROM user_sessions
         WHERE user_id = ?
           AND jwt_id = ?
           AND token_hash = SHA2(?, 256)
           AND revoked_at IS NULL
           AND expires_at > NOW()
         LIMIT 1`,
        [decoded.id, decoded.jti, token]
      )

      if (sessions.length === 0) {
        return res.status(401).json({ error: 'Session expired or invalidated' })
      }
    }

    const [users] = await db.promise().query(
      `SELECT id, account_type, auth_version FROM users WHERE id = ? LIMIT 1`,
      [decoded.id]
    )
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' })
    }

    const currentAuthVersion = Number(users[0].auth_version || 1)
    const tokenAuthVersion = Number(decoded.authVersion || 1)
    if (tokenAuthVersion !== currentAuthVersion) {
      return res.status(401).json({ error: 'Session expired or invalidated' })
    }

    const accountType = String(users[0].account_type || decoded.accountType || 'trader').toLowerCase()
    req.user = {
      ...decoded,
      accountType,
      account_type: accountType
    }
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

const requireAccountType = (...allowedTypes) => {
  const normalized = allowedTypes.map((item) => String(item).toLowerCase())
  return (req, res, next) => {
    const currentType = String(req.user?.accountType || req.user?.account_type || '').toLowerCase()
    if (!normalized.includes(currentType)) {
      return res.status(403).json({ error: 'Access denied for this account type' })
    }
    next()
  }
}

// Export as an object
module.exports = {
  verifyToken,
  requireAccountType
}
