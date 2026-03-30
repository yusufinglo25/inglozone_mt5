const db = require('../config/db')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const zohoService = require('./zoho.service')
const adminAuthService = require('./admin-auth.service')
const adminPermissionService = require('./admin-permission.service')
const { validatePasswordPolicy } = require('../utils/password-policy')

class AdminUserService {
  async getAllUsers(adminSession) {
    const zohoAccessToken = await adminAuthService.getValidZohoAccessToken(adminSession)
    const employees = await zohoService.getEmployees(zohoAccessToken)

    let roleRows
    try {
      ;([roleRows] = await db.promise().query(
        `SELECT
           ur.email, ur.zoho_user_id, ur.role, ur.permission_role_id,
           apr.name AS permission_role_name, apr.description AS permission_role_description
         FROM user_roles ur
         LEFT JOIN admin_permission_roles apr ON apr.id = ur.permission_role_id`
      ))
    } catch (error) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(String(error?.code || ''))) {
        throw error
      }
      ;([roleRows] = await db.promise().query(
        `SELECT email, zoho_user_id, role
         FROM user_roles`
      ))
    }
    const [accessRows] = await db.promise().query(
      `SELECT email, zoho_user_id, login_access_status FROM user_access_control`
    )
    let adminUserRows
    try {
      ;([adminUserRows] = await db.promise().query(
        `SELECT
           au.id, au.email, au.zoho_user_id, au.role, au.permission_role_id,
           apr.name AS permission_role_name, apr.description AS permission_role_description
         FROM admin_users au
         LEFT JOIN admin_permission_roles apr ON apr.id = au.permission_role_id`
      ))
    } catch (error) {
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(String(error?.code || ''))) {
        throw error
      }
      ;([adminUserRows] = await db.promise().query(
        `SELECT id, email, zoho_user_id, role
         FROM admin_users`
      ))
    }

    const roleByKey = new Map()
    const permissionRoleByKey = new Map()
    for (const row of roleRows) {
      if (row.email) roleByKey.set(`email:${row.email.toLowerCase()}`, row.role)
      if (row.zoho_user_id) roleByKey.set(`zoho:${row.zoho_user_id}`, row.role)
      if (row.permission_role_id) {
        const value = {
          id: row.permission_role_id,
          name: row.permission_role_name || null,
          description: row.permission_role_description || null
        }
        if (row.email) permissionRoleByKey.set(`email:${row.email.toLowerCase()}`, value)
        if (row.zoho_user_id) permissionRoleByKey.set(`zoho:${row.zoho_user_id}`, value)
      }
    }
    for (const row of adminUserRows) {
      if (row.email) roleByKey.set(`email:${row.email.toLowerCase()}`, row.role)
      if (row.zoho_user_id) roleByKey.set(`zoho:${row.zoho_user_id}`, row.role)
      if (row.permission_role_id) {
        const value = {
          id: row.permission_role_id,
          name: row.permission_role_name || null,
          description: row.permission_role_description || null
        }
        if (row.email) permissionRoleByKey.set(`email:${row.email.toLowerCase()}`, value)
        if (row.zoho_user_id) permissionRoleByKey.set(`zoho:${row.zoho_user_id}`, value)
      }
    }

    const accessByKey = new Map()
    for (const row of accessRows) {
      if (row.email) accessByKey.set(`email:${row.email.toLowerCase()}`, row.login_access_status)
      if (row.zoho_user_id) accessByKey.set(`zoho:${row.zoho_user_id}`, row.login_access_status)
    }

    const mapped = employees.map((employee) => {
      const legacyRole =
        roleByKey.get(`zoho:${employee.zohoUserId}`) ||
        roleByKey.get(`email:${employee.email.toLowerCase()}`) ||
        'accounts'
      const permissionRole =
        permissionRoleByKey.get(`zoho:${employee.zohoUserId}`) ||
        permissionRoleByKey.get(`email:${employee.email.toLowerCase()}`) ||
        null

      const loginAccessStatus =
        accessByKey.get(`zoho:${employee.zohoUserId}`) ||
        accessByKey.get(`email:${employee.email.toLowerCase()}`) ||
        'allowed'

      return {
        fullName: employee.fullName,
        email: employee.email,
        department: employee.department,
        status: employee.status,
        role: legacyRole,
        legacyRole,
        permissionRoleId: permissionRole?.id || null,
        permissionRoleName: permissionRole?.name || null,
        permissionRoleDescription: permissionRole?.description || null,
        effectiveAccessSource: permissionRole?.id ? 'custom_role' : 'legacy_role',
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
          user.legacyRole,
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
         SET email = ?, zoho_user_id = ?, role = ?, permission_role_id = NULL, updated_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [normalizedEmail || null, targetZohoUserId || null, role, updatedBy, rows[0].id]
      )
      await this.syncAdminUserRole(normalizedEmail || null, targetZohoUserId || null, role)
      return { success: true, role, note: 'User should logout/login again for new role token claims.' }
    }

    await db.promise().query(
      `INSERT INTO user_roles (id, email, zoho_user_id, role, permission_role_id, updated_by)
       VALUES (?, ?, ?, ?, NULL, ?)`,
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
         SET role = ?, permission_role_id = NULL, updated_at = NOW()
         WHERE id = ?`,
        [role, adminRows[0].id]
      )
      return
    }

    const fallbackName = email ? email.split('@')[0] : 'zoho_user'
    await db.promise().query(
      `INSERT INTO admin_users (id, zoho_user_id, full_name, email, password_hash, department, role, permission_role_id, is_active)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, true)`,
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
      `SELECT role, permission_role_id FROM user_roles WHERE email = ? OR zoho_user_id = ? LIMIT 1`,
      [normalizedEmail || null, targetZohoUserId || null]
    )
    const derivedRole = roleRows[0]?.role || 'accounts'
    const derivedPermissionRoleId = roleRows[0]?.permission_role_id || null
    const name = fullName || (normalizedEmail ? normalizedEmail.split('@')[0] : 'zoho_user')

    await db.promise().query(
      `INSERT INTO admin_users (id, zoho_user_id, full_name, email, password_hash, department, role, permission_role_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [uuidv4(), targetZohoUserId || null, name, normalizedEmail, hash, department, derivedRole, derivedPermissionRoleId]
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

  async getPermissionCatalog() {
    return adminPermissionService.getCatalog()
  }

  async getMyPermissionContext(admin) {
    return adminPermissionService.resolveAdminPermissionContext({
      id: admin?.id,
      email: admin?.email,
      role: admin?.role,
      permission_role_id: admin?.permissionRoleId || null,
      zoho_user_id: admin?.zohoUserId || null
    })
  }

  async listPermissionRoles() {
    return adminPermissionService.listRoles()
  }

  async createPermissionRole(payload = {}, updatedBy) {
    return adminPermissionService.createRole({
      name: payload.name,
      description: payload.description,
      permissions: payload.permissions,
      createdBy: updatedBy
    })
  }

  async updatePermissionRole(roleId, payload = {}, updatedBy) {
    return adminPermissionService.updateRole(roleId, payload, updatedBy)
  }

  async assignPermissionRole({ targetEmail, targetZohoUserId, permissionRoleId, updatedBy }) {
    return adminPermissionService.assignRoleToUser({
      targetEmail,
      targetZohoUserId,
      permissionRoleId,
      updatedBy
    })
  }
}

module.exports = new AdminUserService()
