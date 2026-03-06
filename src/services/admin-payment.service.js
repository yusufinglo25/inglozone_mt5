const crypto = require('crypto')
const fs = require('fs')
const db = require('../config/db')
const walletService = require('./wallet.service')
const { v4: uuidv4 } = require('uuid')

class AdminPaymentService {
  maskSecret(secretValue) {
    const value = String(secretValue || '')
    if (!value) return null
    if (value.length <= 8) return '********'
    return `${value.slice(0, 4)}********${value.slice(-4)}`
  }

  encryptionKey() {
    return crypto.createHash('sha256')
      .update(process.env.PAYMENT_SECRET_ENCRYPTION_KEY || process.env.JWT_SECRET || 'payment-secret-key')
      .digest()
  }

  encryptSecret(plainText) {
    if (!plainText) return { encrypted: null, iv: null }
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return {
      encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
      iv: iv.toString('hex')
    }
  }

  decryptSecret(encryptedBase64, ivHex) {
    if (!encryptedBase64 || !ivHex) return null
    const raw = Buffer.from(encryptedBase64, 'base64')
    const authTag = raw.subarray(raw.length - 16)
    const encrypted = raw.subarray(0, raw.length - 16)
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  }

  async getGateways() {
    const [rows] = await db.promise().query(
      `SELECT id, gateway_code, is_enabled, public_key, secret_key_encrypted, secret_key_iv, extra_config, updated_at
       FROM payment_gateway_configs
       ORDER BY gateway_code ASC`
    )

    const map = new Map(rows.map((row) => [row.gateway_code, row]))
    const allCodes = ['stripe', 'tamara', 'razorpay']

    return allCodes.map((gatewayCode) => {
      const row = map.get(gatewayCode)
      const rawExtra = row?.extra_config
      const extraConfig = typeof rawExtra === 'string'
        ? (() => {
            try { return JSON.parse(rawExtra) } catch (error) { return {} }
          })()
        : (rawExtra || {})

      const envPublicKey = gatewayCode === 'stripe'
        ? (process.env.STRIPE_PUBLISHABLE_KEY || null)
        : gatewayCode === 'razorpay'
          ? (process.env.RAZORPAY_KEY_ID || null)
          : null
      const envSecret = gatewayCode === 'stripe'
        ? (process.env.STRIPE_SECRET_KEY || null)
        : gatewayCode === 'tamara'
          ? (process.env.TAMARA_API_TOKEN || null)
          : gatewayCode === 'razorpay'
            ? (process.env.RAZORPAY_KEY_SECRET || null)
            : null

      const savedSecret = row?.secret_key_encrypted && row?.secret_key_iv
        ? this.decryptSecret(row.secret_key_encrypted, row.secret_key_iv)
        : null

      return {
        gatewayCode,
        isEnabled: row ? Boolean(row.is_enabled) : false,
        publicKey: row?.public_key || envPublicKey,
        secretKeyMasked: this.maskSecret(savedSecret || envSecret),
        source: row ? 'database' : 'env_fallback',
        updatedAt: row?.updated_at || null,
        extraConfig
      }
    })
  }

  async updateGateway({ gatewayCode, isEnabled, publicKey, secretKey, extraConfig, updatedBy }) {
    const normalized = String(gatewayCode || '').trim().toLowerCase()
    if (!['stripe', 'tamara', 'razorpay'].includes(normalized)) {
      throw new Error('Invalid gateway code')
    }

    const [rows] = await db.promise().query(
      `SELECT id FROM payment_gateway_configs WHERE gateway_code = ? LIMIT 1`,
      [normalized]
    )

    const encrypted = this.encryptSecret(secretKey)
    const configJson = extraConfig ? JSON.stringify(extraConfig) : null

    if (rows.length > 0) {
      await db.promise().query(
        `UPDATE payment_gateway_configs
         SET is_enabled = COALESCE(?, is_enabled),
             public_key = COALESCE(?, public_key),
             secret_key_encrypted = COALESCE(?, secret_key_encrypted),
             secret_key_iv = COALESCE(?, secret_key_iv),
             extra_config = COALESCE(?, extra_config),
             updated_by = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          typeof isEnabled === 'boolean' ? isEnabled : null,
          publicKey || null,
          encrypted.encrypted,
          encrypted.iv,
          configJson,
          updatedBy,
          rows[0].id
        ]
      )
    } else {
      await db.promise().query(
        `INSERT INTO payment_gateway_configs
         (id, gateway_code, is_enabled, public_key, secret_key_encrypted, secret_key_iv, extra_config, updated_by)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized,
          typeof isEnabled === 'boolean' ? isEnabled : false,
          publicKey || null,
          encrypted.encrypted,
          encrypted.iv,
          configJson,
          updatedBy
        ]
      )
    }

    const gateways = await this.getGateways()
    return gateways.find((item) => item.gatewayCode === normalized)
  }

  async listBankAccounts() {
    const [rows] = await db.promise().query(
      `SELECT
         ba.id, ba.country_code AS countryCode, ba.is_enabled AS isEnabled, ba.updated_at AS updatedAt,
         baf.id AS fieldId, baf.field_label AS fieldLabel, baf.display_order AS displayOrder,
         baf.field_value_encrypted AS fieldValueEncrypted, baf.field_value_iv AS fieldValueIv
       FROM bank_accounts ba
       LEFT JOIN bank_account_fields baf ON baf.bank_account_id = ba.id
       ORDER BY ba.country_code ASC, baf.display_order ASC, baf.created_at ASC`
    )

    const map = new Map()
    for (const row of rows) {
      if (!map.has(row.id)) {
        map.set(row.id, {
          id: row.id,
          countryCode: row.countryCode,
          isEnabled: Boolean(row.isEnabled),
          updatedAt: row.updatedAt,
          fields: []
        })
      }
      if (row.fieldId) {
        map.get(row.id).fields.push({
          id: row.fieldId,
          label: row.fieldLabel,
          value: this.decryptSecret(row.fieldValueEncrypted, row.fieldValueIv),
          displayOrder: row.displayOrder
        })
      }
    }

    return Array.from(map.values())
  }

  async upsertBankAccount({ id = null, countryCode, isEnabled = true, fields = [], updatedBy }) {
    const normalizedCountry = String(countryCode || '').trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
      throw new Error('countryCode must be ISO-2 format')
    }
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('At least one bank field is required')
    }
    if (fields.length > 6) {
      throw new Error('Maximum 6 bank account fields are allowed')
    }

    let bankAccountId = id
    if (bankAccountId) {
      await db.promise().query(
        `UPDATE bank_accounts
         SET country_code = ?, is_enabled = ?, updated_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [normalizedCountry, Boolean(isEnabled), updatedBy, bankAccountId]
      )
    } else {
      const [existing] = await db.promise().query(
        `SELECT id FROM bank_accounts WHERE country_code = ? LIMIT 1`,
        [normalizedCountry]
      )
      if (existing.length > 0) {
        bankAccountId = existing[0].id
        await db.promise().query(
          `UPDATE bank_accounts
           SET is_enabled = ?, updated_by = ?, updated_at = NOW()
           WHERE id = ?`,
          [Boolean(isEnabled), updatedBy, bankAccountId]
        )
      } else {
        bankAccountId = uuidv4()
        await db.promise().query(
          `INSERT INTO bank_accounts (id, country_code, is_enabled, updated_by)
           VALUES (?, ?, ?, ?)`,
          [bankAccountId, normalizedCountry, Boolean(isEnabled), updatedBy]
        )
      }
    }

    await db.promise().query(`DELETE FROM bank_account_fields WHERE bank_account_id = ?`, [bankAccountId])
    for (let i = 0; i < fields.length; i += 1) {
      const label = String(fields[i]?.label || '').trim()
      const value = String(fields[i]?.value || '').trim()
      if (!label || !value) throw new Error('Bank field label/value are required')
      const encrypted = this.encryptSecret(value)
      await db.promise().query(
        `INSERT INTO bank_account_fields
         (id, bank_account_id, field_label, field_value_encrypted, field_value_iv, display_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), bankAccountId, label, encrypted.encrypted, encrypted.iv, i + 1]
      )
    }

    const all = await this.listBankAccounts()
    return all.find((item) => item.id === bankAccountId)
  }

  async deleteBankAccount(id) {
    await db.promise().query(`DELETE FROM bank_accounts WHERE id = ?`, [id])
    return { success: true }
  }

  async getReviewingBankTransfers({ page = 1, limit = 20 }) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)
    const safePage = Math.max(parseInt(page, 10) || 1, 1)
    const offset = (safePage - 1) * safeLimit

    const [rows] = await db.promise().query(
      `SELECT
         t.id, t.user_id AS userId, t.amount, t.currency, t.status, t.country_code AS countryCode,
         t.created_at AS createdAt, t.updated_at AS updatedAt,
         u.email,
         btp.id AS proofId, btp.file_path AS proofPath, btp.original_filename AS originalFilename,
         btp.mime_type AS mimeType, btp.uploaded_at AS uploadedAt
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN bank_transfer_proofs btp
         ON btp.transaction_id = t.id
        AND btp.deleted_at IS NULL
       WHERE t.payment_provider = 'bank_transfer'
         AND t.status = 'Reviewing'
       ORDER BY t.updated_at DESC
       LIMIT ? OFFSET ?`,
      [safeLimit, offset]
    )

    const [[countRow]] = await db.promise().query(
      `SELECT COUNT(*) AS total
       FROM transactions
       WHERE payment_provider = 'bank_transfer'
         AND status = 'Reviewing'`
    )

    return {
      transactions: rows,
      total: countRow.total,
      page: safePage,
      limit: safeLimit
    }
  }

  async getBankTransferDetails(transactionId) {
    const [rows] = await db.promise().query(
      `SELECT
         t.*,
         u.email, u.first_name AS firstName, u.last_name AS lastName,
         btp.id AS proofId, btp.file_path AS proofPath, btp.original_filename AS originalFilename,
         btp.mime_type AS mimeType, btp.file_size AS fileSize, btp.uploaded_at AS uploadedAt
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN bank_transfer_proofs btp
         ON btp.transaction_id = t.id
        AND btp.deleted_at IS NULL
       WHERE t.id = ?
         AND t.payment_provider = 'bank_transfer'
       LIMIT 1`,
      [transactionId]
    )

    if (rows.length === 0) {
      throw new Error('Bank transfer transaction not found')
    }

    return rows[0]
  }

  async approveBankTransfer(transactionId, adminId) {
    const details = await this.getBankTransferDetails(transactionId)
    if (details.status !== 'Reviewing') {
      throw new Error('Only Reviewing transactions can be approved')
    }

    await walletService.markTransactionCompleted(transactionId, `bank_transfer:${transactionId}`)

    await db.promise().query(
      `UPDATE transactions
       SET reviewed_by = ?,
           reviewed_at = NOW(),
           review_reason = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [adminId, transactionId]
    )
    return { success: true }
  }

  async rejectBankTransfer(transactionId, adminId, reason) {
    const trimmedReason = String(reason || '').trim()
    if (trimmedReason.length < 5) {
      throw new Error('Rejection reason is required')
    }
    const details = await this.getBankTransferDetails(transactionId)
    if (!['Pending', 'Reviewing'].includes(details.status)) {
      throw new Error('Only Pending/Reviewing transactions can be rejected')
    }

    await db.promise().query(
      `UPDATE transactions
       SET status = 'Rejected',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [adminId, trimmedReason, transactionId]
    )

    if (details.proofId && details.proofPath) {
      try {
        await fs.promises.unlink(details.proofPath)
      } catch (error) {
        // no-op when file already removed
      }
      await db.promise().query(
        `UPDATE bank_transfer_proofs
         SET deleted_at = NOW()
         WHERE id = ?`,
        [details.proofId]
      )
    }

    return { success: true }
  }
}

module.exports = new AdminPaymentService()
