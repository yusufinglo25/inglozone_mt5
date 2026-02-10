require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { swaggerJsdoc, swaggerUi, options } = require('./src/config/swagger')
const jwt = require('jsonwebtoken')

const app = express()
const migrate = require('./src/config/migrate')
migrate()
const passport = require('passport')
require('./src/config/google')

// Start cleanup job (comment out in development if needed)
if (process.env.NODE_ENV === 'production') {
  require('./src/jobs/cleanup')
}
const kycRoutes = require('./src/routes/kyc.routes')
const specs = swaggerJsdoc(options)

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))
app.use(passport.initialize())
app.use('/api/kyc', kycRoutes)
// CORS Configuration - Allow multiple origins
app.use(cors({
  origin: ['https://customer-panel-inglo.vercel.app', 'http://localhost:5173'],
  credentials: true
}))

// Regular JSON parsing for all routes except webhooks
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe-webhook') {
    next() // Skip JSON parsing for webhook
  } else {
    express.json()(req, res, next)
  }
})

app.get('/', (req, res) => {
  res.send('Backend running successfully 🚀')
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Import routes
const accountRoutes = require('./src/routes/account.routes')
const authRoutes = require('./src/routes/auth.routes')
const userRoutes = require('./src/routes/user.routes')
const walletRoutes = require('./src/routes/wallet.routes')
const webhookRoutes = require('./src/webhooks/stripe.webhook') // NEW

// Use routes
app.use('/api/user', userRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/webhooks', webhookRoutes) // NEW

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Allowed origins: https://customer-panel-inglo.vercel.app, http://localhost:5173`)
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)
  console.log(`Google Callback URL: ${process.env.GOOGLE_CALLBACK_URL}`)
  console.log(`Webhook URL: https://8a4ff10a2271.ngrok-free.app/api/webhooks/stripe-webhook`)
})