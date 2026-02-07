const db = require('../config/db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const emailService = require('./email.service')

// 1. REGISTER FUNCTION (Direct registration without OTP)
exports.register = async (data) => {
  const { firstName, lastName, email, password } = data

  // Check if email already exists
  const existingUser = await new Promise((resolve, reject) => {
    db.query(
      `SELECT id FROM users WHERE email = ?`,
      [email],
      (err, results) => {
        if (err) return reject(err)
        resolve(results[0])
      }
    )
  })

  if (existingUser) {
    throw new Error('Email already registered. Please use another email or login.')
  }

  const hash = await bcrypt.hash(password, 10)
  const id = uuidv4()

  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO users (id, first_name, last_name, email, password_hash) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, firstName, lastName, email, hash],
      (err) => {
        if (err) return reject(err)
        resolve({
          success: true,
          message: 'Account created successfully',
          next: 'login'
        })
      }
    )
  })
}

// 2. LOGIN FUNCTION
exports.login = async (data) => {
  const { email, password } = data

  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM users WHERE email = ?`,
      [email],
      async (err, results) => {
        if (err || results.length === 0)
          return reject(new Error('Invalid credentials'))

        const user = results[0]
        
        const match = await bcrypt.compare(password, user.password_hash)

        if (!match) return reject(new Error('Invalid credentials'))

        const token = jwt.sign(
          { id: user.id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        )

        resolve({
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            mobile: user.mobile,
            is2FAEnabled: user.is_2fa_enabled,
            profileCompleted: user.profile_completed
          }
        })
      }
    )
  })
}

// 3. OTP FUNCTIONS
exports.sendRegistrationOTP = async (data) => {
  const { firstName, lastName, email, password } = data
  
  // Check if email already registered
  const existingUser = await new Promise((resolve, reject) => {
    db.query(
      `SELECT id FROM users WHERE email = ?`,
      [email],
      (err, results) => {
        if (err) return reject(err)
        resolve(results[0])
      }
    )
  })

  if (existingUser) {
    throw new Error('Email already registered. Please use another email or login.')
  }

  // Check daily OTP limit (max 5 per day)
  const today = new Date().toISOString().split('T')[0]
  const dailyLimit = await new Promise((resolve, reject) => {
    db.query(
      `SELECT count FROM otp_daily_limits WHERE email = ? AND date = ?`,
      [email, today],
      (err, results) => {
        if (err) return reject(err)
        resolve(results[0]?.count || 0)
      }
    )
  })

  if (dailyLimit >= 5) {
    throw new Error('Maximum OTP requests reached for today. Please try again tomorrow.')
  }

  // Delete any existing OTP for this email (registration purpose)
  await new Promise((resolve, reject) => {
    db.query(
      `DELETE FROM otp_verifications WHERE email = ? AND purpose = 'registration'`,
      [email],
      (err) => {
        if (err) return reject(err)
        resolve()
      }
    )
  })

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const otpHash = await bcrypt.hash(otp, 10)
  const otpId = uuidv4()
  
  // Set expiry (5 minutes from now)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  // Store OTP in database
  await new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO otp_verifications (id, email, otp_hash, purpose, expires_at) 
       VALUES (?, ?, ?, 'registration', ?)`,
      [otpId, email, otpHash, expiresAt],
      (err) => {
        if (err) return reject(err)
        resolve()
      }
    )
  })

  // Update daily count
  if (dailyLimit === 0) {
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO otp_daily_limits (id, email, date, count) VALUES (?, ?, ?, 1)`,
        [uuidv4(), email, today],
        (err) => {
          if (err) return reject(err)
          resolve()
        }
      )
    })
  } else {
    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE otp_daily_limits SET count = count + 1 WHERE email = ? AND date = ?`,
        [email, today],
        (err) => {
          if (err) return reject(err)
          resolve()
        }
      )
    })
  }

  // Hash password temporarily (will use in verification)
  const passwordHash = await bcrypt.hash(password, 10)

  // Store user data temporarily (or pass to frontend to resend in verification)
  // For simplicity, we'll return a temporary token with user data
  const tempToken = jwt.sign(
    { 
      temp: true, 
      email, 
      firstName, 
      lastName, 
      passwordHash,
      otpId 
    },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  )

  // Send OTP email
  await emailService.sendOTPEmail(email, firstName, otp)

  return {
    success: true,
    message: 'OTP sent to your email. Please check your inbox.',
    tempToken,
    email,
    expiresIn: 300 // 5 minutes in seconds
  }
}

exports.verifyRegistrationOTP = async (tempToken, otpCode) => {
  try {
    // Verify temp token
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET)
    
    if (!decoded.temp) {
      throw new Error('Invalid verification token')
    }

    const { email, firstName, lastName, passwordHash, otpId } = decoded

    // Get OTP from database
    const otpRecord = await new Promise((resolve, reject) => {
      db.query(
        `SELECT * FROM otp_verifications WHERE id = ? AND email = ? AND purpose = 'registration'`,
        [otpId, email],
        (err, results) => {
          if (err) return reject(err)
          resolve(results[0])
        }
      )
    })

    if (!otpRecord) {
      throw new Error('OTP expired or not found. Please request a new OTP.')
    }

    // Check if OTP expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      // Clean up expired OTP
      db.query(`DELETE FROM otp_verifications WHERE id = ?`, [otpId])
      throw new Error('OTP has expired. Please request a new OTP.')
    }

    // Check attempt limit
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      throw new Error('Maximum OTP attempts exceeded. Please request a new OTP.')
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otpCode, otpRecord.otp_hash)
    
    if (!isValid) {
      // Increment attempt count
      await new Promise((resolve, reject) => {
        db.query(
          `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`,
          [otpId],
          (err) => {
            if (err) return reject(err)
            resolve()
          }
        )
      })

      const attemptsLeft = otpRecord.max_attempts - (otpRecord.attempts + 1)
      throw new Error(`Invalid OTP. ${attemptsLeft} attempt(s) remaining.`)
    }

    // OTP verified - Create user account
    const userId = uuidv4()
    
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO users (
          id, first_name, last_name, email, password_hash, 
          provider, is_verified, email_verified, password_set, verified_at
        ) VALUES (?, ?, ?, ?, ?, 'local', true, true, true, NOW())`,
        [userId, firstName, lastName, email, passwordHash],
        (err) => {
          if (err) return reject(err)
          resolve()
        }
      )
    })

    // Delete used OTP
    db.query(`DELETE FROM otp_verifications WHERE id = ?`, [otpId])

    // Generate final auth token
    const token = jwt.sign(
      { id: userId, email: email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return {
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        emailVerified: true,
        isVerified: true,
        provider: 'local'
      }
    }

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid or expired verification token')
    }
    throw error
  }
}

exports.resendRegistrationOTP = async (tempToken) => {
  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET)
    
    if (!decoded.temp) {
      throw new Error('Invalid token')
    }

    const { email, firstName } = decoded

    // Check daily limit
    const today = new Date().toISOString().split('T')[0]
    const dailyLimit = await new Promise((resolve, reject) => {
      db.query(
        `SELECT count FROM otp_daily_limits WHERE email = ? AND date = ?`,
        [email, today],
        (err, results) => {
          if (err) return reject(err)
          resolve(results[0]?.count || 0)
        }
      )
    })

    if (dailyLimit >= 5) {
      throw new Error('Maximum OTP requests reached for today. Please try again tomorrow.')
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await bcrypt.hash(otp, 10)
    const otpId = uuidv4()
    
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    // Delete old OTP and store new one
    await new Promise((resolve, reject) => {
      db.query(
        `DELETE FROM otp_verifications WHERE email = ? AND purpose = 'registration'`,
        [email],
        (err) => {
          if (err) return reject(err)
          
          db.query(
            `INSERT INTO otp_verifications (id, email, otp_hash, purpose, expires_at) 
             VALUES (?, ?, ?, 'registration', ?)`,
            [otpId, email, otpHash, expiresAt],
            (err) => {
              if (err) return reject(err)
              resolve()
            }
          )
        }
      )
    })

    // Update daily count
    if (dailyLimit === 0) {
      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO otp_daily_limits (id, email, date, count) VALUES (?, ?, ?, 1)`,
          [uuidv4(), email, today],
          (err) => {
            if (err) return reject(err)
            resolve()
          }
        )
      })
    } else {
      await new Promise((resolve, reject) => {
        db.query(
          `UPDATE otp_daily_limits SET count = count + 1 WHERE email = ? AND date = ?`,
          [email, today],
          (err) => {
            if (err) return reject(err)
            resolve()
          }
        )
      })
    }

    // Update temp token with new otpId
    const newTempToken = jwt.sign(
      { 
        temp: true, 
        email: decoded.email, 
        firstName: decoded.firstName, 
        lastName: decoded.lastName, 
        passwordHash: decoded.passwordHash,
        otpId 
      },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    )

    // Send new OTP email
    await emailService.sendOTPEmail(email, firstName, otp)

    return {
      success: true,
      message: 'New OTP sent to your email.',
      tempToken: newTempToken,
      expiresIn: 300
    }

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid or expired token')
    }
    throw error
  }
}

// 4. GOOGLE OAUTH FUNCTIONS (Add if you have them)
exports.checkEmail = async (email) => {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT id, provider, password_set FROM users WHERE email = ?`,
      [email],
      (err, results) => {
        if (err) return reject(err)
        
        resolve({
          exists: results.length > 0,
          user: results[0] || null
        })
      }
    )
  })
}

exports.completeProfile = async (userId, data) => {
  const { firstName, lastName, password } = data
  
  return new Promise((resolve, reject) => {
    // Check if user exists and is a Google OAuth user without password
    db.query(
      `SELECT * FROM users WHERE id = ? AND provider = 'google' AND password_set = false`,
      [userId],
      async (err, results) => {
        if (err || results.length === 0) {
          return reject(new Error('User not found or password already set'))
        }
        
        const hash = await bcrypt.hash(password, 10)
        
        db.query(
          `UPDATE users SET 
            first_name = ?, 
            last_name = ?, 
            password_hash = ?, 
            password_set = true,
            profile_completed = true
           WHERE id = ?`,
          [firstName, lastName, hash, userId],
          (err) => {
            if (err) return reject(err)
            
            resolve({
              success: true,
              message: 'Profile completed successfully'
            })
          }
        )
      }
    )
  })
}

// 5. Make sure ALL functions are exported
module.exports = {
  register: exports.register,
  login: exports.login,
  sendRegistrationOTP: exports.sendRegistrationOTP,
  verifyRegistrationOTP: exports.verifyRegistrationOTP,
  resendRegistrationOTP: exports.resendRegistrationOTP,
  checkEmail: exports.checkEmail,
  completeProfile: exports.completeProfile
}