const express = require('express')
const router = express.Router()
const controller = require('../controllers/wallet.controller')
const authMiddleware = require('../middleware/auth.middleware') 
const uploadMiddleware = require('../middleware/upload.middleware')

router.use(authMiddleware.verifyToken)

router.get('/balance', controller.getWallet)
router.get('/payment-methods', controller.getPaymentMethods)
router.post('/deposit', controller.createDeposit)
router.post('/deposit/verify', controller.verifyDeposit)
router.post('/tamara/deposit', controller.createTamaraDeposit)
router.post('/tamara/deposit/verify', controller.verifyTamaraDeposit)
router.post('/razorpay/deposit', controller.createRazorpayDeposit)
router.post('/razorpay/deposit/verify', controller.verifyRazorpayDeposit)
router.post('/bank-transfer/deposit', controller.createBankTransferDeposit)
router.get('/bank-transfer/bank-details', controller.getBankTransferDetails)
router.post('/bank-transfer/:transactionId/proof', uploadMiddleware.uploadRateLimit, uploadMiddleware.uploadSingle, controller.uploadBankTransferProof)
router.get('/transactions', controller.getTransactions)
router.get('/transactions/:id', controller.getTransaction)

module.exports = router
