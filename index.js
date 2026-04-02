require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { PrismaClient } = require('@prisma/client')
const { PrismaMariaDb } = require('@prisma/adapter-mariadb')
const { swaggerUi, getSwaggerSpec } = require('./src/config/swagger')
const jwt = require('jsonwebtoken')

const app = express()

const HEALTH_CACHE_TTL_MS = 5000
const HEALTH_DB_TIMEOUT_MS = 80

const healthState = {
  checkedAt: 0,
  isConnected: false,
  inFlightCheck: null
}

let prismaHealthClient = null

function getHealthPrismaClient() {
  if (prismaHealthClient) {
    return prismaHealthClient
  }

  const adapter = new PrismaMariaDb({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    connectionLimit: Number(process.env.HEALTH_DB_CONNECTION_LIMIT || 2),
    acquireTimeout: Number(process.env.HEALTH_DB_ACQUIRE_TIMEOUT_MS || 100),
    connectTimeout: Number(process.env.HEALTH_DB_CONNECT_TIMEOUT_MS || 5000)
  })

  prismaHealthClient = new PrismaClient({ adapter })
  return prismaHealthClient
}

function setHealthHeaders(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  res.set('Surrogate-Control', 'no-store')
}

async function runHealthDatabaseCheck() {
  const prisma = getHealthPrismaClient()
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Health database check timed out after ${HEALTH_DB_TIMEOUT_MS}ms`)), HEALTH_DB_TIMEOUT_MS)
  })

  await Promise.race([
    prisma.$queryRaw`SELECT 1`,
    timeoutPromise
  ])

  healthState.checkedAt = Date.now()
  healthState.isConnected = true

  return true
}

async function refreshHealthDatabaseStatus() {
  if (healthState.inFlightCheck) {
    return healthState.inFlightCheck
  }

  healthState.inFlightCheck = runHealthDatabaseCheck()
    .catch(() => {
      healthState.checkedAt = Date.now()
      healthState.isConnected = false
      return false
    })
    .finally(() => {
      healthState.inFlightCheck = null
    })

  return healthState.inFlightCheck
}

async function getHealthDatabaseStatus() {
  if (!healthState.checkedAt) {
    return refreshHealthDatabaseStatus()
  }

  const cacheAge = Date.now() - healthState.checkedAt
  if (cacheAge >= HEALTH_CACHE_TTL_MS && !healthState.inFlightCheck) {
    void refreshHealthDatabaseStatus()
  }

  return healthState.isConnected
}

// Tiny startup/runtime logger for cPanel environments.
const startupLogDir = path.join(__dirname, 'tmp')
const startupLogFile = path.join(startupLogDir, 'startup.log')
try {
  fs.mkdirSync(startupLogDir, { recursive: true })

  const writeStartupLog = (level, args) => {
    const ts = new Date().toISOString()
    const message = args.map((arg) => {
      if (arg instanceof Error) return `${arg.message}\n${arg.stack || ''}`
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg) } catch (e) { return '[object]' }
      }
      return String(arg)
    }).join(' ')

    fs.appendFileSync(startupLogFile, `[${ts}] [${level}] ${message}\n`)
  }

  const originalLog = console.log.bind(console)
  const originalError = console.error.bind(console)
  console.log = (...args) => {
    writeStartupLog('INFO', args)
    originalLog(...args)
  }
  console.error = (...args) => {
    writeStartupLog('ERROR', args)
    originalError(...args)
  }

  console.log(`Startup logger active: ${startupLogFile}`)
} catch (loggerError) {
  console.error('Failed to initialize startup logger:', loggerError.message)
}

const swaggerUiAssetsPath = path.dirname(require.resolve('swagger-ui-dist/package.json'))
app.use('/swagger-ui-assets', express.static(swaggerUiAssetsPath))
const migrate = require('./src/config/migrate')
const runAdminMigrations = require('./src/config/admin.migrate')
const runSettingsMigrations = require('./src/config/settings.migrate')
const startPaymentReminderJob = require('./src/jobs/payment-reminder')
const passport = require('./src/config/google')
migrate()
runAdminMigrations()
runSettingsMigrations()

// Start cleanup job (comment out in development if needed)
if (process.env.NODE_ENV === 'production') {
  require('./src/jobs/cleanup')
}

if (process.env.ENABLE_PAYMENT_REMINDER_JOB !== 'false') {
  startPaymentReminderJob()
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
app.use(passport.initialize())

// 1. Global CORS headers middleware
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://customer-panel-inglo.vercel.app',
    'https://inglo-zone-admin-panel.vercel.app',
    'http://localhost:5173',
    'https://inglozone.in'
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
  if (req.originalUrl === '/api/webhooks/stripe-webhook' || req.originalUrl === '/api/webhooks/razorpay-webhook') {
    next()
  } else {
    express.json()(req, res, next)
  }
})

app.get('/', (req, res) => {
  res.send('Backend running successfully 🚀')
})

app.get('/health', async (req, res) => {
  setHealthHeaders(res)

  try {
    const isDatabaseConnected = await getHealthDatabaseStatus()
    return res.status(isDatabaseConnected ? 200 : 503).json({
      status: isDatabaseConnected ? 'ok' : 'error',
      uptime: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
      database: isDatabaseConnected ? 'connected' : 'disconnected'
    })
  } catch (error) {
    console.error('Health endpoint failed unexpectedly:', error.message)
    return res.status(503).json({
      status: 'error',
      uptime: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    })
  }
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
const investorRoutes = require('./src/routes/investor.routes')
const webhookRoutes = require('./src/webhooks/stripe.webhook')
const kycRoutes = require('./src/routes/kyc.routes')
const adminRoutes = require('./src/routes/admin.routes')
const settingsRoutes = require('./src/routes/settings.routes')
const matchTraderRoutes = require('./src/routes/matchtrader.routes')

// Use routes
app.use('/api/user', userRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/investor', investorRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/kyc', kycRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/matchtrader', matchTraderRoutes)

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
