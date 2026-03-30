const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/investor.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/users', adminAuth.requirePermissions('investor_accounts.read'), controller.getUsers)
router.get('/accounts', adminAuth.requirePermissions('investor_accounts.read'), controller.getInvestorAccounts)
router.post('/accounts/:userId/approve', adminAuth.requirePermissions('investor_accounts.write'), controller.approveInvestorAccount)
router.patch('/accounts/:userId/status', adminAuth.requirePermissions('investor_accounts.write'), controller.updateInvestorStatus)
router.patch('/accounts/:userId/stats', adminAuth.requirePermissions('investor_performance.write'), controller.updateInvestorStats)
router.get('/accounts/:userId/transactions', adminAuth.requirePermissions('investor_transactions.read'), controller.getInvestorTransactions)
router.get('/transactions', adminAuth.requirePermissions('investor_transactions.read'), controller.getAllTransactions)

module.exports = router
