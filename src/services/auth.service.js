const crypto = require('crypto')
const db = require('../config/db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const speakeasy = require('speakeasy')
const { v4: uuidv4 } = require('uuid')
const emailService = require('./email.service')

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function decrypt2FASecret(encryptedBase64, ivHex) {
  const key = crypto.createHash('sha256')
    .update(process.env.TWO_FA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'two-fa-default-key')
    .digest()
  const raw = Buffer.from(encryptedBase64, 'base64')
  const authTag = raw.subarray(raw.length - 16)
  const encrypted = raw.subarray(0, raw.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

async function createUserSessionToken(user, ipAddress = null, userAgent = null) {
  const jti = uuidv4()
  const token = jwt.sign(
    { id: user.id, email: user.email, jti, type: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
  const decoded = jwt.decode(token)
  const expiresAt = new Date((decoded.exp || 0) * 1000)

  await db.promise().query(
    `INSERT INTO user_sessions (id, user_id, jwt_id, token_hash, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), user.id, jti, hashToken(token), ipAddress, userAgent, expiresAt]
  )

  return token
}

exports.register = async (data) => {
  const { firstName, lastName, email, password } = data

  const existingUser = await new Promise((resolve, reject) => {
    db.query(`SELECT id FROM users WHERE email = ?`, [email], (err, results) => {
      if (err) return reject(err)
      resolve(results[0])
    })
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

exports.login = async (data) => {
  const { email, password, twoFactorCode, ipAddress, userAgent } = data

  return new Promise((resolve, reject) => {
    db.query(`SELECT * FROM users WHERE email = ?`, [email], async (err, results) => {
      if (err || results.length === 0) return reject(new Error('Invalid credentials'))

      const user = results[0]
      const match = await bcrypt.compare(password, user.password_hash || '')
      if (!match) return reject(new Error('Invalid credentials'))

      if (user.is_2fa_enabled) {
        if (!twoFactorCode) return reject(new Error('2FA code is required'))
        if (!user.two_fa_secret_encrypted || !user.two_fa_secret_iv) {
          return reject(new Error('2FA configuration missing. Please re-enable 2FA.'))
        }

        const base32Secret = decrypt2FASecret(user.two_fa_secret_encrypted, user.two_fa_secret_iv)
        const verified = speakeasy.totp.verify({
          secret: base32Secret,
          encoding: 'base32',
          token: String(twoFactorCode),
          window: 1
        })
        if (!verified) return reject(new Error('Invalid 2FA code'))
      }

      const token = await createUserSessionToken(user, ipAddress, userAgent)

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
    })
  })
}

exports.sendRegistrationOTP = async (data) => {
  const { firstName, lastName, email, password } = data

  const existingUser = await new Promise((resolve, reject) => {
    db.query(`SELECT id FROM users WHERE email = ?`, [email], (err, results) => {
      if (err) return reject(err)
      resolve(results[0])
    })
  })

  if (existingUser) {
    throw new Error('Email already registered. Please use another email or login.')
  }

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

  await new Promise((resolve, reject) => {
    db.query(
      `DELETE FROM otp_verifications WHERE email = ? AND purpose = 'registration'`,
      [email],
      (err) => (err ? reject(err) : resolve())
    )
  })

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const otpHash = await bcrypt.hash(otp, 10)
  const otpId = uuidv4()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO otp_verifications (id, email, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, 'registration', ?)`,
      [otpId, email, otpHash, expiresAt],
      (err) => (err ? reject(err) : resolve())
    )
  })

  if (dailyLimit === 0) {
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO otp_daily_limits (id, email, date, count) VALUES (?, ?, ?, 1)`,
        [uuidv4(), email, today],
        (err) => (err ? reject(err) : resolve())
      )
    })
  } else {
    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE otp_daily_limits SET count = count + 1 WHERE email = ? AND date = ?`,
        [email, today],
        (err) => (err ? reject(err) : resolve())
      )
    })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const tempToken = jwt.sign(
    { temp: true, email, firstName, lastName, passwordHash, otpId },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  )

  await emailService.sendOTPEmail(email, firstName, otp)

  return {
    success: true,
    message: 'OTP sent to your email. Please check your inbox.',
    tempToken,
    email,
    expiresIn: 300
  }
}

exports.verifyRegistrationOTP = async (tempToken, otpCode, sessionMeta = {}) => {
  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET)
    if (!decoded.temp) throw new Error('Invalid verification token')

    const { email, firstName, lastName, passwordHash, otpId } = decoded

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

    if (!otpRecord) throw new Error('OTP expired or not found. Please request a new OTP.')
    if (new Date(otpRecord.expires_at) < new Date()) {
      db.query(`DELETE FROM otp_verifications WHERE id = ?`, [otpId])
      throw new Error('OTP has expired. Please request a new OTP.')
    }
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      throw new Error('Maximum OTP attempts exceeded. Please request a new OTP.')
    }

    const isValid = await bcrypt.compare(otpCode, otpRecord.otp_hash)
    if (!isValid) {
      await new Promise((resolve, reject) => {
        db.query(
          `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`,
          [otpId],
          (err) => (err ? reject(err) : resolve())
        )
      })
      const attemptsLeft = otpRecord.max_attempts - (otpRecord.attempts + 1)
      throw new Error(`Invalid OTP. ${attemptsLeft} attempt(s) remaining.`)
    }

    const userId = uuidv4()
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO users (
          id, first_name, last_name, email, password_hash,
          provider, is_verified, email_verified, password_set, verified_at
        ) VALUES (?, ?, ?, ?, ?, 'local', true, true, true, NOW())`,
        [userId, firstName, lastName, email, passwordHash],
        (err) => (err ? reject(err) : resolve())
      )
    })

    db.query(`DELETE FROM otp_verifications WHERE id = ?`, [otpId])

    const token = await createUserSessionToken(
      { id: userId, email },
      sessionMeta.ipAddress || null,
      sessionMeta.userAgent || null
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
    if (!decoded.temp) throw new Error('Invalid token')

    const { email, firstName } = decoded
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await bcrypt.hash(otp, 10)
    const otpId = uuidv4()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

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
            (insertErr) => (insertErr ? reject(insertErr) : resolve())
          )
        }
      )
    })

    if (dailyLimit === 0) {
      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO otp_daily_limits (id, email, date, count) VALUES (?, ?, ?, 1)`,
          [uuidv4(), email, today],
          (err) => (err ? reject(err) : resolve())
        )
      })
    } else {
      await new Promise((resolve, reject) => {
        db.query(
          `UPDATE otp_daily_limits SET count = count + 1 WHERE email = ? AND date = ?`,
          [email, today],
          (err) => (err ? reject(err) : resolve())
        )
      })
    }

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

    await emailService.sendOTPEmail(email, firstName, otp)
    return {
      success: true,
      message: 'New OTP sent to your email.',
      tempToken: newTempToken,
      expiresIn: 300
    }
  } catch (error) {
    if (error.name === 'JsonWebTokenError') throw new Error('Invalid or expired token')
    throw error
  }
}

exports.checkEmail = async (email) => {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT id, provider, password_set FROM users WHERE email = ?`,
      [email],
      (err, results) => {
        if (err) return reject(err)
        resolve({ exists: results.length > 0, user: results[0] || null })
      }
    )
  })
}

exports.completeProfile = async (userId, data) => {
  const { firstName, lastName, password } = data
  return new Promise((resolve, reject) => {
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
          (updateErr) => {
            if (updateErr) return reject(updateErr)
            resolve({ success: true, message: 'Profile completed successfully' })
          }
        )
      }
    )
  })
}

module.exports = {
  register: exports.register,
  login: exports.login,
  sendRegistrationOTP: exports.sendRegistrationOTP,
  verifyRegistrationOTP: exports.verifyRegistrationOTP,
  resendRegistrationOTP: exports.resendRegistrationOTP,
  checkEmail: exports.checkEmail,
  completeProfile: exports.completeProfile,
  createUserSessionToken
}
