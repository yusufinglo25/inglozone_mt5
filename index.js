require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { swaggerUi, getSwaggerSpec } = require('./src/config/swagger')
const jwt = require('jsonwebtoken')

const app = express()

const swaggerUiAssetsPath = path.dirname(require.resolve('swagger-ui-dist/package.json'))
app.use('/swagger-ui-assets', express.static(swaggerUiAssetsPath))
const migrate = require('./src/config/migrate')
const runAdminMigrations = require('./src/config/admin.migrate')
const runSettingsMigrations = require('./src/config/settings.migrate')
migrate()
runAdminMigrations()
runSettingsMigrations()
// const passport = require('passport') // Comment out for now

// Start cleanup job (comment out in development if needed)
if (process.env.NODE_ENV === 'production') {
  require('./src/jobs/cleanup')
}

app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
  const specs = getSwaggerSpec()
  return swaggerUi.setup(specs)(req, res, next)
})

app.get('/api-docs-json', (req, res) => {
  res.json(getSwaggerSpec())
})

app.get('/api-documentation.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/docs/api-documentation.html'))
})
// app.use(passport.initialize()) // Comment out for now

// 1. Global CORS headers middleware
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://customer-panel-inglo.vercel.app',
    'https://inglo-zone-admin-panel.vercel.app',
    'http://localhost:5173'
  ]
  const origin = req.headers.origin
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  next()
})

// 2. CORS middleware
app.use(cors({
  origin: [
    'https://customer-panel-inglo.vercel.app',
    'https://inglo-zone-admin-panel.vercel.app',
    'http://localhost:5173'
  ],
  credentials: true
}))

// Parse URL-encoded form bodies (required for Swagger form submissions)
app.use(express.urlencoded({ extended: true }))

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

// Test endpoint
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  })
})

// Import routes
const accountRoutes = require('./src/routes/account.routes')
const authRoutes = require('./src/routes/auth.routes')
const userRoutes = require('./src/routes/user.routes')
const walletRoutes = require('./src/routes/wallet.routes')
const webhookRoutes = require('./src/webhooks/stripe.webhook')
const kycRoutes = require('./src/routes/kyc.routes')
const adminRoutes = require('./src/routes/admin.routes')
const settingsRoutes = require('./src/routes/settings.routes')

// Use routes
app.use('/api/user', userRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/kyc', kycRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/settings', settingsRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message)
  
  // Add CORS headers to error responses too
  const allowedOrigins = [
    'https://customer-panel-inglo.vercel.app',
    'https://inglo-zone-admin-panel.vercel.app',
    'http://localhost:5173'
  ]
  const origin = req.headers.origin
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  res.header('Access-Control-Allow-Credentials', 'true')
  
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// 404 handler with CORS headers
app.use((req, res) => {
  const allowedOrigins = [
    'https://customer-panel-inglo.vercel.app',
    'https://inglo-zone-admin-panel.vercel.app',
    'http://localhost:5173'
  ]
  const origin = req.headers.origin
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  res.header('Access-Control-Allow-Credentials', 'true')
  res.status(404).json({ error: 'Route not found' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`CORS enabled for origins: https://customer-panel-inglo.vercel.app, http://localhost:5173`)
  console.log(`KYC routes: /api/kyc/*`)
  console.log(`Test endpoint: https://temp.inglozone.com/api/test-cors`)
})
