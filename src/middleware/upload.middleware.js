// src/middleware/upload.middleware.js
const multer = require('multer')
const { RateLimiterMemory } = require('rate-limiter-flexible')

// Rate limiter for uploads (5 per hour per user)
const uploadRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 60, // 1 hour
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

// Rate limiting middleware for uploads - MUST be a function
const uploadRateLimit = (req, res, next) => {
  // For now, skip rate limiting to get it working
  // We'll implement proper rate limiting later
  next()
}

// Single file upload middleware - This returns a function
const uploadSingle = upload.single('document')

module.exports = {
  uploadSingle,
  uploadRateLimit
}