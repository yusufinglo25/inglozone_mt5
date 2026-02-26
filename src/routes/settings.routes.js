const express = require('express')
const router = express.Router()
const controller = require('../controllers/settings.controller')
const auth = require('../middleware/auth.middleware')

router.use(auth.verifyToken)

router.post('/email-change/request-old-otp', controller.requestOldEmailOTP)
router.post('/email-change/verify-old-otp', controller.verifyOldEmailOTP)
router.post('/email-change/request-new-otp', controller.requestNewEmailOTP)
router.post('/email-change/verify-new-otp', controller.verifyNewEmailOTP)

router.post('/password/change', controller.changePassword)

router.post('/2fa/generate', controller.generate2FA)
router.post('/2fa/verify', controller.verify2FA)
router.post('/2fa/disable', controller.disable2FA)

router.post('/logout-all', controller.logoutAllDevices)
router.post('/logout-others', controller.logoutOtherDevices)

module.exports = router
