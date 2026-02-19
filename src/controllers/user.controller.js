const db = require('../config/db')
const bcrypt = require('bcryptjs')
const { validatePasswordPolicy } = require('../utils/password-policy')

exports.completeProfile = async (req, res) => {
  const { firstName, lastName, password, confirmPassword } = req.body

  if (!firstName || !lastName || !password || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' })
  }

  const passwordError = validatePasswordPolicy(password)
  if (passwordError) {
    return res.status(400).json({ error: passwordError })
  }

  const hash = await bcrypt.hash(password, 10)

  db.query(
    `UPDATE users
     SET first_name = ?, last_name = ?, password_hash = ?, profile_completed = true
     WHERE id = ?`,
    [firstName, lastName, hash, req.user.id],
    () => res.json({ success: true, message: 'Profile completed' })
  )
}
