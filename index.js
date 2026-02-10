require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { swaggerJsdoc, swaggerUi, options } = require('./src/config/swagger')
const jwt = require('jsonwebtoken')

const app = express()
const migrate = require('./src/config/migrate')
migrate()
const passport = require('passport')

// Start cleanup job (comment out in development if needed)
if (process.env.NODE_ENV === 'production') {
  require('./src/jobs/cleanup')
}

const specs = swaggerJsdoc(options)

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))
app.use(passport.initialize())

// 1. FIRST: Handle preflight OPTIONS requests BEFORE CORS
app.options('*', (req, res) => {
  console.log('Handling OPTIONS preflight request for:', req.originalUrl)
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://customer-panel-inglo.vercel.app')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Max-Age', '86400')
  res.status(200).end()
})

// 2. CORS Configuration - SIMPLIFIED VERSION
const corsOptions = {
  origin: ['https://customer-panel-inglo.vercel.app', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}

app.use(cors(corsOptions))

// 3. Global CORS headers for all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://customer-panel-inglo.vercel.app')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Expose-Headers', 'Authorization')
  next()
})

// Regular JSON parsing for all routes except webhooks
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe-webhook') {
    next()
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
const webhookRoutes = require('./src/webhooks/stripe.webhook')
const kycRoutes = require('./src/routes/kyc.routes')

// Use routes
app.use('/api/user', userRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/kyc', kycRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack)
  
  // Add CORS headers to error responses too
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://customer-panel-inglo.vercel.app')
  res.header('Access-Control-Allow-Credentials', 'true')
  
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// 404 handler with CORS headers
app.use((req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://customer-panel-inglo.vercel.app')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.status(404).json({ error: 'Route not found' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`CORS enabled for origins: https://customer-panel-inglo.vercel.app, http://localhost:5173`)
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`)
})