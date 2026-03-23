const matchTraderService = require('../services/matchtrader.service')
const { MatchTraderApiError } = require('../services/matchtrader.client')

function sendSuccess(res, data, meta = undefined, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {})
  })
}

function sendError(res, error) {
  const isProviderError = error instanceof MatchTraderApiError
  const statusCode = isProviderError
    ? (Number.isInteger(error.statusCode) ? error.statusCode : 502)
    : 500

  return res.status(statusCode).json({
    success: false,
    error: {
      code: isProviderError ? error.code : 'INTERNAL_ERROR',
      message: error.message || 'Unexpected server error',
      ...(isProviderError && error.providerError ? { details: error.providerError } : {})
    }
  })
}

exports.createTradingAccount = async (req, res) => {
  try {
    const data = await matchTraderService.createTradingAccountForUser(req.user.id, req.body || {})
    return sendSuccess(res, data, undefined, 201)
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getCustomerAccounts = async (req, res) => {
  try {
    const accounts = await matchTraderService.listCustomerTradingAccounts(req.user.id)
    return sendSuccess(res, accounts, { count: accounts.length })
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getCustomerOffers = async (req, res) => {
  try {
    const offers = await matchTraderService.listOffers(req.query || {})
    return sendSuccess(res, offers, { count: offers.length })
  } catch (error) {
    return sendError(res, error)
  }
}

exports.changeTradingPassword = async (req, res) => {
  try {
    const data = await matchTraderService.changeTradingPassword(req.user.id, req.body || {})
    return sendSuccess(res, data)
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getCustomerOrders = async (req, res) => {
  try {
    const data = await matchTraderService.getCustomerOrders(req.user.id, req.query || {})
    return sendSuccess(res, data)
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getCustomerHistory = async (req, res) => {
  try {
    const data = await matchTraderService.getCustomerHistory(req.user.id, req.query || {})
    return sendSuccess(res, data)
  } catch (error) {
    return sendError(res, error)
  }
}

exports.createDemoAccount = async (req, res) => {
  try {
    const data = await matchTraderService.createDemoAccount(req.user.id, req.body || {})
    return sendSuccess(res, data, undefined, 201)
  } catch (error) {
    return sendError(res, error)
  }
}

exports.demoDeposit = async (req, res) => {
  try {
    const data = await matchTraderService.demoDeposit(req.user.id, req.body || {})
    return sendSuccess(res, data)
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getTradeAccess = async (req, res) => {
  try {
    const data = await matchTraderService.getTradeAccess(req.user.id, req.query || {})
    return sendSuccess(res, data)
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getAdminAccounts = async (req, res) => {
  try {
    const data = await matchTraderService.getAdminAccounts()
    return sendSuccess(res, data, { count: data.length })
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getAdminOrders = async (req, res) => {
  try {
    const data = await matchTraderService.getAdminOrders(req.query || {})
    return sendSuccess(res, data)
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getAdminUserDetails = async (req, res) => {
  try {
    const userId = req.params.user_id
    const data = await matchTraderService.getAdminUserDetails(userId, req.query || {})
    return sendSuccess(res, data)
  } catch (error) {
    return sendError(res, error)
  }
}
