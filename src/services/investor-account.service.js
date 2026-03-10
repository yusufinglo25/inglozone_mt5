const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')

class InvestorAccountService {
  async ensureInvestorAccount(userId) {
    const [users] = await db.promise().query(
      `SELECT id, account_type FROM users WHERE id = ? LIMIT 1`,
      [userId]
    )
    if (users.length === 0) throw new Error('User not found')
    if (String(users[0].account_type || '').toLowerCase() !== 'investor') {
      throw new Error('Only investor accounts are supported here')
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

  async getMyInvestorAccount(userId) {
    const account = await this.ensureInvestorAccount(userId)
    if (account.account_status !== 'active') {
      return {
        approved: false,
        accountStatus: account.account_status
      }
    }
    return {
      approved: true,
      account: {
        user_id: account.user_id,
        account_status: account.account_status,
        balance: Number(account.balance || 0),
        equity: Number(account.equity || 0),
        floating_profit_loss: Number(account.floating_profit_loss || 0),
        total_profit_loss: Number(account.total_profit_loss || 0),
        approved_at: account.approved_at,
        created_at: account.created_at
      }
    }
  }
}

module.exports = new InvestorAccountService()
