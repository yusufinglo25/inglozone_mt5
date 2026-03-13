const adminPaymentService = require('../../services/admin-payment.service')

exports.getGateways = async (req, res) => {
  try {
    const data = await adminPaymentService.getGateways()
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getSupportedCurrencyCountries = async (req, res) => {
  try {
    const data = await adminPaymentService.getSupportedCurrencyCountries()
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getCurrencyRates = async (req, res) => {
  try {
    const activeOnly = String(req.query.activeOnly || '').toLowerCase() === 'true'
    const data = await adminPaymentService.listCurrencyRates({ activeOnly })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.createCurrencyRate = async (req, res) => {
  try {
    const { countryCode, countryName, currencyCode, usdRate } = req.body
    const data = await adminPaymentService.upsertCurrencyRate({
      countryCode,
      countryName,
      currencyCode,
      usdRate,
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.updateCurrencyRate = async (req, res) => {
  try {
    const { currencyRateId } = req.params
    const { countryCode, countryName, currencyCode, usdRate } = req.body
    const data = await adminPaymentService.upsertCurrencyRate({
      id: currencyRateId,
      countryCode,
      countryName,
      currencyCode,
      usdRate,
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.updateCurrencyRateStatus = async (req, res) => {
  try {
    const { currencyRateId } = req.params
    const { isActive } = req.body
    const data = await adminPaymentService.updateCurrencyRateStatus({
      id: currencyRateId,
      isActive,
      updatedBy: req.admin.id
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(400).json({ error: error.message })
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

exports.listWithdrawals = async (req, res) => {
  try {
    const { page, limit, status } = req.query
    const data = await adminPaymentService.listWithdrawals({ page, limit, status })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

exports.getWithdrawalDetails = async (req, res) => {
  try {
    const { transactionId } = req.params
    const data = await adminPaymentService.getWithdrawalDetails(transactionId)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(404).json({ error: error.message })
  }
}

exports.approveWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params
    const data = await adminPaymentService.approveWithdrawal(transactionId, req.admin.id)
    return res.json({ success: true, data, message: 'Withdrawal approved successfully' })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}

exports.completeWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params
    const { referenceNumber } = req.body
    const data = await adminPaymentService.completeWithdrawal(transactionId, req.admin.id, referenceNumber)
    return res.json({ success: true, data, message: 'Withdrawal completed successfully' })
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }
}
