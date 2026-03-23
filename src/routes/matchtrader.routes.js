const express = require('express')
const controller = require('../controllers/matchtrader.controller')
const authMiddleware = require('../middleware/auth.middleware')
const adminAuthMiddleware = require('../middleware/admin-auth.middleware')

const router = express.Router()

// Customer endpoints (JWT required)
router.post('/customer/create-account', authMiddleware.verifyToken, controller.createTradingAccount)
router.get('/customer/accounts', authMiddleware.verifyToken, controller.getCustomerAccounts)
router.get('/customer/offers', authMiddleware.verifyToken, controller.getCustomerOffers)
router.post('/customer/change-password', authMiddleware.verifyToken, controller.changeTradingPassword)
router.get('/customer/orders', authMiddleware.verifyToken, controller.getCustomerOrders)
router.get('/customer/history', authMiddleware.verifyToken, controller.getCustomerHistory)
router.post('/customer/create-demo', authMiddleware.verifyToken, controller.createDemoAccount)
router.post('/customer/demo-deposit', authMiddleware.verifyToken, controller.demoDeposit)
router.get('/customer/trade-access', authMiddleware.verifyToken, controller.getTradeAccess)

// Admin endpoints (Admin JWT required)
router.get('/admin/accounts', adminAuthMiddleware.verifyAdminToken, controller.getAdminAccounts)
router.get('/admin/orders', adminAuthMiddleware.verifyAdminToken, controller.getAdminOrders)
router.get('/admin/user/:user_id', adminAuthMiddleware.verifyAdminToken, controller.getAdminUserDetails)

module.exports = router
