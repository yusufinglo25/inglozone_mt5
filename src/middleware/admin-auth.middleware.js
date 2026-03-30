const jwt = require('jsonwebtoken')
const adminAuthService = require('../services/admin-auth.service')
const adminPermissionService = require('../services/admin-permission.service')

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
    const permissionContext = await adminPermissionService.resolveAdminPermissionContext({
      id: session.admin_user_id,
      email: session.email,
      role: session.role,
      permission_role_id: session.permission_role_id || null,
      zoho_user_id: session.zoho_user_id || null
    })

    req.adminToken = token
    req.admin = {
      id: session.admin_user_id,
      email: session.email,
      role: session.role,
      zohoUserId: session.zoho_user_id,
      fullName: session.full_name,
      department: session.department,
      permissionRoleId: permissionContext.permissionRoleId,
      permissionRoleName: permissionContext.permissionRoleName,
      permissions: permissionContext.permissions,
      permissionSource: permissionContext.source
    }
    req.adminPermissionContext = permissionContext
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

const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || String(req.admin.role || '').toLowerCase() !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden. Superadmin access required.' })
  }
  return next()
}

const requirePermissions = (...permissions) => (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ error: 'Unauthorized admin access' })
  }

  const normalizedRole = String(req.admin.role || '').toLowerCase()
  if (normalizedRole === 'superadmin') {
    return next()
  }

  const normalizedPermissions = permissions
    .map((permission) => String(permission || '').trim())
    .filter(Boolean)

  if (normalizedPermissions.length === 0) {
    return next()
  }

  const hasPermissions = adminPermissionService.hasPermissions(
    req.adminPermissionContext || req.admin,
    normalizedPermissions
  )

  if (!hasPermissions) {
    return res.status(403).json({ error: 'Forbidden. Insufficient permission access.' })
  }

  return next()
}

module.exports = {
  verifyAdminToken,
  requireRoles,
  requireSuperAdmin,
  requirePermissions
}
