const adminAuthService = require('../../services/admin-auth.service')

exports.getZohoAuthorizeUrl = async (req, res) => {
  try {
    const authUrl = adminAuthService.getZohoAuthorizeUrl(req.query.redirectUri)
    return res.json({ success: true, authUrl })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.zohoCallback = async (req, res) => {
  try {
    const code = String(req.query.code || '').trim()
    if (!code) {
      return res.status(400).send('Zoho OAuth code is missing')
    }

    const redirectUri = process.env.ZOHO_REDIRECT_URI || `${process.env.BASE_URL || ''}/api/admin/auth/zoho/callback`
    const result = await adminAuthService.loginWithZoho({
      code,
      redirectUri,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })

    const adminFrontendUrl = String(
      process.env.ADMIN_FRONTEND_URL || 'https://inglo-zone-admin-panel.vercel.app'
    ).replace(/\/$/, '')
    const callbackUrl = new URL('/auth/zoho-callback', adminFrontendUrl)
    callbackUrl.searchParams.set('token', result.token)
    callbackUrl.searchParams.set('role', result.admin.role || '')
    callbackUrl.searchParams.set('email', result.admin.email || '')

    return res.redirect(callbackUrl.toString())
  } catch (error) {
    const adminFrontendUrl = String(
      process.env.ADMIN_FRONTEND_URL || 'https://inglo-zone-admin-panel.vercel.app'
    ).replace(/\/$/, '')
    const callbackUrl = new URL('/auth/zoho-callback', adminFrontendUrl)
    callbackUrl.searchParams.set('error', error.message || 'Zoho login failed')
    return res.redirect(callbackUrl.toString())
  }
}

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
