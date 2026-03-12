const db = require('../config/db')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const zohoService = require('./zoho.service')
const adminAuthService = require('./admin-auth.service')
const { validatePasswordPolicy } = require('../utils/password-policy')

class AdminUserService {
  async getAllUsers(adminSession) {
    const zohoAccessToken = await adminAuthService.getValidZohoAccessToken(adminSession)
    const employees = await zohoService.getEmployees(zohoAccessToken)

    const [roleRows] = await db.promise().query(
      `SELECT email, zoho_user_id, role FROM user_roles`
    )
    const [accessRows] = await db.promise().query(
      `SELECT email, zoho_user_id, login_access_status FROM user_access_control`
    )
    const [adminUserRows] = await db.promise().query(
      `SELECT id, email, zoho_user_id, role
       FROM admin_users`
    )

    const roleByKey = new Map()
    for (const row of roleRows) {
      if (row.email) roleByKey.set(`email:${row.email.toLowerCase()}`, row.role)
      if (row.zoho_user_id) roleByKey.set(`zoho:${row.zoho_user_id}`, row.role)
    }
    for (const row of adminUserRows) {
      if (row.email) roleByKey.set(`email:${row.email.toLowerCase()}`, row.role)
      if (row.zoho_user_id) roleByKey.set(`zoho:${row.zoho_user_id}`, row.role)
    }

    const accessByKey = new Map()
    for (const row of accessRows) {
      if (row.email) accessByKey.set(`email:${row.email.toLowerCase()}`, row.login_access_status)
      if (row.zoho_user_id) accessByKey.set(`zoho:${row.zoho_user_id}`, row.login_access_status)
    }

    const mapped = employees.map((employee) => {
      const role =
        roleByKey.get(`zoho:${employee.zohoUserId}`) ||
        roleByKey.get(`email:${employee.email.toLowerCase()}`) ||
        'accounts'

      const loginAccessStatus =
        accessByKey.get(`zoho:${employee.zohoUserId}`) ||
        accessByKey.get(`email:${employee.email.toLowerCase()}`) ||
        'allowed'

      return {
        fullName: employee.fullName,
        email: employee.email,
        department: employee.department,
        status: employee.status,
        role,
        loginAccessStatus,
        zohoUserId: employee.zohoUserId
      }
    })

    // Keep admin_users in sync with Zoho employee master data every fetch.
    // Preserves password_hash and existing role while refreshing profile fields.
    for (const user of mapped) {
      await db.promise().query(
        `INSERT INTO admin_users (id, zoho_user_id, full_name, email, password_hash, department, role, is_active)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           zoho_user_id = VALUES(zoho_user_id),
           full_name = VALUES(full_name),
           email = VALUES(email),
           department = VALUES(department),
           is_active = VALUES(is_active),
           updated_at = NOW()`,
        [
          uuidv4(),
          user.zohoUserId || null,
          user.fullName || (user.email ? user.email.split('@')[0] : 'zoho_user'),
          user.email,
          user.department || null,
          user.role,
          user.status === 'Terminated' ? 0 : 1
        ]
      )
    }

    return mapped
  }

  async updateUserRole({ targetEmail, targetZohoUserId, role, updatedBy }) {
    if (!['superadmin', 'admin', 'accounts'].includes(role)) {
      throw new Error('Invalid role')
    }

    const normalizedEmail = (targetEmail || '').toLowerCase()
    if (!normalizedEmail && !targetZohoUserId) {
      throw new Error('email or zohoUserId is required')
    }

    const [rows] = await db.promise().query(
      `SELECT id FROM user_roles WHERE email = ? OR zoho_user_id = ? LIMIT 1`,
      [normalizedEmail || null, targetZohoUserId || null]
    )

    if (rows.length > 0) {
      await db.promise().query(
        `UPDATE user_roles
         SET email = ?, zoho_user_id = ?, role = ?, updated_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [normalizedEmail || null, targetZohoUserId || null, role, updatedBy, rows[0].id]
      )
      await this.syncAdminUserRole(normalizedEmail || null, targetZohoUserId || null, role)
      return { success: true, role, note: 'User should logout/login again for new role token claims.' }
    }

    await db.promise().query(
      `INSERT INTO user_roles (id, email, zoho_user_id, role, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), normalizedEmail || null, targetZohoUserId || null, role, updatedBy]
    )
    await this.syncAdminUserRole(normalizedEmail || null, targetZohoUserId || null, role)
    return { success: true, role, note: 'User should logout/login again for new role token claims.' }
  }

  async syncAdminUserRole(email, zohoUserId, role) {
    const [adminRows] = await db.promise().query(
      `SELECT id
       FROM admin_users
       WHERE email = ? OR zoho_user_id = ?
       LIMIT 1`,
      [email || null, zohoUserId || null]
    )

    if (adminRows.length > 0) {
      await db.promise().query(
        `UPDATE admin_users
         SET role = ?, updated_at = NOW()
         WHERE id = ?`,
        [role, adminRows[0].id]
      )
      return
    }

    const fallbackName = email ? email.split('@')[0] : 'zoho_user'
    await db.promise().query(
      `INSERT INTO admin_users (id, zoho_user_id, full_name, email, password_hash, department, role, is_active)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, true)`,
      [uuidv4(), zohoUserId || null, fallbackName, email || `${zohoUserId || uuidv4()}@zoho.local`, role]
    )
  }

  async setLoginAccess({ targetEmail, targetZohoUserId, status, updatedBy }) {
    if (!['allowed', 'blocked'].includes(status)) {
      throw new Error('Invalid login access status')
    }

    const normalizedEmail = (targetEmail || '').toLowerCase()
    if (!normalizedEmail && !targetZohoUserId) {
      throw new Error('email or zohoUserId is required')
    }

    const [rows] = await db.promise().query(
      `SELECT id FROM user_access_control WHERE email = ? OR zoho_user_id = ? LIMIT 1`,
      [normalizedEmail || null, targetZohoUserId || null]
    )

    if (rows.length > 0) {
      await db.promise().query(
        `UPDATE user_access_control
         SET email = ?, zoho_user_id = ?, login_access_status = ?, updated_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [normalizedEmail || null, targetZohoUserId || null, status, updatedBy, rows[0].id]
      )
      return { success: true, loginAccessStatus: status }
    }

    await db.promise().query(
      `INSERT INTO user_access_control (id, email, zoho_user_id, login_access_status, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), normalizedEmail || null, targetZohoUserId || null, status, updatedBy]
    )

    return { success: true, loginAccessStatus: status }
  }

  async setUserPassword({
    targetEmail,
    targetZohoUserId,
    password,
    updatedBy,
    fullName = null,
    department = null
  }) {
    const normalizedEmail = (targetEmail || '').trim().toLowerCase()
    if (!normalizedEmail && !targetZohoUserId) {
      throw new Error('email or zohoUserId is required')
    }
    if (!password) {
      throw new Error('Password is required')
    }

    const passwordError = validatePasswordPolicy(password)
    if (passwordError) {
      throw new Error(passwordError)
    }

    const hash = await bcrypt.hash(password, 10)

    const [rows] = await db.promise().query(
      `SELECT id, role
       FROM admin_users
       WHERE email = ? OR zoho_user_id = ?
       LIMIT 1`,
      [normalizedEmail || null, targetZohoUserId || null]
    )

    if (rows.length > 0) {
      await db.promise().query(
        `UPDATE admin_users
         SET email = COALESCE(?, email),
             zoho_user_id = COALESCE(?, zoho_user_id),
             password_hash = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [normalizedEmail || null, targetZohoUserId || null, hash, rows[0].id]
      )
      return { success: true, message: 'Password updated successfully' }
    }

    const [roleRows] = await db.promise().query(
      `SELECT role FROM user_roles WHERE email = ? OR zoho_user_id = ? LIMIT 1`,
      [normalizedEmail || null, targetZohoUserId || null]
    )
    const derivedRole = roleRows[0]?.role || 'accounts'
    const name = fullName || (normalizedEmail ? normalizedEmail.split('@')[0] : 'zoho_user')

    await db.promise().query(
      `INSERT INTO admin_users (id, zoho_user_id, full_name, email, password_hash, department, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, true)`,
      [uuidv4(), targetZohoUserId || null, name, normalizedEmail, hash, department, derivedRole]
    )

    await db.promise().query(
      `INSERT INTO user_access_control (id, zoho_user_id, email, login_access_status, updated_by)
       VALUES (?, ?, ?, 'allowed', ?)
       ON DUPLICATE KEY UPDATE
         login_access_status = VALUES(login_access_status),
         updated_by = VALUES(updated_by),
         updated_at = NOW()`,
      [uuidv4(), targetZohoUserId || null, normalizedEmail, updatedBy]
    )

    return { success: true, message: 'Password created successfully' }
  }
}

module.exports = new AdminUserService()
