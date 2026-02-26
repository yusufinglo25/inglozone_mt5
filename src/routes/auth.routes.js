const express = require('express')
const router = express.Router()
const controller = require('../controllers/auth.controller')
const passport = require('passport')
const authService = require('../services/auth.service')

// OLD ROUTES (if you want to keep direct registration)
router.post('/register', controller.register) // Direct registration (optional)

// NEW OTP REGISTRATION ROUTES
router.post('/register-with-otp', controller.registerWithOTP) // Step 1: Send OTP
router.post('/verify-otp', controller.verifyOTP) // Step 2: Verify OTP
router.post('/resend-otp', controller.resendOTP) // Resend OTP

// LOGIN ROUTE
router.post('/login', controller.login)

// GOOGLE OAUTH ROUTES
router.post('/check-email', controller.checkEmail)
router.post('/complete-profile', controller.completeProfile)

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      if (!req.user) {
        throw new Error('Authentication failed')
      }
      
      const token = await authService.createUserSessionToken(
        { id: req.user.id, email: req.user.email },
        req.ip,
        req.get('User-Agent')
      )
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      
      if (!req.user.password_set) {
        const redirectUrl = `${frontendUrl}/complete-profile?token=${token}&userId=${req.user.id}&email=${encodeURIComponent(req.user.email)}&firstName=${encodeURIComponent(req.user.first_name || '')}&lastName=${encodeURIComponent(req.user.last_name || '')}`
        return res.redirect(redirectUrl)
      }
      
      res.redirect(`${frontendUrl}/dashboard?token=${token}`)
      
    } catch (error) {
      console.error('Google callback error:', error)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error.message)}`)
    }
  }
)

// Optional: Add a route to check auth status
router.get('/status', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ authenticated: false })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    res.json({ 
      authenticated: true,
      user: decoded 
    })
  } catch (error) {
    res.status(401).json({ authenticated: false })
  }
})

module.exports = router
