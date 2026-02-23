// src/routes/account.routes.js
const express = require('express')
const router = express.Router()
const controller = require('../controllers/account.controller')
const auth = require('../middleware/auth.middleware')
const kycMiddleware = require('../middleware/kyc.middleware')

// user - FIXED: use auth.verifyToken instead of just auth
router.get('/dashboard', auth.verifyToken, controller.dashboard)
router.post('/create', auth.verifyToken, controller.createAccount)

// admin / testing
router.get('/dashboard/:userId', auth.verifyToken, kycMiddleware.isAdmin, controller.dashboardByUserId)

module.exports = router
