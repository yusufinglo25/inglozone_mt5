const jwt = require('jsonwebtoken')
const adminAuthService = require('../services/admin-auth.service')

const verifyAdminToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No admin token provided.' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.type !== 'admin' || !decoded.adminId) {
      return res.status(401).json({ error: 'Invalid admin token' })
    }

    const session = await adminAuthService.validateSession(token, decoded)

    req.adminToken = token
    req.admin = {
      id: decoded.adminId,
      email: decoded.email,
      role: decoded.role,
      zohoUserId: decoded.zohoUserId,
      fullName: session.full_name,
      department: session.department
    }
    req.adminSession = session
    next()
  } catch (error) {
    return res.status(401).json({ error: error.message || 'Unauthorized admin access' })
  }
}

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    return res.status(403).json({ error: 'Forbidden. Insufficient role permissions.' })
  }
  return next()
}

module.exports = {
  verifyAdminToken,
  requireRoles
}
