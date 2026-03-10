const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/investor.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/users', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.getUsers)
router.get('/accounts', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.getInvestorAccounts)
router.post('/accounts/:userId/approve', adminAuth.requireRoles('superadmin', 'admin'), controller.approveInvestorAccount)
router.patch('/accounts/:userId/status', adminAuth.requireRoles('superadmin', 'admin'), controller.updateInvestorStatus)
router.patch('/accounts/:userId/stats', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.updateInvestorStats)
router.get('/accounts/:userId/transactions', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.getInvestorTransactions)
router.get('/transactions', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.getAllTransactions)

module.exports = router
