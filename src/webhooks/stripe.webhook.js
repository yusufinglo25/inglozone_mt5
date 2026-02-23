const express = require('express')
const router = express.Router()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const db = require('../config/db')
const walletService = require('../services/wallet.service')

// Stripe webhook endpoint
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  console.log('Webhook received:', event.type)

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object)
      break
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object)
      break
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object)
      break
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  res.json({ received: true })
})

// Handle successful checkout session
async function handleCheckoutSessionCompleted(session) {
  let connection

  try {
    console.log('Checkout session completed:', session.id)
    
    const { transactionId } = session.metadata || {}
    
    if (!transactionId) {
      console.error('No transaction ID in session metadata')
      return
    }

    connection = await db.promise().getConnection()
    await connection.beginTransaction()

    const [transactions] = await connection.query(
      `SELECT id, amount, user_id, status FROM transactions WHERE id = ? FOR UPDATE`,
      [transactionId]
    )

    if (transactions.length === 0) {
      await connection.rollback()
      console.error('Transaction not found:', transactionId)
      return
    }

    const transaction = transactions[0]

    if (transaction.status !== 'pending') {
      await connection.commit()
      return
    }

    const limitValidation = await walletService.validateDepositCompletionLimit(
      connection,
      transaction.user_id,
      transaction.amount
    )

    if (!limitValidation.allowed) {
      await connection.query(
        `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = ? AND status = 'pending'`,
        [transactionId]
      )
      await connection.commit()
      console.log(`Deposit blocked by KYC limit for transaction ${transactionId}`)
      return
    }

    const [transactionUpdate] = await connection.query(
      `UPDATE transactions 
       SET status = 'completed', 
           stripe_payment_id = ?,
           updated_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [session.payment_intent, transactionId]
    )

    if (transactionUpdate.affectedRows === 0) {
      await connection.commit()
      return
    }

    const [walletUpdate] = await connection.query(
      `UPDATE wallets 
       SET balance = balance + ?, 
           updated_at = NOW()
       WHERE user_id = ?`,
      [transaction.amount, transaction.user_id]
    )

    if (walletUpdate.affectedRows === 0) {
      throw new Error(`Wallet not found for user ${transaction.user_id}`)
    }

    await connection.commit()
    console.log(`Wallet updated for user ${transaction.user_id}: +${transaction.amount} USD`)
  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    console.error('Error handling checkout session:', error)
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id)
  // You can add additional logic here if needed
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent) {
  console.log('Payment failed:', paymentIntent.id)
  
  // Update any related transaction to failed status
  db.query(
    `UPDATE transactions 
     SET status = 'failed', 
         updated_at = NOW()
     WHERE stripe_payment_id = ?`,
    [paymentIntent.id],
    (err) => {
      if (err) {
        console.error('Error updating failed transaction:', err)
      }
    }
  )
}

module.exports = router
