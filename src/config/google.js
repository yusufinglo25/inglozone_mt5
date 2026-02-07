const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const db = require('./db')
const { v4: uuidv4 } = require('uuid')

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value
        const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || ''
        const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || ''
        const avatarUrl = profile.photos?.[0]?.value || null

        // First, check if user exists with this google_id
        db.query(
          `SELECT * FROM users WHERE google_id = ?`,
          [profile.id],
          async (err, googleRows) => {
            if (err) return done(err)
            
            if (googleRows.length > 0) {
              const user = googleRows[0]
              
              // Update user info if needed
              if (user.avatar_url !== avatarUrl || user.first_name !== firstName || user.last_name !== lastName) {
                db.query(
                  `UPDATE users SET 
                    first_name = ?, 
                    last_name = ?, 
                    avatar_url = ?, 
                    is_verified = true,
                    provider = 'google'
                   WHERE google_id = ?`,
                  [firstName, lastName, avatarUrl, profile.id],
                  (updateErr) => {
                    if (updateErr) console.error('Error updating user:', updateErr)
                  }
                )
              }
              
              return done(null, {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                avatar_url: user.avatar_url,
                is_verified: user.is_verified,
                provider: user.provider || 'google',
                password_set: user.password_set || false,
                profile_completed: user.profile_completed
              })
            }
            
            // Check if email already exists (user registered with email/password)
            db.query(
              `SELECT * FROM users WHERE email = ?`,
              [email],
              async (err, emailRows) => {
                if (err) return done(err)
                
                if (emailRows.length > 0) {
                  // Email exists, link Google account to existing account
                  const existingUser = emailRows[0]
                  
                  db.query(
                    `UPDATE users SET 
                      google_id = ?, 
                      avatar_url = ?, 
                      is_verified = true,
                      provider = CASE WHEN provider = 'local' THEN 'both' ELSE 'google' END
                     WHERE email = ?`,
                    [profile.id, avatarUrl, email],
                    (updateErr) => {
                      if (updateErr) return done(updateErr)
                      
                      return done(null, {
                        id: existingUser.id,
                        email: existingUser.email,
                        first_name: existingUser.first_name || firstName,
                        last_name: existingUser.last_name || lastName,
                        avatar_url: avatarUrl,
                        is_verified: true,
                        provider: existingUser.provider === 'local' ? 'both' : 'google',
                        password_set: existingUser.password_set || true,
                        profile_completed: existingUser.profile_completed
                      })
                    }
                  )
                } else {
                  // Create new user with Google OAuth
                  const id = uuidv4()
                  
                  db.query(
                    `INSERT INTO users (
                      id, first_name, last_name, email, google_id, 
                      avatar_url, is_verified, provider, password_set, profile_completed
                    ) VALUES (?, ?, ?, ?, ?, ?, true, 'google', false, false)`,
                    [id, firstName, lastName, email, profile.id, avatarUrl],
                    (insertErr) => {
                      if (insertErr) return done(insertErr)
                      
                      return done(null, {
                        id,
                        email,
                        first_name: firstName,
                        last_name: lastName,
                        avatar_url: avatarUrl,
                        is_verified: true,
                        provider: 'google',
                        password_set: false,
                        profile_completed: false
                      })
                    }
                  )
                }
              }
            )
          }
        )
      } catch (error) {
        done(error)
      }
    }
  )
)

// Serialize user (if using sessions)
passport.serializeUser((user, done) => {
  done(null, user.id)
})

// Deserialize user (if using sessions)
passport.deserializeUser((id, done) => {
  db.query(
    `SELECT * FROM users WHERE id = ?`,
    [id],
    (err, rows) => {
      if (err) return done(err)
      if (rows.length === 0) return done(null, false)
      
      const user = rows[0]
      done(null, {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
        provider: user.provider,
        password_set: user.password_set,
        profile_completed: user.profile_completed
      })
    }
  )
})

module.exports = passport