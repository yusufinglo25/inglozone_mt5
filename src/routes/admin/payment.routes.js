const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/payment.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/countries', adminAuth.requireRoles('superadmin', 'admin'), controller.getSupportedCurrencyCountries)
router.get('/currency-rates', adminAuth.requireRoles('superadmin', 'admin'), controller.getCurrencyRates)
router.post('/currency-rates', adminAuth.requireRoles('superadmin'), controller.createCurrencyRate)
router.patch('/currency-rates/:currencyRateId', adminAuth.requireRoles('superadmin'), controller.updateCurrencyRate)
router.patch('/currency-rates/:currencyRateId/status', adminAuth.requireRoles('superadmin'), controller.updateCurrencyRateStatus)

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

router.get('/withdrawals', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.listWithdrawals)
router.get('/withdrawals/:transactionId', adminAuth.requireRoles('superadmin', 'admin', 'accounts'), controller.getWithdrawalDetails)
router.post('/withdrawals/:transactionId/approve', adminAuth.requireRoles('superadmin', 'admin'), controller.approveWithdrawal)
router.post('/withdrawals/:transactionId/complete', adminAuth.requireRoles('superadmin', 'admin'), controller.completeWithdrawal)

module.exports = router
