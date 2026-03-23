const crypto = require('crypto')

class MatchTraderApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'MatchTraderApiError'
    this.statusCode = options.statusCode || 500
    this.code = options.code || 'MATCH_TRADER_API_ERROR'
    this.providerError = options.providerError || null
    this.retriable = Boolean(options.retriable)
    this.context = options.context || null
  }
}

class MatchTraderClient {
  constructor(options = {}) {
    this.baseUrl = String(
      options.baseUrl ||
      process.env.MATCH_TRADER_BASE_URL ||
      'https://broker-api-demo.match-trader.com'
    ).replace(/\/+$/, '')

    this.apiKey = String(
      options.apiKey ||
      process.env.MATCH_TRADER_API_KEY ||
      ''
    ).trim()

    this.timeoutMs = Number.parseInt(
      options.timeoutMs || process.env.MATCH_TRADER_TIMEOUT_MS || '15000',
      10
    )

    this.maxRetries = Number.parseInt(
      options.maxRetries || process.env.MATCH_TRADER_MAX_RETRIES || '2',
      10
    )

    this.initialRetryDelayMs = Number.parseInt(
      options.initialRetryDelayMs || process.env.MATCH_TRADER_RETRY_DELAY_MS || '350',
      10
    )
  }

  ensureConfigured() {
    if (!this.apiKey) {
      throw new MatchTraderApiError('Match-Trader API key is not configured', {
        statusCode: 500,
        code: 'MATCH_TRADER_CONFIG_ERROR',
        retriable: false
      })
    }
  }

  resolveAuthHeaders() {
    const raw = String(this.apiKey || '').trim()
    const withoutBearer = raw.replace(/^Bearer\s+/i, '').trim()
    const bearer = /^Bearer\s+/i.test(raw) ? raw : `Bearer ${withoutBearer}`
    return {
      authorization: bearer,
      apiKey: withoutBearer
    }
  }

  buildUrl(pathname, query = {}) {
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`
    const url = new URL(`${this.baseUrl}${path}`)
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      if (Array.isArray(value)) {
        value.forEach((item) => url.searchParams.append(key, String(item)))
        return
      }
      url.searchParams.set(key, String(value))
    })
    return url
  }

  sanitizeForLogs(value) {
    if (value === null || value === undefined) return value
    if (Array.isArray(value)) return value.map((item) => this.sanitizeForLogs(item))
    if (typeof value !== 'object') return value

    const hiddenKeyPattern = /(authorization|api.?key|secret|token|password|passphrase)/i
    const output = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      if (hiddenKeyPattern.test(key)) {
        output[key] = '***'
      } else {
        output[key] = this.sanitizeForLogs(nestedValue)
      }
    }
    return output
  }

  toMessageFromProvider(payload, fallback = 'Match-Trader request failed') {
    if (!payload) return fallback
    if (typeof payload === 'string') return payload
    if (typeof payload !== 'object') return fallback

    const candidates = [
      payload.message,
      payload.error,
      payload.description,
      payload.details,
      payload.title
    ]
      .map((item) => (typeof item === 'string' ? item : null))
      .filter(Boolean)

    return candidates[0] || fallback
  }

  shouldRetry(statusCode, attempt) {
    if (attempt >= this.maxRetries) return false
    const retryableStatus = new Set([408, 425, 429, 500, 502, 503, 504])
    return retryableStatus.has(Number(statusCode))
  }

  async wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  logRequest(logContext) {
    const { requestId, method, url, attempt, body } = logContext
    console.log(
      `[MatchTrader][request] id=${requestId} method=${method} attempt=${attempt} url=${url} body=${JSON.stringify(this.sanitizeForLogs(body || {}))}`
    )
  }

  logResponse(logContext) {
    const {
      requestId, method, url, statusCode, durationMs, response
    } = logContext
    console.log(
      `[MatchTrader][response] id=${requestId} method=${method} status=${statusCode} durationMs=${durationMs} url=${url} payload=${JSON.stringify(this.sanitizeForLogs(response || {}))}`
    )
  }

  async request({
    method = 'GET',
    path,
    query = {},
    body = undefined,
    headers = {}
  }) {
    this.ensureConfigured()

    const requestId = crypto.randomUUID()
    const upperMethod = String(method || 'GET').toUpperCase()
    const url = this.buildUrl(path, query)
    const authHeaders = this.resolveAuthHeaders()

    const normalizedHeaders = {
      Accept: 'application/json',
      Authorization: authHeaders.authorization,
      'X-API-Key': authHeaders.apiKey,
      'api-key': authHeaders.apiKey,
      ...headers
    }

    if (body !== undefined && body !== null) {
      normalizedHeaders['Content-Type'] = 'application/json'
    }

    let latestError = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const startedAt = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

      try {
        this.logRequest({
          requestId,
          method: upperMethod,
          url: url.toString(),
          attempt: attempt + 1,
          body
        })

        const response = await fetch(url.toString(), {
          method: upperMethod,
          headers: normalizedHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal
        })

        clearTimeout(timeout)

        const contentType = String(response.headers.get('content-type') || '').toLowerCase()
        let payload
        if (contentType.includes('application/json')) {
          payload = await response.json().catch(() => ({}))
        } else {
          const text = await response.text().catch(() => '')
          payload = text ? { raw: text } : {}
        }

        this.logResponse({
          requestId,
          method: upperMethod,
          url: url.toString(),
          statusCode: response.status,
          durationMs: Date.now() - startedAt,
          response: payload
        })

        if (!response.ok) {
          const retriable = this.shouldRetry(response.status, attempt)
          const providerMessage = this.toMessageFromProvider(payload, `Match-Trader HTTP ${response.status}`)
          latestError = new MatchTraderApiError(providerMessage, {
            statusCode: response.status,
            code: 'MATCH_TRADER_HTTP_ERROR',
            providerError: payload,
            retriable,
            context: { method: upperMethod, path, query }
          })

          if (retriable) {
            const delayMs = this.initialRetryDelayMs * Math.pow(2, attempt)
            await this.wait(delayMs)
            continue
          }
          throw latestError
        }

        return payload
      } catch (error) {
        clearTimeout(timeout)

        if (error instanceof MatchTraderApiError) {
          throw error
        }

        const isAbort = error?.name === 'AbortError'
        const retriable = attempt < this.maxRetries
        latestError = new MatchTraderApiError(
          isAbort ? 'Match-Trader request timeout' : (error?.message || 'Match-Trader network error'),
          {
            statusCode: isAbort ? 504 : 502,
            code: isAbort ? 'MATCH_TRADER_TIMEOUT' : 'MATCH_TRADER_NETWORK_ERROR',
            providerError: null,
            retriable,
            context: { method: upperMethod, path, query }
          }
        )

        console.error(
          `[MatchTrader][error] id=${requestId} attempt=${attempt + 1} message=${latestError.message}`
        )

        if (!retriable) {
          throw latestError
        }

        const delayMs = this.initialRetryDelayMs * Math.pow(2, attempt)
        await this.wait(delayMs)
      }
    }

    throw latestError || new MatchTraderApiError('Match-Trader request failed after retries', {
      statusCode: 502,
      code: 'MATCH_TRADER_RETRY_EXHAUSTED'
    })
  }

  get(path, query = {}, headers = {}) {
    return this.request({ method: 'GET', path, query, headers })
  }

  post(path, body = {}, query = {}, headers = {}) {
    return this.request({ method: 'POST', path, query, body, headers })
  }

  patch(path, body = {}, query = {}, headers = {}) {
    return this.request({ method: 'PATCH', path, query, body, headers })
  }

  put(path, body = {}, query = {}, headers = {}) {
    return this.request({ method: 'PUT', path, query, body, headers })
  }

  delete(path, query = {}, headers = {}) {
    return this.request({ method: 'DELETE', path, query, headers })
  }
}

module.exports = {
  MatchTraderClient,
  MatchTraderApiError
}
