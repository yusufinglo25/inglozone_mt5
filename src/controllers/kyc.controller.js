// src/controllers/kyc.controller.js
const kycService = require('../services/kyc.service')

class KYCController {
  // Upload KYC document
  async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        })
      }
      
      const { documentType } = req.body
      const userId = req.user.id
      
      if (!documentType || !['passport', 'national_id'].includes(documentType)) {
        return res.status(400).json({
          error: 'Invalid document type. Must be "passport" or "national_id"'
        })
      }
      
      // Encrypt file
      const encryptedData = kycService.encryptFile(req.file.buffer)
      
      // Generate filename
      const filename = kycService.generateFileName(userId, req.file.originalname)
      
      // Save encrypted file
      const filePath = await kycService.saveEncryptedFile(encryptedData, filename)
      
      // Create KYC record
      const kycDocument = await kycService.createKYCDocument({
        userId,
        documentType,
        originalFilename: req.file.originalname,
        encryptedFilePath: filePath,
        iv: encryptedData.iv,
        authTag: encryptedData.authTag
      })
      
      // Log upload
      await kycService.logAudit({
        kycDocumentId: kycDocument.id,
        userId,
        action: 'UPLOAD',
        details: {
          document_type: documentType,
          file_size: req.file.size,
          mime_type: req.file.mimetype
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      })
      
      // Queue for auto verification
      setTimeout(async () => {
        try {
          await kycService.autoVerifyKYCDocument(kycDocument.id)
        } catch (error) {
          console.error('Auto verification failed:', error)
        }
      }, 1000)
      
      res.status(201).json({
        success: true,
        message: 'KYC document uploaded successfully',
        data: {
          id: kycDocument.id,
          documentType,
          status: 'PENDING',
          createdAt: new Date()
        }
      })
      
    } catch (error) {
      console.error('Error uploading KYC document:', error)
      res.status(500).json({
        error: 'Failed to upload KYC document',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
  
  // Get user's KYC status
  async getKYCStatus(req, res) {
    try {
      const userId = req.user.id
      
      const documents = await kycService.getUserKYCDocuments(userId)
      
      const latestDoc = documents.length > 0 ? documents[0] : null
      const status = latestDoc ? latestDoc.status : 'NOT_SUBMITTED'
      
      res.json({
        success: true,
        data: {
          status,
          latestDocument: latestDoc,
          allDocuments: documents
        }
      })
      
    } catch (error) {
      console.error('Error getting KYC status:', error)
      res.status(500).json({
        error: 'Failed to get KYC status'
      })
    }
  }
  
  // Get KYC document details
  async getKYCDocument(req, res) {
    try {
      const { kycId } = req.params
      
      const document = await kycService.getKYCDocumentById(kycId)
      
      if (!document) {
        return res.status(404).json({
          error: 'KYC document not found'
        })
      }
      
      // Don't include sensitive data for non-admin users unless it's their own
      const userEmail = req.user.email || ''
      const isAdmin = userEmail.includes('admin') || userEmail === process.env.ADMIN_EMAIL
      const isOwner = document.user_id === req.user.id
      
      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          error: 'Forbidden'
        })
      }
      
      // Get audit logs if admin
      let auditLogs = []
      if (isAdmin) {
        auditLogs = await kycService.getAuditLogs(kycId)
      }
      
      // Remove sensitive data for non-admin
      if (!isAdmin) {
        delete document.encrypted_file_path
        delete document.iv
        delete document.auth_tag
        delete document.reviewed_by
      }
      
      res.json({
        success: true,
        data: {
          document,
          auditLogs: isAdmin ? auditLogs : undefined
        }
      })
      
    } catch (error) {
      console.error('Error getting KYC document:', error)
      res.status(500).json({
        error: 'Failed to get KYC document'
      })
    }
  }
  
  // Admin: Get pending KYC documents
  async getPendingKYC(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query
      
      const result = await kycService.getPendingKYCDocuments(
        parseInt(limit),
        parseInt(offset)
      )
      
      res.json({
        success: true,
        data: result
      })
      
    } catch (error) {
      console.error('Error getting pending KYC:', error)
      res.status(500).json({
        error: 'Failed to get pending KYC documents'
      })
    }
  }
  
  // Admin: Approve KYC
  async approveKYC(req, res) {
    try {
      const { kycId } = req.params
      const { comment } = req.body
      const adminUserId = req.user.id
      
      const success = await kycService.updateKYCStatus(
        kycId,
        'APPROVED',
        adminUserId,
        comment
      )
      
      if (!success) {
        return res.status(404).json({
          error: 'KYC document not found'
        })
      }
      
      // Log approval
      await kycService.logAudit({
        kycDocumentId: kycId,
        userId: adminUserId,
        action: 'MANUAL_APPROVE',
        details: { comment },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      })
      
      res.json({
        success: true,
        message: 'KYC approved successfully'
      })
      
    } catch (error) {
      console.error('Error approving KYC:', error)
      res.status(500).json({
        error: 'Failed to approve KYC'
      })
    }
  }
  
  // Admin: Reject KYC
  async rejectKYC(req, res) {
    try {
      const { kycId } = req.params
      const { comment, reason } = req.body
      const adminUserId = req.user.id
      
      if (!comment || comment.trim().length < 10) {
        return res.status(400).json({
          error: 'Rejection comment is required and must be at least 10 characters'
        })
      }
      
      const success = await kycService.updateKYCStatus(
        kycId,
        'REJECTED',
        adminUserId,
        comment
      )
      
      if (!success) {
        return res.status(404).json({
          error: 'KYC document not found'
        })
      }
      
      // Log rejection
      await kycService.logAudit({
        kycDocumentId: kycId,
        userId: adminUserId,
        action: 'MANUAL_REJECT',
        details: { comment, reason },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      })
      
      res.json({
        success: true,
        message: 'KYC rejected successfully'
      })
      
    } catch (error) {
      console.error('Error rejecting KYC:', error)
      res.status(500).json({
        error: 'Failed to reject KYC'
      })
    }
  }
  
  // Admin: Run auto verification manually
  async runAutoVerification(req, res) {
    try {
      const { kycId } = req.params
      
      const result = await kycService.autoVerifyKYCDocument(kycId)
      
      if (!result.success) {
        return res.status(400).json({
          error: 'Auto verification failed',
          details: result.error
        })
      }
      
      res.json({
        success: true,
        message: 'Auto verification completed',
        data: result
      })
      
    } catch (error) {
      console.error('Error running auto verification:', error)
      res.status(500).json({
        error: 'Failed to run auto verification'
      })
    }
  }
  
  // Get KYC statistics
  async getKYCStats(req, res) {
    try {
      const db = require('../config/db')
      
      const [stats] = await db.promise().query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'AUTO_VERIFIED' THEN 1 ELSE 0 END) as auto_verified,
          SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
          AVG(auto_score) as avg_score,
          COUNT(DISTINCT user_id) as unique_users
        FROM kyc_documents
      `)
      
      const [recent] = await db.promise().query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM kyc_documents
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `)
      
      res.json({
        success: true,
        data: {
          summary: stats[0],
          recentActivity: recent
        }
      })
      
    } catch (error) {
      console.error('Error getting KYC stats:', error)
      res.status(500).json({
        error: 'Failed to get KYC statistics'
      })
    }
  }
}

// Create instance and export all methods
const kycController = new KYCController()

module.exports = {
  uploadDocument: kycController.uploadDocument.bind(kycController),
  getKYCStatus: kycController.getKYCStatus.bind(kycController),
  getKYCDocument: kycController.getKYCDocument.bind(kycController),
  getPendingKYC: kycController.getPendingKYC.bind(kycController),
  approveKYC: kycController.approveKYC.bind(kycController),
  rejectKYC: kycController.rejectKYC.bind(kycController),
  runAutoVerification: kycController.runAutoVerification.bind(kycController),
  getKYCStats: kycController.getKYCStats.bind(kycController)
}