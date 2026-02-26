const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const zohoService = require('./zoho.service')
const adminAuthService = require('./admin-auth.service')

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

    const roleByKey = new Map()
    for (const row of roleRows) {
      if (row.email) roleByKey.set(`email:${row.email.toLowerCase()}`, row.role)
      if (row.zoho_user_id) roleByKey.set(`zoho:${row.zoho_user_id}`, row.role)
    }

    const accessByKey = new Map()
    for (const row of accessRows) {
      if (row.email) accessByKey.set(`email:${row.email.toLowerCase()}`, row.login_access_status)
      if (row.zoho_user_id) accessByKey.set(`zoho:${row.zoho_user_id}`, row.login_access_status)
    }

    return employees.map((employee) => {
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
      return { success: true, role }
    }

    await db.promise().query(
      `INSERT INTO user_roles (id, email, zoho_user_id, role, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), normalizedEmail || null, targetZohoUserId || null, role, updatedBy]
    )
    return { success: true, role }
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
}

module.exports = new AdminUserService()
