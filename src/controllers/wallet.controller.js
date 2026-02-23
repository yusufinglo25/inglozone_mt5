const walletService = require('../services/wallet.service')

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

exports.createDeposit = async (req, res) => {
  try {
    const userId = req.user.id
    const { amount } = req.body
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
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