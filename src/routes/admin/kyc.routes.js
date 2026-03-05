const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/kyc.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/', controller.getAllKYCRecords)
router.get('/:userId', controller.getSingleCustomerKYCDetails)
router.post('/:userId/start-review', adminAuth.requireRoles('superadmin', 'admin'), controller.startReview)
router.post('/:userId/approve-documents', adminAuth.requireRoles('superadmin', 'admin'), controller.approveDocuments)
router.post('/:userId/approve-profile', adminAuth.requireRoles('superadmin', 'admin'), controller.approveProfile)
router.post('/:userId/approve', adminAuth.requireRoles('superadmin', 'admin'), controller.approveKYC)
router.post('/:userId/reject', adminAuth.requireRoles('superadmin', 'admin'), controller.rejectKYC)

module.exports = router
