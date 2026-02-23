const express = require('express')
const router = express.Router()
const controller = require('../controllers/auth.controller')
const passport = require('passport')
const jwt = require('jsonwebtoken')
const auth = require('../middleware/auth.middleware')

const buildRedirectUrl = (frontendUrl, path, queryParams, token) => {
  const searchParams = new URLSearchParams()
  Object.entries(queryParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value)
    }
  })

  const queryString = searchParams.toString()
  const baseUrl = `${frontendUrl}${path}${queryString ? `?${queryString}` : ''}`
  const useLegacyQueryToken = process.env.LEGACY_QUERY_TOKEN_REDIRECT === 'true'

  if (useLegacyQueryToken) {
    const joiner = queryString ? '&' : '?'
    return `${baseUrl}${joiner}token=${encodeURIComponent(token)}`
  }

  return `${baseUrl}#token=${encodeURIComponent(token)}`
}

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
router.post('/complete-profile', auth.verifyTokenFlexible, controller.completeProfile)

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    try {
      if (!req.user) {
        throw new Error('Authentication failed')
      }
      
      const token = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email,
          provider: req.user.provider
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      )
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      
      if (!req.user.password_set) {
        const redirectUrl = buildRedirectUrl(
          frontendUrl,
          '/complete-profile',
          {
            userId: req.user.id,
            email: req.user.email,
            firstName: req.user.first_name || '',
            lastName: req.user.last_name || ''
          },
          token
        )
        return res.redirect(redirectUrl)
      }
      
      res.redirect(buildRedirectUrl(frontendUrl, '/dashboard', {}, token))
      
    } catch (error) {
      console.error('Google callback error:', error)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error.message)}`)
    }
  }
)

// Optional: Add a route to check auth status
router.get('/status', (req, res) => {
  const token = auth.extractToken(req, { allowQueryToken: true })
  
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
