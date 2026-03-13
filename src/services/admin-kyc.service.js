const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')

class AdminKYCService {
  async syncKYCRecords() {
    const [rows] = await db.promise().query(
      `SELECT
         u.id AS user_id,
         u.email,
         CONCAT_WS(' ', u.first_name, u.last_name) AS customer_name,
         COALESCE(NULLIF(u.registration_country_name, ''), kp.country_of_residence) AS country,
         kp.profile_status,
         (
           SELECT kd.status
           FROM kyc_documents kd
           WHERE kd.user_id = u.id
           ORDER BY kd.created_at DESC
           LIMIT 1
         ) AS latest_document_status,
         rp.aml_status
       FROM users u
       LEFT JOIN kyc_profiles kp ON kp.user_id = u.id
       LEFT JOIN risk_profiles rp ON rp.user_id = u.id`
    )

    for (const row of rows) {
      const status = this.resolveKYCStatus(row.profile_status, row.latest_document_status)
      const rejectionReason = this.resolveRejectionReason(row.profile_status, row.latest_document_status)
      await db.promise().query(
        `INSERT INTO kyc_records (id, user_id, customer_name, email, country, kyc_status, rejection_reason, aml_status, full_kyc_details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           customer_name = VALUES(customer_name),
           email = VALUES(email),
           country = VALUES(country),
           kyc_status = VALUES(kyc_status),
           rejection_reason = VALUES(rejection_reason),
           aml_status = VALUES(aml_status),
           full_kyc_details = VALUES(full_kyc_details),
           updated_at = NOW()`,
        [
          uuidv4(),
          row.user_id,
          row.customer_name || row.email,
          row.email,
          row.country || null,
          status,
          rejectionReason,
          row.aml_status || 'review',
          JSON.stringify({
            profileStatus: row.profile_status || null,
            latestDocumentStatus: row.latest_document_status || null
          })
        ]
      )
    }
  }

  resolveRejectionReason(profileStatus, documentStatus) {
    const normalizedProfile = String(profileStatus || '').toUpperCase()
    const normalizedDocument = String(documentStatus || '').toUpperCase()
    if (normalizedProfile === 'REJECTED' || normalizedDocument === 'REJECTED') {
      return 'Rejected by compliance review'
    }
    return null
  }

  resolveKYCStatus(profileStatus, documentStatus) {
    const normalizedProfile = String(profileStatus || '').toUpperCase()
    const normalizedDocument = String(documentStatus || '').toUpperCase()
    const statuses = [normalizedProfile, normalizedDocument]

    if (statuses.includes('REJECTED')) return 'Rejected'
    if (statuses.includes('APPROVED')) return 'Approved'

    const profileSubmitted = ['SUBMITTED', 'UNDER_REVIEW'].includes(normalizedProfile)
    const documentSubmitted = ['PENDING', 'AUTO_VERIFIED'].includes(normalizedDocument)
    if (profileSubmitted || documentSubmitted) return 'Pending'

    return 'Not_Submitted'
  }

  async getAllKYCRecords() {
    await this.syncKYCRecords()

    const [rows] = await db.promise().query(
      `SELECT
         kr.user_id AS userId,
         kr.customer_name AS customerName,
         kr.email,
         kr.country,
         kr.kyc_status AS kycStatus,
         kr.rejection_reason AS rejectionReason,
         IFNULL(rp.risk_input, 'low') AS riskInput,
         IFNULL(kr.aml_status, 'review') AS amlStatus,
         kr.updated_at AS updatedAt
       FROM kyc_records kr
       LEFT JOIN risk_profiles rp ON rp.user_id = kr.user_id
       ORDER BY kr.updated_at DESC`
    )

    return rows
  }

  async getSingleCustomerKYCDetails(userId) {
    await this.syncKYCRecords()

    const [recordRows] = await db.promise().query(
      `SELECT
         kr.user_id AS userId,
         kr.customer_name AS customerName,
         kr.email,
         kr.country,
         kr.kyc_status AS kycStatus,
         kr.rejection_reason AS rejectionReason,
         IFNULL(rp.risk_input, 'low') AS riskInput,
         IFNULL(kr.aml_status, 'review') AS amlStatus,
         rp.notes AS riskNotes,
         kr.full_kyc_details AS fullKycDetails,
         kr.reviewed_at AS reviewedAt
       FROM kyc_records kr
       LEFT JOIN risk_profiles rp ON rp.user_id = kr.user_id
       WHERE kr.user_id = ?
       LIMIT 1`,
      [userId]
    )

    if (recordRows.length === 0) {
      return null
    }

    const [profileRows] = await db.promise().query(
      `SELECT * FROM kyc_profiles WHERE user_id = ? LIMIT 1`,
      [userId]
    )
    const [documentRows] = await db.promise().query(
      `SELECT id, document_type, document_side, status, auto_score, admin_comment, created_at, reviewed_at
       FROM kyc_documents
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    )

    const result = recordRows[0]
    if (typeof result.fullKycDetails === 'string') {
      try {
        result.fullKycDetails = JSON.parse(result.fullKycDetails)
      } catch (error) {
        result.fullKycDetails = { raw: result.fullKycDetails }
      }
    }
    result.profile = profileRows[0] || null
    result.documents = documentRows

    return result
  }

  async startReview(userId) {
    await this.syncKYCRecords()
    const details = await this.getSingleCustomerKYCDetails(userId)
    if (!details) return null

    const docs = details.documents || []
    const profile = details.profile || null
    const autoScore = docs.length > 0
      ? Math.round(docs.reduce((sum, d) => sum + (Number(d.auto_score) || 0), 0) / docs.length)
      : 0

    const reviewChecklist = {
      documentsUploaded: docs.length > 0,
      profileSubmitted: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(
        String(profile?.profile_status || '').toUpperCase()
      ),
      autoScore
    }

    return {
      ...details,
      reviewChecklist
    }
  }

  async approveDocuments(userId, reviewedBy, comment = null) {
    const [docs] = await db.promise().query(
      `SELECT id FROM kyc_documents
       WHERE user_id = ?
         AND status IN ('PENDING', 'AUTO_VERIFIED', 'REJECTED')`,
      [userId]
    )

    if (docs.length === 0) {
      throw new Error('No reviewable KYC documents found')
    }

    await db.promise().query(
      `UPDATE kyc_documents
       SET status = 'APPROVED',
           reviewed_by = ?,
           reviewed_at = NOW(),
           admin_comment = ?,
           updated_at = NOW()
       WHERE user_id = ?
         AND status IN ('PENDING', 'AUTO_VERIFIED', 'REJECTED')`,
      [reviewedBy, comment, userId]
    )

    for (const doc of docs) {
      await db.promise().query(
        `INSERT INTO kyc_audit_logs (id, kyc_document_id, user_id, action, details)
         VALUES (?, ?, ?, 'MANUAL_APPROVE', ?)`,
        [uuidv4(), doc.id, reviewedBy, JSON.stringify({ scope: 'documents', comment })]
      )
    }

    await this.refreshKYCRecordFromStates(userId, reviewedBy, null)
    return this.getSingleCustomerKYCDetails(userId)
  }

  async approveProfile(userId, reviewedBy, notes = null) {
    const [profiles] = await db.promise().query(
      `SELECT id FROM kyc_profiles WHERE user_id = ? LIMIT 1`,
      [userId]
    )
    if (profiles.length === 0) {
      throw new Error('KYC profile not found')
    }

    await db.promise().query(
      `UPDATE kyc_profiles
       SET profile_status = 'APPROVED',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_notes = ?,
           updated_at = NOW()
       WHERE user_id = ?`,
      [reviewedBy, notes, userId]
    )

    await this.refreshKYCRecordFromStates(userId, reviewedBy, null)
    return this.getSingleCustomerKYCDetails(userId)
  }

  async refreshKYCRecordFromStates(userId, reviewedBy = null, rejectionReason = null) {
    const [profileRows] = await db.promise().query(
      `SELECT profile_status FROM kyc_profiles WHERE user_id = ? LIMIT 1`,
      [userId]
    )
    const profileStatus = String(profileRows[0]?.profile_status || '').toUpperCase()

    const [docStatsRows] = await db.promise().query(
      `SELECT
         COUNT(*) AS totalDocs,
         SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approvedDocs,
         SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedDocs,
         SUM(CASE WHEN status IN ('PENDING', 'AUTO_VERIFIED') THEN 1 ELSE 0 END) AS pendingDocs
       FROM kyc_documents
       WHERE user_id = ?`,
      [userId]
    )
    const docStats = docStatsRows[0] || { totalDocs: 0, approvedDocs: 0, rejectedDocs: 0, pendingDocs: 0 }

    let recordStatus = 'Not_Submitted'
    if (profileStatus === 'REJECTED' || Number(docStats.rejectedDocs) > 0) {
      recordStatus = 'Rejected'
    } else if (
      profileStatus === 'APPROVED' &&
      Number(docStats.totalDocs) > 0 &&
      Number(docStats.approvedDocs) === Number(docStats.totalDocs)
    ) {
      recordStatus = 'Approved'
    } else if (
      ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(profileStatus) ||
      Number(docStats.pendingDocs) > 0 ||
      Number(docStats.approvedDocs) > 0
    ) {
      recordStatus = 'Pending'
    }

    await db.promise().query(
      `UPDATE kyc_records
       SET kyc_status = ?,
           rejection_reason = ?,
           reviewed_by = ?,
           reviewed_at = CASE WHEN ? IN ('Approved', 'Rejected') THEN NOW() ELSE reviewed_at END,
           updated_at = NOW()
       WHERE user_id = ?`,
      [
        recordStatus,
        recordStatus === 'Rejected' ? (rejectionReason || 'Rejected by compliance review') : null,
        reviewedBy,
        recordStatus,
        userId
      ]
    )
  }

  async updateKYCDecision(userId, decision, reviewedBy, comment = null) {
    if (decision === 'approve') {
      await this.approveDocuments(userId, reviewedBy, comment || null)
      await this.approveProfile(userId, reviewedBy, comment || null)
      await this.refreshKYCRecordFromStates(userId, reviewedBy, null)
      return
    }

    // If one side is rejected, reject all sides.
    const [docs] = await db.promise().query(
      `SELECT id FROM kyc_documents WHERE user_id = ?`,
      [userId]
    )

    await db.promise().query(
      `UPDATE kyc_documents
       SET status = 'REJECTED',
           reviewed_by = ?,
           reviewed_at = NOW(),
           admin_comment = ?,
           updated_at = NOW()
       WHERE user_id = ?`,
      [reviewedBy, comment, userId]
    )

    await db.promise().query(
      `UPDATE kyc_profiles
       SET profile_status = 'REJECTED',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_notes = ?,
           updated_at = NOW()
       WHERE user_id = ?`,
      [reviewedBy, comment, userId]
    )

    await db.promise().query(
      `UPDATE kyc_records
       SET kyc_status = 'Rejected',
           rejection_reason = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = ?`,
      [comment || 'Rejected by compliance review', reviewedBy, userId]
    )

    for (const doc of docs) {
      await db.promise().query(
        `INSERT INTO kyc_audit_logs (id, kyc_document_id, user_id, action, details)
         VALUES (?, ?, ?, 'MANUAL_REJECT', ?)`,
        [uuidv4(), doc.id, reviewedBy, JSON.stringify({ scope: 'full_review', comment })]
      )
    }
  }
}

module.exports = new AdminKYCService()
