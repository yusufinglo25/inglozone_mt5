function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function getConfiguredAdminEmails() {
  const raw = [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAILS]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map(normalizeEmail)
    .filter(Boolean)

  return new Set(raw)
}

function isAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return false

  const adminEmails = getConfiguredAdminEmails()
  return adminEmails.has(normalizedEmail)
}

module.exports = {
  isAdminEmail
}
