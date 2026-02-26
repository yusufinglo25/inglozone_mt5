const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const speakeasy = require('speakeasy')
const QRCode = require('qrcode')
const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')
const emailService = require('./email.service')
const { validatePasswordPolicy } = require('../utils/password-policy')

class SettingsService {
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  async createSessionToken(user, ipAddress = null, userAgent = null) {
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
      [uuidv4(), user.id, jti, this.hashToken(token), ipAddress, userAgent, expiresAt]
    )

    return token
  }

  encryptSecret(plainText) {
    const key = crypto.createHash('sha256')
      .update(process.env.TWO_FA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'two-fa-default-key')
      .digest()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return {
      encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
      iv: iv.toString('hex')
    }
  }

  decryptSecret(encryptedBase64, ivHex) {
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

  async requestOldEmailOTP(userId) {
    const [users] = await db.promise().query(
      `SELECT id, email, first_name FROM users WHERE id = ? LIMIT 1`,
      [userId]
    )
    if (users.length === 0) throw new Error('User not found')

    const user = users[0]
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await bcrypt.hash(otp, 10)
    const otpId = uuidv4()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await db.promise().query(
      `DELETE FROM otp_verifications WHERE email = ? AND purpose = 'email_change'`,
      [user.email]
    )

    await db.promise().query(
      `INSERT INTO otp_verifications (id, email, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, 'email_change', ?)`,
      [otpId, user.email, otpHash, expiresAt]
    )

    await emailService.sendOTPEmail(user.email, user.first_name || 'User', otp)

    const verificationToken = jwt.sign(
      { type: 'email_change', stage: 'old_email', userId, email: user.email, otpId },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    )

    return {
      success: true,
      message: 'OTP sent to your current email address',
      verificationToken,
      expiresIn: 300
    }
  }

  async verifyOldEmailOTP(userId, verificationToken, otpCode) {
    const decoded = jwt.verify(verificationToken, process.env.JWT_SECRET)
    if (decoded.type !== 'email_change' || decoded.stage !== 'old_email' || decoded.userId !== userId) {
      throw new Error('Invalid verification token')
    }

    const [records] = await db.promise().query(
      `SELECT * FROM otp_verifications
       WHERE id = ? AND email = ? AND purpose = 'email_change'
       LIMIT 1`,
      [decoded.otpId, decoded.email]
    )
    if (records.length === 0) throw new Error('OTP expired or invalid')

    const record = records[0]
    if (new Date(record.expires_at) < new Date()) {
      await db.promise().query(`DELETE FROM otp_verifications WHERE id = ?`, [record.id])
      throw new Error('OTP expired')
    }
    if (record.attempts >= record.max_attempts) throw new Error('Maximum OTP attempts exceeded')

    const isValid = await bcrypt.compare(otpCode, record.otp_hash)
    if (!isValid) {
      await db.promise().query(
        `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`,
        [record.id]
      )
      throw new Error('Invalid OTP')
    }

    await db.promise().query(`DELETE FROM otp_verifications WHERE id = ?`, [record.id])

    const emailChangeToken = jwt.sign(
      { type: 'email_change', stage: 'old_verified', userId, oldEmail: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    )

    return {
      success: true,
      message: 'Old email verified successfully',
      emailChangeToken
    }
  }

  async requestNewEmailOTP(userId, emailChangeToken, newEmail) {
    const normalizedNewEmail = String(newEmail || '').trim().toLowerCase()
    if (!normalizedNewEmail) throw new Error('New email is required')

    const decoded = jwt.verify(emailChangeToken, process.env.JWT_SECRET)
    if (decoded.type !== 'email_change' || decoded.stage !== 'old_verified' || decoded.userId !== userId) {
      throw new Error('Invalid email change token')
    }

    if (decoded.oldEmail === normalizedNewEmail) {
      throw new Error('New email cannot be same as current email')
    }

    const [existingUsers] = await db.promise().query(
      `SELECT id FROM users WHERE email = ? LIMIT 1`,
      [normalizedNewEmail]
    )
    if (existingUsers.length > 0) throw new Error('Email already in use')

    const [userRows] = await db.promise().query(
      `SELECT first_name FROM users WHERE id = ? LIMIT 1`,
      [userId]
    )
    if (userRows.length === 0) throw new Error('User not found')

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await bcrypt.hash(otp, 10)
    const otpId = uuidv4()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await db.promise().query(
      `DELETE FROM otp_verifications WHERE email = ? AND purpose = 'email_change'`,
      [normalizedNewEmail]
    )

    await db.promise().query(
      `INSERT INTO otp_verifications (id, email, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, 'email_change', ?)`,
      [otpId, normalizedNewEmail, otpHash, expiresAt]
    )

    await emailService.sendOTPEmail(normalizedNewEmail, userRows[0].first_name || 'User', otp)

    const newEmailVerificationToken = jwt.sign(
      {
        type: 'email_change',
        stage: 'new_email',
        userId,
        oldEmail: decoded.oldEmail,
        newEmail: normalizedNewEmail,
        otpId
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    )

    return {
      success: true,
      message: 'OTP sent to new email address',
      newEmailVerificationToken,
      expiresIn: 300
    }
  }

  async verifyNewEmailOTP(userId, newEmailVerificationToken, otpCode) {
    const decoded = jwt.verify(newEmailVerificationToken, process.env.JWT_SECRET)
    if (decoded.type !== 'email_change' || decoded.stage !== 'new_email' || decoded.userId !== userId) {
      throw new Error('Invalid verification token')
    }

    const [records] = await db.promise().query(
      `SELECT * FROM otp_verifications
       WHERE id = ? AND email = ? AND purpose = 'email_change'
       LIMIT 1`,
      [decoded.otpId, decoded.newEmail]
    )
    if (records.length === 0) throw new Error('OTP expired or invalid')

    const record = records[0]
    if (new Date(record.expires_at) < new Date()) {
      await db.promise().query(`DELETE FROM otp_verifications WHERE id = ?`, [record.id])
      throw new Error('OTP expired')
    }

    const isValid = await bcrypt.compare(otpCode, record.otp_hash)
    if (!isValid) {
      await db.promise().query(
        `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`,
        [record.id]
      )
      throw new Error('Invalid OTP')
    }

    const [conflict] = await db.promise().query(
      `SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1`,
      [decoded.newEmail, userId]
    )
    if (conflict.length > 0) throw new Error('Email already in use')

    await db.promise().query(
      `UPDATE users
       SET email = ?, email_verified = true
       WHERE id = ?`,
      [decoded.newEmail, userId]
    )

    await db.promise().query(`DELETE FROM otp_verifications WHERE id = ?`, [record.id])

    return {
      success: true,
      message: 'Email updated successfully',
      email: decoded.newEmail
    }
  }

  async changePassword(userId, currentPassword, newPassword, confirmNewPassword) {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      throw new Error('All password fields are required')
    }
    if (newPassword !== confirmNewPassword) {
      throw new Error('New password and confirm password do not match')
    }

    const passwordError = validatePasswordPolicy(newPassword)
    if (passwordError) throw new Error(passwordError)

    const [rows] = await db.promise().query(
      `SELECT password_hash FROM users WHERE id = ? LIMIT 1`,
      [userId]
    )
    if (rows.length === 0) throw new Error('User not found')

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash || '')
    if (!match) throw new Error('Current password is incorrect')

    const newHash = await bcrypt.hash(newPassword, 10)
    await db.promise().query(
      `UPDATE users SET password_hash = ? WHERE id = ?`,
      [newHash, userId]
    )

    return { success: true, message: 'Password changed successfully' }
  }

  async generate2FA(userId, email) {
    const secret = speakeasy.generateSecret({
      name: `Inglozone (${email})`,
      issuer: 'Inglozone',
      length: 20
    })

    const encrypted = this.encryptSecret(secret.base32)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await db.promise().query(
      `UPDATE users
       SET two_fa_temp_secret_encrypted = ?, two_fa_temp_secret_iv = ?, two_fa_temp_expires_at = ?
       WHERE id = ?`,
      [encrypted.encrypted, encrypted.iv, expiresAt, userId]
    )

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url)

    return {
      success: true,
      message: '2FA setup generated',
      data: {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeDataUrl,
        expiresIn: 600
      }
    }
  }

  async verify2FA(userId, code) {
    const [rows] = await db.promise().query(
      `SELECT two_fa_temp_secret_encrypted, two_fa_temp_secret_iv, two_fa_temp_expires_at
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    )
    if (rows.length === 0) throw new Error('User not found')

    const row = rows[0]
    if (!row.two_fa_temp_secret_encrypted || !row.two_fa_temp_secret_iv) {
      throw new Error('2FA setup not initiated')
    }
    if (row.two_fa_temp_expires_at && new Date(row.two_fa_temp_expires_at) < new Date()) {
      throw new Error('2FA setup expired. Please generate QR again')
    }

    const base32 = this.decryptSecret(row.two_fa_temp_secret_encrypted, row.two_fa_temp_secret_iv)
    const verified = speakeasy.totp.verify({
      secret: base32,
      encoding: 'base32',
      token: String(code),
      window: 1
    })

    if (!verified) throw new Error('Invalid 2FA code')

    const encryptedFinal = this.encryptSecret(base32)
    await db.promise().query(
      `UPDATE users
       SET is_2fa_enabled = true,
           two_fa_secret_encrypted = ?,
           two_fa_secret_iv = ?,
           two_fa_temp_secret_encrypted = NULL,
           two_fa_temp_secret_iv = NULL,
           two_fa_temp_expires_at = NULL
       WHERE id = ?`,
      [encryptedFinal.encrypted, encryptedFinal.iv, userId]
    )

    return { success: true, message: '2FA enabled successfully' }
  }

  async disable2FA(userId, code) {
    const [rows] = await db.promise().query(
      `SELECT is_2fa_enabled, two_fa_secret_encrypted, two_fa_secret_iv
       FROM users WHERE id = ? LIMIT 1`,
      [userId]
    )
    if (rows.length === 0) throw new Error('User not found')
    const user = rows[0]
    if (!user.is_2fa_enabled) throw new Error('2FA is already disabled')

    const base32 = this.decryptSecret(user.two_fa_secret_encrypted, user.two_fa_secret_iv)
    const verified = speakeasy.totp.verify({
      secret: base32,
      encoding: 'base32',
      token: String(code),
      window: 1
    })
    if (!verified) throw new Error('Invalid 2FA code')

    await db.promise().query(
      `UPDATE users
       SET is_2fa_enabled = false,
           two_fa_secret_encrypted = NULL,
           two_fa_secret_iv = NULL,
           two_fa_temp_secret_encrypted = NULL,
           two_fa_temp_secret_iv = NULL,
           two_fa_temp_expires_at = NULL
       WHERE id = ?`,
      [userId]
    )

    return { success: true, message: '2FA disabled successfully' }
  }

  async logoutAllDevices(userId) {
    await db.promise().query(
      `UPDATE user_sessions
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    )
    return { success: true, message: 'Logged out from all devices' }
  }

  async logoutOtherDevices(userId, currentJti) {
    if (!currentJti) throw new Error('Current session identifier missing')
    await db.promise().query(
      `UPDATE user_sessions
       SET revoked_at = NOW(), updated_at = NOW()
       WHERE user_id = ?
         AND jwt_id <> ?
         AND revoked_at IS NULL`,
      [userId, currentJti]
    )
    return { success: true, message: 'Logged out from all other devices' }
  }
}

module.exports = new SettingsService()
