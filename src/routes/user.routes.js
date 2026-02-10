const express = require('express')
const router = express.Router()
const controller = require('../controllers/user.controller')
const auth = require('../middleware/auth.middleware')

router.post('/complete-profile', auth.verifyToken, controller.completeProfile)

module.exports = router
