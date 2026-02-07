const service = require('../services/auth.service')

// OLD FUNCTIONS - KEEP AS IS (commented out since we're using OTP now)
exports.register = async (req, res) => {
  try {
    const user = await service.register(req.body)
    res.json(user)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

exports.login = async (req, res) => {
  try {
    const result = await service.login(req.body)
    res.json(result)
  } catch (err) {
    res.status(401).json({ error: err.message })
  }
}

// NEW OTP FUNCTIONS
exports.registerWithOTP = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body
    
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ 
        error: 'All fields are required' 
      })
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      })
    }
    
    const result = await service.sendRegistrationOTP({
      firstName,
      lastName,
      email,
      password
    })
    
    res.status(200).json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

exports.verifyOTP = async (req, res) => {
  try {
    const { tempToken, otp } = req.body
    
    if (!tempToken || !otp) {
      return res.status(400).json({ 
        error: 'OTP and verification token are required' 
      })
    }
    
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ 
        error: 'OTP must be a 6-digit number' 
      })
    }
    
    const result = await service.verifyRegistrationOTP(tempToken, otp)
    res.status(201).json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

exports.resendOTP = async (req, res) => {
  try {
    const { tempToken } = req.body
    
    if (!tempToken) {
      return res.status(400).json({ 
        error: 'Verification token is required' 
      })
    }
    
    const result = await service.resendRegistrationOTP(tempToken)
    res.status(200).json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

// GOOGLE OAUTH FUNCTIONS
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      })
    }
    
    const result = await service.checkEmail(email)
    
    if (result.exists) {
      return res.status(200).json({
        success: false,
        error: `Email already registered with ${result.user.provider} authentication`,
        provider: result.user.provider,
        exists: true
      })
    }
    
    res.status(200).json({
      success: true,
      message: 'Email is available',
      exists: false
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

exports.completeProfile = async (req, res) => {
  try {
    const { userId, firstName, lastName, password } = req.body
    
    if (!userId || !firstName || !lastName || !password) {
      return res.status(400).json({ 
        error: 'All fields are required' 
      })
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      })
    }
    
    const result = await service.completeProfile(userId, {
      firstName,
      lastName,
      password
    })
    
    res.status(200).json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}