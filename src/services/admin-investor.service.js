const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')

class AdminInvestorService {
  async getUsers({ page = 1, limit = 20, accountType = null }) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200)
    const safePage = Math.max(parseInt(page, 10) || 1, 1)
    const offset = (safePage - 1) * safeLimit
    const normalizedType = accountType ? String(accountType).toLowerCase() : null

    const where = []
    const params = []
    if (normalizedType && ['trader', 'investor'].includes(normalizedType)) {
      where.push('u.account_type = ?')
      params.push(normalizedType)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const [rows] = await db.promise().query(
      `SELECT u.id, u.first_name AS firstName, u.last_name AS lastName, u.email, u.account_type AS accountType, u.created_at AS createdAt
       FROM users u
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    )

    const [[countRow]] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM users u
       ${whereSql}`,
      params
    )

    return { users: rows, total: countRow.total, page: safePage, limit: safeLimit }
  }

  async ensureInvestorAccount(userId) {
    const [users] = await db.promise().query(
      `SELECT id, account_type FROM users WHERE id = ? LIMIT 1`,
      [userId]
    )
    if (users.length === 0) throw new Error('User not found')
    if (String(users[0].account_type || '').toLowerCase() !== 'investor') {
      throw new Error('User account_type must be investor')
    }

    const [accounts] = await db.promise().query(
      `SELECT * FROM investor_accounts WHERE user_id = ? LIMIT 1`,
      [userId]
    )
    if (accounts.length > 0) return accounts[0]

    await db.promise().query(
      `INSERT INTO investor_accounts
       (id, user_id, account_status, balance, equity, floating_profit_loss, total_profit_loss)
       VALUES (?, ?, 'pending', 0.00, 0.00, 0.00, 0.00)`,
      [uuidv4(), userId]
    )
    const [created] = await db.promise().query(
      `SELECT * FROM investor_accounts WHERE user_id = ? LIMIT 1`,
      [userId]
    )
    return created[0]
  }

  async listInvestorAccounts({ page = 1, limit = 20, status = null }) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200)
    const safePage = Math.max(parseInt(page, 10) || 1, 1)
    const offset = (safePage - 1) * safeLimit
    const where = [`u.account_type = 'investor'`]
    const params = []

    const normalizedStatus = status ? String(status).toLowerCase() : null
    if (normalizedStatus && ['pending', 'active', 'inactive', 'rejected'].includes(normalizedStatus)) {
      where.push('ia.account_status = ?')
      params.push(normalizedStatus)
    }

    const [rows] = await db.promise().query(
      `SELECT
         u.id AS userId, u.first_name AS firstName, u.last_name AS lastName, u.email,
         ia.account_status AS accountStatus, ia.balance, ia.equity,
         ia.floating_profit_loss AS floatingProfitLoss, ia.total_profit_loss AS totalProfitLoss,
         ia.approved_at AS approvedAt, ia.created_at AS createdAt
       FROM users u
       LEFT JOIN investor_accounts ia ON ia.user_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    )

    const [[countRow]] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM users u
       LEFT JOIN investor_accounts ia ON ia.user_id = u.id
       WHERE ${where.join(' AND ')}`,
      params
    )

    return { investors: rows, total: countRow.total, page: safePage, limit: safeLimit }
  }

  async approveInvestorAccount(userId) {
    await this.ensureInvestorAccount(userId)
    await db.promise().query(
      `UPDATE investor_accounts
       SET account_status = 'active',
           approved_at = COALESCE(approved_at, NOW()),
           updated_at = NOW()
       WHERE user_id = ?`,
      [userId]
    )
    return { success: true }
  }

  async updateInvestorStatus(userId, accountStatus) {
    const normalized = String(accountStatus || '').toLowerCase()
    if (!['pending', 'active', 'inactive', 'rejected'].includes(normalized)) {
      throw new Error('Invalid account status')
    }
    await this.ensureInvestorAccount(userId)
    await db.promise().query(
      `UPDATE investor_accounts
       SET account_status = ?,
           approved_at = CASE WHEN ? = 'active' THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
           updated_at = NOW()
       WHERE user_id = ?`,
      [normalized, normalized, userId]
    )
    return { success: true, accountStatus: normalized }
  }

  async updateInvestorStats(userId, payload = {}) {
    await this.ensureInvestorAccount(userId)
    const numeric = (value) => {
      if (value === null || value === undefined || value === '') return null
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    }

    const balance = numeric(payload.balance)
    const equity = numeric(payload.equity)
    const floatingProfitLoss = numeric(payload.floating_profit_loss)
    const totalProfitLoss = numeric(payload.total_profit_loss)

    await db.promise().query(
      `UPDATE investor_accounts
       SET balance = COALESCE(?, balance),
           equity = COALESCE(?, equity),
           floating_profit_loss = COALESCE(?, floating_profit_loss),
           total_profit_loss = COALESCE(?, total_profit_loss),
           updated_at = NOW()
       WHERE user_id = ?`,
      [balance, equity, floatingProfitLoss, totalProfitLoss, userId]
    )
    return { success: true }
  }

  async getInvestorTransactions(userId, { page = 1, limit = 20, type = null } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200)
    const safePage = Math.max(parseInt(page, 10) || 1, 1)
    const offset = (safePage - 1) * safeLimit
    const where = ['t.user_id = ?']
    const params = [userId]

    const normalizedType = type ? String(type).toLowerCase() : null
    if (normalizedType && ['deposit', 'withdrawal'].includes(normalizedType)) {
      where.push('t.type = ?')
      params.push(normalizedType)
    }

    const [rows] = await db.promise().query(
      `SELECT
         t.id, t.transaction_number, t.user_id AS userId, t.amount, t.currency, t.type, t.status,
         t.payment_id AS paymentId, t.session_id AS sessionId, t.created_at AS createdAt
       FROM transactions t
       WHERE ${where.join(' AND ')}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    )

    const [[countRow]] = await db.promise().query(
      `SELECT COUNT(*) AS total FROM transactions t WHERE ${where.join(' AND ')}`,
      params
    )

    return { transactions: rows, total: countRow.total, page: safePage, limit: safeLimit }
  }

  async listTransactions({ page = 1, limit = 50, userId = null, type = null } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)
    const safePage = Math.max(parseInt(page, 10) || 1, 1)
    const offset = (safePage - 1) * safeLimit

    const where = []
    const params = []
    if (userId) {
      where.push('t.user_id = ?')
      params.push(String(userId))
    }
    const normalizedType = type ? String(type).toLowerCase() : null
    if (normalizedType && ['deposit', 'withdrawal'].includes(normalizedType)) {
      where.push('t.type = ?')
      params.push(normalizedType)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [rows] = await db.promise().query(
      `SELECT
         t.id, t.transaction_number, t.user_id AS userId, t.amount, t.currency, t.type, t.status,
         t.payment_id AS paymentId, t.session_id AS sessionId, t.created_at AS createdAt
       FROM transactions t
       ${whereSql}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    )

    const [[countRow]] = await db.promise().query(
      `SELECT COUNT(*) AS total FROM transactions t ${whereSql}`,
      params
    )

    return { transactions: rows, total: countRow.total, page: safePage, limit: safeLimit }
  }
}

module.exports = new AdminInvestorService()
