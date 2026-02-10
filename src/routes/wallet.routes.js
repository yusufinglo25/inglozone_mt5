const express = require('express')
const router = express.Router()
const controller = require('../controllers/wallet.controller')
const authMiddleware = require('../middleware/auth.middleware') 

router.use(authMiddleware.verifyToken)

router.get('/balance', controller.getWallet)
router.post('/deposit', controller.createDeposit)
router.post('/deposit/verify', controller.verifyDeposit)
router.get('/transactions', controller.getTransactions)
router.get('/transactions/:id', controller.getTransaction)

module.exports = router