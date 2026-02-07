const express = require('express')
const router = express.Router()
const controller = require('../controllers/account.controller')
const auth = require('../middleware/auth.middleware')

// user
router.get('/dashboard', auth, controller.dashboard)
router.post('/create', auth, controller.createAccount)

// admin / testing
router.get('/dashboard/:userId', controller.dashboardByUserId)

module.exports = router
