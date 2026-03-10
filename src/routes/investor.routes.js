const express = require('express')
const router = express.Router()
const controller = require('../controllers/investor.controller')
const auth = require('../middleware/auth.middleware')

router.use(auth.verifyToken)
router.use(auth.requireAccountType('investor'))

router.get('/account', controller.getMyAccount)

module.exports = router
