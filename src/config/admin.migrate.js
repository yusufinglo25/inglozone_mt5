const db = require('./db')
const { v4: uuidv4 } = require('uuid')

async function tableExists(tableName) {
  const [rows] = await db.promise().query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  )
  return rows[0].count > 0
}

async function runAdminMigrations() {
  try {
    const queries = [
      `CREATE TABLE IF NOT EXISTS admin_users (
        id VARCHAR(36) PRIMARY KEY,
        zoho_user_id VARCHAR(128) UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

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

    for (const query of queries) {
      await db.promise().query(query)
    }

    if (await tableExists('admin_users')) {
      await seedAdminUsers()
    }

    console.log('Admin migrations ready')
  } catch (error) {
    console.error('Error running admin migrations:', error.message)
  }
}

async function seedAdminUsers() {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length === 0) {
    return
  }

  for (let i = 0; i < adminEmails.length; i += 1) {
    const email = adminEmails[i]
    const [rows] = await db.promise().query(
      `SELECT id FROM admin_users WHERE email = ? LIMIT 1`,
      [email]
    )

    if (rows.length > 0) {
      continue
    }

    const id = uuidv4()
    const role = i === 0 ? 'superadmin' : 'admin'
    await db.promise().query(
      `INSERT INTO admin_users (id, full_name, email, role, is_active)
       VALUES (?, ?, ?, ?, true)`,
      [id, email.split('@')[0], email, role]
    )
  }
}

module.exports = runAdminMigrations
