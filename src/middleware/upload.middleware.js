// src/middleware/upload.middleware.js
const multer = require('multer')
const { RateLimiterMemory } = require('rate-limiter-flexible')

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

// Rate limiter for uploads (5 per hour per user)
const uploadRateLimiter = new RateLimiterMemory({
  points: parsePositiveInt(process.env.KYC_MAX_UPLOADS_PER_HOUR, 5),
  duration: parsePositiveInt(process.env.KYC_UPLOAD_RATE_LIMIT_WINDOW_SECONDS, 60 * 60), // 1 hour
})

// Configure multer for memory storage
const storage = multer.memoryStorage()

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'), false)
  }
  
  // Check file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    return cb(new Error('File size too large. Maximum size is 5MB.'), false)
  }
  
  cb(null, true)
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
})

// Rate limiting middleware for uploads
const uploadRateLimit = async (req, res, next) => {
  const limiterKey = req.user?.id || req.ip

  try {
    await uploadRateLimiter.consume(limiterKey)
    next()
  } catch (rateError) {
    if (rateError instanceof Error) {
      return next(rateError)
    }

    const retryAfterSeconds = Math.ceil(rateError.msBeforeNext / 1000)
    res.set('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({
      error: 'Too many upload attempts. Please try again later.',
      retryAfter: retryAfterSeconds
    })
  }
}

// Single file upload middleware - This returns a function
const uploadSingle = upload.single('document')

module.exports = {
  uploadSingle,
  uploadRateLimit
}
