const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

class WalletService {
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