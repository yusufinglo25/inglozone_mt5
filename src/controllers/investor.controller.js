const investorAccountService = require('../services/investor-account.service')

exports.getMyAccount = async (req, res) => {
  try {
    const data = await investorAccountService.getMyInvestorAccount(req.user.id)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
