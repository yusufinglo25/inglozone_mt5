const crypto = require('crypto')

function deriveKey(keySource = '') {
  return crypto.createHash('sha256').update(String(keySource || '')).digest()
}

function encryptSecret(plainText, keySource) {
  const normalized = String(plainText || '')
  if (!normalized) {
    return { encrypted: null, iv: null }
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(keySource), iv)
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
    iv: iv.toString('hex')
  }
}

function decryptSecret(encryptedBase64, ivHex, keySource) {
  if (!encryptedBase64 || !ivHex) return null

  const raw = Buffer.from(encryptedBase64, 'base64')
  const authTag = raw.subarray(raw.length - 16)
  const encrypted = raw.subarray(0, raw.length - 16)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(keySource),
    Buffer.from(ivHex, 'hex')
  )
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

module.exports = {
  encryptSecret,
  decryptSecret
}
