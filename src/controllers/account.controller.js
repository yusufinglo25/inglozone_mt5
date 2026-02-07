const service = require('../services/account.service')

/**
 * USER DASHBOARD (JWT protected)
 */
exports.dashboard = async (req, res) => {
  try {
    const data = await service.getDashboardData(req.user.id)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * ADMIN / TEST DASHBOARD (optional)
 */
exports.dashboardByUserId = async (req, res) => {
  try {
    const userId = req.params.userId
    const data = await service.getDashboardData(userId)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * CREATE ACCOUNT
 */
exports.createAccount = async (req, res) => {
  try {
    const result = await service.createAccount(req.user.id, req.body)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
