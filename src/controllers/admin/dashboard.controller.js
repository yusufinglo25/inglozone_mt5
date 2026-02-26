const adminDashboardService = require('../../services/admin-dashboard.service')

exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await adminDashboardService.getStats()
    return res.json({ success: true, data: stats })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
