// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken')

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return secret
}

const extractToken = (req, options = {}) => {
  const { allowBodyToken = false, allowQueryToken = false } = options
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1]
  }

  if (allowBodyToken && req.body && typeof req.body.token === 'string') {
    return req.body.token
  }

  if (allowQueryToken && typeof req.query?.token === 'string') {
    return req.query.token
  }

  return null
}

const verifyToken = (req, res, next) => {
  const token = extractToken(req)
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' })
  }

  let secret
  try {
    secret = getJwtSecret()
  } catch (configError) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  try {
    const decoded = jwt.verify(token, secret)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

const verifyTokenFlexible = (req, res, next) => {
  const token = extractToken(req, { allowBodyToken: true, allowQueryToken: true })

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' })
  }

  let secret
  try {
    secret = getJwtSecret()
  } catch (configError) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  try {
    const decoded = jwt.verify(token, secret)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Export as an object
module.exports = {
  verifyToken,
  verifyTokenFlexible,
  extractToken
}
