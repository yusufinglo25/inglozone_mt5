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

// Rate limiting middleware for uploads
const uploadRateLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      })
    }
    
    await uploadRateLimiter.consume(userId)
    next()
  } catch (rateLimitError) {
    return res.status(429).json({
      error: 'Too many upload requests. Please try again later.'
    })
  }
}

// Single file upload middleware - MUST be a function
const uploadSingle = upload.single('document')

// Export as an object
module.exports = {
  uploadSingle,
  uploadRateLimit
}