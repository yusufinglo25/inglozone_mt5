class ZohoService {
  constructor() {
    this.accountsBaseUrl = process.env.ZOHO_ACCOUNTS_BASE_URL || 'https://accounts.zoho.com'
    this.employeeApiUrl = process.env.ZOHO_EMPLOYEES_API_URL || ''
  }

  async exchangeAuthorizationCode(code, redirectUri) {
    if (!code) {
      throw new Error('Zoho authorization code is required')
    }

    const clientId = process.env.ZOHO_CLIENT_ID
    const clientSecret = process.env.ZOHO_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Zoho OAuth credentials are not configured')
    }

    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri || process.env.ZOHO_REDIRECT_URI || ''
    })

    const response = await fetch(`${this.accountsBaseUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString()
    })

    const data = await response.json()
    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || 'Zoho token exchange failed')
    }

    return data
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Zoho refresh token is required')
    }

    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.ZOHO_CLIENT_ID || '',
      client_secret: process.env.ZOHO_CLIENT_SECRET || ''
    })

    const response = await fetch(`${this.accountsBaseUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString()
    })

    const data = await response.json()
    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || 'Zoho token refresh failed')
    }

    return data
  }

  async getUserProfile(accessToken) {
    if (!accessToken) {
      throw new Error('Zoho access token is required')
    }

    const response = await fetch(`${this.accountsBaseUrl}/oauth/user/info`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    })

    const data = await response.json()
    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || 'Failed to fetch Zoho profile')
    }

    return this.normalizeZohoProfile(data)
  }

  async getEmployees(accessToken) {
    if (!this.employeeApiUrl) {
      throw new Error('ZOHO_EMPLOYEES_API_URL is not configured')
    }

    const response = await fetch(this.employeeApiUrl, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    })

    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const message = typeof data === 'object'
        ? (data.error_description || data.error || JSON.stringify(data))
        : data
      throw new Error(`Failed to fetch Zoho employees: ${message}`)
    }

    return this.normalizeZohoEmployees(data)
  }

  normalizeZohoProfile(payload) {
    const userId = payload.ZUID || payload.id || payload.user_id || payload.userid || ''
    const email = (payload.Email || payload.email || payload.primary_email || '').toLowerCase()
    const fullName = payload.Display_Name || payload.name || payload.Full_Name || ''
    const firstName = payload.First_Name || payload.first_name || ''
    const lastName = payload.Last_Name || payload.last_name || ''
    const department = payload.Department || payload.department || null

    return {
      zohoUserId: String(userId),
      email,
      fullName: fullName || `${firstName} ${lastName}`.trim() || email,
      department
    }
  }

  normalizeZohoEmployees(payload) {
    let rows = []
    if (Array.isArray(payload)) rows = payload
    else if (Array.isArray(payload?.data)) rows = payload.data
    else if (Array.isArray(payload?.employees)) rows = payload.employees
    else if (Array.isArray(payload?.response?.result)) rows = payload.response.result
    else if (typeof payload?.response?.result === 'object' && payload?.response?.result !== null) {
      rows = Object.values(payload.response.result)
    }

    return rows
      .map((row) => {
        const email = (
          row.email ||
          row.Email ||
          row.EmailID ||
          row.mail ||
          row.work_email ||
          ''
        ).toLowerCase()

        const firstName = row.first_name || row.First_Name || row.firstName || ''
        const lastName = row.last_name || row.Last_Name || row.lastName || ''
        const fullName = row.full_name || row.Full_Name || row.display_name || row.name ||
          `${firstName} ${lastName}`.trim()

        const statusRaw = String(
          row.status || row.employee_status || row.employment_status || 'active'
        ).toLowerCase()

        return {
          zohoUserId: String(
            row.ZUID || row.id || row.user_id || row.userid || row.employee_id || row.employeeId || ''
          ),
          fullName: fullName || email,
          email,
          department: row.department || row.Department || row.department_name || null,
          status: statusRaw.includes('term') || statusRaw.includes('inactive')
            ? 'Terminated'
            : 'Active'
        }
      })
      .filter((row) => row.email)
  }
}

module.exports = new ZohoService()
