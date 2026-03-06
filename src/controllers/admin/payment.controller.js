const adminPaymentService = require('../../services/admin-payment.service')

exports.getGateways = async (req, res) => {
  try {
    const data = await adminPaymentService.getGateways()
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.updateGateway = async (req, res) => {
  try {
    const { gatewayCode } = req.params
    const { isEnabled, publicKey, secretKey, extraConfig } = req.body
    const data = await adminPaymentService.updateGateway({
      gatewayCode,
      isEnabled,
      publicKey,
      secretKey,
      extraConfig,
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.getBankAccounts = async (req, res) => {
  try {
    const data = await adminPaymentService.listBankAccounts()
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.createBankAccount = async (req, res) => {
  try {
    const { countryCode, isEnabled, fields } = req.body
    const data = await adminPaymentService.upsertBankAccount({
      countryCode,
      isEnabled,
      fields,
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.updateBankAccount = async (req, res) => {
  try {
    const { bankAccountId } = req.params
    const { countryCode, isEnabled, fields } = req.body
    const data = await adminPaymentService.upsertBankAccount({
      id: bankAccountId,
      countryCode,
      isEnabled,
      fields,
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.deleteBankAccount = async (req, res) => {
  try {
    const { bankAccountId } = req.params
    const data = await adminPaymentService.deleteBankAccount(bankAccountId)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.getReviewingBankTransfers = async (req, res) => {
  try {
    const { page, limit } = req.query
    const data = await adminPaymentService.getReviewingBankTransfers({ page, limit })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getBankTransferDetails = async (req, res) => {
  try {
    const { transactionId } = req.params
    const data = await adminPaymentService.getBankTransferDetails(transactionId)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(404).json({ error: error.message })
  }
}

exports.approveBankTransfer = async (req, res) => {
  try {
    const { transactionId } = req.params
    const data = await adminPaymentService.approveBankTransfer(transactionId, req.admin.id)
    return res.json({ success: true, data, message: 'Bank transfer approved successfully' })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.rejectBankTransfer = async (req, res) => {
  try {
    const { transactionId } = req.params
    const { reason } = req.body
    const data = await adminPaymentService.rejectBankTransfer(transactionId, req.admin.id, reason)
    return res.json({ success: true, data, message: 'Bank transfer rejected successfully' })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
