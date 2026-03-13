const cron = require('node-cron')
const walletService = require('../services/wallet.service')

let started = false

function startPaymentReminderJob() {
  if (started) return
  started = true

  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await walletService.processPendingDepositReminders()
      if (result.checked > 0) {
        console.log(`Pending deposit reminder job processed: ${result.checked}`)
      }
    } catch (error) {
      console.error('Pending deposit reminder job failed:', error.message)
    }
  })

  console.log('Pending deposit reminder job scheduled (every 15 minutes)')
}

module.exports = startPaymentReminderJob
