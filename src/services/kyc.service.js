const crypto = require('crypto')
const fs = require('fs').promises
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')
const Tesseract = require('tesseract.js')
const Jimp = require('jimp')

class KYCService {
  constructor() {
    this.uploadPath = process.env.KYC_UPLOAD_PATH || './uploads/kyc'
    this.ensureUploadDirectory()
  }
  
  async ensureUploadDirectory() {
    try {
      await fs.mkdir(this.uploadPath, { recursive: true })
    } catch (error) {
      console.error('Error creating upload directory:', error)
    }
  }
  
  // Generate a unique filename with UUID
  generateFileName(userId, originalFilename) {
    const ext = path.extname(originalFilename)
    const timestamp = Date.now()
    return `${userId}_${timestamp}_${uuidv4()}${ext}`
  }
  
  // Encrypt file using AES-256-GCM
  encryptFile(buffer) {
    const algorithm = 'aes-256-gcm'
    const key = crypto.createHash('sha256')
      .update(process.env.KYC_ENCRYPTION_KEY || 'your-secret-key-32-chars-long')
      .digest()
    
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    
    let encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
    const authTag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    }
  }
  
  // Decrypt file
  decryptFile(encryptedBuffer, ivHex, authTagHex) {
    const algorithm = 'aes-256-gcm'
    const key = crypto.createHash('sha256')
      .update(process.env.KYC_ENCRYPTION_KEY || 'your-secret-key-32-chars-long')
      .digest()
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    decipher.setAuthTag(authTag)
    
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])
  }
  
  // Save encrypted file to disk
  async saveEncryptedFile(encryptedData, filename) {
    const filePath = path.join(this.uploadPath, filename)
    await fs.writeFile(filePath, encryptedData.encrypted)
    return filePath
  }
  
  // Create KYC document record
  async createKYCDocument(data) {
    const {
      userId,
      documentType,
      originalFilename,
      encryptedFilePath,
      iv,
      authTag
    } = data
    
    const kycId = uuidv4()
    
    const [result] = await db.promise().query(
      `INSERT INTO kyc_documents 
       (id, user_id, document_type, original_filename, encrypted_file_path, iv, auth_tag, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [kycId, userId, documentType, originalFilename, encryptedFilePath, iv, authTag]
    )
    
    return {
      id: kycId,
      ...data
    }
  }
  
  // Get KYC document by ID
  async getKYCDocumentById(kycId, includeFile = false) {
    const [documents] = await db.promise().query(
      `SELECT kd.*, 
              u.email as user_email,
              u.first_name,
              u.last_name,
              ru.email as reviewer_email
       FROM kyc_documents kd
       LEFT JOIN users u ON kd.user_id = u.id
       LEFT JOIN users ru ON kd.reviewed_by = ru.id
       WHERE kd.id = ?`,
      [kycId]
    )
    
    if (documents.length === 0) {
      return null
    }
    
    const document = documents[0]
    
    if (includeFile) {
      const encryptedBuffer = await fs.readFile(document.encrypted_file_path)
      const decryptedBuffer = this.decryptFile(encryptedBuffer, document.iv, document.auth_tag)
      
      return {
        ...document,
        fileBuffer: decryptedBuffer,
        fileMimeType: this.getMimeType(document.original_filename)
      }
    }
    
    return document
  }
  
  // Get all KYC documents for user
  async getUserKYCDocuments(userId) {
    const [documents] = await db.promise().query(
      `SELECT id, document_type, status, auto_score, 
              created_at, updated_at, reviewed_at
       FROM kyc_documents 
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    )
    
    return documents
  }
  
  // Get pending KYC documents for admin
  async getPendingKYCDocuments(limit = 50, offset = 0) {
    const [documents] = await db.promise().query(
      `SELECT kd.id, kd.document_type, kd.status, kd.auto_score,
              kd.created_at, kd.updated_at,
              u.id as user_id, u.email, u.first_name, u.last_name
       FROM kyc_documents kd
       JOIN users u ON kd.user_id = u.id
       WHERE kd.status IN ('PENDING', 'AUTO_VERIFIED')
       ORDER BY kd.created_at ASC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    )
    
    const [total] = await db.promise().query(
      `SELECT COUNT(*) as count 
       FROM kyc_documents 
       WHERE status IN ('PENDING', 'AUTO_VERIFIED')`
    )
    
    return {
      documents,
      total: total[0].count,
      limit,
      offset
    }
  }
  
  // Update KYC status
  async updateKYCStatus(kycId, status, adminUserId = null, comment = null) {
    const updateData = {
      status,
      updated_at: new Date()
    }
    
    if (adminUserId) {
      updateData.reviewed_by = adminUserId
      updateData.reviewed_at = new Date()
    }
    
    if (comment) {
      updateData.admin_comment = comment
    }
    
    const [result] = await db.promise().query(
      `UPDATE kyc_documents SET ? WHERE id = ?`,
      [updateData, kycId]
    )
    
    return result.affectedRows > 0
  }
  
  // Automatic verification using OCR and image analysis
  async autoVerifyKYCDocument(kycId) {
    try {
      const document = await this.getKYCDocumentById(kycId, true)
      
      if (!document || !document.fileBuffer) {
        throw new Error('Document not found or no file buffer')
      }
      
      let score = 0
      const extractedData = {}
      
      // Check if file is PDF or image
      const isPdf = document.original_filename.toLowerCase().endsWith('.pdf')
      
      if (isPdf) {
        // PDF processing would go here
        // For now, we'll convert first page to image or use a PDF OCR library
        score += 30 // Base score for PDF
        extractedData.file_type = 'pdf'
      } else {
        // Image processing
        const image = await Jimp.read(document.fileBuffer)
        
        // Image quality checks
        const width = image.bitmap.width
        const height = image.bitmap.height
        
        // Score based on image size
        if (width >= 800 && height >= 600) {
          score += 20
        } else if (width >= 400 && height >= 300) {
          score += 10
        }
        
        // Check for blur (simple edge detection)
        const edgeCount = await this.detectEdges(image)
        if (edgeCount > 100) {
          score += 15
        }
        
        extractedData.image_dimensions = { width, height }
        extractedData.file_type = 'image'
      }
      
      // OCR text extraction
      try {
        const { data: { text } } = await Tesseract.recognize(
          document.fileBuffer,
          'eng',
          {
            logger: m => console.log(m) // Remove in production
          }
        )
        
        extractedData.ocr_text = text.substring(0, 5000) // Limit text length
        
        // Basic document validation
        const validationResult = this.validateDocumentText(text, document.document_type)
        score += validationResult.score
        
        Object.assign(extractedData, validationResult.extracted)
        
      } catch (ocrError) {
        console.error('OCR processing failed:', ocrError)
        extractedData.ocr_error = 'Failed to process text'
      }
      
      // Face detection (simplified)
      if (!isPdf) {
        const hasFace = await this.detectFace(document.fileBuffer)
        if (hasFace) {
          score += 25
          extractedData.has_face = true
        }
      }
      
      // Update document with extracted data and score
      await db.promise().query(
        `UPDATE kyc_documents 
         SET extracted_data = ?, auto_score = ?,
             status = CASE WHEN ? >= 70 THEN 'AUTO_VERIFIED' ELSE status END
         WHERE id = ?`,
        [JSON.stringify(extractedData), score, score, kycId]
      )
      
      // Log audit
      await this.logAudit({
        kycDocumentId: kycId,
        userId: document.user_id,
        action: 'AUTO_VERIFY',
        details: { score, extracted_data: extractedData }
      })
      
      return {
        success: true,
        score,
        extractedData,
        status: score >= 70 ? 'AUTO_VERIFIED' : 'PENDING'
      }
      
    } catch (error) {
      console.error('Auto verification failed:', error)
      
      // Log failed verification
      await this.logAudit({
        kycDocumentId: kycId,
        userId: 'system',
        action: 'AUTO_VERIFY',
        details: { error: error.message }
      })
      
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  // Simple edge detection
  async detectEdges(image) {
    let edgeCount = 0
    const threshold = 30
    
    for (let y = 1; y < image.bitmap.height - 1; y++) {
      for (let x = 1; x < image.bitmap.width - 1; x++) {
        const idx = (image.bitmap.width * y + x) << 2
        
        // Get neighboring pixels
        const current = this.getBrightness(
          image.bitmap.data[idx],
          image.bitmap.data[idx + 1],
          image.bitmap.data[idx + 2]
        )
        
        const right = this.getBrightness(
          image.bitmap.data[idx + 4],
          image.bitmap.data[idx + 5],
          image.bitmap.data[idx + 6]
        )
        
        const bottom = this.getBrightness(
          image.bitmap.data[idx + image.bitmap.width * 4],
          image.bitmap.data[idx + image.bitmap.width * 4 + 1],
          image.bitmap.data[idx + image.bitmap.width * 4 + 2]
        )
        
        if (Math.abs(current - right) > threshold || Math.abs(current - bottom) > threshold) {
          edgeCount++
        }
      }
    }
    
    return edgeCount
  }
  
  getBrightness(r, g, b) {
    return (r + g + b) / 3
  }
  
  // Simple face detection (placeholder - implement with proper library in production)
  async detectFace(imageBuffer) {
    // In production, use a proper face detection library like face-api.js or OpenCV
    // For now, return true for testing
    return Math.random() > 0.3 // 70% chance of "detecting" a face
  }
  
  // Validate document text
  validateDocumentText(text, documentType) {
    const result = {
      score: 0,
      extracted: {}
    }
    
    const lowerText = text.toLowerCase()
    
    // Check for document type specific keywords
    if (documentType === 'passport') {
      if (lowerText.includes('passport') || lowerText.includes('passeport')) {
        result.score += 15
        result.extracted.has_passport_keyword = true
      }
      
      // Look for passport number pattern
      const passportNumber = text.match(/[A-Z]{1,2}[0-9]{6,9}/)
      if (passportNumber) {
        result.score += 20
        result.extracted.passport_number = passportNumber[0]
      }
    }
    
    if (documentType === 'national_id') {
      if (lowerText.includes('national') || lowerText.includes('identity') || lowerText.includes('id')) {
        result.score += 15
        result.extracted.has_id_keyword = true
      }
      
      // Look for ID number pattern
      const idNumber = text.match(/[0-9]{8,12}/)
      if (idNumber) {
        result.score += 20
        result.extracted.id_number = idNumber[0]
      }
    }
    
    // Look for dates
    const datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/
    const dates = text.match(datePattern)
    if (dates && dates.length > 0) {
      result.score += 10
      result.extracted.dates_found = dates
    }
    
    // Look for names (simple check)
    const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/
    const names = text.match(namePattern)
    if (names && names.length > 0) {
      result.score += 15
      result.extracted.names_found = names
    }
    
    return result
  }
  
  // Get MIME type from filename
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.pdf': 'application/pdf'
    }
    
    return mimeTypes[ext] || 'application/octet-stream'
  }
  
  // Log audit trail
  async logAudit(data) {
    const {
      kycDocumentId,
      userId,
      action,
      details,
      ipAddress = null,
      userAgent = null
    } = data
    
    const auditId = uuidv4()
    
    await db.promise().query(
      `INSERT INTO kyc_audit_logs 
       (id, kyc_document_id, user_id, action, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [auditId, kycDocumentId, userId, action, JSON.stringify(details), ipAddress, userAgent]
    )
  }
  
  // Get audit logs for KYC document
  async getAuditLogs(kycDocumentId) {
    const [logs] = await db.promise().query(
      `SELECT al.*, u.email as user_email
       FROM kyc_audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.kyc_document_id = ?
       ORDER BY al.created_at DESC`,
      [kycDocumentId]
    )
    
    return logs
  }
  
  // Cleanup expired/rejected KYC files
  async cleanupOldKYCDocuments(daysToKeep = 30) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      
      // Get old rejected documents
      const [oldDocuments] = await db.promise().query(
        `SELECT id, encrypted_file_path 
         FROM kyc_documents 
         WHERE (status = 'REJECTED' OR status = 'PENDING') 
         AND created_at < ?`,
        [cutoffDate]
      )
      
      let deletedCount = 0
      
      for (const doc of oldDocuments) {
        try {
          // Delete file from disk
          await fs.unlink(doc.encrypted_file_path)
          
          // Delete from database
          await db.promise().query(
            `DELETE FROM kyc_documents WHERE id = ?`,
            [doc.id]
          )
          
          // Log deletion
          await this.logAudit({
            kycDocumentId: doc.id,
            userId: 'system',
            action: 'DELETE',
            details: { reason: 'cleanup', cutoff_date: cutoffDate }
          })
          
          deletedCount++
        } catch (error) {
          console.error(`Error deleting KYC document ${doc.id}:`, error)
        }
      }
      
      return {
        deletedCount,
        success: true
      }
    } catch (error) {
      console.error('Error in KYC cleanup:', error)
      return {
        deletedCount: 0,
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = new KYCService()