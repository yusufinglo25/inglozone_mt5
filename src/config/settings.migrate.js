const db = require('./db')

async function columnExists(tableName, columnName) {
  const [rows] = await db.promise().query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  )
  return rows[0].count > 0
}

async function tableExists(tableName) {
  const [rows] = await db.promise().query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  )
  return rows[0].count > 0
}

async function runSettingsMigrations() {
  try {
    const usersReady = await tableExists('users')
    if (!usersReady) {
      setTimeout(runSettingsMigrations, 3000)
      return
    }

    await db.promise().query(
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        jwt_id VARCHAR(128) NOT NULL UNIQUE,
        token_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_sessions_user_id (user_id),
        INDEX idx_user_sessions_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )

    const userColumns = [
      { name: 'two_fa_secret_encrypted', type: 'TEXT NULL' },
      { name: 'two_fa_secret_iv', type: 'VARCHAR(64) NULL' },
      { name: 'two_fa_temp_secret_encrypted', type: 'TEXT NULL' },
      { name: 'two_fa_temp_secret_iv', type: 'VARCHAR(64) NULL' },
      { name: 'two_fa_temp_expires_at', type: 'TIMESTAMP NULL DEFAULT NULL' }
    ]

    for (const column of userColumns) {
      const exists = await columnExists('users', column.name)
      if (!exists) {
        await db.promise().query(
          `ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`
        )
      }
    }

    console.log('Settings migrations ready')
  } catch (error) {
    console.error('Error running settings migrations:', error.message)
  }
}

module.exports = runSettingsMigrations
