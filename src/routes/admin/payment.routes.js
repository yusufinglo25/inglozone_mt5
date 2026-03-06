const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/payment.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/gateways', adminAuth.requireRoles('superadmin', 'admin'), controller.getGateways)
router.patch('/gateways/:gatewayCode', adminAuth.requireRoles('superadmin'), controller.updateGateway)

router.get('/bank-accounts', adminAuth.requireRoles('superadmin', 'admin'), controller.getBankAccounts)
router.post('/bank-accounts', adminAuth.requireRoles('superadmin'), controller.createBankAccount)
router.patch('/bank-accounts/:bankAccountId', adminAuth.requireRoles('superadmin'), controller.updateBankAccount)
router.delete('/bank-accounts/:bankAccountId', adminAuth.requireRoles('superadmin'), controller.deleteBankAccount)

router.get('/bank-transfers', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.getReviewingBankTransfers)
router.get('/bank-transfers/:transactionId', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.getBankTransferDetails)
router.post('/bank-transfers/:transactionId/approve', adminAuth.requireRoles('superadmin', 'admin'), controller.approveBankTransfer)
router.post('/bank-transfers/:transactionId/reject', adminAuth.requireRoles('superadmin', 'admin'), controller.rejectBankTransfer)

module.exports = router
