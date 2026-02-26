const adminUserService = require('../../services/admin-user.service')

exports.getAllUsers = async (req, res) => {
  try {
    const users = await adminUserService.getAllUsers(req.adminSession)
    return res.json({ success: true, data: users })
  } catch (error) {
    return res.status(500).json({ error: error.message })
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
