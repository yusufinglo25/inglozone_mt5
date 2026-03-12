const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/auth.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.get('/zoho/authorize-url', controller.getZohoAuthorizeUrl)
router.get('/zoho/callback', controller.zohoCallback)
router.post('/login', controller.login)
router.post('/login-password', controller.loginWithPassword)
router.post('/bootstrap-superadmin', controller.bootstrapSuperAdmin)
router.post('/logout', adminAuth.verifyAdminToken, controller.logout)

module.exports = router
