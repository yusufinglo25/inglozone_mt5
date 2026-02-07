const db = require('../config/db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')

exports.register = async (data) => {
  const { firstName, lastName, email, password } = data

  // Check if email already exists
  const existingUser = await new Promise((resolve, reject) => {
    db.query(
      `SELECT id FROM users WHERE email = ?`,
      [email],
      (err, results) => {
        if (err) return reject(err)
        resolve(results[0])
      }
    )
  })

  if (existingUser) {
    throw new Error('Email already registered. Please use another email or login.')
  }

  const hash = await bcrypt.hash(password, 10)
  const id = uuidv4()

  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO users (id, first_name, last_name, email, password_hash, provider, is_verified, password_set)
       VALUES (?, ?, ?, ?, ?, 'local', true, true)`,
      [id, firstName, lastName, email, hash],
      (err) => {
        if (err) return reject(err)
        resolve({
          success: true,
          message: 'Account created successfully',
          next: 'login'
        })
      }
    )
  })
}

exports.login = async (data) => {
  const { email, password } = data

  return new Promise((resolve, reject) => {
    db.query(
      `SELECT * FROM users WHERE email = ? AND provider = 'local'`,
      [email],
      async (err, results) => {
        if (err || results.length === 0)
          return reject(new Error('Invalid credentials'))

        const user = results[0]
        
        // Check if password is set (for Google users who haven't set password yet)
        if (!user.password_set) {
          return reject(new Error('Please set your password first'))
        }

        const match = await bcrypt.compare(password, user.password_hash)

        if (!match) return reject(new Error('Invalid credentials'))

        const token = jwt.sign(
          { id: user.id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        )

        resolve({
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            avatarUrl: user.avatar_url,
            isVerified: user.is_verified,
            provider: user.provider
          }
        })
      }
    )
  })
}

// Google OAuth functions
exports.findOrCreateGoogleUser = async (profile) => {
  const { id, displayName, emails, photos, name } = profile
  const email = emails[0].value
  const firstName = name?.givenName || displayName.split(' ')[0]
  const lastName = name?.familyName || displayName.split(' ').slice(1).join(' ') || ''
  const avatarUrl = photos?.[0]?.value || null

  return new Promise((resolve, reject) => {
    // Check if user exists by google_id
    db.query(
      `SELECT * FROM users WHERE google_id = ?`,
      [id],
      async (err, results) => {
        if (err) return reject(err)
        
        // If user found with google_id, return user
        if (results.length > 0) {
          const user = results[0]
          
          // Update user info if needed
          if (user.avatar_url !== avatarUrl || user.first_name !== firstName || user.last_name !== lastName) {
            db.query(
              `UPDATE users SET 
                first_name = ?, 
                last_name = ?, 
                avatar_url = ?, 
                is_verified = true 
               WHERE google_id = ?`,
              [firstName, lastName, avatarUrl, id]
            )
          }
          
          return resolve({
            user: {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              avatarUrl: user.avatar_url,
              isVerified: user.is_verified,
              provider: user.provider,
              passwordSet: user.password_set
            },
            isNew: false
          })
        }
        
        // Check if email exists (user registered with email/password)
        db.query(
          `SELECT * FROM users WHERE email = ?`,
          [email],
          async (err, emailResults) => {
            if (err) return reject(err)
            
            if (emailResults.length > 0) {
              // Email exists, link Google account to existing account
              const user = emailResults[0]
              
              db.query(
                `UPDATE users SET 
                  google_id = ?, 
                  avatar_url = ?, 
                  is_verified = true 
                 WHERE email = ?`,
                [id, avatarUrl, email]
              )
              
              return resolve({
                user: {
                  id: user.id,
                  email: user.email,
                  firstName: user.first_name,
                  lastName: user.last_name,
                  avatarUrl: avatarUrl,
                  isVerified: true,
                  provider: user.provider === 'local' ? 'both' : 'google',
                  passwordSet: user.password_set
                },
                isNew: false
              })
            }
            
            // Create new user with Google OAuth
            const userId = uuidv4()
            
            db.query(
              `INSERT INTO users (
                id, google_id, email, first_name, last_name, 
                avatar_url, provider, is_verified, password_set
              ) VALUES (?, ?, ?, ?, ?, ?, 'google', true, false)`,
              [userId, id, email, firstName, lastName, avatarUrl],
              (err) => {
                if (err) return reject(err)
                
                resolve({
                  user: {
                    id: userId,
                    email,
                    firstName,
                    lastName,
                    avatarUrl,
                    isVerified: true,
                    provider: 'google',
                    passwordSet: false
                  },
                  isNew: true
                })
              }
            )
          }
        )
      }
    )
  })
}

exports.completeProfile = async (userId, data) => {
  const { firstName, lastName, password } = data
  
  return new Promise((resolve, reject) => {
    // Check if user exists and is a Google OAuth user without password
    db.query(
      `SELECT * FROM users WHERE id = ? AND provider = 'google' AND password_set = false`,
      [userId],
      async (err, results) => {
        if (err || results.length === 0) {
          return reject(new Error('User not found or password already set'))
        }
        
        const hash = await bcrypt.hash(password, 10)
        
        db.query(
          `UPDATE users SET 
            first_name = ?, 
            last_name = ?, 
            password_hash = ?, 
            password_set = true 
           WHERE id = ?`,
          [firstName, lastName, hash, userId],
          (err) => {
            if (err) return reject(err)
            
            resolve({
              success: true,
              message: 'Profile completed successfully'
            })
          }
        )
      }
    )
  })
}

exports.checkEmail = async (email) => {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT id, provider FROM users WHERE email = ?`,
      [email],
      (err, results) => {
        if (err) return reject(err)
        
        resolve({
          exists: results.length > 0,
          user: results[0] || null
        })
      }
    )
  })
}