const settingsService = require('../services/settings.service')

exports.requestOldEmailOTP = async (req, res) => {
  try {
    const result = await settingsService.requestOldEmailOTP(req.user.id)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.verifyOldEmailOTP = async (req, res) => {
  try {
    const { verificationToken, otp } = req.body
    const result = await settingsService.verifyOldEmailOTP(req.user.id, verificationToken, otp)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.requestNewEmailOTP = async (req, res) => {
  try {
    const { emailChangeToken, newEmail } = req.body
    const result = await settingsService.requestNewEmailOTP(req.user.id, emailChangeToken, newEmail)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.verifyNewEmailOTP = async (req, res) => {
  try {
    const { newEmailVerificationToken, otp } = req.body
    const result = await settingsService.verifyNewEmailOTP(req.user.id, newEmailVerificationToken, otp)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body
    const result = await settingsService.changePassword(
      req.user.id,
      currentPassword,
      newPassword,
      confirmNewPassword
    )
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.generate2FA = async (req, res) => {
  try {
    const result = await settingsService.generate2FA(req.user.id, req.user.email)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.verify2FA = async (req, res) => {
  try {
    const { code } = req.body
    const result = await settingsService.verify2FA(req.user.id, code)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.disable2FA = async (req, res) => {
  try {
    const { code } = req.body
    const result = await settingsService.disable2FA(req.user.id, code)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.logoutAllDevices = async (req, res) => {
  try {
    const result = await settingsService.logoutAllDevices(req.user.id)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

exports.logoutOtherDevices = async (req, res) => {
  try {
    const result = await settingsService.logoutOtherDevices(req.user.id, req.user.jti)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}
