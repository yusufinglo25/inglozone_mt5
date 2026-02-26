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

    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Export as an object
module.exports = {
  verifyToken
}
