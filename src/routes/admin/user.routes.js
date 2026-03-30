const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/user.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/', controller.getAllUsers)
router.get('/permission-catalog', controller.getPermissionCatalog)
router.get('/permission-context', controller.getMyPermissionContext)
router.get('/permission-roles', adminAuth.requireSuperAdmin, controller.listPermissionRoles)
router.post('/permission-roles', adminAuth.requireSuperAdmin, controller.createPermissionRole)
router.patch('/permission-roles/:roleId', adminAuth.requireSuperAdmin, controller.updatePermissionRole)
router.patch('/assign-permission-role', adminAuth.requireSuperAdmin, controller.assignPermissionRole)
router.patch('/role', adminAuth.requireSuperAdmin, controller.updateUserRole)
router.patch('/allow-login', adminAuth.requireSuperAdmin, controller.allowUserLogin)
router.patch('/block-login', adminAuth.requireSuperAdmin, controller.blockUserLogin)
router.patch('/set-password', adminAuth.requireSuperAdmin, controller.setUserPassword)

module.exports = router
