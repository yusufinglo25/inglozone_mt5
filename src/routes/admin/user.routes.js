const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/user.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/', controller.getAllUsers)
router.patch('/role', adminAuth.requireRoles('superadmin'), controller.updateUserRole)
router.patch('/allow-login', adminAuth.requireRoles('superadmin'), controller.allowUserLogin)
router.patch('/block-login', adminAuth.requireRoles('superadmin'), controller.blockUserLogin)
router.patch('/set-password', adminAuth.requireRoles('superadmin'), controller.setUserPassword)

module.exports = router
