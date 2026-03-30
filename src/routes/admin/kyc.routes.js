const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/kyc.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.use(adminAuth.verifyAdminToken)

router.get('/', adminAuth.requirePermissions('kyc.read'), controller.getAllKYCRecords)
router.get('/:userId', adminAuth.requirePermissions('kyc.read'), controller.getSingleCustomerKYCDetails)
router.post('/:userId/start-review', adminAuth.requirePermissions('kyc.write'), controller.startReview)
router.post('/:userId/approve-documents', adminAuth.requirePermissions('kyc.write'), controller.approveDocuments)
router.post('/:userId/approve-profile', adminAuth.requirePermissions('kyc.write'), controller.approveProfile)
router.post('/:userId/approve', adminAuth.requirePermissions('kyc.write'), controller.approveKYC)
router.post('/:userId/reject', adminAuth.requirePermissions('kyc.write'), controller.rejectKYC)

module.exports = router
