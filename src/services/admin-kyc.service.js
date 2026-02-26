const db = require('../config/db')
const { v4: uuidv4 } = require('uuid')

class AdminKYCService {
  async syncKYCRecords() {
    const [rows] = await db.promise().query(
      `SELECT
         u.id AS user_id,
         u.email,
         CONCAT_WS(' ', u.first_name, u.last_name) AS customer_name,
         kp.country_of_residence AS country,
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
      await db.promise().query(
        `INSERT INTO kyc_records (id, user_id, customer_name, email, country, kyc_status, aml_status, full_kyc_details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           customer_name = VALUES(customer_name),
           email = VALUES(email),
           country = VALUES(country),
           kyc_status = VALUES(kyc_status),
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
          row.aml_status || 'review',
          JSON.stringify({
            profileStatus: row.profile_status || null,
            latestDocumentStatus: row.latest_document_status || null
          })
        ]
      )
    }
  }

  resolveKYCStatus(profileStatus, documentStatus) {
    const statuses = [String(profileStatus || ''), String(documentStatus || '')].map((s) => s.toUpperCase())
    if (statuses.includes('REJECTED')) return 'Rejected'
    if (statuses.includes('APPROVED')) return 'Approved'
    return 'Pending'
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

  async updateKYCDecision(userId, decision, reviewedBy, comment = null) {
    const targetStatus = decision === 'approve' ? 'Approved' : 'Rejected'
    const documentStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED'

    await db.promise().query(
      `UPDATE kyc_records
       SET kyc_status = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE user_id = ?`,
      [targetStatus, reviewedBy, userId]
    )

    await db.promise().query(
      `UPDATE kyc_profiles
       SET profile_status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE user_id = ?`,
      [documentStatus, reviewedBy, comment, userId]
    )

    const [docs] = await db.promise().query(
      `SELECT id FROM kyc_documents
       WHERE user_id = ? AND status IN ('PENDING', 'AUTO_VERIFIED')`,
      [userId]
    )

    if (docs.length > 0) {
      await db.promise().query(
        `UPDATE kyc_documents
         SET status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_comment = ?, updated_at = NOW()
         WHERE user_id = ? AND status IN ('PENDING', 'AUTO_VERIFIED')`,
        [documentStatus, reviewedBy, comment, userId]
      )

      for (const doc of docs) {
        await db.promise().query(
          `INSERT INTO kyc_audit_logs (id, kyc_document_id, user_id, action, details)
           VALUES (?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            doc.id,
            reviewedBy,
            decision === 'approve' ? 'MANUAL_APPROVE' : 'MANUAL_REJECT',
            JSON.stringify({ comment })
          ]
        )
      }
    }
  }
}

module.exports = new AdminKYCService()
