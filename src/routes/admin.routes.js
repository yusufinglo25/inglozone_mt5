const express = require('express')
const router = express.Router()

const adminAuthRoutes = require('./admin/auth.routes')
const adminUserRoutes = require('./admin/user.routes')
const adminKYCRoutes = require('./admin/kyc.routes')
const adminDashboardRoutes = require('./admin/dashboard.routes')

router.use('/auth', adminAuthRoutes)
router.use('/users', adminUserRoutes)
router.use('/kyc', adminKYCRoutes)
router.use('/dashboard', adminDashboardRoutes)

module.exports = router
