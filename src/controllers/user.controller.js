const db = require('../config/db')
const bcrypt = require('bcryptjs')

exports.completeProfile = async (req, res) => {
  const { firstName, lastName, password, confirmPassword } = req.body

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' })
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
