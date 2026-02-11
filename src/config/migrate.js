const db = require('./db')

const runMigrations = () => {
  console.log('Starting database migrations...')

  // Create tables without foreign keys first
  const userTable = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      mobile VARCHAR(20),
      google_id VARCHAR(255),
      is_2fa_enabled BOOLEAN DEFAULT false,
      profile_completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  // Create basic tables first
  const tables = [
    { sql: userTable, name: 'users' },
    { 
      sql: `CREATE TABLE IF NOT EXISTS trading_accounts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        mode ENUM('REAL','DEMO'),
        type VARCHAR(50),
        currency VARCHAR(10),
        leverage VARCHAR(10),
        status VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      name: 'trading_accounts'
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS otp_verifications (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        purpose ENUM('registration', 'password_reset', 'email_change') DEFAULT 'registration',
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 3,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_purpose (email, purpose),
        INDEX idx_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      name: 'otp_verifications'
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS otp_daily_limits (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        count INT DEFAULT 0,
        UNIQUE KEY unique_email_date (email, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      name: 'otp_daily_limits'
    }
  ]

  // Create basic tables first
  let completed = 0
  tables.forEach(({ sql, name }) => {
    db.query(sql, (err) => {
      if (err) {
        console.error(`❌ Error creating ${name} table:`, err.message)
      } else {
        console.log(`✅ ${name} table ready`)
      }
      completed++
      
      if (completed === tables.length) {
        // Now create wallet tables (after users table exists)
        createWalletTables()
      }
    })
  })
}

function createWalletTables() {
  console.log('Creating wallet tables...')
  
  // Create wallets table WITHOUT foreign key first
  const walletTable = `
    CREATE TABLE IF NOT EXISTS wallets (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      balance DECIMAL(15, 2) DEFAULT 0.00,
      currency VARCHAR(10) DEFAULT 'USD',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_wallet (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  // Create transactions table WITHOUT foreign keys first
  const transactionsTable = `
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      wallet_id VARCHAR(36),
      type ENUM('deposit', 'withdrawal', 'trade_profit', 'trade_loss', 'bonus', 'fee') NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
      stripe_payment_id VARCHAR(255),
      stripe_session_id VARCHAR(255),
      description TEXT,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status),
      INDEX idx_type (type),
      INDEX idx_stripe_id (stripe_payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  // Create wallets table
  db.query(walletTable, (err) => {
    if (err) {
      console.error('❌ Error creating wallet table:', err.message)
    } else {
      console.log('✅ Wallet table ready')
    }
    
    // Create transactions table
    db.query(transactionsTable, (err) => {
      if (err) {
        console.error('❌ Error creating transactions table:', err.message)
      } else {
        console.log('✅ Transactions table ready')
        
        // Now add foreign keys if they don't exist
        addForeignKeys()
        
        // Create KYC tables after wallet tables
        createKYCTables()
      }
    })
  })
}

function addForeignKeys() {
  console.log('Adding foreign keys...')
  
  // Add foreign key to wallets table
  db.query(`
    SELECT COUNT(*) as exists_flag 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'wallets' 
    AND CONSTRAINT_NAME = 'wallets_ibfk_1'
  `, (err, results) => {
    if (!err && results[0].exists_flag === 0) {
      db.query(`
        ALTER TABLE wallets 
        ADD CONSTRAINT wallets_ibfk_1 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `, (alterErr) => {
        if (alterErr) {
          console.log('ℹ️ Could not add foreign key to wallets:', alterErr.message)
        } else {
          console.log('✅ Added foreign key to wallets table')
        }
      })
    }
  })
  
  // Add foreign keys to transactions table
  setTimeout(() => {
    // Check and add user_id foreign key
    db.query(`
      SELECT COUNT(*) as exists_flag 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE CONSTRAINT_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'transactions' 
      AND CONSTRAINT_NAME = 'transactions_ibfk_1'
    `, (err, results) => {
      if (!err && results[0].exists_flag === 0) {
        db.query(`
          ALTER TABLE transactions 
          ADD CONSTRAINT transactions_ibfk_1 
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        `, (alterErr) => {
          if (alterErr) {
            console.log('ℹ️ Could not add user_id foreign key to transactions:', alterErr.message)
          } else {
            console.log('✅ Added user_id foreign key to transactions')
          }
        })
      }
    })
    
    // Check and add wallet_id foreign key
    setTimeout(() => {
      db.query(`
        SELECT COUNT(*) as exists_flag 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND CONSTRAINT_NAME = 'transactions_ibfk_2'
      `, (err, results) => {
        if (!err && results[0].exists_flag === 0) {
          db.query(`
            ALTER TABLE transactions 
            ADD CONSTRAINT transactions_ibfk_2 
            FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL
          `, (alterErr) => {
            if (alterErr) {
              console.log('ℹ️ Could not add wallet_id foreign key to transactions:', alterErr.message)
            } else {
              console.log('✅ Added wallet_id foreign key to transactions')
            }
          })
        }
      })
    }, 1000)
  }, 1000)
  
  // Add missing columns to users table
  setTimeout(() => {
    console.log('Checking for missing columns in users table...')
    const addColumns = [
      { name: 'is_verified', type: 'BOOLEAN DEFAULT false' },
      { name: 'password_set', type: 'BOOLEAN DEFAULT true' },
      { name: 'avatar_url', type: 'VARCHAR(500) DEFAULT NULL' },
      { name: 'provider', type: 'VARCHAR(50) DEFAULT "local"' },
      { name: 'email_verified', type: 'BOOLEAN DEFAULT false' },
      { name: 'verified_at', type: 'TIMESTAMP DEFAULT NULL' }
    ]
    
    checkAndAddColumns(addColumns, 0)
  }, 2000)
}

function createKYCTables() {
  console.log('Creating KYC tables...')
  
  const kycTable = `
    CREATE TABLE IF NOT EXISTS kyc_documents (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      document_type ENUM('passport', 'national_id') NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      encrypted_file_path VARCHAR(500) NOT NULL,
      iv VARCHAR(64) NOT NULL,
      auth_tag VARCHAR(64) NOT NULL,
      status ENUM('PENDING', 'AUTO_VERIFIED', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
      extracted_data JSON,
      auto_score INT DEFAULT 0,
      admin_comment TEXT,
      reviewed_by VARCHAR(36),
      reviewed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  const auditTable = `
    CREATE TABLE IF NOT EXISTS kyc_audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      kyc_document_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      action ENUM('UPLOAD', 'AUTO_VERIFY', 'MANUAL_APPROVE', 'MANUAL_REJECT', 'DELETE') NOT NULL,
      details JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_kyc_document_id (kyc_document_id),
      INDEX idx_user_id (user_id),
      INDEX idx_action (action),
      FOREIGN KEY (kyc_document_id) REFERENCES kyc_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  // Create kyc_documents table
db.query(kycTable, (err) => {
  if (err) {
    console.error('❌ Error creating kyc_documents table:', err.message)
  } else {
    console.log('✅ kyc_documents table ready')
    
    // Create audit logs table
    db.query(auditTable, (err) => {
      if (err) {
        console.error('❌ Error creating kyc_audit_logs table:', err.message)
      } else {
        console.log('✅ kyc_audit_logs table ready')
        
        // Create KYC profile tables
        createKYCProfileTables()
      }
    })
  }
})
}

function createKYCProfileTables() {
  console.log('Creating KYC profile tables...')
  
  const kycProfileTable = `
    CREATE TABLE IF NOT EXISTS kyc_profiles (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      
      -- Personal Information
      date_of_birth DATE,
      place_of_birth VARCHAR(100),
      gender ENUM('male', 'female', 'other') DEFAULT 'other',
      nationality VARCHAR(100),
      country_of_residence VARCHAR(100),
      address_line1 VARCHAR(255),
      address_line2 VARCHAR(255),
      city VARCHAR(100),
      state VARCHAR(100),
      postal_code VARCHAR(20),
      country VARCHAR(100),
      phone_number VARCHAR(20),
      mobile_number VARCHAR(20),
      
      -- Employment & Financial Information
      employment_status ENUM('employed', 'self_employed', 'unemployed', 'retired', 'student') DEFAULT 'employed',
      occupation VARCHAR(100),
      employer_name VARCHAR(100),
      employer_address VARCHAR(255),
      employer_phone VARCHAR(20),
      years_in_employment INT DEFAULT 0,
      monthly_income DECIMAL(15, 2) DEFAULT 0.00,
      annual_income DECIMAL(15, 2) DEFAULT 0.00,
      income_currency VARCHAR(10) DEFAULT 'USD',
      source_of_funds ENUM('salary', 'business', 'investments', 'inheritance', 'savings', 'other') DEFAULT 'salary',
      other_source_of_funds VARCHAR(255),
      
      -- Financial Experience
      trading_experience_years INT DEFAULT 0,
      trading_experience_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'beginner',
      investment_knowledge ENUM('none', 'basic', 'good', 'excellent') DEFAULT 'basic',
      risk_tolerance ENUM('low', 'medium', 'high') DEFAULT 'medium',
      
      -- Regulatory & Compliance
      politically_exposed_person BOOLEAN DEFAULT false,
      pep_details TEXT,
      us_citizen_or_resident BOOLEAN DEFAULT false,
      tax_identification_number VARCHAR(50),
      social_security_number VARCHAR(50),
      
      -- Account Purpose
      account_purpose ENUM('investment', 'savings', 'trading', 'hedging', 'speculation', 'other') DEFAULT 'trading',
      other_account_purpose VARCHAR(255),
      estimated_annual_deposit DECIMAL(15, 2) DEFAULT 0.00,
      estimated_annual_withdrawal DECIMAL(15, 2) DEFAULT 0.00,
      
      -- Additional Documents
      proof_of_address_uploaded BOOLEAN DEFAULT false,
      proof_of_income_uploaded BOOLEAN DEFAULT false,
      
      -- Status & Verification
      profile_status ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT',
      submitted_at TIMESTAMP NULL,
      reviewed_by VARCHAR(36),
      reviewed_at TIMESTAMP NULL,
      review_notes TEXT,
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY unique_user_profile (user_id),
      INDEX idx_profile_status (profile_status),
      INDEX idx_created_at (created_at),
      
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `
  
  // Create kyc_profiles table
  db.query(kycProfileTable, (err) => {
    if (err) {
      console.error('❌ Error creating kyc_profiles table:', err.message)
    } else {
      console.log('✅ kyc_profiles table ready')
    }
  })
}
// Helper function to check and add columns one by one
function checkAndAddColumns(columns, index) {
  if (index >= columns.length) {
    console.log('✅ All user table columns verified')
    
    // Clean up expired OTPs
    setTimeout(() => {
      db.query('DELETE FROM otp_verifications WHERE expires_at < NOW()', (err) => {
        if (err) console.error('Error cleaning expired OTPs:', err.message)
        else console.log('✅ Expired OTPs cleaned up')
        
        console.log('🎉 All migrations completed successfully!')
      })
    }, 1000)
    
    return
  }
  
  const column = columns[index]
  
  // Check if column exists
  db.query(
    `SELECT COUNT(*) as exists_flag 
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'users' 
     AND COLUMN_NAME = ?`,
    [column.name],
    (err, results) => {
      if (err) {
        console.error(`Error checking column ${column.name}:`, err.message)
        checkAndAddColumns(columns, index + 1)
        return
      }
      
      const columnExists = results[0].exists_flag > 0
      
      if (!columnExists) {
        db.query(
          `ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`,
          (alterErr) => {
            if (alterErr) {
              console.error(`Error adding column ${column.name}:`, alterErr.message)
            } else {
              console.log(`✅ Column ${column.name} added successfully`)
            }
            checkAndAddColumns(columns, index + 1)
          }
        )
      } else {
        console.log(`✅ Column ${column.name} already exists`)
        checkAndAddColumns(columns, index + 1)
      }
    }
  )
}

module.exports = runMigrations