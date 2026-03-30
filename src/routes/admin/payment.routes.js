const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/payment.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/countries', adminAuth.requirePermissions('payment_settings.read'), controller.getSupportedCurrencyCountries)
router.get('/currency-rates', adminAuth.requirePermissions('payment_settings.read'), controller.getCurrencyRates)
router.post('/currency-rates', adminAuth.requirePermissions('payment_settings.write'), controller.createCurrencyRate)
router.patch('/currency-rates/:currencyRateId', adminAuth.requirePermissions('payment_settings.write'), controller.updateCurrencyRate)
router.patch('/currency-rates/:currencyRateId/status', adminAuth.requirePermissions('payment_settings.write'), controller.updateCurrencyRateStatus)

router.get('/gateways', adminAuth.requirePermissions('payment_settings.read'), controller.getGateways)
router.patch('/gateways/:gatewayCode', adminAuth.requirePermissions('payment_settings.write'), controller.updateGateway)

router.get('/bank-accounts', adminAuth.requirePermissions('payment_settings.read'), controller.getBankAccounts)
router.post('/bank-accounts', adminAuth.requirePermissions('payment_settings.write'), controller.createBankAccount)
router.patch('/bank-accounts/:bankAccountId', adminAuth.requirePermissions('payment_settings.write'), controller.updateBankAccount)
router.delete('/bank-accounts/:bankAccountId', adminAuth.requirePermissions('payment_settings.write'), controller.deleteBankAccount)

router.get('/bank-transfers', adminAuth.requirePermissions('bank_transfers.read'), controller.getReviewingBankTransfers)
router.get('/bank-transfers/:transactionId', adminAuth.requirePermissions('bank_transfers.read'), controller.getBankTransferDetails)
router.post('/bank-transfers/:transactionId/approve', adminAuth.requirePermissions('bank_transfers.write'), controller.approveBankTransfer)
router.post('/bank-transfers/:transactionId/reject', adminAuth.requirePermissions('bank_transfers.write'), controller.rejectBankTransfer)

router.get('/withdrawals', adminAuth.requirePermissions('withdrawals.read'), controller.listWithdrawals)
router.get('/withdrawals/:transactionId', adminAuth.requirePermissions('withdrawals.read'), controller.getWithdrawalDetails)
router.post('/withdrawals/:transactionId/approve', adminAuth.requirePermissions('withdrawals.write'), controller.approveWithdrawal)
router.post('/withdrawals/:transactionId/complete', adminAuth.requirePermissions('withdrawals.write'), controller.completeWithdrawal)

module.exports = router
