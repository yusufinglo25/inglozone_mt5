const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const jwt = require('jsonwebtoken')

class WalletService {
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

    if (transaction.status === 'completed') {
      return { alreadyCompleted: true, transaction }
    }

    await new Promise((resolve, reject) => {
      db.query(
        `UPDATE transactions
         SET status = 'completed',
             stripe_payment_id = COALESCE(?, stripe_payment_id),
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

    return { alreadyCompleted: false, transaction }
  }

  // Get user wallet balance
  async getWallet(userId) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT w.*, 
                (SELECT SUM(amount) FROM transactions t WHERE t.user_id = w.user_id AND t.type = 'deposit' AND t.status = 'completed') as total_deposits,
                (SELECT SUM(amount) FROM transactions t WHERE t.user_id = w.user_id AND t.type = 'withdrawal' AND t.status = 'completed') as total_withdrawals
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
    const walletId = uuidv4()
    
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
  async createDepositIntent(userId, amountAED) {
    try {
      // Convert AED to USD (1 USD = 3.66 AED)
      const amountUSD = parseFloat((amountAED / 3.66).toFixed(2))
      
      if (amountUSD < 1) {
        throw new Error('Minimum deposit amount is 3.66 AED (1 USD)')
      }

      // Get user email for Stripe
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

      // Create transaction record
      const transactionId = uuidv4()
      const wallet = await this.getWallet(userId)
      
      await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO transactions (id, user_id, wallet_id, type, amount, currency, status, description)
           VALUES (?, ?, ?, 'deposit', ?, 'USD', 'pending', ?)`,
          [transactionId, userId, wallet.id, amountUSD, `Deposit of ${amountAED} AED (${amountUSD} USD)`],
          (err) => {
            if (err) return reject(err)
            resolve()
          }
        )
      })

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Wallet Deposit',
              description: `Deposit ${amountUSD} USD to your Inglozone wallet`
            },
            unit_amount: Math.round(amountUSD * 100), // Stripe uses cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/wallet/deposit/success?session_id={CHECKOUT_SESSION_ID}&transaction_id=${transactionId}`,
        cancel_url: `${process.env.FRONTEND_URL}/wallet/deposit/cancel?transaction_id=${transactionId}`,
        customer_email: user.email,
        metadata: {
          userId,
          transactionId,
          amountAED: amountAED.toString(),
          amountUSD: amountUSD.toString()
        }
      })

      // Update transaction with Stripe session ID
      await new Promise((resolve, reject) => {
        db.query(
          `UPDATE transactions SET stripe_session_id = ? WHERE id = ?`,
          [session.id, transactionId],
          (err) => {
            if (err) return reject(err)
            resolve()
          }
        )
      })

      return {
        sessionId: session.id,
        url: session.url,
        amountUSD,
        amountAED,
        transactionId
      }

    } catch (error) {
      throw error
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
          `SELECT * FROM transactions WHERE stripe_session_id = ?`,
          [sessionId],
          (err, results) => {
            if (err || results.length === 0) return reject(new Error('Transaction not found'))
            resolve(results[0])
          }
        )
      })

      if (transaction.status === 'completed') {
        return { success: true, message: 'Deposit already processed' }
      }

      // Check if payment was successful
      if (session.payment_status === 'paid') {
        // Update transaction status
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE transactions 
             SET status = 'completed', 
                 stripe_payment_id = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [session.payment_intent.id, transaction.id],
            (err) => {
              if (err) return reject(err)
              resolve()
            }
          )
        })

        // Update wallet balance
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE wallets 
             SET balance = balance + ?, 
                 updated_at = NOW()
             WHERE user_id = ?`,
            [transaction.amount, transaction.user_id],
            (err) => {
              if (err) return reject(err)
              resolve()
            }
          )
        })

        return {
          success: true,
          message: 'Deposit completed successfully',
          amount: transaction.amount,
          currency: transaction.currency
        }
      } else {
        // Payment failed
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = ?`,
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

  async createTamaraDepositIntent(userId, amountAED) {
    const numericAmountAED = parseFloat(amountAED)
    if (!numericAmountAED || Number.isNaN(numericAmountAED) || numericAmountAED <= 0) {
      throw new Error('Valid amount is required')
    }

    const amountUSD = parseFloat((numericAmountAED / 3.66).toFixed(2))
    if (amountUSD < 1) {
      throw new Error('Minimum deposit amount is 3.66 AED (1 USD)')
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
    const transactionId = uuidv4()

    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO transactions (id, user_id, wallet_id, type, amount, currency, status, description, metadata)
         VALUES (?, ?, ?, 'deposit', ?, 'USD', 'pending', ?, ?)`,
        [
          transactionId,
          userId,
          wallet.id,
          amountUSD,
          `Tamara deposit of ${numericAmountAED} AED (${amountUSD} USD)`,
          JSON.stringify({
            paymentProvider: 'tamara',
            tamara: { status: 'created', amountAED: numericAmountAED }
          })
        ],
        (err) => (err ? reject(err) : resolve())
      )
    })

    const countryCode = process.env.TAMARA_COUNTRY_CODE || 'AE'
    const phone = String(user.mobile || '').replace(/\D/g, '')
    const frontendBase = (process.env.FRONTEND_URL || '').replace(/\/+$/, '')

    const payload = {
      total_amount: { amount: numericAmountAED, currency: 'AED' },
      shipping_amount: { amount: 0, currency: 'AED' },
      tax_amount: { amount: 0, currency: 'AED' },
      order_reference_id: transactionId,
      order_number: transactionId,
      description: `Wallet deposit for ${user.email}`,
      country_code: countryCode,
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
        country_code: countryCode,
        phone_number: phone || '971500000000'
      },
      billing_address: {
        first_name: user.first_name || 'Customer',
        last_name: user.last_name || 'User',
        line1: 'Not provided',
        city: 'Dubai',
        country_code: countryCode,
        phone_number: phone || '971500000000'
      },
      items: [
        {
          name: 'Wallet Deposit',
          type: 'Digital',
          reference_id: transactionId,
          sku: 'INGLO-WALLET-DEPOSIT',
          quantity: 1,
          unit_price: { amount: numericAmountAED, currency: 'AED' },
          tax_amount: { amount: 0, currency: 'AED' },
          total_amount: { amount: numericAmountAED, currency: 'AED' }
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
        amountAED: numericAmountAED
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
      amountAED: numericAmountAED,
      amountUSD
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
          `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = ?`,
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
        `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = ?`,
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

  // Get transaction history
  async getTransactions(userId, limit = 10, offset = 0) {
    return new Promise((resolve, reject) => {
      db.query(
        `SELECT t.*, 
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
                transactions: results,
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
        `SELECT t.*, 
                DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') as formatted_date
         FROM transactions t
         WHERE t.id = ? AND t.user_id = ?`,
        [transactionId, userId],
        (err, results) => {
          if (err || results.length === 0) return reject(new Error('Transaction not found'))
          resolve(results[0])
        }
      )
    })
  }

  // In wallet.service.js, add this method:
async handleWebhookEvent(event) {
  try {
    const session = event.data.object
    
    if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
      const { transactionId } = session.metadata
      
      if (!transactionId) {
        throw new Error('No transaction ID in webhook')
      }
      
      // Find transaction
      const transaction = await new Promise((resolve, reject) => {
        db.query(
          `SELECT * FROM transactions WHERE id = ?`,
          [transactionId],
          (err, results) => {
            if (err || results.length === 0) return reject(new Error('Transaction not found'))
            resolve(results[0])
          }
        )
      })
      
      // Only process if still pending
      if (transaction.status === 'pending') {
        // Update transaction
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE transactions 
             SET status = 'completed', 
                 stripe_payment_id = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [session.payment_intent, transactionId],
            (err) => {
              if (err) return reject(err)
              resolve()
            }
          )
        })
        
        // Update wallet
        await new Promise((resolve, reject) => {
          db.query(
            `UPDATE wallets 
             SET balance = balance + ?, 
                 updated_at = NOW()
             WHERE user_id = ?`,
            [transaction.amount, transaction.user_id],
            (err) => {
              if (err) return reject(err)
              resolve()
            }
          )
        })
        
        console.log(`Webhook: Deposit completed for transaction ${transactionId}`)
        return { success: true, transactionId }
      }
    }
    
    return { success: false, message: 'Event not processed' }
  } catch (error) {
    console.error('Webhook processing error:', error)
    throw error
  }
}
}

module.exports = new WalletService()
