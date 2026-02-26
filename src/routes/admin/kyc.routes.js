const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/kyc.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/', controller.getAllKYCRecords)
router.get('/:userId', controller.getSingleCustomerKYCDetails)
router.post('/:userId/approve', adminAuth.requireRoles('superadmin', 'admin'), controller.approveKYC)
router.post('/:userId/reject', adminAuth.requireRoles('superadmin', 'admin'), controller.rejectKYC)

module.exports = router
