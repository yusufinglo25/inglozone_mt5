const db = require('../config/db')
const bcrypt = require('bcryptjs')
const { validatePasswordPolicy } = require('../utils/password-policy')
const matchTraderService = require('../services/matchtrader.service')

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
  try {
    const matchTraderSync = await matchTraderService.syncPortalPasswordForUser(
      req.user.id,
      password,
      {
        createIfMissing: true
      }
    )

    await db.promise().query(
      `UPDATE users
       SET first_name = ?,
           last_name = ?,
           password_hash = ?,
           password_set = true,
           profile_completed = true
       WHERE id = ?`,
      [firstName, lastName, hash, req.user.id]
    )

    return res.json({
      success: true,
      message: 'Profile completed',
      matchTraderSync: {
        synced: true,
        source: matchTraderSync.source || 'existing',
        account_uuid: matchTraderSync.account_uuid || null
      }
    })
  } catch (error) {
    const statusCode = Number(error.statusCode)
    const resolvedStatus = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600
      ? statusCode
      : 400
    return res.status(resolvedStatus).json({ error: error.message })
  }
}
