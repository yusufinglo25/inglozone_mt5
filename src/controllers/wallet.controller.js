const walletService = require('../services/wallet.service')
const withdrawalService = require('../services/withdrawal.service')

exports.getWallet = async (req, res) => {
  try {
    const userId = req.user.id
    const wallet = await walletService.getWallet(userId)
    
    res.json({
      success: true,
      wallet
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

exports.getPaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id
    const data = await walletService.getPaymentMethods(userId)
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.getCurrencyContext = async (req, res) => {
  try {
    const userId = req.user.id
    const data = await walletService.getUserCurrencyContext(userId)
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.getSupportedCountries = async (req, res) => {
  try {
    const data = walletService.getSupportedCountries()
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

exports.createDeposit = async (req, res) => {
  try {
    const userId = req.user.id
    const amount = req.body.amountUSD ?? req.body.amount
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid USD amount is required'
      })
    }

    const deposit = await walletService.createDepositIntent(userId, parseFloat(amount))
    
    res.json({
      success: true,
      data: deposit
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.verifyDeposit = async (req, res) => {
  try {
    const { session_id } = req.body
    
    if (!session_id) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      })
    }

    const result = await walletService.verifyDeposit(session_id)
    
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.createTamaraDeposit = async (req, res) => {
  try {
    const userId = req.user.id
    const amount = req.body.amountUSD ?? req.body.amount

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid USD amount is required'
      })
    }

    const result = await walletService.createTamaraDepositIntent(userId, parseFloat(amount))
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.verifyTamaraDeposit = async (req, res) => {
  try {
    const userId = req.user.id
    const { order_id, transaction_id } = req.body

    const result = await walletService.verifyTamaraDeposit({
      userId,
      orderId: order_id,
      transactionId: transaction_id
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.createRazorpayDeposit = async (req, res) => {
  try {
    const userId = req.user.id
    const amount = req.body.amountUSD ?? req.body.amount

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid USD amount is required'
      })
    }

    const data = await walletService.createRazorpayDepositIntent(userId, parseFloat(amount))
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.verifyRazorpayDeposit = async (req, res) => {
  try {
    const userId = req.user.id
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transaction_id } = req.body
    const data = await walletService.verifyRazorpayDeposit({
      userId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      transactionId: transaction_id
    })
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.createBankTransferDeposit = async (req, res) => {
  try {
    const userId = req.user.id
    const amount = req.body.amountUSD ?? req.body.amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid USD amount is required'
      })
    }
    const data = await walletService.createBankTransferDepositIntent(userId, parseFloat(amount))
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.getWithdrawalOptions = async (req, res) => {
  try {
    const userId = req.user.id
    const data = await withdrawalService.getWithdrawalOptions(userId)
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.getWithdrawalAccounts = async (req, res) => {
  try {
    const userId = req.user.id
    const data = await withdrawalService.listAccounts(userId)
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.createWithdrawalAccount = async (req, res) => {
  try {
    const userId = req.user.id
    const data = await withdrawalService.createAccount(userId, req.body || {})
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.requestWithdrawalOTP = async (req, res) => {
  try {
    const userId = req.user.id
    const amountUSD = req.body.amountUSD ?? req.body.amount
    const withdrawalAccountId = req.body.withdrawalAccountId
    const data = await withdrawalService.createWithdrawalOtpRequest({
      userId,
      amountUsd: amountUSD,
      withdrawalAccountId
    })
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.verifyWithdrawalOTP = async (req, res) => {
  try {
    const userId = req.user.id
    const { verificationToken, otp, note } = req.body
    if (!verificationToken || !otp) {
      return res.status(400).json({
        success: false,
        error: 'verificationToken and otp are required'
      })
    }
    const data = await withdrawalService.verifyWithdrawalOtpAndCreateRequest({
      userId,
      verificationToken,
      otpCode: otp,
      note
    })
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.getBankTransferDetails = async (req, res) => {
  try {
    const userId = req.user.id
    const data = await walletService.getBankTransferDetailsForUser(userId)
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.uploadBankTransferProof = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }
    const userId = req.user.id
    const { transactionId } = req.params
    const data = await walletService.uploadBankTransferProof({
      userId,
      transactionId,
      file: req.file
    })
    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    })
  }
}

exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id
    const { limit = 10, page = 1 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    const transactions = await walletService.getTransactions(userId, parseInt(limit), offset)
    
    res.json({
      success: true,
      data: transactions
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

exports.getTransaction = async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params
    
    const transaction = await walletService.getTransactionById(id, userId)
    
    res.json({
      success: true,
      data: transaction
    })
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    })
  }
}
