const adminAuthService = require('../../services/admin-auth.service')

exports.login = async (req, res) => {
  try {
    const { code, redirectUri } = req.body
    if (!code) {
      return res.status(400).json({ error: 'Zoho OAuth authorization code is required' })
    }

    const result = await adminAuthService.loginWithZoho({
      code,
      redirectUri,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })

    return res.json({
      success: true,
      message: 'Admin login successful',
      token: result.token,
      admin: result.admin
    })
  } catch (error) {
    return res.status(401).json({ error: error.message })
  }
}

exports.loginWithPassword = async (req, res) => {
  try {
    const { email, password } = req.body
    const result = await adminAuthService.loginWithPassword({
      email,
      password,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })

    return res.json({
      success: true,
      message: 'Admin login successful',
      token: result.token,
      admin: result.admin
    })
  } catch (error) {
    return res.status(401).json({ error: error.message })
  }
}

exports.bootstrapSuperAdmin = async (req, res) => {
  try {
    const bootstrapKey = req.headers['x-bootstrap-key'] || req.body.bootstrapKey
    const result = await adminAuthService.bootstrapSuperAdmin(bootstrapKey)
    return res.json(result)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.logout = async (req, res) => {
  try {
    await adminAuthService.logout(req.adminToken, { jti: req.adminSession.jwt_id })
    return res.json({ success: true, message: 'Admin logout successful' })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
