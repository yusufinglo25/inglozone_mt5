const service = require('../services/auth.service')
const { validatePasswordPolicy } = require('../utils/password-policy')

const getFieldValue = (field) => {
  if (field && typeof field === 'object' && Object.prototype.hasOwnProperty.call(field, 'value')) {
    return field.value
  }
  return field
}

// Helper function to add CORS headers
const addCorsHeaders = (res, req) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'https://customer-panel-inglo.vercel.app');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Authorization');
  return res;
};

// OLD FUNCTIONS - KEEP AS IS (commented out since we're using OTP now)
exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body

    if (!firstName || !lastName || !email || !password) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({
        error: 'All fields are required'
      })
    }

    const passwordError = validatePasswordPolicy(password)
    if (passwordError) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ error: passwordError })
    }

    const user = await service.register({ firstName, lastName, email, password })
    res = addCorsHeaders(res, req);
    res.json(user)
  } catch (err) {
    res = addCorsHeaders(res, req);
    res.status(400).json({ error: err.message })
  }
}

exports.login = async (req, res) => {
  try {
    const email = getFieldValue(req.body?.email)
    const password = getFieldValue(req.body?.password)

    if (!email || !password) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await service.login({
      email,
      password,
      twoFactorCode: getFieldValue(req.body?.twoFactorCode),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })
    res = addCorsHeaders(res, req);
    res.json(result)
  } catch (err) {
    res = addCorsHeaders(res, req);
    res.status(401).json({ error: err.message })
  }
}

// NEW OTP FUNCTIONS
exports.registerWithOTP = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body
    
    if (!firstName || !lastName || !email || !password) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ 
        error: 'All fields are required' 
      })
    }
    
    const passwordError = validatePasswordPolicy(password)
    if (passwordError) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ 
        error: passwordError 
      })
    }
    
    const result = await service.sendRegistrationOTP({
      firstName,
      lastName,
      email,
      password
    })
    
    res = addCorsHeaders(res, req);
    res.status(200).json(result)
  } catch (err) {
    res = addCorsHeaders(res, req);
    res.status(400).json({ error: err.message })
  }
}

exports.verifyOTP = async (req, res) => {
  try {
    const { tempToken, otp } = req.body
    
    if (!tempToken || !otp) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ 
        error: 'OTP and verification token are required' 
      })
    }
    
    if (!/^\d{6}$/.test(otp)) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ 
        error: 'OTP must be a 6-digit number' 
      })
    }
    
    const result = await service.verifyRegistrationOTP(tempToken, otp, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })
    res = addCorsHeaders(res, req);
    res.status(201).json(result)
  } catch (err) {
    res = addCorsHeaders(res, req);
    res.status(400).json({ error: err.message })
  }
}

exports.resendOTP = async (req, res) => {
  try {
    const { tempToken } = req.body
    
    if (!tempToken) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ 
        error: 'Verification token is required' 
      })
    }
    
    const result = await service.resendRegistrationOTP(tempToken)
    res = addCorsHeaders(res, req);
    res.status(200).json(result)
  } catch (err) {
    res = addCorsHeaders(res, req);
    res.status(400).json({ error: err.message })
  }
}

// GOOGLE OAUTH FUNCTIONS
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ 
        error: 'Email is required' 
      })
    }
    
    const result = await service.checkEmail(email)
    
    if (result.exists) {
      res = addCorsHeaders(res, req);
      return res.status(200).json({
        success: false,
        error: `Email already registered with ${result.user.provider} authentication`,
        provider: result.user.provider,
        exists: true
      })
    }
    
    res = addCorsHeaders(res, req);
    res.status(200).json({
      success: true,
      message: 'Email is available',
      exists: false
    })
  } catch (error) {
    res = addCorsHeaders(res, req);
    res.status(500).json({ error: error.message })
  }
}

exports.completeProfile = async (req, res) => {
  try {
    const { userId, firstName, lastName, password } = req.body
    
    if (!userId || !firstName || !lastName || !password) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ 
        error: 'All fields are required' 
      })
    }
    
    const passwordError = validatePasswordPolicy(password)
    if (passwordError) {
      res = addCorsHeaders(res, req);
      return res.status(400).json({ 
        error: passwordError 
      })
    }
    
    const result = await service.completeProfile(userId, {
      firstName,
      lastName,
      password
    })
    
    res = addCorsHeaders(res, req);
    res.status(200).json(result)
  } catch (error) {
    res = addCorsHeaders(res, req);
    res.status(400).json({ error: error.message })
  }
}
