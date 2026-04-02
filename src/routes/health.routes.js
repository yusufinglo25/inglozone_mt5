const express = require('express')
const router = express.Router()
const controller = require('../controllers/health.controller')

router.get('/health', controller.getHealth)

module.exports = router
