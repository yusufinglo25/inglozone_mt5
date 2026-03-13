const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const emailService = require('./email.service')
const currencyService = require('./currency.service')
const {
  generateUniqueTransactionId,
  generateUniqueTransactionNumber
} = require('../utils/id-generator')

class WalletService {
  constructor() {
    this.bankTransferUploadPath = process.env.BANK_TRANSFER_UPLOAD_PATH || './uploads/bank-transfer'
    this.ensureUploadDirectory()
  }

  async ensureUploadDirectory() {
    try {
      await fs.promises.mkdir(this.bankTransferUploadPath, { recursive: true })
    } catch (error) {
      console.error('Failed to create bank transfer upload directory:', error.message)
    }
  }

  encryptorKey() {
    return crypto.createHash('sha256')
      .update(process.env.PAYMENT_SECRET_ENCRYPTION_KEY || process.env.JWT_SECRET || 'payment-secret-key')
      .digest()
  }

  decryptValue(encryptedBase64, ivHex) {
    if (!encryptedBase64 || !ivHex) return null
    const raw = Buffer.from(encryptedBase64, 'base64')
    const authTag = raw.subarray(raw.length - 16)
    const encrypted = raw.subarray(0, raw.length - 16)
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptorKey(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  }

  toMoney(value, decimals = 2) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Number(numeric.toFixed(decimals))
  }

  async getGatewayConfig(gatewayCode) {
    const normalizedCode = String(gatewayCode || '').trim().toLowerCase()
    const [rows] = await db.promise().query(
      `SELECT gateway_code, is_enabled, public_key, secret_key_encrypted, secret_key_iv, extra_config
       FROM payment_gateway_configs
       WHERE gateway_code = ?
       LIMIT 1`,
      [normalizedCode]
    )

    const row = rows[0]
    const envPublicKey = normalizedCode === 'stripe'
      ? (process.env.STRIPE_PUBLISHABLE_KEY || null)
      : normalizedCode === 'razorpay'
        ? (process.env.RAZORPAY_KEY_ID || null)
        : null
    const envSecret = normalizedCode === 'stripe'
      ? (process.env.STRIPE_SECRET_KEY || null)
      : normalizedCode === 'tamara'
        ? (process.env.TAMARA_API_TOKEN || null)
        : normalizedCode === 'razorpay'
          ? (process.env.RAZORPAY_KEY_SECRET || null)
          : null

    const parsedExtra = row?.extra_config
      ? (typeof row.extra_config === 'string'
        ? (() => {
            try { return JSON.parse(row.extra_config) } catch (error) { return {} }
          })()
        : row.extra_config)
      : {}

    return {
      code: normalizedCode,
      enabled: row ? Boolean(row.is_enabled) : false,
      publicKey: row?.public_key || envPublicKey,
      secretKey: row?.secret_key_encrypted && row?.secret_key_iv
        ? this.decryptValue(row.secret_key_encrypted, row.secret_key_iv)
        : envSecret,
      extraConfig: parsedExtra || {},
      source: row ? 'db' : 'env'
    }
  }

  async resolveUserCountry(userId) {
    const registration = await currencyService.getUserRegistrationCountry(userId)
    return registration.countryCode
  }

  async getPaymentMethods(userId) {
    const countryCode = await this.resolveUserCountry(userId)
    const displayCurrency = await currencyService.getUserDisplayCurrency(userId)
    const [bankRows] = await db.promise().query(
      `SELECT id FROM bank_accounts WHERE country_code = ? AND is_enabled = true LIMIT 1`,
      [countryCode]
    )
    const hasBankTransfer = bankRows.length > 0

    const [stripeCfg, tamaraCfg, razorpayCfg] = await Promise.all([
      this.getGatewayConfig('stripe'),
      this.getGatewayConfig('tamara'),
      this.getGatewayConfig('razorpay')
    ])

    const methods = []
    if (countryCode === 'IN') {
      if ((razorpayCfg.enabled || (razorpayCfg.source === 'env' && razorpayCfg.publicKey && razorpayCfg.secretKey))
        && razorpayCfg.publicKey && razorpayCfg.secretKey) {
        methods.push({ code: 'razorpay', label: 'Razorpay', type: 'online' })
      }
      if (hasBankTransfer) methods.push({ code: 'bank_transfer', label: 'Bank Transfer', type: 'manual' })
    } else if (countryCode === 'AE') {
      if (stripeCfg.enabled || (stripeCfg.source === 'env' && stripeCfg.secretKey)) {
        methods.push({ code: 'stripe', label: 'Stripe', type: 'online' })
      }
      if (tamaraCfg.enabled || (tamaraCfg.source === 'env' && tamaraCfg.secretKey)) {
        methods.push({ code: 'tamara', label: 'Tamara', type: 'online' })
      }
      if (hasBankTransfer) methods.push({ code: 'bank_transfer', label: 'Bank Transfer', type: 'manual' })
    } else if (hasBankTransfer) {
      methods.push({ code: 'bank_transfer', label: 'Bank Transfer', type: 'manual' })
    }

    return {
      countryCode,
      methods,
      displayCurrency
    }
  }

  async getUserCurrencyContext(userId) {
    return currencyService.getUserDisplayCurrency(userId)
  }

  getSupportedCountries() {
    return currencyService.getSupportedCountries()
  }

  getTamaraBaseUrl() {
    return (process.env.TAMARA_API_URL || 'https://api-sandbox.tamara.co').replace(/\/+$/, '')
  }

  getTamaraNotificationUrl() {
    const baseUrl = (process.env.BASE_URL || 'https://temp.inglozone.com').replace(/\/+$/, '')
    return `${baseUrl}/api/webhooks/tamara-webhook`
  }

  async tamaraRequest(path, method = 'GET', body = null) {
    const token = process.env.TAMARA_API_TOKEN
    if (!token) {
      throw new Error('TAMARA_API_TOKEN is not configured')
    }

    const response = await fetch(`${this.getTamaraBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const message = typeof data === 'object'
        ? (data.message || data.error || JSON.stringify(data))
        : data
      throw new Error(`Tamara API error: ${message}`)
    }

    return data
  }

  async markTransactionCompleted(transactionId, externalPaymentId = null) {
    const transaction = await new Promise((resolve, reject) => {
      db.query(`SELECT * FROM transactions WHERE id = ? LIMIT 1`, [transactionId], (err, results) => {
        if (err || results.length === 0) return reject(new Error('Transaction not found'))
        resolve(results[0])
      })
    })

    if (transaction.status === 'completed' || transaction.status === 'Approved') {
      return { alreadyCompleted: true, transaction }
    }
    if (transaction.type !== 'deposit') {
      throw new Error('markTransactionCompleted only supports deposit transactions')
    }

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE transactions
         SET status = 'Approved',
             payment_id = COALESCE(?, payment_id),
             updated_at = NOW()
         WHERE id = ?`,
        [externalPaymentId, transactionId],
        (err) => (err ? reject(err) : resolve())
      )
    })

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE wallets
         SET balance = balance + ?,
             updated_at = NOW()
         WHERE user_id = ?`,
        [transaction.amount, transaction.user_id],
        (err) => (err ? reject(err) : resolve())
      )
    })

    if (transaction.type === 'deposit') {
      try {
        const [userRows] = await db.promise().query(
          `SELECT email, first_name AS firstName
           FROM users
           WHERE id = ?
           LIMIT 1`,
          [transaction.user_id]
        )
        if (userRows.length > 0) {
          await emailService.sendDepositSuccessEmail(userRows[0].email, userRows[0].firstName || 'User', {
            transactionNumber: transaction.transaction_number,
            amountUSD: Number(transaction.amount),
            localAmount: transaction.local_amount !== null ? Number(transaction.local_amount) : null,
            localCurrencyCode: transaction.local_currency_code,
            status: 'Approved'
          })
        }
      } catch (error) {
        console.error('Failed to send deposit success email:', error.message)
      }
    }

    return { alreadyCompleted: false, transaction }
  }

  sanitizeTransaction(record) {
    if (!record || typeof record !== 'object') return record
    const cleaned = { ...record }
    delete cleaned.stripe_payment_id
    delete cleaned.stripe_session_id
    if (cleaned.amount !== undefined && cleaned.amount !== null) cleaned.amount = Number(cleaned.amount)
    if (cleaned.local_amount !== undefined && cleaned.local_amount !== null) cleaned.local_amount = Number(cleaned.local_amount)
    if (cleaned.usd_to_local_rate !== undefined && cleaned.usd_to_local_rate !== null) cleaned.usd_to_local_rate = Number(cleaned.usd_to_local_rate)
    if (typeof cleaned.metadata === 'string') {
      try {
        cleaned.metadata = JSON.parse(cleaned.metadata)
      } catch (error) {
        // keep raw metadata string for backward compatibility when malformed
      }
    }
    return cleaned
  }

  // Get user wallet balance
  async getWallet(userId) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT w.*, 
                (SELECT SUM(amount) FROM transactions t WHERE t.user_id = w.user_id AND t.type = 'deposit' AND t.status IN ('completed','Approved')) as total_deposits,
                (SELECT SUM(amount) FROM transactions t WHERE t.user_id = w.user_id AND t.type = 'withdrawal' AND t.status IN ('completed','Approved')) as total_withdrawals
         FROM wallets w 
         WHERE w.user_id = ?`,
        [userId],
        (err, results) => {
          if (err) return reject(err)
          
          if (results.length === 0) {
            // Create wallet if doesn't exist
            this.createWallet(userId)
              .then(wallet => resolve(wallet))
              .catch(error => reject(error))
          } else {
            const wallet = results[0]
            // Calculate available balance
            wallet.available_balance = wallet.balance
            wallet.total_deposited = parseFloat(wallet.total_deposits || 0)
            wallet.total_withdrawn = parseFloat(wallet.total_withdrawals || 0)
            resolve(wallet)
          }
        }
      )
    })
  }

  // Create wallet for user
  async createWallet(userId) {
    const walletId = String(userId)
    
    return new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO wallets (id, user_id, balance, currency) 
         VALUES (?, ?, 0.00, 'USD')`,
        [walletId, userId],
        (err) => {
          if (err) return reject(err)
          
          resolve({
            id: walletId,
            user_id: userId,
            balance: 0.00,
            currency: 'USD',
            available_balance: 0.00,
            total_deposited: 0.00,
            total_withdrawn: 0.00
          })
        }
      )
    })
  }

  // Create deposit intent (Stripe)
  async createDepositIntent(userId, amountUSDInput) {
    const countryCode = await this.resolveUserCountry(userId)
    if (countryCode !== 'AE') {
      throw new Error('Stripe deposit is currently available only for UAE')
    }

    const amountUSD = this.toMoney(amountUSDInput)
    if (!Number.isFinite(amountUSD) || amountUSD <= 0) {
      throw new Error('Valid USD amount is required')
    }
    if (amountUSD < 1) {
      throw new Error('Minimum deposit amount is 1 USD')
    }

    const conversion = await currencyService.createConversionSnapshot({
      userId,
      usdAmount: amountUSD
    })

    const user = await new Promise((resolve, reject) => {
      db.query(
        `SELECT email, first_name, last_name FROM users WHERE id = ?`,
        [userId],
        (err, results) => {
          if (err || results.length === 0) return reject(new Error('User not found'))
          resolve(results[0])
        }
      )
    })

    const transactionId = await generateUniqueTransactionId(db)
    const transactionNumber = await generateUniqueTransactionNumber(db)
    const wallet = await this.getWallet(userId)
    const txMetadata = {
      paymentProvider: 'stripe',
      immutableConversion: {
        amountUSD: conversion.amountUSD,
        localAmount: conversion.localAmount,
        localCurrencyCode: conversion.localCurrencyCode,
        usdToLocalRate: conversion.usdToLocalRate
      },
      pendingReminderSentAt: null
    }

    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO transactions
         (id, transaction_number, user_id, wallet_id, type, amount, local_amount, local_currency_code, usd_to_local_rate,
          currency, status, payment_provider, payment_method, country_code, description, metadata)
         VALUES (?, ?, ?, ?, 'deposit', ?, ?, ?, ?, 'USD', 'Pending', 'stripe', 'card', ?, ?, ?)`,
        [
          transactionId,
          transactionNumber,
          userId,
          wallet.id,
          amountUSD,
          conversion.localAmount,
          conversion.localCurrencyCode,
          conversion.usdToLocalRate,
          countryCode,
          `Deposit of ${amountUSD} USD (${conversion.localAmount} ${conversion.localCurrencyCode})`,
          JSON.stringify(txMetadata)
        ],
        (err) => (err ? reject(err) : resolve())
      )
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Wallet Deposit',
            description: `Deposit ${amountUSD} USD to your Inglozone wallet`
          },
          unit_amount: Math.round(amountUSD * 100)
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/wallet/deposit/success?session_id={CHECKOUT_SESSION_ID}&transaction_id=${transactionId}`,
      cancel_url: `${process.env.FRONTEND_URL}/wallet/deposit/cancel?transaction_id=${transactionId}`,
      customer_email: user.email,
      metadata: {
        userId,
        transactionId,
        amountUSD: String(amountUSD),
        localAmount: String(conversion.localAmount),
        localCurrencyCode: conversion.localCurrencyCode
      }
    })

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE transactions SET session_id = ? WHERE id = ?`,
        [session.id, transactionId],
        (err) => (err ? reject(err) : resolve())
      )
    })

    return {
      sessionId: session.id,
      url: session.url,
      amountUSD,
      convertedAmount: conversion.localAmount,
      currencyCode: conversion.localCurrencyCode,
      usdToLocalRate: conversion.usdToLocalRate,
      transactionId
    }
  }

  // Verify and complete deposit
  async verifyDeposit(sessionId) {
    try {
      // Retrieve session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
      })

      // Find transaction
      const transaction = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM transactions WHERE session_id = ?`,
          [sessionId],
          (err, results) => {
            if (err || results.length === 0) return reject(new Error('Transaction not found'))
            resolve(results[0])
          }
        )
      })

      if (transaction.status === 'completed' || transaction.status === 'Approved') {
        return { success: true, message: 'Deposit already processed' }
      }

      // Check if payment was successful
      if (session.payment_status === 'paid') {
        await this.markTransactionCompleted(transaction.id, session.payment_intent.id)

        return {
          success: true,
          message: 'Deposit completed successfully',
          amount: Number(transaction.amount),
          currency: transaction.currency,
          convertedAmount: transaction.local_amount !== null ? Number(transaction.local_amount) : null,
          localCurrencyCode: transaction.local_currency_code
        }
      } else {
        // Payment failed
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE transactions SET status = 'Rejected', updated_at = NOW() WHERE id = ?`,
            [transaction.id],
            (err) => {
              if (err) return reject(err)
              resolve()
            }
          )
        })

        return {
          success: false,
          message: 'Payment failed or not completed'
        }
      }
    } catch (error) {
      throw error
    }
  }

  async createTamaraDepositIntent(userId, amountUSDInput) {
    const countryCode = await this.resolveUserCountry(userId)
    if (countryCode !== 'AE') {
      throw new Error('Tamara deposit is currently available only for UAE')
    }

    const amountUSD = this.toMoney(amountUSDInput)
    if (!amountUSD || Number.isNaN(amountUSD) || amountUSD <= 0) {
      throw new Error('Valid USD amount is required')
    }
    if (amountUSD < 1) {
      throw new Error('Minimum deposit amount is 1 USD')
    }

    const conversion = await currencyService.createConversionSnapshot({
      userId,
      usdAmount: amountUSD
    })
    const numericAmountLocal = this.toMoney(conversion.localAmount)
    if (conversion.localCurrencyCode !== 'AED') {
      throw new Error('Tamara deposits require AED conversion for UAE')
    }

    const user = await new Promise((resolve, reject) => {
      db.query(
        `SELECT id, email, first_name, last_name, mobile FROM users WHERE id = ?`,
        [userId],
        (err, results) => {
          if (err || results.length === 0) return reject(new Error('User not found'))
          resolve(results[0])
        }
      )
    })

    const wallet = await this.getWallet(userId)
    const transactionId = await generateUniqueTransactionId(db)
    const transactionNumber = await generateUniqueTransactionNumber(db)

    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO transactions
         (id, transaction_number, user_id, wallet_id, type, amount, local_amount, local_currency_code, usd_to_local_rate,
          currency, status, payment_provider, payment_method, country_code, description, metadata)
         VALUES (?, ?, ?, ?, 'deposit', ?, ?, ?, ?, 'USD', 'Pending', 'tamara', 'bnpl', ?, ?, ?)`,
        [
          transactionId,
          transactionNumber,
          userId,
          wallet.id,
          amountUSD,
          numericAmountLocal,
          conversion.localCurrencyCode,
          conversion.usdToLocalRate,
          countryCode,
          `Tamara deposit of ${amountUSD} USD (${numericAmountLocal} ${conversion.localCurrencyCode})`,
          JSON.stringify({
            paymentProvider: 'tamara',
            immutableConversion: {
              amountUSD,
              localAmount: numericAmountLocal,
              localCurrencyCode: conversion.localCurrencyCode,
              usdToLocalRate: conversion.usdToLocalRate
            },
            tamara: { status: 'created', amountLocal: numericAmountLocal, currencyCode: conversion.localCurrencyCode },
            pendingReminderSentAt: null
          })
        ],
        (err) => (err ? reject(err) : resolve())
      )
    })

    const tamaraCountryCode = process.env.TAMARA_COUNTRY_CODE || 'AE'
    const phone = String(user.mobile || '').replace(/\D/g, '')
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/+$/, '')

    const payload = {
      total_amount: { amount: numericAmountLocal, currency: conversion.localCurrencyCode },
      shipping_amount: { amount: 0, currency: conversion.localCurrencyCode },
      tax_amount: { amount: 0, currency: conversion.localCurrencyCode },
      order_reference_id: transactionId,
      order_number: transactionId,
      description: `Wallet deposit for ${user.email}`,
      country_code: tamaraCountryCode,
      payment_type: 'PAY_BY_INSTALMENTS',
      instalments: process.env.TAMARA_DEFAULT_INSTALLMENTS
        ? parseInt(process.env.TAMARA_DEFAULT_INSTALLMENTS, 10)
        : undefined,
      consumer: {
        first_name: user.first_name || 'Customer',
        last_name: user.last_name || 'User',
        phone_number: phone || '971500000000',
        email: user.email
      },
      shipping_address: {
        first_name: user.first_name || 'Customer',
        last_name: user.last_name || 'User',
        line1: 'Not provided',
        city: 'Dubai',
        country_code: tamaraCountryCode,
        phone_number: phone || '971500000000'
      },
      billing_address: {
        first_name: user.first_name || 'Customer',
        last_name: user.last_name || 'User',
        line1: 'Not provided',
        city: 'Dubai',
        country_code: tamaraCountryCode,
        phone_number: phone || '971500000000'
      },
      items: [
        {
          name: 'Wallet Deposit',
          type: 'Digital',
          reference_id: transactionId,
          sku: 'INGLO-WALLET-DEPOSIT',
          quantity: 1,
          unit_price: { amount: numericAmountLocal, currency: conversion.localCurrencyCode },
          tax_amount: { amount: 0, currency: conversion.localCurrencyCode },
          total_amount: { amount: numericAmountLocal, currency: conversion.localCurrencyCode }
        }
      ],
      merchant_url: {
        success: `${frontendBase}/wallet/tamara/success?transaction_id=${transactionId}`,
        failure: `${frontendBase}/wallet/tamara/failure?transaction_id=${transactionId}`,
        cancel: `${frontendBase}/wallet/tamara/cancel?transaction_id=${transactionId}`,
        notification: this.getTamaraNotificationUrl()
      }
    }

    if (!payload.instalments) {
      delete payload.instalments
    }

    const checkout = await this.tamaraRequest('/checkout', 'POST', payload)
    const metadata = {
      paymentProvider: 'tamara',
      tamara: {
        status: checkout.status || 'new',
        orderId: checkout.order_id,
        checkoutId: checkout.checkout_id,
        checkoutUrl: checkout.checkout_url,
        amountLocal: numericAmountLocal,
        currencyCode: conversion.localCurrencyCode
      }
    }

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE transactions SET metadata = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(metadata), transactionId],
        (err) => (err ? reject(err) : resolve())
      )
    })

    return {
      provider: 'tamara',
      transactionId,
      orderId: checkout.order_id,
      checkoutId: checkout.checkout_id,
      checkoutUrl: checkout.checkout_url,
      status: checkout.status,
      amountUSD,
      convertedAmount: numericAmountLocal,
      currencyCode: conversion.localCurrencyCode,
      usdToLocalRate: conversion.usdToLocalRate
    }
  }

  async verifyTamaraDeposit({ userId, orderId, transactionId }) {
    let transaction = null

    if (transactionId) {
      transaction = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM transactions WHERE id = ? AND user_id = ? LIMIT 1`,
          [transactionId, userId],
          (err, results) => {
            if (err || results.length === 0) return reject(new Error('Transaction not found'))
            resolve(results[0])
          }
        )
      })
    } else if (orderId) {
      transaction = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM transactions
           WHERE user_id = ?
             AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.tamara.orderId')) = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, orderId],
          (err, results) => {
            if (err || results.length === 0) return reject(new Error('Transaction not found'))
            resolve(results[0])
          }
        )
      })
    } else {
      throw new Error('orderId or transactionId is required')
    }

    const txMetadata = transaction.metadata ? JSON.parse(transaction.metadata) : {}
    const tamaraOrderId = orderId || txMetadata?.tamara?.orderId
    if (!tamaraOrderId) throw new Error('Tamara order ID missing')

    const order = await this.tamaraRequest(`/merchants/orders/${tamaraOrderId}`, 'GET')
    const status = String(order.status || '').toLowerCase()
    const successStatuses = new Set(['approved', 'authorised', 'fully_captured'])

    if (successStatuses.has(status)) {
      await this.markTransactionCompleted(transaction.id, tamaraOrderId)
    } else if (['cancelled', 'expired', 'declined', 'failed'].includes(status)) {
      await new Promise((resolve, reject) => {
        db.query(
          `UPDATE transactions SET status = 'Rejected', updated_at = NOW() WHERE id = ?`,
          [transaction.id],
          (err) => (err ? reject(err) : resolve())
        )
      })
    }

    const updatedMetadata = {
      ...(txMetadata || {}),
      paymentProvider: 'tamara',
      tamara: {
        ...(txMetadata.tamara || {}),
        orderId: tamaraOrderId,
        status: order.status,
        rawStatus: order.status
      }
    }

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE transactions SET metadata = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(updatedMetadata), transaction.id],
        (err) => (err ? reject(err) : resolve())
      )
    })

    return {
      success: successStatuses.has(status),
      transactionId: transaction.id,
      orderId: tamaraOrderId,
      status: order.status
    }
  }

  async handleTamaraWebhook(payload, req) {
    const tokenFromQuery = req.query?.tamaraToken
    const authHeader = req.headers.authorization || ''
    const tokenFromHeader = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null
    const webhookToken = tokenFromQuery || tokenFromHeader

    if (process.env.TAMARA_NOTIFICATION_TOKEN) {
      if (!webhookToken) {
        throw new Error('Tamara webhook token missing')
      }
      jwt.verify(webhookToken, process.env.TAMARA_NOTIFICATION_TOKEN)
    }

    const eventType = String(payload?.event_type || '').toLowerCase()
    const orderId = payload?.order_id
    if (!orderId) {
      return { success: false, message: 'No order_id in webhook payload' }
    }

    const [transactions] = await db.promise().query(
      `SELECT * FROM transactions
       WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.tamara.orderId')) = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    )

    if (transactions.length === 0) {
      return { success: false, message: 'No transaction found for Tamara order' }
    }

    const transaction = transactions[0]
    const order = await this.tamaraRequest(`/merchants/orders/${orderId}`, 'GET')
    const status = String(order.status || '').toLowerCase()
    const successStatuses = new Set(['approved', 'authorised', 'fully_captured'])

    if (successStatuses.has(status)) {
      await this.markTransactionCompleted(transaction.id, orderId)
    } else if (['cancelled', 'expired', 'declined', 'failed'].includes(status)) {
      await db.promise().query(
        `UPDATE transactions SET status = 'Rejected', updated_at = NOW() WHERE id = ?`,
        [transaction.id]
      )
    }

    const txMetadata = transaction.metadata ? JSON.parse(transaction.metadata) : {}
    const updatedMetadata = {
      ...txMetadata,
      paymentProvider: 'tamara',
      tamara: {
        ...(txMetadata.tamara || {}),
        orderId,
        status: order.status,
        lastEventType: eventType
      }
    }
    await db.promise().query(
      `UPDATE transactions SET metadata = ?, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(updatedMetadata), transaction.id]
    )

    return { success: true, transactionId: transaction.id, orderId, status: order.status }
  }

  async createRazorpayDepositIntent(userId, amountUSDInput) {
    const amountUSD = this.toMoney(amountUSDInput)
    if (!amountUSD || Number.isNaN(amountUSD) || amountUSD <= 0) throw new Error('Valid USD amount is required')

    const countryCode = await this.resolveUserCountry(userId)
    if (countryCode !== 'IN') throw new Error('Razorpay is available only for India')

    const gateway = await this.getGatewayConfig('razorpay')
    if (!gateway.publicKey || !gateway.secretKey) {
      throw new Error('Razorpay credentials are not configured')
    }
    if (!gateway.enabled && gateway.source === 'db') {
      throw new Error('Razorpay gateway is disabled by admin')
    }

    const wallet = await this.getWallet(userId)
    const transactionId = await generateUniqueTransactionId(db)
    const transactionNumber = await generateUniqueTransactionNumber(db)
    const conversion = await currencyService.createConversionSnapshot({
      userId,
      usdAmount: amountUSD
    })
    if (conversion.localCurrencyCode !== 'INR') {
      throw new Error('Razorpay deposits require INR conversion for India')
    }
    const amountINR = this.toMoney(conversion.localAmount)

    await db.promise().query(
      `INSERT INTO transactions
       (id, transaction_number, user_id, wallet_id, type, amount, local_amount, local_currency_code, usd_to_local_rate,
        currency, status, payment_provider, payment_method, country_code, description, metadata)
       VALUES (?, ?, ?, ?, 'deposit', ?, ?, ?, ?, 'USD', 'Pending', 'razorpay', 'card', 'IN', ?, ?)`,
      [
        transactionId,
        transactionNumber,
        userId,
        wallet.id,
        amountUSD,
        amountINR,
        conversion.localCurrencyCode,
        conversion.usdToLocalRate,
        `Razorpay deposit of ${amountUSD} USD (${amountINR} ${conversion.localCurrencyCode})`,
        JSON.stringify({
          paymentProvider: 'razorpay',
          amountINR,
          immutableConversion: {
            amountUSD,
            localAmount: amountINR,
            localCurrencyCode: conversion.localCurrencyCode,
            usdToLocalRate: conversion.usdToLocalRate
          },
          pendingReminderSentAt: null
        })
      ]
    )

    const receipt = `rcpt_${transactionId.replace(/-/g, '').slice(0, 20)}`
    const payload = {
      amount: Math.round(amountINR * 100),
      currency: conversion.localCurrencyCode,
      receipt,
      notes: { userId, transactionId, amountUSD: String(amountUSD) }
    }

    const authToken = Buffer.from(`${gateway.publicKey}:${gateway.secretKey}`).toString('base64')
    const response = await fetch(`${(process.env.RAZORPAY_API_URL || 'https://api.razorpay.com').replace(/\/+$/, '')}/v1/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    const data = await response.json()
    if (!response.ok || !data.id) {
      throw new Error(data.error?.description || 'Failed to create Razorpay order')
    }

    await db.promise().query(
      `UPDATE transactions
       SET payment_id = ?, metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.razorpayOrderId', ?), updated_at = NOW()
       WHERE id = ?`,
      [data.id, data.id, transactionId]
    )

    return {
      provider: 'razorpay',
      transactionId,
      razorpayOrderId: data.id,
      amountINR,
      amountUSD,
      convertedAmount: amountINR,
      currencyCode: conversion.localCurrencyCode,
      usdToLocalRate: conversion.usdToLocalRate,
      razorpayKeyId: gateway.publicKey
    }
  }

  async verifyRazorpayDeposit({ userId, razorpayOrderId, razorpayPaymentId, razorpaySignature, transactionId }) {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new Error('Razorpay verification fields are required')
    }

    const gateway = await this.getGatewayConfig('razorpay')
    if (!gateway.secretKey) throw new Error('Razorpay secret key is not configured')

    const generated = crypto
      .createHmac('sha256', gateway.secretKey)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    if (generated !== razorpaySignature) {
      throw new Error('Invalid Razorpay signature')
    }

    let txId = transactionId
    if (!txId) {
      const [rows] = await db.promise().query(
        `SELECT id FROM transactions
         WHERE user_id = ?
           AND payment_provider = 'razorpay'
           AND (payment_id = ? OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.razorpayOrderId')) = ?)
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, razorpayOrderId, razorpayOrderId]
      )
      if (rows.length === 0) throw new Error('Transaction not found')
      txId = rows[0].id
    }

    await db.promise().query(
      `UPDATE transactions
       SET metadata = JSON_SET(
             COALESCE(metadata, JSON_OBJECT()),
             '$.razorpayOrderId', ?,
             '$.razorpayPaymentId', ?,
             '$.razorpaySignature', ?
           ),
           updated_at = NOW()
       WHERE id = ?`,
      [razorpayOrderId, razorpayPaymentId, razorpaySignature, txId]
    )

    await this.markTransactionCompleted(txId, razorpayPaymentId)

    return {
      success: true,
      transactionId: txId,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      status: 'Approved'
    }
  }

  async getBankTransferDetailsForUser(userId) {
    const countryCode = await this.resolveUserCountry(userId)
    const [accounts] = await db.promise().query(
      `SELECT id, country_code
       FROM bank_accounts
       WHERE country_code = ?
         AND is_enabled = true
       LIMIT 1`,
      [countryCode]
    )
    if (accounts.length === 0) throw new Error('Bank transfer is not configured for your country')

    const account = accounts[0]
    const [fields] = await db.promise().query(
      `SELECT field_label, field_value_encrypted, field_value_iv, display_order
       FROM bank_account_fields
       WHERE bank_account_id = ?
       ORDER BY display_order ASC, created_at ASC`,
      [account.id]
    )

    return {
      countryCode: account.country_code,
      fields: fields.map((item) => ({
        label: item.field_label,
        value: this.decryptValue(item.field_value_encrypted, item.field_value_iv)
      }))
    }
  }

  async createBankTransferDepositIntent(userId, amountUSDInput) {
    const amountUSD = this.toMoney(amountUSDInput)
    if (!amountUSD || Number.isNaN(amountUSD) || amountUSD <= 0) {
      throw new Error('Valid USD amount is required')
    }
    const countryCode = await this.resolveUserCountry(userId)
    const conversion = await currencyService.createConversionSnapshot({
      userId,
      usdAmount: amountUSD
    })
    const bankInfo = await this.getBankTransferDetailsForUser(userId)
    if (!bankInfo?.fields?.length) {
      throw new Error('Bank transfer details unavailable')
    }

    const wallet = await this.getWallet(userId)
    const transactionId = await generateUniqueTransactionId(db)
    const transactionNumber = await generateUniqueTransactionNumber(db)

    await db.promise().query(
      `INSERT INTO transactions
       (id, transaction_number, user_id, wallet_id, type, amount, local_amount, local_currency_code, usd_to_local_rate,
        currency, status, payment_provider, payment_method, country_code, description, metadata)
       VALUES (?, ?, ?, ?, 'deposit', ?, ?, ?, ?, 'USD', 'Pending', 'bank_transfer', 'bank_transfer', ?, ?, ?)`,
      [
        transactionId,
        transactionNumber,
        userId,
        wallet.id,
        amountUSD,
        conversion.localAmount,
        conversion.localCurrencyCode,
        conversion.usdToLocalRate,
        countryCode,
        `Bank transfer deposit request ${amountUSD} USD (${conversion.localAmount} ${conversion.localCurrencyCode})`,
        JSON.stringify({
          paymentProvider: 'bank_transfer',
          proofUploaded: false,
          immutableConversion: {
            amountUSD,
            localAmount: conversion.localAmount,
            localCurrencyCode: conversion.localCurrencyCode,
            usdToLocalRate: conversion.usdToLocalRate
          },
          pendingReminderSentAt: null
        })
      ]
    )

    return {
      transactionId,
      status: 'Pending',
      amountUSD,
      convertedAmount: conversion.localAmount,
      currencyCode: conversion.localCurrencyCode,
      usdToLocalRate: conversion.usdToLocalRate,
      currency: 'USD',
      countryCode,
      bankDetails: bankInfo.fields
    }
  }

  async uploadBankTransferProof({ userId, transactionId, file }) {
    if (!file?.buffer) throw new Error('Invalid file')

    const [rows] = await db.promise().query(
      `SELECT id, status
       FROM transactions
       WHERE id = ?
         AND user_id = ?
         AND payment_provider = 'bank_transfer'
       LIMIT 1`,
      [transactionId, userId]
    )
    if (rows.length === 0) throw new Error('Bank transfer transaction not found')

    const tx = rows[0]
    if (!['Pending'].includes(tx.status)) {
      throw new Error('Proof can only be uploaded for Pending bank transfer transactions')
    }

    const [proofRows] = await db.promise().query(
      `SELECT id FROM bank_transfer_proofs WHERE transaction_id = ? AND deleted_at IS NULL LIMIT 1`,
      [transactionId]
    )
    if (proofRows.length > 0) throw new Error('Proof already uploaded for this transaction')

    const extension = path.extname(file.originalname || '').toLowerCase()
    const safeExtension = extension && extension.length <= 10 ? extension : '.bin'
    const hashName = crypto.createHash('sha256')
      .update(`${transactionId}:${Date.now()}:${file.originalname || 'proof'}`)
      .digest('hex')
    const filename = `${hashName}${safeExtension}`
    const absolutePath = path.resolve(this.bankTransferUploadPath, filename)
    await fs.promises.writeFile(absolutePath, file.buffer)

    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex')

    await db.promise().query(
      `INSERT INTO bank_transfer_proofs
       (id, transaction_id, user_id, file_path, original_filename, mime_type, file_size, sha256_hash, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), transactionId, userId, absolutePath, file.originalname || filename, file.mimetype || null, file.size || file.buffer.length, fileHash]
    )

    await db.promise().query(
      `UPDATE transactions
       SET status = 'Reviewing',
           metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.proofUploaded', true),
           updated_at = NOW()
       WHERE id = ?`,
      [transactionId]
    )

    return {
      transactionId,
      status: 'Reviewing',
      uploadedAt: new Date().toISOString()
    }
  }

  // Get transaction history
  async getTransactions(userId, limit = 10, offset = 0) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT t.id, t.transaction_number, t.user_id, t.wallet_id, t.withdrawal_account_id, t.type,
                t.amount, t.local_amount, t.local_currency_code, t.usd_to_local_rate, t.currency, t.status,
                t.payment_provider, t.payment_method, t.country_code, t.payment_id, t.session_id, t.reference_number,
                t.description, t.metadata, t.review_reason, t.reviewed_by, t.reviewed_at, t.created_at, t.updated_at,
                DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') as formatted_date
         FROM transactions t
         WHERE t.user_id = ?
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, results) => {
          if (err) return reject(err)
          
          // Get total count for pagination
          db.query(
            `SELECT COUNT(*) as total FROM transactions WHERE user_id = ?`,
            [userId],
            (countErr, countResults) => {
              if (countErr) return reject(countErr)
              
              resolve({
                transactions: results.map((item) => this.sanitizeTransaction(item)),
                total: countResults[0].total,
                limit,
                offset
              })
            }
          )
        }
      )
    })
  }

  // Get transaction by ID
  async getTransactionById(transactionId, userId) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT t.id, t.transaction_number, t.user_id, t.wallet_id, t.withdrawal_account_id, t.type,
                t.amount, t.local_amount, t.local_currency_code, t.usd_to_local_rate, t.currency, t.status,
                t.payment_provider, t.payment_method, t.country_code, t.payment_id, t.session_id, t.reference_number,
                t.description, t.metadata, t.review_reason, t.reviewed_by, t.reviewed_at, t.created_at, t.updated_at,
                DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') as formatted_date
         FROM transactions t
         WHERE t.id = ? AND t.user_id = ?`,
        [transactionId, userId],
        (err, results) => {
          if (err || results.length === 0) return reject(new Error('Transaction not found'))
          resolve(this.sanitizeTransaction(results[0]))
        }
      )
    })
  }

  async processPendingDepositReminders() {
    const [rows] = await db.promise().query(
      `SELECT t.id, t.transaction_number AS transactionNumber, t.user_id AS userId, t.amount,
              t.local_amount AS localAmount, t.local_currency_code AS localCurrencyCode, t.status,
              u.email, u.first_name AS firstName, t.metadata
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.type = 'deposit'
         AND t.status IN ('Pending', 'pending', 'Reviewing')
         AND t.created_at <= DATE_SUB(NOW(), INTERVAL 2 HOUR)
         AND (
           t.metadata IS NULL
           OR JSON_EXTRACT(t.metadata, '$.pendingReminderSentAt') IS NULL
         )
       ORDER BY t.created_at ASC
       LIMIT 200`
    )

    for (const row of rows) {
      try {
        await emailService.sendDepositPendingReminderEmail(row.email, row.firstName || 'User', {
          transactionNumber: row.transactionNumber,
          amountUSD: Number(row.amount),
          localAmount: row.localAmount !== null ? Number(row.localAmount) : null,
          localCurrencyCode: row.localCurrencyCode,
          status: row.status
        })

        const reminderSentAt = new Date().toISOString()
        await db.promise().query(
          `UPDATE transactions
           SET metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.pendingReminderSentAt', ?),
               updated_at = NOW()
           WHERE id = ?`,
          [reminderSentAt, row.id]
        )
      } catch (error) {
        console.error(`Failed to process pending deposit reminder for ${row.id}:`, error.message)
      }
    }

    return {
      checked: rows.length
    }
  }

  async handleWebhookEvent(event) {
    try {
      const session = event.data.object

      if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
        const { transactionId } = session.metadata || {}
        if (!transactionId) throw new Error('No transaction ID in webhook')

        await this.markTransactionCompleted(transactionId, session.payment_intent || null)
        console.log(`Webhook: Deposit completed for transaction ${transactionId}`)
        return { success: true, transactionId }
      }

      return { success: false, message: 'Event not processed' }
    } catch (error) {
      console.error('Webhook processing error:', error)
      throw error
    }
  }
}

module.exports = new WalletService()
