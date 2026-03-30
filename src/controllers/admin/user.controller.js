const adminUserService = require('../../services/admin-user.service')

exports.getAllUsers = async (req, res) => {
  try {
    const users = await adminUserService.getAllUsers(req.adminSession)
    return res.json({ success: true, data: users })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getPermissionCatalog = async (req, res) => {
  try {
    const data = await adminUserService.getPermissionCatalog()
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getMyPermissionContext = async (req, res) => {
  try {
    const data = await adminUserService.getMyPermissionContext(req.admin)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.listPermissionRoles = async (req, res) => {
  try {
    const data = await adminUserService.listPermissionRoles()
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.createPermissionRole = async (req, res) => {
  try {
    const data = await adminUserService.createPermissionRole(req.body || {}, req.admin.id)
    return res.status(201).json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.updatePermissionRole = async (req, res) => {
  try {
    const data = await adminUserService.updatePermissionRole(
      req.params.roleId,
      req.body || {},
      req.admin.id
    )
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.assignPermissionRole = async (req, res) => {
  try {
    const { email, zohoUserId, permissionRoleId = null } = req.body || {}
    const data = await adminUserService.assignPermissionRole({
      targetEmail: email,
      targetZohoUserId: zohoUserId,
      permissionRoleId,
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.updateUserRole = async (req, res) => {
  try {
    const { email, zohoUserId, role } = req.body
    const result = await adminUserService.updateUserRole({
      targetEmail: email,
      targetZohoUserId: zohoUserId,
      role,
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data: result })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.allowUserLogin = async (req, res) => {
  try {
    const { email, zohoUserId } = req.body
    const result = await adminUserService.setLoginAccess({
      targetEmail: email,
      targetZohoUserId: zohoUserId,
      status: 'allowed',
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data: result })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.blockUserLogin = async (req, res) => {
  try {
    const { email, zohoUserId } = req.body
    const result = await adminUserService.setLoginAccess({
      targetEmail: email,
      targetZohoUserId: zohoUserId,
      status: 'blocked',
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data: result })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.setUserPassword = async (req, res) => {
  try {
    const { email, zohoUserId, password, fullName, department } = req.body
    const result = await adminUserService.setUserPassword({
      targetEmail: email,
      targetZohoUserId: zohoUserId,
      password,
      updatedBy: req.admin.id,
      fullName,
      department
    })
    return res.json({ success: true, data: result })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
