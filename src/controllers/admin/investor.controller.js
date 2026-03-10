const adminInvestorService = require('../../services/admin-investor.service')

exports.getUsers = async (req, res) => {
  try {
    const { page, limit, accountType } = req.query
    const data = await adminInvestorService.getUsers({ page, limit, accountType })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getInvestorAccounts = async (req, res) => {
  try {
    const { page, limit, status } = req.query
    const data = await adminInvestorService.listInvestorAccounts({ page, limit, status })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.approveInvestorAccount = async (req, res) => {
  try {
    const { userId } = req.params
    const data = await adminInvestorService.approveInvestorAccount(userId)
    return res.json({ success: true, data, message: 'Investor account approved' })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.updateInvestorStatus = async (req, res) => {
  try {
    const { userId } = req.params
    const { account_status } = req.body
    const data = await adminInvestorService.updateInvestorStatus(userId, account_status)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.updateInvestorStats = async (req, res) => {
  try {
    const { userId } = req.params
    const data = await adminInvestorService.updateInvestorStats(userId, req.body || {})
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.getInvestorTransactions = async (req, res) => {
  try {
    const { userId } = req.params
    const { page, limit, type } = req.query
    const data = await adminInvestorService.getInvestorTransactions(userId, { page, limit, type })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.getAllTransactions = async (req, res) => {
  try {
    const { page, limit, userId, type } = req.query
    const data = await adminInvestorService.listTransactions({ page, limit, userId, type })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
