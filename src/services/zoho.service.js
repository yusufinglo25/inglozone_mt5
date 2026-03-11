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

    let requestUrl = this.employeeApiUrl
    try {
      const parsed = new URL(this.employeeApiUrl)
      if (!parsed.searchParams.has('sIndex')) parsed.searchParams.set('sIndex', '1')
      if (!parsed.searchParams.has('limit')) parsed.searchParams.set('limit', '200')
      requestUrl = parsed.toString()
    } catch (_) {
      // Keep original URL if parsing fails.
    }

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
    })

    const contentType = response.headers.get('content-type') || ''
    let data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    // Zoho APIs may respond with JSON string but non-json content-type.
    if (typeof data === 'string') {
      const trimmed = data.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          data = JSON.parse(trimmed)
        } catch (_) {
          // keep original string for error reporting
        }
      }
    }

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
    const unwrap = (value) => {
      if (value && typeof value === 'object') {
        if (Object.prototype.hasOwnProperty.call(value, 'value')) return value.value
        if (Object.prototype.hasOwnProperty.call(value, 'displayValue')) return value.displayValue
        if (Object.prototype.hasOwnProperty.call(value, 'display_value')) return value.display_value
      }
      return value
    }

    const getField = (row, keys) => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
          const value = unwrap(row[key])
          if (value !== undefined && value !== null && String(value).trim() !== '') return value
        }
      }
      const lowered = Object.keys(row).reduce((acc, key) => {
        acc[key.toLowerCase()] = row[key]
        return acc
      }, {})
      for (const key of keys) {
        const value = unwrap(lowered[String(key).toLowerCase()])
        if (value !== undefined && value !== null && String(value).trim() !== '') return value
      }
      return ''
    }

    let rows = []
    if (Array.isArray(payload)) rows = payload
    else if (Array.isArray(payload?.data)) rows = payload.data
    else if (Array.isArray(payload?.employees)) rows = payload.employees
    else if (Array.isArray(payload?.response?.result)) rows = payload.response.result
    else if (Array.isArray(payload?.response?.result?.data)) rows = payload.response.result.data
    else if (Array.isArray(payload?.response?.result?.employees)) rows = payload.response.result.employees
    else if (typeof payload?.response?.result === 'object' && payload?.response?.result !== null) {
      rows = Object.values(payload.response.result)
    } else if (typeof payload?.response === 'object' && payload?.response !== null) {
      rows = Object.values(payload.response)
    }

    // Zoho People often returns:
    // { response: { result: [ { "<zohoId>": [ { employeeRecord } ] } ] } }
    // Flatten any nested array/object layers into plain employee record objects.
    const flattenedRows = []
    const flattenInto = (value) => {
      if (Array.isArray(value)) {
        value.forEach(flattenInto)
        return
      }
      if (!value || typeof value !== 'object') return

      const keys = Object.keys(value)
      const looksLikeEmployeeRecord = (
        keys.some((k) => ['EmailID', 'FirstName', 'LastName', 'EmployeeID', 'Zoho_ID'].includes(k)) ||
        keys.some((k) => ['email', 'mail', 'work_email'].includes(String(k).toLowerCase()))
      )
      if (looksLikeEmployeeRecord) {
        flattenedRows.push(value)
        return
      }

      // Nested wrapper object (e.g. { "7594...": [ {...} ] })
      Object.values(value).forEach(flattenInto)
    }
    flattenInto(rows)
    const sourceRows = flattenedRows.length > 0 ? flattenedRows : rows

    return sourceRows
      .map((row) => {
        if (!row || typeof row !== 'object') return null

        const email = String(getField(row, [
          'email', 'Email', 'EmailID', 'Email ID', 'email_id',
          'mail', 'work_email', 'workEmail', 'official_email',
          'Official Email ID', 'Official_Email_ID'
        ])).toLowerCase()

        const firstName = String(getField(row, ['first_name', 'First_Name', 'firstName', 'First Name']) || '')
        const lastName = String(getField(row, ['last_name', 'Last_Name', 'lastName', 'Last Name']) || '')
        const fullName = getField(row, ['full_name', 'Full_Name', 'display_name', 'name', 'Employee Name']) ||
          `${firstName} ${lastName}`.trim()
        const statusRaw = String(
          getField(row, ['status', 'employee_status', 'employment_status', 'Employee Status', 'Employeestatus']) || 'active'
        ).toLowerCase()

        return {
          zohoUserId: String(getField(row, [
            'ZUID', 'id', 'user_id', 'userid', 'employee_id', 'employeeId', 'EmployeeID', 'Zoho_ID'
          ]) || ''),
          fullName: fullName || email,
          email,
          department: getField(row, ['department', 'Department', 'department_name', 'Department Name']) || null,
          status: statusRaw.includes('term') || statusRaw.includes('inactive')
            ? 'Terminated'
            : 'Active'
        }
      })
      .filter(Boolean)
      .filter((row) => row.email)
  }
}

module.exports = new ZohoService()
