const adminKYCService = require('../../services/admin-kyc.service')

exports.getAllKYCRecords = async (req, res) => {
  try {
    const records = await adminKYCService.getAllKYCRecords()
    return res.json({ success: true, data: records })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getSingleCustomerKYCDetails = async (req, res) => {
  try {
    const { userId } = req.params
    const details = await adminKYCService.getSingleCustomerKYCDetails(userId)
    if (!details) {
      return res.status(404).json({ error: 'KYC record not found' })
    }
    return res.json({ success: true, data: details })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.startReview = async (req, res) => {
  try {
    const { userId } = req.params
    const data = await adminKYCService.startReview(userId)
    if (!data) {
      return res.status(404).json({ error: 'KYC record not found' })
    }
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.approveDocuments = async (req, res) => {
  try {
    const { userId } = req.params
    const { comment } = req.body
    const data = await adminKYCService.approveDocuments(userId, req.admin.id, comment || null)
    return res.json({
      success: true,
      message: 'KYC documents approved successfully',
      data
    })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.approveProfile = async (req, res) => {
  try {
    const { userId } = req.params
    const { notes } = req.body
    const data = await adminKYCService.approveProfile(userId, req.admin.id, notes || null)
    return res.json({
      success: true,
      message: 'KYC profile approved successfully',
      data
    })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.approveKYC = async (req, res) => {
  try {
    const { userId } = req.params
    const { comment } = req.body
    await adminKYCService.updateKYCDecision(userId, 'approve', req.admin.id, comment || null)
    return res.json({ success: true, message: 'KYC approved successfully' })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.rejectKYC = async (req, res) => {
  try {
    const { userId } = req.params
    const { comment } = req.body
    if (!comment || comment.trim().length < 5) {
      return res.status(400).json({ error: 'Rejection comment is required' })
    }
    await adminKYCService.updateKYCDecision(userId, 'reject', req.admin.id, comment)
    return res.json({ success: true, message: 'KYC rejected successfully' })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
