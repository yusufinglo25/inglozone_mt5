const cron = require('node-cron')
const kycService = require('../services/kyc.service')
const db = require('../config/db')

class KYCCleanupJob {
  constructor() {
    this.jobs = []
  }
  
  start() {
    console.log('Starting KYC cleanup jobs...')
    
    // Daily cleanup of old KYC documents (runs at 2 AM)
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('Running KYC cleanup job...')
        const result = await kycService.cleanupOldKYCDocuments(30) // 30 days retention
        
        console.log(`KYC cleanup completed: ${result.deletedCount} documents removed`)
        
        // Log cleanup summary
        await kycService.logAudit({
          kycDocumentId: 'system',
          userId: 'system',
          action: 'DELETE',
          details: {
            action: 'cleanup_job',
            deleted_count: result.deletedCount,
            retention_days: 30
          }
        })
        
      } catch (error) {
        console.error('Error in KYC cleanup job:', error)
      }
    })
    
    this.jobs.push(cleanupJob)
    
    // Weekly statistics report (runs every Monday at 9 AM)
    const statsJob = cron.schedule('0 9 * * 1', async () => {
      try {
        console.log('Running KYC statistics report...')
        
        const [stats] = await db.promise().query(`
          SELECT 
            COUNT(*) as total_documents,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'AUTO_VERIFIED' THEN 1 ELSE 0 END) as auto_verified,
            SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
            COUNT(DISTINCT user_id) as unique_users
          FROM kyc_documents
        `)
        
        console.log('KYC Statistics Report:', stats[0])
        
        // Here you could email this report to admin
        // await emailService.sendKYCStatsReport(stats[0])
        
      } catch (error) {
        console.error('Error in KYC statistics job:', error)
      }
    })
    
    this.jobs.push(statsJob)
    
    // Retry failed auto verifications (runs every hour)
    const retryJob = cron.schedule('0 * * * *', async () => {
      try {
        console.log('Checking for failed auto verifications...')
        
        const [failedVerifications] = await db.promise().query(`
          SELECT kd.id, kd.user_id, kd.auto_score, 
                 COUNT(al.id) as verification_attempts
          FROM kyc_documents kd
          LEFT JOIN kyc_audit_logs al ON kd.id = al.kyc_document_id 
            AND al.action = 'AUTO_VERIFY'
          WHERE kd.status = 'PENDING' 
            AND kd.auto_score < 70
            AND kd.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          GROUP BY kd.id
          HAVING verification_attempts < 3
        `)
        
        console.log(`Found ${failedVerifications.length} documents to retry verification`)
        
        for (const doc of failedVerifications) {
          try {
            await kycService.autoVerifyKYCDocument(doc.id)
            console.log(`Retried verification for document ${doc.id}`)
          } catch (error) {
            console.error(`Failed to retry verification for ${doc.id}:`, error)
          }
        }
        
      } catch (error) {
        console.error('Error in retry job:', error)
      }
    })
    
    this.jobs.push(retryJob)
    
    console.log(`Started ${this.jobs.length} KYC cleanup jobs`)
  }
  
  stop() {
    this.jobs.forEach(job => job.stop())
    console.log('Stopped all KYC cleanup jobs')
  }
}

module.exports = new KYCCleanupJob()