// src/services/kyc.service.js
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

  // Generate a unique filename with UUID and side info
  generateFileName(userId, originalFilename, documentSide = 'single') {
    const ext = path.extname(originalFilename)
    const timestamp = Date.now()
    return `${userId}_${documentSide}_${timestamp}_${uuidv4()}${ext}`
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

  // ENHANCED: Create KYC document record with document side
  async createKYCDocument(data) {
    const {
      userId,
      documentType,
      documentSide = 'single',
      originalFilename,
      encryptedFilePath,
      iv,
      authTag
    } = data

    const kycId = uuidv4()

    const [result] = await db.promise().query(
      `INSERT INTO kyc_documents 
       (id, user_id, document_type, document_side, original_filename, encrypted_file_path, iv, auth_tag, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [kycId, userId, documentType, documentSide, originalFilename, encryptedFilePath, iv, authTag]
    )

    return {
      id: kycId,
      ...data
    }
  }

  // NEW: Check if user has complete document set
  async checkDocumentCompleteness(userId) {
    const [documents] = await db.promise().query(
      `SELECT document_type, document_side, status 
       FROM kyc_documents 
       WHERE user_id = ? AND status IN ('APPROVED', 'AUTO_VERIFIED', 'PENDING')`,
      [userId]
    )

    const result = {
      passport: { uploaded: false, status: null },
      national_id: { front: false, back: false, status: null }
    }

    documents.forEach(doc => {
      if (doc.document_type === 'passport') {
        result.passport.uploaded = true
        result.passport.status = doc.status
      } else if (doc.document_type === 'national_id_front') {
        result.national_id.front = true
        result.national_id.status = doc.status
      } else if (doc.document_type === 'national_id_back') {
        result.national_id.back = true
        result.national_id.status = doc.status
      }
    })

    return result
  }

  // ENHANCED: Get KYC document by ID
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

  // ENHANCED: Get all KYC documents for user with grouping
  async getUserKYCDocuments(userId) {
    const [documents] = await db.promise().query(
      `SELECT id, document_type, document_side, status, auto_score, 
              created_at, updated_at, reviewed_at, extracted_data
       FROM kyc_documents 
       WHERE user_id = ?
       ORDER BY 
         CASE document_type
           WHEN 'passport' THEN 1
           WHEN 'national_id_front' THEN 2
           WHEN 'national_id_back' THEN 3
           ELSE 4
         END,
         created_at DESC`,
      [userId]
    )

    // Parse extracted data for each document
    documents.forEach(doc => {
      if (doc.extracted_data) {
        try {
          doc.extracted_data = JSON.parse(doc.extracted_data)
        } catch (e) {
          doc.extracted_data = null
        }
      }
    })

    return documents
  }

  // Get pending KYC documents for admin
  async getPendingKYCDocuments(limit = 50, offset = 0) {
    const [documents] = await db.promise().query(
      `SELECT kd.id, kd.document_type, kd.document_side, kd.status, kd.auto_score,
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

  // ENHANCED: Automatic verification with side-specific logic
  async autoVerifyKYCDocument(kycId) {
    try {
      const document = await this.getKYCDocumentById(kycId, true)

      if (!document || !document.fileBuffer) {
        throw new Error('Document not found or no file buffer')
      }

      let score = 0
      const extractedData = {
        document_side: document.document_side,
        document_type: document.document_type
      }

      // Check if file is PDF or image
      const isPdf = document.original_filename.toLowerCase().endsWith('.pdf')

      if (isPdf) {
        score += 30
        extractedData.file_type = 'pdf'
      } else {
        // Image processing
        const image = await Jimp.read(document.fileBuffer)

        const width = image.bitmap.width
        const height = image.bitmap.height

        if (width >= 800 && height >= 600) {
          score += 20
        } else if (width >= 400 && height >= 300) {
          score += 10
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
            logger: m => console.log(m)
          }
        )

        extractedData.ocr_text = text.substring(0, 5000)

        // Extract based on document type and side
        const validationResult = this.validateAndExtractDocumentData(
          text,
          document.document_type,
          document.document_side
        )
        score += validationResult.score

        Object.assign(extractedData, validationResult.extracted)

      } catch (ocrError) {
        console.error('OCR processing failed:', ocrError)
        extractedData.ocr_error = 'Failed to process text'
      }

      // Face detection (for front of ID or passport)
      if (!isPdf && (document.document_side === 'front' || document.document_type === 'passport')) {
        const hasFace = await this.detectFace(document.fileBuffer)
        if (hasFace) {
          score += 25
          extractedData.has_face = true
        }
      }

      // For back of ID, check for barcode/mrz patterns
      if (document.document_side === 'back') {
        const hasBarcode = await this.detectBarcode(document.fileBuffer)
        if (hasBarcode) {
          score += 15
          extractedData.has_barcode = true
        }
      }

      // Update document with extracted data and score, but do NOT change status
      await db.promise().query(
        `UPDATE kyc_documents 
         SET extracted_data = ?, auto_score = ?
         WHERE id = ?`,
        [JSON.stringify(extractedData), score, kycId]
      )

      // If we extracted personal info from front/passport, try to auto-fill KYC profile
      if ((document.document_side === 'front' || document.document_type === 'passport') &&
          extractedData.personal_info) {
        await this.autoFillKYCProfile(document.user_id, extractedData.personal_info, kycId)
      }

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
        status: document.status // Return original status (should be PENDING)
      }

    } catch (error) {
      console.error('Auto verification failed:', error)

      // Log failed verification
      await this.logAudit({
        kycDocumentId: kycId,
        userId: null,
        action: 'AUTO_VERIFY',
        details: { error: error.message }
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  // Simple face detection (placeholder)
  async detectFace(imageBuffer) {
    // In production, use a proper face detection library
    return Math.random() > 0.3
  }

  // Simple barcode detection (placeholder)
  async detectBarcode(imageBuffer) {
    // In production, use a proper barcode detection library
    return Math.random() > 0.4
  }

  // ENHANCED: Validate and extract document data with side awareness
  validateAndExtractDocumentData(text, documentType, documentSide = 'single') {
    const result = {
      score: 0,
      extracted: {}
    }

    const lowerText = text.toLowerCase()

    // Document type specific validation
    if (documentType === 'passport') {
      if (lowerText.includes('passport') || lowerText.includes('passeport')) {
        result.score += 15
        result.extracted.has_passport_keyword = true
      }

      // Look for passport number pattern
      const passportNumber = text.match(/[A-Z]{1,2}[0-9]{6,9}/)
      if (passportNumber) {
        result.score += 20
        result.extracted.document_number = passportNumber[0]
      }

      // Look for MRZ (Machine Readable Zone) - bottom of passport
      const mrzPattern = /[A-Z0-9<]{44}/g
      const mrz = text.match(mrzPattern)
      if (mrz && mrz.length >= 2) {
        result.score += 25
        result.extracted.has_mrz = true
        result.extracted.mrz = mrz
      }
    }

    if (documentType === 'national_id_front' || documentType === 'national_id_front') {
      if (lowerText.includes('national') || lowerText.includes('identity') || lowerText.includes('id')) {
        result.score += 15
        result.extracted.has_id_keyword = true
      }

      // Look for ID number pattern
      const idNumber = text.match(/[0-9]{8,12}/)
      if (idNumber) {
        result.score += 20
        result.extracted.document_number = idNumber[0]
      }
    }

    if (documentType === 'national_id_back') {
      // Back side might have address, barcode, etc.
      if (lowerText.includes('address') || lowerText.includes('residence')) {
        result.score += 10
        result.extracted.has_address_keyword = true
      }

      // Look for barcode numbers
      const barcodePattern = /[0-9]{10,20}/
      const barcode = text.match(barcodePattern)
      if (barcode) {
        result.score += 15
        result.extracted.barcode = barcode[0]
      }
    }

    // Common fields extraction (apply to any document side)

    // Look for dates
    const datePattern = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/
    const dates = text.match(datePattern)
    if (dates && dates.length > 0) {
      result.score += 10
      result.extracted.dates_found = dates

      // Try to identify DOB
      if (text.toLowerCase().includes('birth') || text.toLowerCase().includes('dob')) {
        const birthMatch = text.match(/(?:birth|dob)[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i)
        if (birthMatch) {
          result.extracted.date_of_birth = this.formatDate(birthMatch[1])
        }
      }
    }

    // Look for names (more relevant on front/passport)
    if (documentSide === 'front' || documentType === 'passport') {
      const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/
      const names = text.match(namePattern)
      if (names && names.length > 0) {
        result.score += 15
        result.extracted.names_found = names

        const fullName = names[0]
        const nameParts = fullName.split(' ')
        if (nameParts.length >= 2) {
          result.extracted.first_name = nameParts[0]
          result.extracted.last_name = nameParts.slice(1).join(' ')
        }
      }
    }

    // Look for nationality
    const countryPattern = /\b(?:Nationality|Country)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
    const countryMatch = text.match(countryPattern)
    if (countryMatch) {
      result.extracted.nationality = countryMatch[1]
    }

    return result
  }

  // Extract personal information for auto-fill
  extractPersonalInformation(text, documentType) {
    const info = {}

    // Extract names
    const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/
    const names = text.match(namePattern)
    if (names && names.length > 0) {
      const fullName = names[0]
      const nameParts = fullName.split(' ')
      if (nameParts.length >= 2) {
        info.first_name = nameParts[0]
        info.last_name = nameParts.slice(1).join(' ')
      }
    }

    // Extract date of birth
    const dobPattern = /(?:Date of Birth|DOB|Birth)[:\s]*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i
    const dobMatch = text.match(dobPattern)
    if (dobMatch) {
      info.date_of_birth = this.formatDate(dobMatch[1])
    }

    // Extract nationality
    const nationalityPattern = /\b(?:Nationality|Country of citizenship)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
    const nationalityMatch = text.match(nationalityPattern)
    if (nationalityMatch) {
      info.nationality = nationalityMatch[1]
    }

    // Extract place of birth
    const birthPlacePattern = /\b(?:Place of Birth|Born in|Birthplace)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s*,\s*[A-Z][a-z]+)*)/i
    const birthPlaceMatch = text.match(birthPlacePattern)
    if (birthPlaceMatch) {
      info.place_of_birth = birthPlaceMatch[1]
    }

    // Extract gender
    const genderPattern = /\b(?:Sex|Gender)[:\s]*(Male|Female|M|F)/i
    const genderMatch = text.match(genderPattern)
    if (genderMatch) {
      const gender = genderMatch[1].toLowerCase()
      info.gender = gender === 'm' ? 'male' : gender === 'f' ? 'female' : gender
    }

    // Extract ID number
    const idPattern = documentType === 'passport' ? /[A-Z]{1,2}[0-9]{6,9}/ : /[0-9]{8,12}/
    const idMatch = text.match(idPattern)
    if (idMatch) {
      info.document_number = idMatch[0]
    }

    return Object.keys(info).length > 0 ? info : null
  }

  // Format date to YYYY-MM-DD
  formatDate(dateStr) {
    try {
      const cleanDate = dateStr.replace(/\./g, '-').replace(/\//g, '-')
      const parts = cleanDate.split('-')

      if (parts.length === 3) {
        let day, month, year

        if (parts[0].length === 4) {
          year = parts[0]
          month = parts[1].padStart(2, '0')
          day = parts[2].padStart(2, '0')
        } else {
          day = parts[0].padStart(2, '0')
          month = parts[1].padStart(2, '0')
          year = parts[2]

          if (year.length === 2) {
            year = parseInt(year) < 30 ? `20${year}` : `19${year}`
          }
        }

        return `${year}-${month}-${day}`
      }
    } catch (error) {
      console.error('Error formatting date:', error)
    }
    return dateStr
  }

  // Auto-fill KYC profile with extracted data
  async autoFillKYCProfile(userId, personalInfo, kycDocumentId) {
    try {
      const kycProfileService = require('./kyc-profile.service')

      let existingProfile = await kycProfileService.getProfileByUserId(userId)

      if (!existingProfile) {
        const profileData = {
          ...personalInfo,
          country_of_residence: personalInfo.nationality || '',
          profile_status: 'DRAFT'
        }

        await kycProfileService.saveProfile(userId, profileData)

        await this.logAudit({
          kycDocumentId: kycDocumentId,
          userId: null,
          action: 'AUTO_FILL',
          details: {
            profile_created: true,
            extracted_fields: Object.keys(personalInfo)
          }
        })
      } else {
        const updates = {}
        for (const [key, value] of Object.entries(personalInfo)) {
          if (!existingProfile[key] || existingProfile[key] === '') {
            updates[key] = value
          }
        }

        if (Object.keys(updates).length > 0) {
          await kycProfileService.saveProfile(userId, updates)

          await this.logAudit({
            kycDocumentId: kycDocumentId,
            userId: null,
            action: 'AUTO_FILL',
            details: {
              profile_updated: true,
              updated_fields: Object.keys(updates)
            }
          })
        }
      }

      return true
    } catch (error) {
      console.error('Error auto-filling KYC profile:', error)
      return false
    }
  }

  // Get auto-filled data from KYC document
  async getAutoFillData(kycId) {
    try {
      const document = await this.getKYCDocumentById(kycId)

      if (!document || !document.extracted_data) {
        return null
      }

      const extractedData = JSON.parse(document.extracted_data)

      const personalInfo = {}

      if (extractedData.first_name) personalInfo.first_name = extractedData.first_name
      if (extractedData.last_name) personalInfo.last_name = extractedData.last_name
      if (extractedData.date_of_birth) personalInfo.date_of_birth = extractedData.date_of_birth
      if (extractedData.place_of_birth) personalInfo.place_of_birth = extractedData.place_of_birth
      if (extractedData.gender) personalInfo.gender = extractedData.gender
      if (extractedData.nationality) {
        personalInfo.nationality = extractedData.nationality
        personalInfo.country_of_residence = extractedData.nationality
      }
      if (extractedData.document_number) personalInfo.document_number = extractedData.document_number

      return {
        success: true,
        extractedData: personalInfo,
        document_type: document.document_type,
        document_side: document.document_side,
        document_status: document.status,
        has_auto_fill_data: Object.keys(personalInfo).length > 0
      }

    } catch (error) {
      console.error('Error getting auto-fill data:', error)
      return null
    }
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
    const safeUserId = (userId === 'system' || !userId) ? null : userId

    await db.promise().query(
      `INSERT INTO kyc_audit_logs 
       (id, kyc_document_id, user_id, action, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [auditId, kycDocumentId, safeUserId, action, JSON.stringify(details), ipAddress, userAgent]
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
          await fs.unlink(doc.encrypted_file_path)

          await db.promise().query(
            `DELETE FROM kyc_documents WHERE id = ?`,
            [doc.id]
          )

          await this.logAudit({
            kycDocumentId: doc.id,
            userId: null,
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