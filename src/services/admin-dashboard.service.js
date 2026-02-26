const db = require('../config/db')
const adminKYCService = require('./admin-kyc.service')

class AdminDashboardService {
  async getStats() {
    await adminKYCService.syncKYCRecords()

    const [[customers]] = await db.promise().query(
      `SELECT COUNT(*) AS totalCustomers FROM users`
    )
    const [[approved]] = await db.promise().query(
      `SELECT COUNT(*) AS totalApprovedKYC FROM kyc_records WHERE kyc_status = 'Approved'`
    )
    const [[pending]] = await db.promise().query(
      `SELECT COUNT(*) AS totalPendingKYC FROM kyc_records WHERE kyc_status = 'Pending'`
    )
    const [[highRisk]] = await db.promise().query(
      `SELECT COUNT(*) AS totalHighRiskCustomers
       FROM risk_profiles
       WHERE risk_input = 'high' OR aml_status = 'blocked'`
    )

    return {
      totalCustomers: customers.totalCustomers,
      totalApprovedKYC: approved.totalApprovedKYC,
      totalPendingKYC: pending.totalPendingKYC,
      totalHighRiskCustomers: highRisk.totalHighRiskCustomers
    }
  }
}

module.exports = new AdminDashboardService()
