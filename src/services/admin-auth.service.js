const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')
const zohoService = require('./zoho.service')

class AdminAuthService {
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  async createAdminSession(admin, sessionData = {}) {
    const jti = uuidv4()
    const token = jwt.sign(
      {
        type: 'admin',
        jti,
        adminId: admin.id,
        zohoUserId: admin.zoho_user_id,
        email: admin.email,
        role: admin.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h' }
    )

    const decoded = jwt.decode(token)
    const expiresAt = new Date((decoded.exp || 0) * 1000)

    await db.promise().query(
      `INSERT INTO admin_sessions (
        id, admin_user_id, jwt_id, session_token_hash, zoho_access_token, zoho_refresh_token,
        zoho_expires_at, ip_address, user_agent, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        admin.id,
        jti,
        this.hashToken(token),
        sessionData.zohoAccessToken || null,
        sessionData.zohoRefreshToken || null,
        sessionData.zohoExpiresAt || null,
        sessionData.ipAddress || null,
        sessionData.userAgent || null,
        expiresAt
      ]
    )

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        department: admin.department,
        role: admin.role
      }
    }
  }

  async loginWithZoho({ code, redirectUri, ipAddress, userAgent }) {
    const tokenData = await zohoService.exchangeAuthorizationCode(code, redirectUri)
    const profile = await zohoService.getUserProfile(tokenData.access_token)
    const admin = await this.getAuthorizedAdmin(profile)
    return this.createAdminSession(admin, {
      zohoAccessToken: tokenData.access_token || null,
      zohoRefreshToken: tokenData.refresh_token || null,
      zohoExpiresAt: tokenData.expires_in ? new Date(Date.now() + (tokenData.expires_in * 1000)) : null,
      ipAddress,
      userAgent
    })
  }

  async loginWithPassword({ email, password, ipAddress, userAgent }) {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail || !password) {
      throw new Error('Email and password are required')
    }

    const [rows] = await db.promise().query(
      `SELECT * FROM admin_users WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    )

    const admin = rows[0]
    if (!admin || !admin.password_hash) {
      throw new Error('Invalid credentials')
    }
    if (!admin.is_active) {
      throw new Error('Admin account is inactive')
    }

    const [accessRows] = await db.promise().query(
      `SELECT login_access_status
       FROM user_access_control
       WHERE email = ? OR zoho_user_id = ?
       LIMIT 1`,
      [admin.email, admin.zoho_user_id || null]
    )
    if (accessRows[0]?.login_access_status === 'blocked') {
      throw new Error('Login blocked for this admin')
    }

    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) {
      throw new Error('Invalid credentials')
    }

    return this.createAdminSession(admin, { ipAddress, userAgent })
  }

  async bootstrapSuperAdmin(bootstrapKey) {
    const expectedKey = process.env.SUPERADMIN_BOOTSTRAP_KEY || ''
    if (!expectedKey) {
      throw new Error('SUPERADMIN_BOOTSTRAP_KEY is not configured')
    }
    if (bootstrapKey !== expectedKey) {
      throw new Error('Invalid bootstrap key')
    }

    const email = 'yusuf.inglo@gmail.com'
    const password = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD || ''
    if (!password) {
      throw new Error('SUPERADMIN_BOOTSTRAP_PASSWORD is not configured')
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await db.promise().query(
      `INSERT INTO admin_users (id, full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'superadmin', true)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         password_hash = VALUES(password_hash),
         role = 'superadmin',
         is_active = true,
         updated_at = NOW()`,
      [uuidv4(), 'yusuf.inglo', email, passwordHash]
    )

    return {
      success: true,
      message: 'Superadmin bootstrapped successfully',
      email
    }
  }

  async logout(token, decoded) {
    await db.promise().query(
      `UPDATE admin_sessions
       SET revoked_at = NOW(), last_activity_at = NOW()
       WHERE jwt_id = ? AND session_token_hash = ? AND revoked_at IS NULL`,
      [decoded.jti, this.hashToken(token)]
    )
  }

  async validateSession(token, decoded) {
    const [rows] = await db.promise().query(
      `SELECT s.*, a.email, a.role, a.is_active, a.full_name, a.department, a.zoho_user_id
       FROM admin_sessions s
       JOIN admin_users a ON a.id = s.admin_user_id
       WHERE s.jwt_id = ?
         AND s.session_token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
       LIMIT 1`,
      [decoded.jti, this.hashToken(token)]
    )

    const session = rows[0]
    if (!session) {
      throw new Error('Invalid admin session')
    }

    if (!session.is_active) {
      throw new Error('Admin account is inactive')
    }

    const [accessRows] = await db.promise().query(
      `SELECT login_access_status
       FROM user_access_control
       WHERE email = ? OR zoho_user_id = ?
       LIMIT 1`,
      [session.email, session.zoho_user_id || null]
    )
    if (accessRows[0]?.login_access_status === 'blocked') {
      throw new Error('Login blocked for this admin')
    }

    await db.promise().query(
      `UPDATE admin_sessions SET last_activity_at = NOW() WHERE id = ?`,
      [session.id]
    )

    return session
  }

  async getValidZohoAccessToken(session) {
    if (!session.zoho_access_token) {
      throw new Error('No Zoho access token stored in session')
    }

    if (session.zoho_expires_at && new Date(session.zoho_expires_at).getTime() - Date.now() > 120000) {
      return session.zoho_access_token
    }

    if (!session.zoho_refresh_token) {
      return session.zoho_access_token
    }

    const refreshed = await zohoService.refreshAccessToken(session.zoho_refresh_token)
    const newAccessToken = refreshed.access_token || session.zoho_access_token
    const refreshToken = refreshed.refresh_token || session.zoho_refresh_token
    const expiresAt = refreshed.expires_in
      ? new Date(Date.now() + (refreshed.expires_in * 1000))
      : session.zoho_expires_at

    await db.promise().query(
      `UPDATE admin_sessions
       SET zoho_access_token = ?, zoho_refresh_token = ?, zoho_expires_at = ?
       WHERE id = ?`,
      [newAccessToken, refreshToken, expiresAt, session.id]
    )

    return newAccessToken
  }

  async getAuthorizedAdmin(profile) {
    const [rows] = await db.promise().query(
      `SELECT *
       FROM admin_users
       WHERE (zoho_user_id = ? AND zoho_user_id IS NOT NULL)
          OR email = ?
       LIMIT 1`,
      [profile.zohoUserId || null, profile.email]
    )

    const admin = rows[0]
    if (!admin) {
      throw new Error('Admin user is not registered')
    }

    if (!admin.is_active) {
      throw new Error('Admin user is disabled')
    }

    await db.promise().query(
      `UPDATE admin_users
       SET zoho_user_id = ?, email = ?, full_name = ?, department = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        profile.zohoUserId || admin.zoho_user_id,
        profile.email || admin.email,
        profile.fullName || admin.full_name,
        profile.department || admin.department,
        admin.id
      ]
    )

    const [updatedRows] = await db.promise().query(
      `SELECT * FROM admin_users WHERE id = ? LIMIT 1`,
      [admin.id]
    )
    return updatedRows[0]
  }
}

module.exports = new AdminAuthService()
