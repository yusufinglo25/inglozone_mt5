const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')
const emailService = require('./email.service')
const currencyService = require('./currency.service')
const {
  generateUniqueTransactionId,
  generateUniqueTransactionNumber
} = require('../utils/id-generator')

class WithdrawalService {
  toMoney(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Number(numeric.toFixed(2))
  }

  parseMethod(value) {
    const method = String(value || '').trim().toLowerCase()
    if (!['upi', 'bank_transfer'].includes(method)) return null
    return method
  }

  getAllowedMethods(countryCode) {
    return countryCode === 'IN' ? ['upi', 'bank_transfer'] : ['bank_transfer']
  }

  getMethodDefinitions(countryCode) {
    if (countryCode === 'IN') {
      return [
        {
          code: 'upi',
          label: 'UPI',
          requiredFields: ['upiId']
        },
        {
          code: 'bank_transfer',
          label: 'Bank Transfer',
          requiredFields: ['bankName', 'accountNumber', 'ifscCode']
        }
      ]
    }

    return [
      {
        code: 'bank_transfer',
        label: 'Bank Transfer',
        requiredFields: ['bankName', 'accountNumber', 'iban']
      }
    ]
  }

  ensureMethodAllowed(countryCode, method) {
    const allowed = this.getAllowedMethods(countryCode)
    if (!allowed.includes(method)) {
      if (countryCode === 'IN') {
        throw new Error('India supports UPI and Bank Transfer withdrawal methods')
      }
      throw new Error('Only Bank Transfer is available for your registered country')
    }
  }

  normalizeAccountPayload(countryCode, payload = {}) {
    const method = this.parseMethod(payload.method)
    if (!method) throw new Error('method must be upi or bank_transfer')
    this.ensureMethodAllowed(countryCode, method)

    const normalized = {
      method,
      label: String(payload.label || '').trim() || null,
      accountHolderName: String(payload.accountHolderName || '').trim() || null,
      upiId: null,
      bankName: null,
      accountNumber: null,
      ifscCode: null,
      iban: null
    }

    if (method === 'upi') {
      const upiId = String(payload.upiId || '').trim().toLowerCase()
      if (!upiId || !upiId.includes('@')) {
        throw new Error('Valid UPI ID is required')
      }
      normalized.upiId = upiId
      return normalized
    }

    normalized.bankName = String(payload.bankName || '').trim()
    normalized.accountNumber = String(payload.accountNumber || '').trim()
    if (!normalized.bankName || !normalized.accountNumber) {
      throw new Error('bankName and accountNumber are required')
    }

    if (countryCode === 'IN') {
      normalized.ifscCode = String(payload.ifscCode || '').trim().toUpperCase()
      if (!normalized.ifscCode) throw new Error('ifscCode is required for India bank transfer')
    } else {
      normalized.iban = String(payload.iban || '').trim().toUpperCase()
      if (!normalized.iban) throw new Error('iban is required for your country bank transfer')
    }

    return normalized
  }

  sanitizeAccount(record) {
    if (!record) return null
    return {
      id: record.id,
      userId: record.user_id || record.userId,
      countryCode: record.country_code || record.countryCode,
      method: record.method,
      label: record.label || null,
      accountHolderName: record.account_holder_name || record.accountHolderName || null,
      upiId: record.upi_id || record.upiId || null,
      bankName: record.bank_name || record.bankName || null,
      accountNumber: record.account_number || record.accountNumber || null,
      ifscCode: record.ifsc_code || record.ifscCode || null,
      iban: record.iban || null,
      isDefault: Boolean(record.is_default ?? record.isDefault),
      isActive: Boolean(record.is_active ?? record.isActive),
      createdAt: record.created_at || record.createdAt || null,
      updatedAt: record.updated_at || record.updatedAt || null
    }
  }

  async ensureWallet(userId) {
    const [rows] = await db.promise().query(
      `SELECT id, user_id AS userId, balance, currency
       FROM wallets
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    )
    if (rows.length > 0) {
      return {
        ...rows[0],
        balance: Number(rows[0].balance)
      }
    }

    const walletId = String(userId)
    await db.promise().query(
      `INSERT INTO wallets (id, user_id, balance, currency)
       VALUES (?, ?, 0.00, 'USD')`,
      [walletId, userId]
    )
    return {
      id: walletId,
      userId,
      balance: 0,
      currency: 'USD'
    }
  }

  async getUserInfo(userId) {
    const [rows] = await db.promise().query(
      `SELECT id, email, first_name AS firstName, last_name AS lastName
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    )
    if (rows.length === 0) throw new Error('User not found')
    return rows[0]
  }

  async listAccounts(userId) {
    const [rows] = await db.promise().query(
      `SELECT *
       FROM user_withdrawal_accounts
       WHERE user_id = ?
         AND is_active = true
       ORDER BY is_default DESC, updated_at DESC`,
      [userId]
    )
    return rows.map((row) => this.sanitizeAccount(row))
  }

  async createAccount(userId, payload = {}) {
    const registration = await currencyService.getUserRegistrationCountry(userId)
    const countryCode = registration.countryCode
    const normalized = this.normalizeAccountPayload(countryCode, payload)
    const isRequestedDefault = Boolean(payload.isDefault)

    const [existingRows] = await db.promise().query(
      `SELECT id
       FROM user_withdrawal_accounts
       WHERE user_id = ?
         AND is_active = true`,
      [userId]
    )
    const shouldBeDefault = isRequestedDefault || existingRows.length === 0

    if (shouldBeDefault) {
      await db.promise().query(
        `UPDATE user_withdrawal_accounts
         SET is_default = false, updated_at = NOW()
         WHERE user_id = ?`,
        [userId]
      )
    }

    const accountId = uuidv4()
    await db.promise().query(
      `INSERT INTO user_withdrawal_accounts
       (id, user_id, country_code, method, label, account_holder_name, upi_id, bank_name, account_number, ifsc_code, iban, is_default, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [
        accountId,
        userId,
        countryCode,
        normalized.method,
        normalized.label,
        normalized.accountHolderName,
        normalized.upiId,
        normalized.bankName,
        normalized.accountNumber,
        normalized.ifscCode,
        normalized.iban,
        shouldBeDefault
      ]
    )

    const [rows] = await db.promise().query(
      `SELECT *
       FROM user_withdrawal_accounts
       WHERE id = ?
       LIMIT 1`,
      [accountId]
    )

    return this.sanitizeAccount(rows[0])
  }

  async getAccountById(userId, accountId) {
    const [rows] = await db.promise().query(
      `SELECT *
       FROM user_withdrawal_accounts
       WHERE id = ?
         AND user_id = ?
         AND is_active = true
       LIMIT 1`,
      [accountId, userId]
    )
    if (rows.length === 0) throw new Error('Withdrawal account not found')
    return rows[0]
  }

  async getWithdrawalOptions(userId) {
    const registration = await currencyService.getUserDisplayCurrency(userId)
    const methods = this.getMethodDefinitions(registration.countryCode)
    const accounts = await this.listAccounts(userId)
    return {
      country: registration,
      methods,
      accounts
    }
  }

  async createWithdrawalOtpRequest({ userId, amountUsd, withdrawalAccountId }) {
    const numericAmount = this.toMoney(amountUsd)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('Valid USD amount is required')
    }

    const registration = await currencyService.getUserRegistrationCountry(userId)
    const wallet = await this.ensureWallet(userId)
    if (Number(wallet.balance) < numericAmount) {
      throw new Error('Insufficient wallet balance')
    }

    const account = await this.getAccountById(userId, withdrawalAccountId)
    this.ensureMethodAllowed(registration.countryCode, account.method)

    const conversionSnapshot = await currencyService.createConversionSnapshot({
      userId,
      usdAmount: numericAmount
    })
    const user = await this.getUserInfo(userId)

    await db.promise().query(
      `DELETE FROM otp_verifications
       WHERE email = ?
         AND purpose = 'withdrawal_request'`,
      [user.email]
    )

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await bcrypt.hash(otp, 10)
    const otpId = uuidv4()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await db.promise().query(
      `INSERT INTO otp_verifications (id, email, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, 'withdrawal_request', ?)`,
      [otpId, user.email, otpHash, expiresAt]
    )

    const verificationToken = jwt.sign(
      {
        type: 'withdrawal_request',
        stage: 'otp_verification',
        userId,
        email: user.email,
        otpId,
        amountUSD: numericAmount,
        withdrawalAccountId,
        conversionSnapshot
      },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    )

    await emailService.sendWithdrawalOtpEmail(
      user.email,
      user.firstName || 'User',
      otp,
      {
        amountUSD: numericAmount,
        localAmount: conversionSnapshot.localAmount,
        localCurrencyCode: conversionSnapshot.localCurrencyCode
      }
    )

    return {
      success: true,
      message: 'OTP sent to your registered email',
      verificationToken,
      expiresIn: 300,
      amountUSD: numericAmount,
      localAmount: conversionSnapshot.localAmount,
      localCurrencyCode: conversionSnapshot.localCurrencyCode
    }
  }

  async verifyWithdrawalOtpAndCreateRequest({ userId, verificationToken, otpCode, note = null }) {
    let decoded
    try {
      decoded = jwt.verify(verificationToken, process.env.JWT_SECRET)
    } catch (error) {
      throw new Error('Invalid or expired verification token')
    }

    if (decoded.type !== 'withdrawal_request' || decoded.stage !== 'otp_verification' || decoded.userId !== userId) {
      throw new Error('Invalid verification token')
    }

    const [records] = await db.promise().query(
      `SELECT *
       FROM otp_verifications
       WHERE id = ?
         AND email = ?
         AND purpose = 'withdrawal_request'
       LIMIT 1`,
      [decoded.otpId, decoded.email]
    )
    if (records.length === 0) throw new Error('OTP expired or invalid')

    const record = records[0]
    if (new Date(record.expires_at) < new Date()) {
      await db.promise().query(`DELETE FROM otp_verifications WHERE id = ?`, [record.id])
      throw new Error('OTP expired')
    }
    if (record.attempts >= record.max_attempts) {
      throw new Error('Maximum OTP attempts exceeded')
    }

    const isValid = await bcrypt.compare(String(otpCode || ''), record.otp_hash)
    if (!isValid) {
      await db.promise().query(
        `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`,
        [record.id]
      )
      const attemptsLeft = Math.max(0, Number(record.max_attempts) - (Number(record.attempts) + 1))
      throw new Error(`Invalid OTP. ${attemptsLeft} attempt(s) remaining.`)
    }

    const account = await this.getAccountById(userId, decoded.withdrawalAccountId)
    const registration = await currencyService.getUserRegistrationCountry(userId)
    this.ensureMethodAllowed(registration.countryCode, account.method)

    const wallet = await this.ensureWallet(userId)
    const amountUSD = this.toMoney(decoded.amountUSD)
    if (Number(wallet.balance) < amountUSD) {
      throw new Error('Insufficient wallet balance')
    }

    const conversionSnapshot = decoded.conversionSnapshot || await currencyService.createConversionSnapshot({
      userId,
      usdAmount: amountUSD
    })

    const accountSnapshot = {
      method: account.method,
      label: account.label || null,
      accountHolderName: account.account_holder_name || null,
      upiId: account.upi_id || null,
      bankName: account.bank_name || null,
      accountNumber: account.account_number || null,
      ifscCode: account.ifsc_code || null,
      iban: account.iban || null
    }

    const transactionId = await generateUniqueTransactionId(db)
    const transactionNumber = await generateUniqueTransactionNumber(db)

    const metadata = {
      withdrawalAccount: accountSnapshot,
      immutableConversion: {
        amountUSD,
        localAmount: this.toMoney(conversionSnapshot.localAmount),
        localCurrencyCode: conversionSnapshot.localCurrencyCode,
        usdToLocalRate: Number(conversionSnapshot.usdToLocalRate)
      },
      requestedNote: note ? String(note).trim() : null,
      otpVerifiedAt: new Date().toISOString()
    }

    await db.promise().query(
      `INSERT INTO transactions
       (id, transaction_number, user_id, wallet_id, withdrawal_account_id, type, amount, local_amount, local_currency_code, usd_to_local_rate,
        currency, status, payment_provider, payment_method, country_code, description, metadata)
       VALUES (?, ?, ?, ?, ?, 'withdrawal', ?, ?, ?, ?, 'USD', 'Pending', 'manual_payout', ?, ?, ?, ?)`,
      [
        transactionId,
        transactionNumber,
        userId,
        wallet.id,
        account.id,
        amountUSD,
        this.toMoney(conversionSnapshot.localAmount),
        conversionSnapshot.localCurrencyCode,
        Number(conversionSnapshot.usdToLocalRate),
        account.method === 'upi' ? 'upi' : 'bank_transfer',
        registration.countryCode,
        `Withdrawal request ${amountUSD} USD`,
        JSON.stringify(metadata)
      ]
    )

    await db.promise().query(`DELETE FROM otp_verifications WHERE id = ?`, [record.id])

    const user = await this.getUserInfo(userId)
    await emailService.sendWithdrawalRequestCreatedEmail(user.email, user.firstName || 'User', {
      transactionNumber,
      amountUSD,
      localAmount: this.toMoney(conversionSnapshot.localAmount),
      localCurrencyCode: conversionSnapshot.localCurrencyCode
    })

    return {
      success: true,
      transactionId,
      transactionNumber,
      status: 'Pending',
      amountUSD,
      localAmount: this.toMoney(conversionSnapshot.localAmount),
      localCurrencyCode: conversionSnapshot.localCurrencyCode
    }
  }

  async listAdminWithdrawals({ page = 1, limit = 20, status = 'Pending' } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)
    const safePage = Math.max(parseInt(page, 10) || 1, 1)
    const offset = (safePage - 1) * safeLimit

    const params = []
    let statusSql = ''
    const normalizedStatus = String(status || '').trim()
    if (normalizedStatus && normalizedStatus.toLowerCase() !== 'all') {
      statusSql = 'AND t.status = ?'
      params.push(normalizedStatus)
    }

    const [rows] = await db.promise().query(
      `SELECT t.id, t.transaction_number AS transactionNumber, t.user_id AS userId, t.amount, t.local_amount AS localAmount,
              t.local_currency_code AS localCurrencyCode, t.usd_to_local_rate AS usdToLocalRate, t.status, t.payment_method AS paymentMethod,
              t.reference_number AS referenceNumber, t.created_at AS createdAt, t.updated_at AS updatedAt,
              u.email, u.first_name AS firstName, u.last_name AS lastName
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.type = 'withdrawal'
         ${statusSql}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    )

    const [countRows] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM transactions t
       WHERE t.type = 'withdrawal'
         ${statusSql}`,
      params
    )

    return {
      withdrawals: rows.map((row) => ({
        ...row,
        amount: Number(row.amount),
        localAmount: row.localAmount !== null ? Number(row.localAmount) : null,
        usdToLocalRate: row.usdToLocalRate !== null ? Number(row.usdToLocalRate) : null
      })),
      total: Number(countRows[0]?.total || 0),
      page: safePage,
      limit: safeLimit
    }
  }

  async getAdminWithdrawalDetails(transactionId) {
    const [rows] = await db.promise().query(
      `SELECT t.*, u.email, u.first_name AS firstName, u.last_name AS lastName,
              wa.method AS accountMethod, wa.label AS accountLabel
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN user_withdrawal_accounts wa ON wa.id = t.withdrawal_account_id
       WHERE t.id = ?
         AND t.type = 'withdrawal'
       LIMIT 1`,
      [transactionId]
    )
    if (rows.length === 0) throw new Error('Withdrawal transaction not found')

    const row = rows[0]
    let metadata = null
    try {
      metadata = row.metadata ? JSON.parse(row.metadata) : null
    } catch (error) {
      metadata = null
    }

    return {
      id: row.id,
      transactionNumber: row.transaction_number,
      userId: row.user_id,
      amount: Number(row.amount),
      localAmount: row.local_amount !== null ? Number(row.local_amount) : null,
      localCurrencyCode: row.local_currency_code,
      usdToLocalRate: row.usd_to_local_rate !== null ? Number(row.usd_to_local_rate) : null,
      status: row.status,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      countryCode: row.country_code,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      accountDetails: metadata?.withdrawalAccount || null,
      metadata
    }
  }

  async approveWithdrawal(transactionId, adminId) {
    const connection = await db.promise().getConnection()
    let finalizedDetails = null
    try {
      await connection.beginTransaction()

      const [txRows] = await connection.query(
        `SELECT id, user_id, amount, status
         FROM transactions
         WHERE id = ?
           AND type = 'withdrawal'
         FOR UPDATE`,
        [transactionId]
      )
      if (txRows.length === 0) throw new Error('Withdrawal transaction not found')
      const tx = txRows[0]
      if (tx.status !== 'Pending') throw new Error('Only Pending withdrawals can be approved')

      const [walletRows] = await connection.query(
        `SELECT id, balance
         FROM wallets
         WHERE user_id = ?
         FOR UPDATE`,
        [tx.user_id]
      )
      if (walletRows.length === 0) throw new Error('Wallet not found for user')

      const walletBalance = Number(walletRows[0].balance)
      const withdrawAmount = Number(tx.amount)
      if (walletBalance < withdrawAmount) {
        throw new Error('Insufficient wallet balance to approve this withdrawal')
      }

      await connection.query(
        `UPDATE wallets
         SET balance = balance - ?, updated_at = NOW()
         WHERE user_id = ?`,
        [withdrawAmount, tx.user_id]
      )

      await connection.query(
        `UPDATE transactions
         SET status = 'Approved',
             reviewed_by = ?,
             reviewed_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [adminId, transactionId]
      )

      await connection.commit()
      finalizedDetails = await this.getAdminWithdrawalDetails(transactionId)
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    const user = await this.getUserInfo(finalizedDetails.userId)
    await emailService.sendWithdrawalApprovedEmail(user.email, user.firstName || 'User', {
      transactionNumber: finalizedDetails.transactionNumber,
      amountUSD: finalizedDetails.amount,
      localAmount: finalizedDetails.localAmount,
      localCurrencyCode: finalizedDetails.localCurrencyCode
    })

    return {
      success: true,
      transactionId,
      status: 'Approved'
    }
  }

  async completeWithdrawal(transactionId, adminId, referenceNumber) {
    const ref = String(referenceNumber || '').trim()
    if (!ref) throw new Error('referenceNumber is required')

    const [result] = await db.promise().query(
      `UPDATE transactions
       SET status = 'completed',
           reference_number = ?,
           payment_id = COALESCE(payment_id, ?),
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?
         AND type = 'withdrawal'
         AND status = 'Approved'`,
      [ref, ref, adminId, transactionId]
    )

    if (result.affectedRows === 0) {
      throw new Error('Only Approved withdrawals can be completed')
    }

    const details = await this.getAdminWithdrawalDetails(transactionId)
    const user = await this.getUserInfo(details.userId)
    await emailService.sendWithdrawalCompletedEmail(user.email, user.firstName || 'User', {
      transactionNumber: details.transactionNumber,
      amountUSD: details.amount,
      localAmount: details.localAmount,
      localCurrencyCode: details.localCurrencyCode,
      referenceNumber: ref
    })

    return {
      success: true,
      transactionId,
      status: 'completed',
      referenceNumber: ref
    }
  }
}

module.exports = new WithdrawalService()
