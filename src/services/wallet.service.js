const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

class WalletService {
  getNonApprovedDepositLimitUSD() {
    const value = Number.parseFloat(process.env.NON_APPROVED_DEPOSIT_LIMIT_USD || '5000')
    return Number.isFinite(value) && value > 0 ? value : 5000
  }

  async isKYCApproved(userId) {
    const [profiles] = await db.promise().query(
      `SELECT profile_status FROM kyc_profiles WHERE user_id = ? LIMIT 1`,
      [userId]
    )

    const isProfileApproved = profiles.length > 0 && profiles[0].profile_status === 'APPROVED'
    if (!isProfileApproved) {
      return false
    }

    const [documents] = await db.promise().query(
      `SELECT document_type, status FROM kyc_documents WHERE user_id = ?`,
      [userId]
    )

    const approvedDocs = documents.filter((doc) => doc.status === 'APPROVED')
    const hasApprovedPassport = approvedDocs.some((doc) => doc.document_type === 'passport')
    const hasApprovedLegacyNationalId = approvedDocs.some((doc) => doc.document_type === 'national_id')
    const hasApprovedNationalIdFront = approvedDocs.some((doc) => doc.document_type === 'national_id_front')
    const hasApprovedNationalIdBack = approvedDocs.some((doc) => doc.document_type === 'national_id_back')

    const isDocumentApproved =
      hasApprovedPassport ||
      hasApprovedLegacyNationalId ||
      (hasApprovedNationalIdFront && hasApprovedNationalIdBack)

    return isDocumentApproved
  }

  async getPendingDepositTotal(userId) {
    const [rows] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = ? AND type = 'deposit' AND status = 'pending'`,
      [userId]
    )

    return parseFloat(rows[0]?.total || 0)
  }

  async enforceDepositLimit(userId, amountUSD, walletBalance) {
    const isApproved = await this.isKYCApproved(userId)
    if (isApproved) {
      return
    }

    const limitUSD = this.getNonApprovedDepositLimitUSD()
    const pendingDeposits = await this.getPendingDepositTotal(userId)
    const currentBalance = parseFloat(walletBalance || 0)
    const projectedBalance = currentBalance + pendingDeposits + amountUSD

    if (projectedBalance > limitUSD) {
      const remaining = Math.max(0, limitUSD - (currentBalance + pendingDeposits))
      throw new Error(
        `Deposit limit reached. Non-approved accounts can hold up to ${limitUSD.toFixed(2)} USD. Remaining allowed amount: ${remaining.toFixed(2)} USD. Complete KYC approval for unlimited deposits.`
      )
    }
  }

  async validateDepositCompletionLimit(connection, userId, amountUSD) {
    const isApproved = await this.isKYCApproved(userId)
    if (isApproved) {
      return { allowed: true }
    }

    const [walletRows] = await connection.query(
      `SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE`,
      [userId]
    )

    if (walletRows.length === 0) {
      return { allowed: false, message: 'Wallet not found' }
    }

    const limitUSD = this.getNonApprovedDepositLimitUSD()
    const currentBalance = parseFloat(walletRows[0].balance || 0)
    const projectedBalance = currentBalance + parseFloat(amountUSD || 0)

    if (projectedBalance > limitUSD) {
      return {
        allowed: false,
        message: `Deposit limit reached. Non-approved accounts can hold up to ${limitUSD.toFixed(2)} USD. Complete KYC approval for unlimited deposits.`
      }
    }

    return { allowed: true }
  }

  async assertWithdrawalAllowed(userId) {
    const isApproved = await this.isKYCApproved(userId)
    if (!isApproved) {
      throw new Error('Withdrawals are disabled until KYC is fully approved.')
    }
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
    let transactionId = null
    let stripeSessionCreated = false

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

      // Check KYC-based deposit cap before creating payment intent
      const wallet = await this.getWallet(userId)
      await this.enforceDepositLimit(userId, amountUSD, wallet.balance)

      // Create transaction record
      transactionId = uuidv4()
      
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
      stripeSessionCreated = true

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
      if (transactionId && !stripeSessionCreated) {
        try {
          await db.promise().query(
            `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = ? AND status = 'pending'`,
            [transactionId]
          )
        } catch (cleanupError) {
          console.error('Failed to mark pending transaction as failed:', cleanupError)
        }
      }
      throw error
    }
  }

  // Verify and complete deposit
  async verifyDeposit(sessionId, userId = null) {
    let connection

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
      })

      connection = await db.promise().getConnection()
      await connection.beginTransaction()

      const transactionQuery = userId
        ? `SELECT * FROM transactions WHERE stripe_session_id = ? AND user_id = ? FOR UPDATE`
        : `SELECT * FROM transactions WHERE stripe_session_id = ? FOR UPDATE`
      const transactionParams = userId ? [sessionId, userId] : [sessionId]

      const [transactions] = await connection.query(transactionQuery, transactionParams)
      if (transactions.length === 0) {
        throw new Error('Transaction not found')
      }

      const transaction = transactions[0]

      if (transaction.status === 'completed') {
        await connection.commit()
        return { success: true, message: 'Deposit already processed' }
      }

      if (transaction.status !== 'pending') {
        await connection.commit()
        return {
          success: false,
          message: `Deposit cannot be processed from status: ${transaction.status}`
        }
      }

      if (session.payment_status === 'paid') {
        const limitValidation = await this.validateDepositCompletionLimit(
          connection,
          transaction.user_id,
          transaction.amount
        )

        if (!limitValidation.allowed) {
          await connection.query(
            `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = ? AND status = 'pending'`,
            [transaction.id]
          )
          await connection.commit()
          return {
            success: false,
            message: limitValidation.message
          }
        }

        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id

        const [transactionUpdate] = await connection.query(
          `UPDATE transactions
           SET status = 'completed',
               stripe_payment_id = ?,
               updated_at = NOW()
           WHERE id = ? AND status = 'pending'`,
          [paymentIntentId, transaction.id]
        )

        if (transactionUpdate.affectedRows === 0) {
          await connection.commit()
          return { success: true, message: 'Deposit already processed' }
        }

        const [walletUpdate] = await connection.query(
          `UPDATE wallets
           SET balance = balance + ?,
               updated_at = NOW()
           WHERE user_id = ?`,
          [transaction.amount, transaction.user_id]
        )

        if (walletUpdate.affectedRows === 0) {
          throw new Error('Wallet not found')
        }

        await connection.commit()
        return {
          success: true,
          message: 'Deposit completed successfully',
          amount: transaction.amount,
          currency: transaction.currency
        }
      }

      await connection.query(
        `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = ? AND status = 'pending'`,
        [transaction.id]
      )

      await connection.commit()
      return {
        success: false,
        message: 'Payment failed or not completed'
      }
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
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
