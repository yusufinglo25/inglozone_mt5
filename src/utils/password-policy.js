function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required'
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter'
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter'
  }

  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return 'Password must include at least one special character'
  }

  return null
}

module.exports = {
  validatePasswordPolicy
}
