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

// Enhanced CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://customer-panel-inglo.vercel.app',
      'http://localhost:5173',
      'https://temp.inglozone.com'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log('Blocked CORS request from origin:', origin);
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Handle preflight requests
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }
  next();
});

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
const webhookRoutes = require('./src/webhooks/stripe.webhook')
const kycRoutes = require('./src/routes/kyc.routes') // NEW KYC ROUTES

// Use routes
app.use('/api/user', userRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/kyc', kycRoutes) // NEW KYC ROUTES

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed'
    })
  }
  
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
  console.log(`KYC Upload Path: ${process.env.KYC_UPLOAD_PATH || './uploads/kyc'}`)
})