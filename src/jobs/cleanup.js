const db = require('../config/db')
const cron = require('node-cron')
const kycCleanupJob = require('./kyc-cleanup')

if (process.env.NODE_ENV === 'production') {
// Clean up expired OTPs every hour
cron.schedule('0 * * * *', () => {
  console.log('Running OTP cleanup job...')
  
  db.query('DELETE FROM otp_verifications WHERE expires_at < NOW()', (err) => {
    if (err) {
      console.error('OTP cleanup error:', err)
    } else {
      console.log('Expired OTPs cleaned up')
    }
  })
  
  // Clean up old daily limits (older than 30 days)
  db.query('DELETE FROM otp_daily_limits WHERE date < DATE_SUB(NOW(), INTERVAL 30 DAY)', (err) => {
    if (err) {
      console.error('Daily limits cleanup error:', err)
    }
  })
})
 kycCleanupJob.start()
}

module.exports = cron