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
  try {
    console.log('Checkout session completed:', session.id)
    
    const { userId, transactionId } = session.metadata
    
    if (!transactionId) {
      console.error('No transaction ID in session metadata')
      return
    }

    // Update transaction status
    db.query(
      `UPDATE transactions 
       SET status = 'Approved', 
           stripe_payment_id = ?,
           updated_at = NOW()
       WHERE id = ? AND status IN ('pending','Pending')`,
      [session.payment_intent, transactionId],
      (err, result) => {
        if (err) {
          console.error('Error updating transaction:', err)
          return
        }

        if (result.affectedRows > 0) {
          // Update wallet balance
          db.query(
            `SELECT amount, user_id FROM transactions WHERE id = ?`,
            [transactionId],
            (err, results) => {
              if (err || results.length === 0) {
                console.error('Transaction not found:', err)
                return
              }

              const { amount, user_id } = results[0]

              db.query(
                `UPDATE wallets 
                 SET balance = balance + ?, 
                     updated_at = NOW()
                 WHERE user_id = ?`,
                [amount, user_id],
                (updateErr) => {
                  if (updateErr) {
                    console.error('Error updating wallet:', updateErr)
                  } else {
                    console.log(`Wallet updated for user ${user_id}: +${amount} USD`)
                  }
                }
              )
            }
          )
        }
      }
    )
  } catch (error) {
    console.error('Error handling checkout session:', error)
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
     SET status = 'Rejected', 
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

// Tamara webhook endpoint
router.post('/tamara-webhook', async (req, res) => {
  try {
    const result = await walletService.handleTamaraWebhook(req.body, req)
    res.json({ received: true, ...result })
  } catch (error) {
    console.error('Tamara webhook error:', error.message)
    res.status(400).json({ error: error.message })
  }
})

router.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const gateway = await walletService.getGatewayConfig('razorpay')
    const secret = gateway.secretKey || process.env.RAZORPAY_WEBHOOK_SECRET || null
    if (!secret) {
      return res.status(400).json({ error: 'Razorpay webhook secret not configured' })
    }

    const signature = req.headers['x-razorpay-signature']
    if (!signature) {
      return res.status(400).json({ error: 'Missing Razorpay signature' })
    }

    const bodyBuffer = req.body
    const computed = require('crypto')
      .createHmac('sha256', secret)
      .update(bodyBuffer)
      .digest('hex')

    if (computed !== signature) {
      return res.status(400).json({ error: 'Invalid Razorpay signature' })
    }

    const payload = JSON.parse(Buffer.isBuffer(bodyBuffer) ? bodyBuffer.toString('utf8') : '{}')
    const eventType = String(payload.event || '').toLowerCase()
    const entity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity || {}
    const orderId = entity.order_id || entity.id
    const paymentId = entity.id && entity.order_id ? entity.id : null

    if (!orderId) {
      return res.json({ received: true, skipped: true, reason: 'No order id' })
    }

    const [rows] = await db.promise().query(
      `SELECT id
       FROM transactions
       WHERE payment_provider = 'razorpay'
         AND (stripe_payment_id = ? OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.razorpayOrderId')) = ?)
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId, orderId]
    )

    if (rows.length === 0) {
      return res.json({ received: true, skipped: true, reason: 'No transaction found' })
    }

    if (eventType.includes('captured') || eventType.includes('authorized')) {
      await walletService.markTransactionCompleted(rows[0].id, paymentId || orderId)
    } else if (eventType.includes('failed')) {
      await db.promise().query(
        `UPDATE transactions SET status = 'Rejected', updated_at = NOW() WHERE id = ?`,
        [rows[0].id]
      )
    }

    return res.json({ received: true })
  } catch (error) {
    console.error('Razorpay webhook error:', error.message)
    return res.status(400).json({ error: error.message })
  }
})

module.exports = router
