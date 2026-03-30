const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')
const {
  getPermissionCatalog,
  getPermissionModule,
  getLegacyPermissions
} = require('../config/admin-permissions')

function toBoolean(value) {
  if (typeof value === 'boolean') return value
  const normalized = String(value || '').trim().toLowerCase()
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized)
}

function isSchemaNotReadyError(error) {
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(String(error?.code || ''))
}

class AdminPermissionService {
  getCatalog() {
    return getPermissionCatalog()
  }

  normalizeAssignments(input) {
    const catalog = this.getCatalog()
    const supportedKeys = new Set(catalog.map((item) => item.key))
    let rawItems = []

    if (Array.isArray(input)) {
      rawItems = input
    } else if (input && typeof input === 'object') {
      rawItems = Object.entries(input).map(([key, value]) => ({
        key,
        ...(value && typeof value === 'object'
          ? value
          : { read: Boolean(value), write: false })
      }))
    }

    const normalized = []
    for (const item of rawItems) {
      const key = String(item?.key || item?.permissionKey || item?.moduleKey || '').trim()
      if (!key || !supportedKeys.has(key)) continue

      const moduleMeta = getPermissionModule(key)
      if (!moduleMeta) continue

      const canWrite = Boolean(moduleMeta.supports.write) && toBoolean(
        item?.canWrite !== undefined ? item.canWrite : item?.write
      )
      const canRead = Boolean(moduleMeta.supports.read) && (
        canWrite ||
        toBoolean(item?.canRead !== undefined ? item.canRead : item?.read)
      )

      if (!canRead && !canWrite) continue

      normalized.push({
        key,
        label: moduleMeta.label,
        canRead,
        canWrite
      })
    }

    normalized.sort((a, b) => a.key.localeCompare(b.key))
    return normalized
  }

  buildPermissionTokensFromAssignments(assignments = []) {
    const tokens = new Set()
    assignments.forEach((assignment) => {
      if (assignment.canRead) tokens.add(`${assignment.key}.read`)
      if (assignment.canWrite) {
        tokens.add(`${assignment.key}.write`)
        tokens.add(`${assignment.key}.read`)
      }
    })
    return [...tokens].sort()
  }

  buildPermissionTokensFromRows(rows = []) {
    return this.buildPermissionTokensFromAssignments(
      rows.map((row) => ({
        key: row.permission_key,
        canRead: Boolean(row.can_read),
        canWrite: Boolean(row.can_write)
      }))
    )
  }

  async getRoleById(roleId) {
    const normalizedRoleId = String(roleId || '').trim()
    if (!normalizedRoleId) return null

    let roleRows
    try {
      ;([roleRows] = await db.promise().query(
        `SELECT id, name, description, is_active, created_by, updated_by, created_at, updated_at
         FROM admin_permission_roles
         WHERE id = ?
         LIMIT 1`,
        [normalizedRoleId]
      ))
    } catch (error) {
      if (isSchemaNotReadyError(error)) return null
      throw error
    }

    const role = roleRows[0]
    if (!role) return null

    let permissionRows
    try {
      ;([permissionRows] = await db.promise().query(
        `SELECT permission_key, can_read, can_write
         FROM admin_permission_role_permissions
         WHERE role_id = ?
         ORDER BY permission_key ASC`,
        [normalizedRoleId]
      ))
    } catch (error) {
      if (isSchemaNotReadyError(error)) permissionRows = []
      else throw error
    }

    return {
      ...role,
      permissions: permissionRows.map((row) => ({
        key: row.permission_key,
        canRead: Boolean(row.can_read),
        canWrite: Boolean(row.can_write)
      })),
      permissionTokens: this.buildPermissionTokensFromRows(permissionRows)
    }
  }

  async listRoles() {
    let roleRows
    let permissionRows
    try {
      ;([roleRows] = await db.promise().query(
        `SELECT
           r.id, r.name, r.description, r.is_active, r.created_by, r.updated_by, r.created_at, r.updated_at,
           COUNT(DISTINCT au.id) AS assigned_user_count
         FROM admin_permission_roles r
         LEFT JOIN admin_users au ON au.permission_role_id = r.id
         GROUP BY r.id, r.name, r.description, r.is_active, r.created_by, r.updated_by, r.created_at, r.updated_at
         ORDER BY r.name ASC`
      ))

      ;([permissionRows] = await db.promise().query(
        `SELECT role_id, permission_key, can_read, can_write
         FROM admin_permission_role_permissions
         ORDER BY permission_key ASC`
      ))
    } catch (error) {
      if (isSchemaNotReadyError(error)) {
        throw new Error('Permission role tables are not ready yet. Please retry in a moment.')
      }
      throw error
    }

    const permissionsByRoleId = new Map()
    permissionRows.forEach((row) => {
      if (!permissionsByRoleId.has(row.role_id)) {
        permissionsByRoleId.set(row.role_id, [])
      }
      permissionsByRoleId.get(row.role_id).push(row)
    })

    return roleRows.map((role) => {
      const rows = permissionsByRoleId.get(role.id) || []
      return {
        ...role,
        assignedUserCount: Number(role.assigned_user_count || 0),
        permissions: rows.map((row) => ({
          key: row.permission_key,
          canRead: Boolean(row.can_read),
          canWrite: Boolean(row.can_write)
        })),
        permissionTokens: this.buildPermissionTokensFromRows(rows)
      }
    })
  }

  async saveRolePermissions(roleId, assignments = []) {
    await db.promise().query(
      `DELETE FROM admin_permission_role_permissions WHERE role_id = ?`,
      [roleId]
    )

    for (const assignment of assignments) {
      await db.promise().query(
        `INSERT INTO admin_permission_role_permissions
         (id, role_id, permission_key, can_read, can_write)
         VALUES (?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          roleId,
          assignment.key,
          assignment.canRead ? 1 : 0,
          assignment.canWrite ? 1 : 0
        ]
      )
    }
  }

  async createRole({ name, description = null, permissions = [], createdBy }) {
    const normalizedName = String(name || '').trim()
    if (!normalizedName) {
      throw new Error('Role name is required')
    }

    const assignments = this.normalizeAssignments(permissions)
    if (assignments.length === 0) {
      throw new Error('At least one permission must be selected')
    }

    const [existingRows] = await db.promise().query(
      `SELECT id FROM admin_permission_roles WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [normalizedName]
    )
    if (existingRows.length > 0) {
      throw new Error('A role with this name already exists')
    }

    const roleId = uuidv4()
    await db.promise().query(
      `INSERT INTO admin_permission_roles
       (id, name, description, is_active, created_by, updated_by)
       VALUES (?, ?, ?, true, ?, ?)`,
      [roleId, normalizedName, description ? String(description).trim() : null, createdBy, createdBy]
    )

    await this.saveRolePermissions(roleId, assignments)
    return this.getRoleById(roleId)
  }

  async updateRole(roleId, payload = {}, updatedBy) {
    const role = await this.getRoleById(roleId)
    if (!role) {
      throw new Error('Permission role not found')
    }

    const nextName = payload.name !== undefined ? String(payload.name || '').trim() : role.name
    if (!nextName) {
      throw new Error('Role name is required')
    }

    const assignments = payload.permissions !== undefined
      ? this.normalizeAssignments(payload.permissions)
      : this.normalizeAssignments(role.permissions)

    if (assignments.length === 0) {
      throw new Error('At least one permission must be selected')
    }

    const [duplicateRows] = await db.promise().query(
      `SELECT id
       FROM admin_permission_roles
       WHERE LOWER(name) = LOWER(?)
         AND id <> ?
       LIMIT 1`,
      [nextName, role.id]
    )
    if (duplicateRows.length > 0) {
      throw new Error('Another role with this name already exists')
    }

    const nextDescription = payload.description !== undefined
      ? (payload.description ? String(payload.description).trim() : null)
      : role.description
    const nextActive = payload.isActive !== undefined ? toBoolean(payload.isActive) : Boolean(role.is_active)

    await db.promise().query(
      `UPDATE admin_permission_roles
       SET name = ?,
           description = ?,
           is_active = ?,
           updated_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [nextName, nextDescription, nextActive ? 1 : 0, updatedBy, role.id]
    )

    await this.saveRolePermissions(role.id, assignments)
    return this.getRoleById(role.id)
  }

  async assignRoleToUser({ targetEmail, targetZohoUserId, permissionRoleId, updatedBy }) {
    const normalizedEmail = String(targetEmail || '').trim().toLowerCase()
    const normalizedZohoUserId = String(targetZohoUserId || '').trim()

    if (!normalizedEmail && !normalizedZohoUserId) {
      throw new Error('email or zohoUserId is required')
    }

    let roleId = null
    let role = null
    if (permissionRoleId !== null && permissionRoleId !== undefined && String(permissionRoleId).trim()) {
      roleId = String(permissionRoleId).trim()
      role = await this.getRoleById(roleId)
      if (!role) {
        throw new Error('Permission role not found')
      }
      if (!role.is_active) {
        throw new Error('Permission role is inactive')
      }
    }

    const [mappingRows] = await db.promise().query(
      `SELECT id
       FROM user_roles
       WHERE email = ? OR zoho_user_id = ?
       LIMIT 1`,
      [normalizedEmail || null, normalizedZohoUserId || null]
    )

    if (mappingRows.length > 0) {
      await db.promise().query(
        `UPDATE user_roles
         SET email = ?,
             zoho_user_id = ?,
             permission_role_id = ?,
             updated_by = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          normalizedEmail || null,
          normalizedZohoUserId || null,
          roleId,
          updatedBy,
          mappingRows[0].id
        ]
      )
    } else {
      let fallbackLegacyRole = 'accounts'
      const [adminRows] = await db.promise().query(
        `SELECT role
         FROM admin_users
         WHERE email = ? OR zoho_user_id = ?
         LIMIT 1`,
        [normalizedEmail || null, normalizedZohoUserId || null]
      )
      if (adminRows[0]?.role) {
        fallbackLegacyRole = String(adminRows[0].role)
      }

      await db.promise().query(
        `INSERT INTO user_roles
         (id, email, zoho_user_id, role, permission_role_id, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          normalizedEmail || null,
          normalizedZohoUserId || null,
          fallbackLegacyRole,
          roleId,
          updatedBy
        ]
      )
    }

    await db.promise().query(
      `UPDATE admin_users
       SET permission_role_id = ?,
           updated_at = NOW()
       WHERE email = ? OR zoho_user_id = ?`,
      [roleId, normalizedEmail || null, normalizedZohoUserId || null]
    )

    return {
      success: true,
      permissionRoleId: role ? role.id : null,
      permissionRoleName: role ? role.name : null,
      note: role
        ? 'Custom permission role assigned successfully.'
        : 'Custom permission role removed. Legacy role fallback remains active.'
    }
  }

  async resolvePermissionRoleIdForAdmin(admin) {
    if (admin?.permission_role_id) {
      return String(admin.permission_role_id).trim()
    }

    const email = String(admin?.email || '').trim().toLowerCase()
    const zohoUserId = String(admin?.zoho_user_id || admin?.zohoUserId || '').trim()
    if (!email && !zohoUserId) return null

    let rows
    try {
      ;([rows] = await db.promise().query(
        `SELECT permission_role_id
         FROM user_roles
         WHERE email = ? OR zoho_user_id = ?
         LIMIT 1`,
        [email || null, zohoUserId || null]
      ))
    } catch (error) {
      if (isSchemaNotReadyError(error)) return null
      throw error
    }

    return rows[0]?.permission_role_id ? String(rows[0].permission_role_id).trim() : null
  }

  async resolveAdminPermissionContext(adminInput = {}) {
    let admin = { ...adminInput }

    if (!admin.id && admin.adminId) {
      admin.id = admin.adminId
    }

    if (admin.id) {
      let rows
      try {
        ;([rows] = await db.promise().query(
          `SELECT id, email, role, permission_role_id, zoho_user_id
           FROM admin_users
           WHERE id = ?
           LIMIT 1`,
          [admin.id]
        ))
      } catch (error) {
        if (!isSchemaNotReadyError(error)) throw error
        ;([rows] = await db.promise().query(
          `SELECT id, email, role, zoho_user_id
           FROM admin_users
           WHERE id = ?
           LIMIT 1`,
          [admin.id]
        ))
      }
      if (rows[0]) {
        admin = { ...admin, ...rows[0] }
      }
    }

    const role = String(admin.role || '').trim().toLowerCase()
    const baseContext = {
      adminId: admin.id || null,
      legacyRole: role || null,
      permissionRoleId: null,
      permissionRoleName: null,
      permissionRoleDescription: null,
      source: 'legacy_role',
      permissions: [],
      catalog: this.getCatalog()
    }

    if (role === 'superadmin') {
      return {
        ...baseContext,
        source: 'superadmin',
        permissions: getLegacyPermissions('superadmin')
      }
    }

    const permissionRoleId = await this.resolvePermissionRoleIdForAdmin(admin)
    if (permissionRoleId) {
      const permissionRole = await this.getRoleById(permissionRoleId)
      if (permissionRole && permissionRole.is_active) {
        return {
          ...baseContext,
          permissionRoleId: permissionRole.id,
          permissionRoleName: permissionRole.name,
          permissionRoleDescription: permissionRole.description || null,
          source: 'custom_role',
          permissions: permissionRole.permissionTokens
        }
      }
    }

    return {
      ...baseContext,
      permissions: getLegacyPermissions(role)
    }
  }

  hasPermissions(context = {}, requiredPermissions = []) {
    const role = String(context.legacyRole || context.role || '').trim().toLowerCase()
    if (role === 'superadmin') return true

    const currentPermissions = new Set(
      Array.isArray(context.permissions) ? context.permissions.map((item) => String(item).trim()) : []
    )
    return requiredPermissions.every((permission) => currentPermissions.has(String(permission).trim()))
  }
}

module.exports = new AdminPermissionService()
