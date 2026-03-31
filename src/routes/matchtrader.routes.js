const express = require('express')
const controller = require('../controllers/matchtrader.controller')
const authMiddleware = require('../middleware/auth.middleware')
const adminAuthMiddleware = require('../middleware/admin-auth.middleware')

const router = express.Router()

// Customer endpoints (JWT required)
router.post('/customer/create-account', authMiddleware.verifyToken, controller.createTradingAccount)
router.get('/customer/accounts', authMiddleware.verifyToken, controller.getCustomerAccounts)
router.get('/customer/offers', authMiddleware.verifyToken, controller.getCustomerOffers)
router.get('/customer/offer-groups', authMiddleware.verifyToken, controller.getCustomerOfferGroups)
router.post('/customer/change-password', authMiddleware.verifyToken, controller.changeTradingPassword)
router.get('/customer/orders', authMiddleware.verifyToken, controller.getCustomerOrders)
router.get('/customer/open-positions', authMiddleware.verifyToken, controller.getCustomerOpenPositions)
router.get('/customer/all-orders', authMiddleware.verifyToken, controller.getCustomerAllOrders)
router.get('/customer/history', authMiddleware.verifyToken, controller.getCustomerHistory)
router.post('/customer/create-demo', authMiddleware.verifyToken, controller.createDemoAccount)
router.post('/customer/demo-deposit', authMiddleware.verifyToken, controller.demoDeposit)
router.get('/customer/trade-access', authMiddleware.verifyToken, controller.getTradeAccess)

// Admin endpoints (Admin JWT required)
router.get('/admin/accounts', adminAuthMiddleware.verifyAdminToken, controller.getAdminAccounts)
router.get('/admin/orders', adminAuthMiddleware.verifyAdminToken, controller.getAdminOrders)
router.get('/admin/user/:user_id', adminAuthMiddleware.verifyAdminToken, controller.getAdminUserDetails)
router.get(
  '/admin/offers/catalog',
  adminAuthMiddleware.verifyAdminToken,
  adminAuthMiddleware.requirePermissions('matchtrader_offers.read'),
  controller.getAdminOfferCatalog
)
router.put(
  '/admin/offers/customer-visibility',
  adminAuthMiddleware.verifyAdminToken,
  adminAuthMiddleware.requirePermissions('matchtrader_offers.write'),
  controller.updateAdminCustomerVisibleOffers
)

module.exports = router
