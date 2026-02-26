const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/dashboard.controller')
const adminAuth = require('../../middleware/admin-auth.middleware')

router.get('/stats', adminAuth.verifyAdminToken, controller.getDashboardStats)

module.exports = router
