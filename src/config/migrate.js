const db = require('./db')
const {
  generateUniqueTransactionNumber
} = require('../utils/id-generator')

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
      account_type ENUM('trader','investor') NOT NULL DEFAULT 'trader',
      auth_version INT NOT NULL DEFAULT 1,
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
      transaction_number VARCHAR(15) NULL,
      user_id VARCHAR(36) NOT NULL,
      wallet_id VARCHAR(36),
      type ENUM('deposit', 'withdrawal', 'trade_profit', 'trade_loss', 'bonus', 'fee') NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
      payment_id VARCHAR(255),
      session_id VARCHAR(255),
      description TEXT,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      UNIQUE KEY uk_transaction_number (transaction_number),
      INDEX idx_status (status),
      INDEX idx_type (type),
      INDEX idx_payment_id (payment_id)
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

        // Payment extension tables and columns (Razorpay + Bank Transfer)
        runPaymentMigrations()
        runInvestorMigrations()
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
      { name: 'account_type', type: 'ENUM("trader","investor") NOT NULL DEFAULT "trader"' },
      { name: 'auth_version', type: 'INT NOT NULL DEFAULT 1' },
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
    document_type ENUM('passport', 'national_id', 'national_id_front', 'national_id_back', 'drivers_license', 'residence_permit') NOT NULL,
    document_side ENUM('front', 'back', 'single') DEFAULT 'single',
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
    INDEX idx_document_side (document_side),
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
      
      -- Phone Numbers with Country Codes (NEW)
      primary_phone_country_code VARCHAR(5) DEFAULT '+1',
      primary_phone_number VARCHAR(20),
      secondary_phone_country_code VARCHAR(5),
      secondary_phone_number VARCHAR(20),
      
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
      
      -- Additional Documents (UPDATED)
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
      console.log('✅ kyc_profiles table ready with phone country codes')
    }
  })
}

// Add this function after createKYCProfileTables()

function addMissingKYCDocumentColumns() {
  console.log('Checking for missing columns in kyc_documents table...')
  
  const addColumns = [
    { name: 'document_side', type: "ENUM('front', 'back', 'single') DEFAULT 'single'" }
  ]
  
  checkAndAddKYCDocumentColumns(addColumns, 0)
}

function checkAndAddKYCDocumentColumns(columns, index) {
  if (index >= columns.length) {
    console.log('✅ All kyc_documents table columns verified')
    
    // Update existing records
    db.query(
      `UPDATE kyc_documents SET document_side = 'single' WHERE document_side IS NULL`,
      (err) => {
        if (err) console.error('Error updating document_side:', err.message)
        else console.log('✅ Existing documents updated with default side')
      }
    )
    
    return
  }
  
  const column = columns[index]
  
  db.query(
    `SELECT COUNT(*) as exists_flag 
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'kyc_documents' 
     AND COLUMN_NAME = ?`,
    [column.name],
    (err, results) => {
      if (err) {
        console.error(`Error checking column ${column.name}:`, err.message)
        checkAndAddKYCDocumentColumns(columns, index + 1)
        return
      }
      
      const columnExists = results[0].exists_flag > 0
      
      if (!columnExists) {
        db.query(
          `ALTER TABLE kyc_documents ADD COLUMN ${column.name} ${column.type}`,
          (alterErr) => {
            if (alterErr) {
              console.error(`Error adding column ${column.name}:`, alterErr.message)
            } else {
              console.log(`✅ Column ${column.name} added to kyc_documents`)
            }
            checkAndAddKYCDocumentColumns(columns, index + 1)
          }
        )
      } else {
        console.log(`✅ Column ${column.name} already exists in kyc_documents`)
        checkAndAddKYCDocumentColumns(columns, index + 1)
      }
    }
  )
}

function addMissingKYCProfileColumns() {
  console.log('Checking for missing columns in kyc_profiles table...')
  
  const addColumns = [
    { name: 'primary_phone_country_code', type: "VARCHAR(5) DEFAULT '+1'" },
    { name: 'primary_phone_number', type: 'VARCHAR(20)' },
    { name: 'secondary_phone_country_code', type: 'VARCHAR(5)' },
    { name: 'secondary_phone_number', type: 'VARCHAR(20)' }
  ]
  
  checkAndAddKYCProfileColumns(addColumns, 0)
}

function checkAndAddKYCProfileColumns(columns, index) {
  if (index >= columns.length) {
    console.log('✅ All kyc_profiles table columns verified')
    return
  }
  
  const column = columns[index]
  
  db.query(
    `SELECT COUNT(*) as exists_flag 
     FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'kyc_profiles' 
     AND COLUMN_NAME = ?`,
    [column.name],
    (err, results) => {
      if (err) {
        console.error(`Error checking column ${column.name}:`, err.message)
        checkAndAddKYCProfileColumns(columns, index + 1)
        return
      }
      
      const columnExists = results[0].exists_flag > 0
      
      if (!columnExists) {
        db.query(
          `ALTER TABLE kyc_profiles ADD COLUMN ${column.name} ${column.type}`,
          (alterErr) => {
            if (alterErr) {
              console.error(`Error adding column ${column.name}:`, alterErr.message)
            } else {
              console.log(`✅ Column ${column.name} added to kyc_profiles`)
            }
            checkAndAddKYCProfileColumns(columns, index + 1)
          }
        )
      } else {
        console.log(`✅ Column ${column.name} already exists in kyc_profiles`)
        checkAndAddKYCProfileColumns(columns, index + 1)
      }
    }
  )
}

// Update the ENUM for document_type
function updateDocumentTypeEnum() {
  db.query(
    `SHOW COLUMNS FROM kyc_documents LIKE 'document_type'`,
    (err, results) => {
      if (err) {
        console.error('Error checking document_type:', err.message)
        return
      }
      
      if (results.length > 0 && !results[0].Type.includes('national_id_front')) {
        console.log('Updating document_type ENUM...')
        db.query(
          `ALTER TABLE kyc_documents 
           MODIFY COLUMN document_type ENUM('passport', 'national_id', 'national_id_front', 'national_id_back', 'drivers_license', 'residence_permit') NOT NULL`,
          (alterErr) => {
            if (alterErr) {
              console.error('Error updating document_type:', alterErr.message)
            } else {
              console.log('✅ document_type ENUM updated')
            }
          }
        )
      }
    }
  )
}

// Update the createKYCTables function to also check for missing columns
function createKYCTables() {
  console.log('Creating/updating KYC tables...')
  
  const kycTable = `
    CREATE TABLE IF NOT EXISTS kyc_documents (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      document_type ENUM('passport', 'national_id', 'national_id_front', 'national_id_back', 'drivers_license', 'residence_permit') NOT NULL,
      document_side ENUM('front', 'back', 'single') DEFAULT 'single',
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
      INDEX idx_document_side (document_side),
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
      
      // Add missing columns to existing table
      addMissingKYCDocumentColumns()
      
      // Update ENUM
      updateDocumentTypeEnum()
      
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

// Update createKYCProfileTables to also check for missing columns
function createKYCProfileTables() {
  console.log('Creating/updating KYC profile tables...')
  
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
      
      -- Phone Numbers with Country Codes
      primary_phone_country_code VARCHAR(5) DEFAULT '+1',
      primary_phone_number VARCHAR(20),
      secondary_phone_country_code VARCHAR(5),
      secondary_phone_number VARCHAR(20),
      
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
      
      // Add missing columns to existing kyc_profiles table
      addMissingKYCProfileColumns()
    }
  })
}

// Helper function to check and add columns one by one
function checkAndAddColumns(columns, index) {
  if (index >= columns.length) {
    console.log('✅ All user table columns verified')
    
    runPostUserMigrations(() => {
      // Clean up expired OTPs
      setTimeout(() => {
        db.query('DELETE FROM otp_verifications WHERE expires_at < NOW()', (err) => {
          if (err) console.error('Error cleaning expired OTPs:', err.message)
          else console.log('✅ Expired OTPs cleaned up')

          console.log('🎉 All migrations completed successfully!')
        })
      }, 1000)
    })
    
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

function runPaymentMigrations() {
  console.log('Creating/updating payment extension tables...')

  const paymentGatewayConfigTable = `
    CREATE TABLE IF NOT EXISTS payment_gateway_configs (
      id VARCHAR(36) PRIMARY KEY,
      gateway_code ENUM('stripe', 'tamara', 'razorpay') NOT NULL UNIQUE,
      is_enabled BOOLEAN DEFAULT false,
      public_key VARCHAR(255) NULL,
      secret_key_encrypted TEXT NULL,
      secret_key_iv VARCHAR(64) NULL,
      extra_config JSON NULL,
      updated_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_gateway_enabled (is_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  const bankAccountsTable = `
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id VARCHAR(36) PRIMARY KEY,
      country_code CHAR(2) NOT NULL UNIQUE,
      is_enabled BOOLEAN DEFAULT true,
      updated_by VARCHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bank_country_enabled (country_code, is_enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  const bankFieldsTable = `
    CREATE TABLE IF NOT EXISTS bank_account_fields (
      id VARCHAR(36) PRIMARY KEY,
      bank_account_id VARCHAR(36) NOT NULL,
      field_label VARCHAR(100) NOT NULL,
      field_value_encrypted TEXT NOT NULL,
      field_value_iv VARCHAR(64) NOT NULL,
      display_order TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bank_account_fields_bank (bank_account_id),
      CONSTRAINT fk_bank_account_fields_bank
        FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  const bankTransferProofsTable = `
    CREATE TABLE IF NOT EXISTS bank_transfer_proofs (
      id VARCHAR(36) PRIMARY KEY,
      transaction_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NULL,
      file_size INT NULL,
      sha256_hash VARCHAR(64) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      UNIQUE KEY uk_bank_transfer_proof_transaction (transaction_id),
      INDEX idx_bank_transfer_proof_user (user_id),
      CONSTRAINT fk_bank_transfer_proof_tx
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      CONSTRAINT fk_bank_transfer_proof_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  db.query(paymentGatewayConfigTable, (err) => {
    if (err) {
      console.error('Error creating payment_gateway_configs:', err.message)
      return
    }
    db.query(bankAccountsTable, (bankErr) => {
      if (bankErr) {
        console.error('Error creating bank_accounts:', bankErr.message)
        return
      }
      db.query(bankFieldsTable, (fieldsErr) => {
        if (fieldsErr) {
          console.error('Error creating bank_account_fields:', fieldsErr.message)
          return
        }
        db.query(bankTransferProofsTable, (proofErr) => {
          if (proofErr) {
            console.error('Error creating bank_transfer_proofs:', proofErr.message)
            return
          }
          ensureTransactionPaymentColumns()
        })
      })
    })
  })
}

function ensureTransactionPaymentColumns() {
  const transactionColumns = [
    { name: 'transaction_number', type: 'VARCHAR(15) NULL AFTER id' },
    { name: 'payment_id', type: 'VARCHAR(255) NULL AFTER status' },
    { name: 'session_id', type: 'VARCHAR(255) NULL AFTER payment_id' },
    { name: 'payment_provider', type: "ENUM('stripe','tamara','razorpay','bank_transfer') NULL AFTER status" },
    { name: 'payment_method', type: "ENUM('card','bnpl','bank_transfer') NULL AFTER payment_provider" },
    { name: 'country_code', type: 'CHAR(2) NULL AFTER payment_method' },
    { name: 'review_reason', type: 'TEXT NULL AFTER description' },
    { name: 'reviewed_by', type: 'VARCHAR(36) NULL AFTER review_reason' },
    { name: 'reviewed_at', type: 'TIMESTAMP NULL AFTER reviewed_by' }
  ]

  const next = (index) => {
    if (index >= transactionColumns.length) {
      backfillLegacyGatewayColumns()

      db.query(
        `ALTER TABLE transactions
         MODIFY COLUMN status ENUM(
           'pending','completed','failed','cancelled',
           'Pending','Reviewing','Approved','Rejected'
         ) DEFAULT 'Pending'`,
        (enumErr) => {
          if (enumErr) {
            console.error('Error updating transactions.status enum:', enumErr.message)
          } else {
            db.query(
              `CREATE INDEX idx_transactions_provider_status
               ON transactions (payment_provider, status, created_at)`,
              () => {}
            )
            db.query(
              `CREATE INDEX idx_transactions_payment_id
               ON transactions (payment_id)`,
              () => {}
            )
            db.query(
              `CREATE UNIQUE INDEX uk_transactions_transaction_number
               ON transactions (transaction_number)`,
              () => {}
            )
            console.log('Payment transaction columns verified')
          }
        }
      )
      return
    }

    const column = transactionColumns[index]
    db.query(
      `SELECT COUNT(*) AS exists_flag
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'transactions'
         AND COLUMN_NAME = ?`,
      [column.name],
      (err, rows) => {
        if (err) {
          console.error(`Error checking transactions column ${column.name}:`, err.message)
          next(index + 1)
          return
        }
        if (rows[0].exists_flag > 0) {
          next(index + 1)
          return
        }
        db.query(
          `ALTER TABLE transactions ADD COLUMN ${column.name} ${column.type}`,
          (alterErr) => {
            if (alterErr) {
              console.error(`Error adding transactions column ${column.name}:`, alterErr.message)
            }
            next(index + 1)
          }
        )
      }
    )
  }

  next(0)
}

function normalizeUserAndWalletIds(done = () => {}) {
  ;(async () => {
    try {
      const [users] = await db.promise().query(
        `SELECT id, created_at
         FROM users
         ORDER BY created_at ASC, id ASC`
      )

      if (!users.length) {
        done()
        return
      }

      const base = 25110
      const map = users.map((user, index) => ({
        oldId: String(user.id),
        newId: String(base + index)
      }))
      const changed = map.filter((item) => item.oldId !== item.newId)

      await db.promise().query('SET FOREIGN_KEY_CHECKS = 0')

      if (changed.length > 0) {
        const inClause = changed.map((item) => db.escape(item.oldId)).join(', ')
        const caseExpr = changed
          .map((item) => `WHEN ${db.escape(item.oldId)} THEN ${db.escape(item.newId)}`)
          .join(' ')

        const [userIdColumns] = await db.promise().query(
          `SELECT DISTINCT TABLE_NAME
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND COLUMN_NAME = 'user_id'`
        )

        for (const row of userIdColumns) {
          const tableName = row.TABLE_NAME
          if (!tableName || tableName === 'users') continue
          await db.promise().query(
            `UPDATE \`${tableName}\`
             SET user_id = CASE user_id ${caseExpr} ELSE user_id END
             WHERE user_id IN (${inClause})`
          )
        }

        const [reviewedByColumns] = await db.promise().query(
          `SELECT DISTINCT TABLE_NAME
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND COLUMN_NAME = 'reviewed_by'`
        )

        for (const row of reviewedByColumns) {
          const tableName = row.TABLE_NAME
          if (!tableName || tableName === 'users') continue
          await db.promise().query(
            `UPDATE \`${tableName}\`
             SET reviewed_by = CASE reviewed_by ${caseExpr} ELSE reviewed_by END
             WHERE reviewed_by IN (${inClause})`
          )
        }

        await db.promise().query(
          `UPDATE users
           SET id = CASE id ${caseExpr} ELSE id END
           WHERE id IN (${inClause})`
        )
      }

      await db.promise().query(
        `UPDATE wallets
         SET id = user_id
         WHERE id <> user_id`
      )

      await db.promise().query(
        `UPDATE transactions t
         JOIN wallets w ON w.user_id = t.user_id
         SET t.wallet_id = w.id
         WHERE t.wallet_id IS NULL OR t.wallet_id <> w.id`
      )

      await db.promise().query('SET FOREIGN_KEY_CHECKS = 1')
      console.log('User and wallet IDs normalized')
      done()
    } catch (error) {
      db.promise().query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {})
      console.error('Error normalizing user/wallet IDs:', error.message)
      done()
    }
  })()
}

function runInvestorMigrations() {
  const investorAccountsTable = `
    CREATE TABLE IF NOT EXISTS investor_accounts (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL UNIQUE,
      account_status ENUM('pending','active','inactive','rejected') NOT NULL DEFAULT 'pending',
      balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      equity DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      floating_profit_loss DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      total_profit_loss DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
      approved_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_investor_status (account_status),
      CONSTRAINT fk_investor_account_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `

  db.query(investorAccountsTable, (err) => {
    if (err) {
      console.error('Error creating investor_accounts:', err.message)
    } else {
      console.log('Investor accounts table verified')
    }
  })
}

function runPostUserMigrations(done = () => {}) {
  normalizeUserAndWalletIds(async () => {
    try {
      await ensureMigrationRunsTable()
      await runOneTimeMigration('existing_users_set_account_type_trader_v1', async () => {
        await db.promise().query(
          `UPDATE users
           SET account_type = 'trader'
           WHERE account_type IS NULL
              OR account_type = ''
              OR account_type NOT IN ('trader', 'investor')`
        )
      })
      await runOneTimeMigration('users_auth_version_default_v1', async () => {
        const [columnRows] = await db.promise().query(
          `SELECT COUNT(*) AS exists_flag
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = 'users'
             AND COLUMN_NAME = 'auth_version'`
        )
        if (Number(columnRows[0]?.exists_flag || 0) === 0) {
          await db.promise().query(
            `ALTER TABLE users ADD COLUMN auth_version INT NOT NULL DEFAULT 1`
          )
        }

        await db.promise().query(
          `UPDATE users
           SET auth_version = 1
           WHERE auth_version IS NULL OR auth_version < 1`
        )
      })
      await runOneTimeMigration('transactions_backfill_transaction_number_v1', backfillTransactionNumbersOnce)
    } catch (error) {
      console.error('Error in post-user migrations:', error.message)
    }
    done()
  })
}

async function ensureMigrationRunsTable() {
  await db.promise().query(
    `CREATE TABLE IF NOT EXISTS migration_runs (
      migration_key VARCHAR(128) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  )
}

async function runOneTimeMigration(migrationKey, handler) {
  const [rows] = await db.promise().query(
    `SELECT migration_key FROM migration_runs WHERE migration_key = ? LIMIT 1`,
    [migrationKey]
  )
  if (rows.length > 0) return

  await handler()
  await db.promise().query(
    `INSERT INTO migration_runs (migration_key) VALUES (?)`,
    [migrationKey]
  )
  console.log(`One-time migration completed: ${migrationKey}`)
}

async function backfillTransactionNumbersOnce() {
  const [columnRows] = await db.promise().query(
    `SELECT COUNT(*) AS exists_flag
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'transactions'
       AND COLUMN_NAME = 'transaction_number'`
  )
  if (Number(columnRows[0]?.exists_flag || 0) === 0) {
    await db.promise().query(
      `ALTER TABLE transactions ADD COLUMN transaction_number VARCHAR(15) NULL AFTER id`
    )
  }

  const [rows] = await db.promise().query(
    `SELECT id, transaction_number
     FROM transactions
     WHERE transaction_number IS NULL
        OR transaction_number = ''
        OR transaction_number NOT REGEXP '^ING[0-9]{12}$'`
  )

  for (const row of rows) {
    const idValue = String(row.id || '')
    const fallbackFromId = /^ING[0-9]{12}$/.test(idValue) ? idValue : null
    const transactionNumber = fallbackFromId || await generateUniqueTransactionNumber(db)
    await db.promise().query(
      `UPDATE transactions SET transaction_number = ? WHERE id = ?`,
      [transactionNumber, row.id]
    )
  }

  await db.promise().query(
    `CREATE UNIQUE INDEX uk_transactions_transaction_number
     ON transactions (transaction_number)`
  ).catch(() => {})
}

function backfillLegacyGatewayColumns() {
  db.query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'transactions'
       AND COLUMN_NAME IN ('stripe_payment_id', 'stripe_session_id')`,
    (err, rows) => {
      if (err) return
      const hasStripePaymentId = rows.some((row) => row.COLUMN_NAME === 'stripe_payment_id')
      const hasStripeSessionId = rows.some((row) => row.COLUMN_NAME === 'stripe_session_id')
      if (!hasStripePaymentId && !hasStripeSessionId) return

      const updates = []
      if (hasStripePaymentId) updates.push(`payment_id = COALESCE(payment_id, stripe_payment_id)`)
      if (hasStripeSessionId) updates.push(`session_id = COALESCE(session_id, stripe_session_id)`)
      if (!updates.length) return

      db.query(
        `UPDATE transactions SET ${updates.join(', ')}`,
        () => {}
      )
    }
  )
}

module.exports = runMigrations

