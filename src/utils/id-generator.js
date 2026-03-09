const USER_ID_START = 25110
const TX_PREFIX = 'ING'
const TX_DIGITS = 12

const isDigitsOnly = (value) => /^\d+$/.test(String(value || '').trim())

async function getNextUserId(db) {
  const [rows] = await db.promise().query(
    `SELECT MAX(CAST(id AS UNSIGNED)) AS max_id
     FROM users
     WHERE id REGEXP '^[0-9]+$'`
  )

  const maxId = Number(rows[0]?.max_id || 0)
  const next = maxId >= USER_ID_START ? maxId + 1 : USER_ID_START
  return String(next)
}

function buildRandomTxId() {
  let suffix = ''
  for (let i = 0; i < TX_DIGITS; i += 1) {
    suffix += Math.floor(Math.random() * 10)
  }
  return `${TX_PREFIX}${suffix}`
}

async function generateUniqueTransactionId(db, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildRandomTxId()
    const [rows] = await db.promise().query(
      `SELECT id FROM transactions WHERE id = ? LIMIT 1`,
      [candidate]
    )
    if (rows.length === 0) return candidate
  }

  throw new Error('Failed to generate unique transaction id')
}

module.exports = {
  USER_ID_START,
  TX_PREFIX,
  TX_DIGITS,
  isDigitsOnly,
  getNextUserId,
  generateUniqueTransactionId
}
