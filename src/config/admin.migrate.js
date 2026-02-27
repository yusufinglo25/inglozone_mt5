const db = require('./db')
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

const adminMigrateLogFile = path.join(__dirname, '../../tmp/admin-migrate.log')
function logAdminMigrate(message, error = null) {
  try {
    const ts = new Date().toISOString()
    const errText = error
      ? ` | error=${error.message || ''} | code=${error.code || ''} | errno=${error.errno || ''} | sqlState=${error.sqlState || ''}`
      : ''
    fs.mkdirSync(path.dirname(adminMigrateLogFile), { recursive: true })
    fs.appendFileSync(adminMigrateLogFile, `[${ts}] ${message}${errText}\n`)
  } catch (e) {
    // no-op
  }
}

async function tableExists(tableName) {
  const [rows] = await db.promise().query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  )
  return rows[0].count > 0
}

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

async function runAdminMigrations() {
  try {
    logAdminMigrate('runAdminMigrations started')
    const coreQueries = [
      `CREATE TABLE IF NOT EXISTS admin_users (
        id VARCHAR(36) PRIMARY KEY,
        zoho_user_id VARCHAR(128) UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NULL,
        department VARCHAR(120),
        role ENUM('superadmin', 'admin', 'accounts') NOT NULL DEFAULT 'accounts',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_admin_role (role),
        INDEX idx_admin_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS admin_sessions (
        id VARCHAR(36) PRIMARY KEY,
        admin_user_id VARCHAR(36) NOT NULL,
        jwt_id VARCHAR(128) NOT NULL UNIQUE,
        session_token_hash VARCHAR(255) NOT NULL,
        zoho_access_token TEXT,
        zoho_refresh_token TEXT,
        zoho_expires_at TIMESTAMP NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admin_session_admin (admin_user_id),
        INDEX idx_admin_session_exp (expires_at),
        CONSTRAINT fk_admin_sessions_admin
          FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS user_roles (
        id VARCHAR(36) PRIMARY KEY,
        zoho_user_id VARCHAR(128) UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        role ENUM('superadmin', 'admin', 'accounts') NOT NULL DEFAULT 'accounts',
        updated_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_roles_role (role),
        CONSTRAINT fk_user_roles_updated_by
          FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS user_access_control (
        id VARCHAR(36) PRIMARY KEY,
        zoho_user_id VARCHAR(128) UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        login_access_status ENUM('allowed', 'blocked') NOT NULL DEFAULT 'allowed',
        updated_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_access_status (login_access_status),
        CONSTRAINT fk_user_access_updated_by
          FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ]

    for (let i = 0; i < coreQueries.length; i += 1) {
      await db.promise().query(coreQueries[i])
      logAdminMigrate(`core query ${i + 1}/${coreQueries.length} executed`)
    }

    // Always seed superadmin once admin_users exists.
    if (await tableExists('admin_users')) {
      await seedAdminUsers()
      logAdminMigrate('seedAdminUsers completed')
    }

    // These tables depend on users table existing.
    const usersReady = await tableExists('users')
    if (!usersReady) {
      console.log('Admin migrations waiting for users table...')
      logAdminMigrate('users table not ready, scheduling retry in 3s')
      setTimeout(runAdminMigrations, 3000)
      return
    }

    const userDependentQueries = [
      `CREATE TABLE IF NOT EXISTS risk_profiles (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL UNIQUE,
        risk_input ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
        risk_score INT DEFAULT 0,
        aml_status ENUM('clear', 'review', 'blocked') NOT NULL DEFAULT 'review',
        notes TEXT,
        updated_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_risk_input (risk_input),
        INDEX idx_aml_status (aml_status),
        CONSTRAINT fk_risk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_risk_updated_by
          FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

      `CREATE TABLE IF NOT EXISTS kyc_records (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL UNIQUE,
        customer_name VARCHAR(255),
        email VARCHAR(255) NOT NULL,
        country VARCHAR(100),
        kyc_status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
        aml_status ENUM('clear', 'review', 'blocked') NOT NULL DEFAULT 'review',
        full_kyc_details JSON,
        reviewed_by VARCHAR(36),
        reviewed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_kyc_record_status (kyc_status),
        INDEX idx_kyc_record_email (email),
        CONSTRAINT fk_kyc_record_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_kyc_record_reviewer
          FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ]

    for (let i = 0; i < userDependentQueries.length; i += 1) {
      await db.promise().query(userDependentQueries[i])
      logAdminMigrate(`dependent query ${i + 1}/${userDependentQueries.length} executed`)
    }

    const hasPasswordHash = await columnExists('admin_users', 'password_hash')
    if (!hasPasswordHash) {
      await db.promise().query(
        `ALTER TABLE admin_users ADD COLUMN password_hash VARCHAR(255) NULL`
      )
    }

    console.log('Admin migrations ready')
    logAdminMigrate('Admin migrations ready')
  } catch (error) {
    console.error('Error running admin migrations:', error.message)
    logAdminMigrate('Error running admin migrations, scheduling retry in 5s', error)
    setTimeout(runAdminMigrations, 5000)
  }
}

async function seedAdminUsers() {
  logAdminMigrate('seedAdminUsers started')
  const forcedSuperAdminEmail = 'yusuf.inglo@gmail.com'
  const adminEmails = [forcedSuperAdminEmail, ...(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)]
  const uniqueAdminEmails = [...new Set(adminEmails)]

  if (uniqueAdminEmails.length === 0) {
    return
  }

  const bootstrapPassword = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD || ''
  const forceBootstrapUpdate = String(process.env.SUPERADMIN_BOOTSTRAP_FORCE || '').toLowerCase() === 'true'

  // Always ensure forced superadmin exists (idempotent upsert).
  await db.promise().query(
    `INSERT INTO admin_users (id, full_name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, NULL, 'superadmin', true)
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       role = 'superadmin',
       is_active = true,
       updated_at = NOW()`,
    [uuidv4(), forcedSuperAdminEmail.split('@')[0], forcedSuperAdminEmail]
  )
  logAdminMigrate(`superadmin upserted: ${forcedSuperAdminEmail}`)

  // Set/rotate superadmin password hash only from env, never plain text in DB/code.
  if (bootstrapPassword) {
    const [superRows] = await db.promise().query(
      `SELECT id, password_hash FROM admin_users WHERE email = ? LIMIT 1`,
      [forcedSuperAdminEmail]
    )
    if (superRows.length > 0 && (!superRows[0].password_hash || forceBootstrapUpdate)) {
      const passwordHash = await bcrypt.hash(bootstrapPassword, 10)
      await db.promise().query(
        `UPDATE admin_users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
        [passwordHash, superRows[0].id]
      )
      logAdminMigrate('superadmin password hash set/updated from env')
    }
  }

  // Ensure additional admin emails exist.
  for (const email of uniqueAdminEmails) {
    if (email === forcedSuperAdminEmail) continue
    await db.promise().query(
      `INSERT INTO admin_users (id, full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, NULL, 'admin', true)
       ON DUPLICATE KEY UPDATE
         is_active = true,
         updated_at = NOW()`,
      [uuidv4(), email.split('@')[0], email]
    )
    logAdminMigrate(`admin upserted: ${email}`)
  }
}

module.exports = runAdminMigrations
