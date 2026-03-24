const crypto = require('crypto')
const db = require('../config/db')
const { MatchTraderClient, MatchTraderApiError } = require('./matchtrader.client')

class MatchTraderService {
  constructor(options = {}) {
    this.client = options.client || new MatchTraderClient()
    this.platformUrl = String(
      options.platformUrl ||
      process.env.MATCH_TRADER_PLATFORM_URL ||
      'https://mtr-demo-prod.match-trader.com/'
    ).replace(/\/+$/, '')
    this.defaultOfferUuid = String(process.env.MATCH_TRADER_DEFAULT_OFFER_UUID || '').trim()
  }

  async query(sql, params = []) {
    const [rows] = await db.promise().query(sql, params)
    return rows
  }

  normalizeMode(input) {
    return String(input || '').toUpperCase() === 'DEMO' ? 'DEMO' : 'REAL'
  }

  normalizeStatus(input) {
    if (!input) return 'UNKNOWN'
    return String(input).toUpperCase().slice(0, 20)
  }

  parseCollection(payload) {
    if (!payload) return []
    const normalizedPayload = this.unwrapData(payload)
    if (Array.isArray(normalizedPayload)) return normalizedPayload
    if (Array.isArray(normalizedPayload.content)) return normalizedPayload.content
    if (Array.isArray(normalizedPayload.items)) return normalizedPayload.items
    if (Array.isArray(normalizedPayload.data)) return normalizedPayload.data
    if (normalizedPayload.data && Array.isArray(normalizedPayload.data.content)) return normalizedPayload.data.content
    if (normalizedPayload.data && Array.isArray(normalizedPayload.data.items)) return normalizedPayload.data.items
    if (Array.isArray(normalizedPayload.orders)) return normalizedPayload.orders
    if (Array.isArray(normalizedPayload.positions)) return normalizedPayload.positions
    if (Array.isArray(normalizedPayload.offers)) return normalizedPayload.offers
    return []
  }

  unwrapData(payload) {
    if (
      payload &&
      typeof payload === 'object' &&
      payload.data &&
      typeof payload.data === 'object' &&
      !Array.isArray(payload.data)
    ) {
      return payload.data
    }
    return payload
  }

  findTradingAccountId(payload) {
    if (!payload || typeof payload !== 'object') return null
    const candidates = [
      payload.login,
      payload.tradingAccountId,
      payload.accountId,
      payload.id
    ]
      .map((item) => (item === undefined || item === null ? null : String(item).trim()))
      .filter(Boolean)
    return candidates[0] || null
  }

  toSafeNumber(value) {
    if (typeof value === 'string') {
      const normalized = value.replace(/,/g, '').trim()
      if (!normalized) return null
      const parsedFromString = Number(normalized)
      return Number.isFinite(parsedFromString) ? parsedFromString : null
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  toSafeNumberOrDefault(value, defaultValue = 0) {
    const parsed = this.toSafeNumber(value)
    return parsed === null ? defaultValue : parsed
  }

  pickFirstNumber(candidates = []) {
    for (const candidate of candidates) {
      const parsed = this.toSafeNumber(candidate)
      if (parsed !== null) return parsed
    }
    return null
  }

  toBoolean(value) {
    if (typeof value === 'boolean') return value
    const normalized = String(value || '').trim().toLowerCase()
    return ['true', '1', 'yes', 'y'].includes(normalized)
  }

  normalizeLeverageValue(value) {
    const raw = this.pickFirstString([value])
    if (!raw) return ''
    const compact = raw.replace(/\s+/g, '')
    const matched = compact.match(/^(?:1:)?(\d+)$/i)
    if (matched) return matched[1]
    return raw
  }

  normalizeCurrencyValue(value) {
    const raw = this.pickFirstString([value])
    if (!raw) return ''
    return raw.toUpperCase()
  }

  extractTradingStatus(payload = {}) {
    return this.pickFirstString([
      payload.status,
      payload.access,
      payload.state
    ])
  }

  extractTradingCurrency(payload = {}) {
    return this.pickFirstString([
      payload.currency,
      payload.financeInfo && payload.financeInfo.currency,
      payload.accountInfo && payload.accountInfo.currency
    ])
  }

  extractTradingLeverage(payload = {}) {
    return this.pickFirstString([
      payload.leverage,
      payload.financeInfo && payload.financeInfo.leverage
    ])
  }

  extractTradingBalance(payload = {}) {
    return this.pickFirstNumber([
      payload.balance,
      payload.financeInfo && payload.financeInfo.balance,
      payload.accountInfo && payload.accountInfo.balance,
      payload.statistics && payload.statistics.balance
    ])
  }

  extractTradingEquity(payload = {}) {
    const equity = this.pickFirstNumber([
      payload.equity,
      payload.financeInfo && payload.financeInfo.equity,
      payload.accountInfo && payload.accountInfo.equity,
      payload.statistics && payload.statistics.equity
    ])
    if (equity !== null) return equity
    return this.extractTradingBalance(payload)
  }

  extractProviderGeneratedPassword(payload = {}) {
    if (!payload || typeof payload !== 'object') return ''
    return this.pickFirstString([
      payload.generatedPassword,
      payload.autoGeneratedPassword,
      payload.password,
      payload.tradingPassword,
      payload.accountPassword,
      payload.credentials && payload.credentials.password,
      payload.accountCredentials && payload.accountCredentials.password
    ])
  }

  generatePassword() {
    const raw = crypto.randomBytes(20).toString('base64url')
    return `Mt#${raw.slice(0, 16)}1!`
  }

  pickFirstString(candidates = []) {
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue
      const value = String(candidate).trim()
      if (value) return value
    }
    return ''
  }

  extractBrokerAccountUuid(payload = {}) {
    if (!payload || typeof payload !== 'object') return ''
    return this.pickFirstString([
      payload.accountUuid,
      payload.accountUUID,
      payload.accountId,
      payload.accountInfo && payload.accountInfo.uuid,
      payload.accountInfo && payload.accountInfo.accountUuid,
      payload.accountInfo && payload.accountInfo.accountUUID,
      payload.accountInfo && payload.accountInfo.id,
      payload.account && payload.account.uuid,
      payload.account && payload.account.accountUuid,
      payload.brokerAccountUuid,
      payload.brokerAccountUUID
    ])
  }

  extractSystemUuid(payload = {}) {
    if (!payload || typeof payload !== 'object') return ''
    return this.pickFirstString([
      payload.systemUuid,
      payload.systemUUID,
      payload.systemId,
      payload.serverUuid,
      payload.serverUUID,
      payload.tradingSystemUuid,
      payload.tradingSystemUUID,
      payload.system && payload.system.id,
      payload.system && payload.system.uuid,
      payload.system && payload.systemUuid,
      payload.accountInfo && payload.accountInfo.systemUuid,
      payload.accountInfo && payload.accountInfo.systemUUID,
      payload.accountInfo && payload.accountInfo.serverUuid,
      payload.accountInfo && payload.accountInfo.serverUUID
    ])
  }

  buildAccountPasswordChangePlans(accountUuid, newPassword, currentPassword = '') {
    const normalizedAccountUuid = String(accountUuid || '').trim()
    const normalizedNewPassword = String(newPassword || '').trim()
    if (!normalizedAccountUuid || !normalizedNewPassword) return []

    const payloads = [{ accountUuid: normalizedAccountUuid, newPassword: normalizedNewPassword }]

    const normalizedCurrent = String(currentPassword || '').trim()
    if (normalizedCurrent) {
      payloads.push(
        {
          accountUuid: normalizedAccountUuid,
          newPassword: normalizedNewPassword,
          currentPassword: normalizedCurrent
        },
        {
          accountUuid: normalizedAccountUuid,
          newPassword: normalizedNewPassword,
          oldPassword: normalizedCurrent
        }
      )
    }

    const paths = [
      '/v1/change-password',
      '/v1/accounts/change-password',
      '/v1/account/change-password'
    ]

    return paths.flatMap((path) =>
      payloads.map((body) => ({
        method: 'POST',
        path,
        body
      }))
    )
  }

  buildTradingPasswordChangePlans({
    tradingAccountId,
    newPassword,
    currentPassword = '',
    systemUuid = ''
  }) {
    const login = String(tradingAccountId || '').trim()
    const normalizedNewPassword = String(newPassword || '').trim()
    if (!login || !normalizedNewPassword) return []

    const normalizedCurrent = String(currentPassword || '').trim()

    const postPayloads = [
      { login, newPassword: normalizedNewPassword },
      { login, password: normalizedNewPassword },
      { tradingAccountLogin: login, newPassword: normalizedNewPassword },
      { accountLogin: login, newPassword: normalizedNewPassword }
    ]

    if (normalizedCurrent) {
      postPayloads.push(
        { login, newPassword: normalizedNewPassword, currentPassword: normalizedCurrent },
        { login, newPassword: normalizedNewPassword, oldPassword: normalizedCurrent },
        { tradingAccountLogin: login, newPassword: normalizedNewPassword, oldPassword: normalizedCurrent }
      )
    }

    const plans = []
    const postPaths = [
      '/v1/trading-account/change-password',
      '/v1/trading-accounts/change-password',
      '/v1/change-password'
    ]
    postPaths.forEach((path) => {
      postPayloads.forEach((body) => {
        plans.push({ method: 'POST', path, body })
      })
    })

    const queryVariants = [
      { login },
      { accountLogin: login },
      { tradingAccountLogin: login }
    ]
    if (systemUuid) {
      queryVariants.forEach((query) => {
        query.systemUuid = systemUuid
      })
    }

    const patchBodies = [
      { password: normalizedNewPassword },
      { newPassword: normalizedNewPassword },
      { tradingPassword: normalizedNewPassword }
    ]
    const patchPaths = ['/v1/trading-account', '/v1/trading-accounts']
    patchPaths.forEach((path) => {
      queryVariants.forEach((query) => {
        patchBodies.forEach((body) => {
          plans.push({
            method: 'PATCH',
            path,
            query,
            body
          })
        })
      })
    })

    return plans
  }

  buildTradingAccountCreateVariants({
    offerUuid,
    selectedOffer,
    body = {}
  }) {
    const commissionUuid = this.pickFirstString([body.commission_uuid, body.commissionUuid])
    const requestedCurrency = this.normalizeCurrencyValue(body.currency)
    const requestedLeverage = this.normalizeLeverageValue(body.leverage)
    const offerCurrency = this.normalizeCurrencyValue(selectedOffer && selectedOffer.currency)
    const offerLeverage = this.normalizeLeverageValue(selectedOffer && selectedOffer.leverage)
    const preferredCurrency = requestedCurrency || offerCurrency
    const preferredLeverage = requestedLeverage || offerLeverage

    const base = {
      offerUuid,
      ...(commissionUuid ? { commissionUuid } : {})
    }

    const variants = [base]

    // Some environments require explicit currency/leverage for specific real offers.
    if (preferredCurrency) {
      variants.push({ ...base, currency: preferredCurrency })
    }
    if (preferredLeverage && preferredLeverage !== '0') {
      variants.push({ ...base, leverage: preferredLeverage })
    }
    if (preferredCurrency && preferredLeverage && preferredLeverage !== '0') {
      variants.push({
        ...base,
        currency: preferredCurrency,
        leverage: preferredLeverage
      })
    }

    const deduped = []
    const seen = new Set()
    for (const variant of variants) {
      const key = JSON.stringify(variant)
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(variant)
    }
    return deduped
  }

  async executePasswordChangePlans(plans = []) {
    let lastError = null
    let preferredError = null

    for (const plan of plans) {
      try {
        const method = String(plan.method || 'POST').toUpperCase()
        if (method === 'PATCH') {
          const payload = await this.client.patch(plan.path, plan.body || {}, plan.query || {})
          return this.unwrapData(payload)
        }
        if (method === 'PUT') {
          const payload = await this.client.put(plan.path, plan.body || {}, plan.query || {})
          return this.unwrapData(payload)
        }
        if (method === 'GET') {
          const payload = await this.client.get(plan.path, plan.query || {})
          return this.unwrapData(payload)
        }
        const payload = await this.client.post(plan.path, plan.body || {}, plan.query || {})
        return this.unwrapData(payload)
      } catch (error) {
        lastError = error
        if (error instanceof MatchTraderApiError) {
          const statusCode = Number(error.statusCode)
          if (!preferredError && ![404, 405].includes(statusCode)) {
            preferredError = error
          }
          if ([401, 403].includes(statusCode)) {
            throw error
          }
          continue
        }
        throw error
      }
    }

    throw preferredError || lastError || new MatchTraderApiError('Failed to change password in provider', {
      statusCode: 502,
      code: 'MATCH_TRADER_PASSWORD_CHANGE_FAILED'
    })
  }

  async getUserById(userId) {
    const rows = await this.query(
      `SELECT id, email, first_name, last_name
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    )
    if (!rows.length) {
      throw new MatchTraderApiError('User not found', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      })
    }
    return rows[0]
  }

  async getUserByIdForAdmin(userId) {
    const rows = await this.query(
      `SELECT id, email, first_name, last_name, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    )
    if (!rows.length) {
      throw new MatchTraderApiError('User not found', {
        statusCode: 404,
        code: 'USER_NOT_FOUND'
      })
    }
    return rows[0]
  }

  async listLocalTradingAccountsByUser(userId) {
    return this.query(
      `SELECT id, user_id, mode, type, currency, leverage, status, created_at
       FROM trading_accounts
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    )
  }

  async getLocalTradingAccountForUser(userId, tradingAccountId) {
    const accountId = String(tradingAccountId || '').trim()
    let rows = await this.query(
      `SELECT id, user_id, mode, type, currency, leverage, status, created_at
       FROM trading_accounts
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [accountId, userId]
    )

    if (!rows.length) {
      try {
        const user = await this.getUserById(userId)
        await this.syncLocalTradingAccountsForUser(userId, user)
        rows = await this.query(
          `SELECT id, user_id, mode, type, currency, leverage, status, created_at
           FROM trading_accounts
           WHERE id = ? AND user_id = ?
           LIMIT 1`,
          [accountId, userId]
        )
      } catch (error) {
        // Preserve original not-found behavior if provider sync is unavailable.
      }
    }

    if (!rows.length) {
      throw new MatchTraderApiError('Trading account not found for user', {
        statusCode: 404,
        code: 'TRADING_ACCOUNT_NOT_FOUND'
      })
    }
    return rows[0]
  }

  async listAllLocalTradingAccounts() {
    return this.query(
      `SELECT ta.id, ta.user_id, ta.mode, ta.type, ta.currency, ta.leverage, ta.status, ta.created_at,
              u.email, u.first_name, u.last_name
       FROM trading_accounts ta
       LEFT JOIN users u ON u.id = ta.user_id
       ORDER BY ta.created_at DESC`
    )
  }

  async upsertTradingAccountForUser({
    userId,
    tradingAccountId,
    mode,
    type,
    currency,
    leverage,
    status
  }) {
    const accountId = String(tradingAccountId || '').trim()
    if (!accountId) {
      throw new MatchTraderApiError('Provider did not return trading account id', {
        statusCode: 502,
        code: 'PROVIDER_INVALID_RESPONSE'
      })
    }

    const existing = await this.query(
      `SELECT id, user_id FROM trading_accounts WHERE id = ? LIMIT 1`,
      [accountId]
    )

    if (existing.length > 0 && String(existing[0].user_id || '') !== String(userId)) {
      throw new MatchTraderApiError('Trading account already linked to another user', {
        statusCode: 409,
        code: 'TRADING_ACCOUNT_OWNERSHIP_CONFLICT'
      })
    }

    if (!existing.length) {
      await this.query(
        `INSERT INTO trading_accounts (id, user_id, mode, type, currency, leverage, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          String(userId),
          this.normalizeMode(mode),
          String(type || '').slice(0, 50) || null,
          String(currency || '').slice(0, 10) || null,
          String(leverage || '').slice(0, 10) || null,
          this.normalizeStatus(status)
        ]
      )
      return
    }

    await this.query(
      `UPDATE trading_accounts
       SET mode = ?,
           type = ?,
           currency = ?,
           leverage = ?,
           status = ?
       WHERE id = ?`,
      [
        this.normalizeMode(mode),
        String(type || '').slice(0, 50) || null,
        String(currency || '').slice(0, 10) || null,
        String(leverage || '').slice(0, 10) || null,
        this.normalizeStatus(status),
        accountId
      ]
    )
  }

  async findBrokerAccountByEmail(email) {
    try {
      const payload = await this.client.get(`/v1/accounts/by-email/${encodeURIComponent(email)}`)
      return this.unwrapData(payload)
    } catch (error) {
      if (error instanceof MatchTraderApiError && error.statusCode === 404) {
        return null
      }
      throw error
    }
  }

  async createBrokerAccountForUser(user, preferredPassword) {
    const password = String(preferredPassword || this.generatePassword())
    const payload = {
      email: user.email,
      password,
      personalDetails: {
        firstname: user.first_name || 'User',
        lastname: user.last_name || 'Trader'
      }
    }
    const created = await this.client.post('/v1/accounts', payload)
    return {
      account: this.unwrapData(created),
      password
    }
  }

  async ensureBrokerAccount(user, body = {}) {
    const preferredCreationPassword = this.pickFirstString([
      body.broker_password,
      body.brokerPassword
    ])

    const brokerAccountUuidFromRequest = this.pickFirstString([
      body.broker_account_uuid,
      body.brokerAccountUuid
    ])
    if (brokerAccountUuidFromRequest) {
      return {
        uuid: brokerAccountUuidFromRequest,
        source: 'request',
        generated_password: '',
        creation_password: ''
      }
    }

    const byEmail = await this.findBrokerAccountByEmail(user.email)
    if (byEmail) {
      const existingUuid = this.pickFirstString([byEmail.uuid, byEmail.accountUuid, byEmail.id])
      return {
        uuid: existingUuid,
        source: 'existing',
        generated_password: '',
        creation_password: ''
      }
    }

    const created = await this.createBrokerAccountForUser(user, preferredCreationPassword || undefined)
    return {
      uuid: this.pickFirstString([
        created.account && created.account.uuid,
        created.account && created.account.accountUuid,
        created.account && created.account.id
      ]),
      source: 'created',
      generated_password: this.extractProviderGeneratedPassword(created.account || {}),
      creation_password: created.password || ''
    }
  }

  async syncPortalPasswordForUser(userOrId, password, options = {}) {
    const normalizedPassword = String(password || '').trim()
    if (!normalizedPassword) {
      throw new MatchTraderApiError('password is required for Match-Trader sync', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    const user = (userOrId && typeof userOrId === 'object')
      ? userOrId
      : await this.getUserById(userOrId)

    const email = this.pickFirstString([user && user.email]).toLowerCase()
    if (!email) {
      throw new MatchTraderApiError('User email is required for Match-Trader sync', {
        statusCode: 422,
        code: 'BROKER_ACCOUNT_RESOLUTION_FAILED'
      })
    }

    const currentPassword = this.pickFirstString([
      options.currentPassword,
      options.current_password,
      options.oldPassword,
      options.old_password
    ])
    const createIfMissing = options.createIfMissing !== false
    const allowUnauthorizedFallbackCreate = options.allowUnauthorizedFallbackCreate !== false

    const byEmail = await this.findBrokerAccountByEmail(email)
    if (!byEmail) {
      if (!createIfMissing) {
        return {
          synced: false,
          skipped: true,
          reason: 'BROKER_ACCOUNT_NOT_FOUND'
        }
      }

      const created = await this.createBrokerAccountForUser(user, normalizedPassword)
      const createdAccount = created.account || {}
      const accountUuid = this.pickFirstString([
        createdAccount.uuid,
        createdAccount.accountUuid,
        createdAccount.id
      ])

      if (!accountUuid) {
        throw new MatchTraderApiError('Provider did not return broker account uuid', {
          statusCode: 502,
          code: 'PROVIDER_INVALID_RESPONSE',
          providerError: createdAccount
        })
      }

      return {
        synced: true,
        source: 'created',
        changed: true,
        account_uuid: accountUuid,
        provider: createdAccount
      }
    }

    const accountUuid = this.pickFirstString([byEmail.uuid, byEmail.accountUuid, byEmail.id])
    if (!accountUuid) {
      throw new MatchTraderApiError('Unable to resolve Match-Trader account UUID for password sync', {
        statusCode: 422,
        code: 'BROKER_ACCOUNT_RESOLUTION_FAILED',
        providerError: byEmail
      })
    }

    const plans = this.buildAccountPasswordChangePlans(accountUuid, normalizedPassword, currentPassword)
    try {
      const provider = await this.executePasswordChangePlans(plans)
      return {
        synced: true,
        source: 'existing',
        changed: true,
        account_uuid: accountUuid,
        provider
      }
    } catch (error) {
      if (
        createIfMissing &&
        allowUnauthorizedFallbackCreate &&
        error instanceof MatchTraderApiError &&
        Number(error.statusCode) === 401
      ) {
        try {
          const created = await this.createBrokerAccountForUser(user, normalizedPassword)
          const createdAccount = created.account || {}
          const freshAccountUuid = this.pickFirstString([
            createdAccount.uuid,
            createdAccount.accountUuid,
            createdAccount.id
          ])
          if (freshAccountUuid) {
            return {
              synced: true,
              source: 'created_fallback',
              changed: true,
              account_uuid: freshAccountUuid,
              provider: createdAccount
            }
          }
        } catch (fallbackError) {
          // preserve original provider authorization error when fallback creation is blocked
        }
      }

      throw error
    }
  }

  extractProviderTradingAccountEmail(providerAccount = {}) {
    return this.pickFirstString([
      providerAccount.email,
      providerAccount.accountInfo && providerAccount.accountInfo.email,
      providerAccount.account && providerAccount.account.email
    ])
  }

  extractProviderTradingAccountSystemUuid(providerAccount = {}) {
    return this.extractSystemUuid(providerAccount)
  }

  mapProviderTradingAccount(providerAccount = {}) {
    const tradingAccountId = this.findTradingAccountId(providerAccount)
    if (!tradingAccountId) return null

    return {
      tradingAccountId,
      mode: this.normalizeMode(
        this.pickFirstString([
          providerAccount.accountType,
          providerAccount.mode,
          providerAccount.type
        ]) || 'REAL'
      ),
      type: this.pickFirstString([
        providerAccount.group,
        providerAccount.offerName,
        providerAccount.offerUuid,
        providerAccount.accountType
      ]),
      currency: this.pickFirstString([
        providerAccount.currency,
        providerAccount.financeInfo && providerAccount.financeInfo.currency,
        providerAccount.accountInfo && providerAccount.accountInfo.currency
      ]),
      leverage: this.pickFirstString([
        providerAccount.leverage,
        providerAccount.financeInfo && providerAccount.financeInfo.leverage
      ]),
      status: this.pickFirstString([
        providerAccount.status,
        providerAccount.access,
        providerAccount.state
      ]) || 'ACTIVE',
      email: this.extractProviderTradingAccountEmail(providerAccount),
      systemUuid: this.extractProviderTradingAccountSystemUuid(providerAccount)
    }
  }

  mergeProviderTradingAccounts(collections = []) {
    const output = []
    const seen = new Set()

    collections.forEach((items) => {
      ;(items || []).forEach((item) => {
        const key = this.pickFirstString([
          this.findTradingAccountId(item),
          item && item.uuid,
          item && item.id,
          item && item.accountUuid
        ]) || JSON.stringify(item || {})

        if (seen.has(key)) return
        seen.add(key)
        output.push(item)
      })
    })

    return output
  }

  async listProviderTradingAccounts(searchTerm) {
    const normalizedSearch = String(searchTerm || '').trim()
    if (!normalizedSearch) return []

    const payload = await this.fetchWithPayloadVariants('/v1/trading-accounts', 'GET', [
      { query: normalizedSearch, page: 0, size: 200 },
      { query: normalizedSearch, size: 200 },
      { query: normalizedSearch },
      { email: normalizedSearch, page: 0, size: 200 },
      { email: normalizedSearch },
      { login: normalizedSearch, page: 0, size: 200 },
      { login: normalizedSearch }
    ])
    return this.parseCollection(payload)
  }

  async listProviderTradingAccountsByBrokerAccountUuid(brokerAccountUuid) {
    const normalizedUuid = String(brokerAccountUuid || '').trim()
    if (!normalizedUuid) return []

    const collections = []
    try {
      const payload = await this.fetchWithPayloadVariants('/v1/trading-accounts', 'GET', [
        { query: normalizedUuid, page: 0, size: 200 },
        { query: normalizedUuid, size: 200 },
        { query: normalizedUuid },
        { accountUuid: normalizedUuid, page: 0, size: 200 },
        { accountUuid: normalizedUuid },
        { brokerAccountUuid: normalizedUuid, page: 0, size: 200 },
        { brokerAccountUuid: normalizedUuid }
      ])
      collections.push(this.parseCollection(payload))
    } catch (error) {
      // continue to path fallback
    }

    try {
      const payload = await this.client.get(
        `/v1/accounts/${encodeURIComponent(normalizedUuid)}/trading-accounts`
      )
      collections.push(this.parseCollection(payload))
    } catch (error) {
      // keep search-result fallback even if account-scoped path is disabled
    }

    return this.mergeProviderTradingAccounts(collections)
  }

  async listProviderTradingAccountsByEmail(email) {
    const normalizedEmail = String(email || '').trim()
    if (!normalizedEmail) return []

    const collections = []
    try {
      collections.push(await this.listProviderTradingAccounts(normalizedEmail))
    } catch (error) {
      // continue with broker-account scoped fallback
    }

    try {
      const brokerAccount = await this.findBrokerAccountByEmail(normalizedEmail)
      const brokerUuid = this.pickFirstString([
        brokerAccount && brokerAccount.uuid,
        brokerAccount && brokerAccount.accountUuid,
        brokerAccount && brokerAccount.id
      ])
      if (brokerUuid) {
        collections.push(await this.listProviderTradingAccountsByBrokerAccountUuid(brokerUuid))
      }
    } catch (error) {
      // keep previous search results if broker-account lookup fails
    }

    return this.mergeProviderTradingAccounts(collections)
  }

  async syncLocalTradingAccountsForUser(userId, user = null) {
    const resolvedUser = user || await this.getUserById(userId)
    const normalizedEmail = String(resolvedUser.email || '').trim().toLowerCase()
    if (!normalizedEmail) return { scanned: 0, synced: 0 }

    const providerAccounts = await this.listProviderTradingAccountsByEmail(normalizedEmail)
    let synced = 0

    for (const providerAccount of providerAccounts) {
      const mapped = this.mapProviderTradingAccount(providerAccount)
      if (!mapped) continue

      const providerEmail = String(mapped.email || '').trim().toLowerCase()
      if (providerEmail && providerEmail !== normalizedEmail) continue

      try {
        await this.upsertTradingAccountForUser({
          userId,
          tradingAccountId: mapped.tradingAccountId,
          mode: mapped.mode,
          type: mapped.type,
          currency: mapped.currency,
          leverage: mapped.leverage,
          status: mapped.status
        })
        synced += 1
      } catch (error) {
        if (
          error instanceof MatchTraderApiError &&
          error.code === 'TRADING_ACCOUNT_OWNERSHIP_CONFLICT'
        ) {
          continue
        }
        throw error
      }
    }

    return {
      scanned: providerAccounts.length,
      synced
    }
  }

  mapOffer(offer = {}) {
    return {
      offer_uuid: String(offer.uuid || offer.offerUuid || offer.id || '').trim(),
      offer_name: offer.name || offer.groupName || null,
      demo: Boolean(offer.demo),
      currency: offer.currency || null,
      leverage: offer.leverage !== undefined && offer.leverage !== null ? String(offer.leverage) : null,
      hidden: Boolean(offer.hidden),
      description: offer.description || null,
      verification_required: Boolean(offer.verificationRequired),
      trading_account_auto_creation: Boolean(offer.tradingAccountAutoCreation),
      initial_deposit: offer.initialDeposit !== undefined && offer.initialDeposit !== null
        ? this.toSafeNumber(offer.initialDeposit)
        : null
    }
  }

  async listOffers(query = {}) {
    const mode = String(query.mode || '').trim().toUpperCase()
    const includeHidden = this.toBoolean(query.include_hidden)
    const instantOnly = this.toBoolean(query.instant_only)
    const payload = await this.client.get('/v1/offers')
    const offers = this.parseCollection(payload).map((offer) => this.mapOffer(offer))

    return offers.filter((offer) => {
      if (!offer.offer_uuid) return false
      if (!includeHidden && offer.hidden) return false
      if (instantOnly && !offer.trading_account_auto_creation) return false
      if (mode === 'DEMO' && !offer.demo) return false
      if (mode === 'REAL' && offer.demo) return false
      return true
    })
  }

  async resolveOfferForMode(mode, preferredOfferUuid = '') {
    const targetMode = this.normalizeMode(mode)
    const allOffers = await this.listOffers({ include_hidden: true })
    const matchingByMode = allOffers.filter((offer) => offer.demo === (targetMode === 'DEMO'))

    if (!matchingByMode.length) {
      throw new MatchTraderApiError(`No ${targetMode} offer is configured in Match-Trader`, {
        statusCode: 400,
        code: 'OFFER_NOT_CONFIGURED'
      })
    }

    const candidateUuid = String(preferredOfferUuid || '').trim() || this.defaultOfferUuid
    if (candidateUuid) {
      const selected = allOffers.find((offer) => offer.offer_uuid === candidateUuid)
      if (!selected) {
        throw new MatchTraderApiError('Selected offer_uuid does not exist', {
          statusCode: 400,
          code: 'INVALID_OFFER'
        })
      }
      if (selected.demo !== (targetMode === 'DEMO')) {
        throw new MatchTraderApiError(`Selected offer is not a ${targetMode} offer`, {
          statusCode: 400,
          code: 'OFFER_MODE_MISMATCH'
        })
      }
      return selected
    }

    const visible = matchingByMode.find((offer) => !offer.hidden)
    return visible || matchingByMode[0]
  }

  async createTradingAccountForUser(userId, body = {}) {
    const user = await this.getUserById(userId)
    const passwordNote = 'Use POST /api/matchtrader/customer/change-password to set or reset platform password.'
    const mode = this.normalizeMode(body.mode || body.account_mode)
    const requestedOfferUuid = String(body.offer_uuid || body.offerUuid || '').trim()
    if (!requestedOfferUuid) {
      throw new MatchTraderApiError('offer_uuid is required. Fetch available offers from /api/matchtrader/customer/offers', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    const selectedOffer = await this.resolveOfferForMode(mode, requestedOfferUuid)
    const offerUuid = selectedOffer.offer_uuid
    if (!selectedOffer.trading_account_auto_creation) {
      throw new MatchTraderApiError(
        'Selected offer requires manual confirmation. Choose an offer with trading_account_auto_creation=true.',
        {
          statusCode: 400,
          code: 'OFFER_REQUIRES_MANUAL_CONFIRMATION',
          providerError: { selected_offer: selectedOffer }
        }
      )
    }

    const brokerAccount = await this.ensureBrokerAccount(user, body)
    if (!brokerAccount.uuid) {
      throw new MatchTraderApiError('Unable to resolve broker account uuid', {
        statusCode: 502,
        code: 'BROKER_ACCOUNT_RESOLUTION_FAILED'
      })
    }

    const createVariants = this.buildTradingAccountCreateVariants({
      offerUuid,
      selectedOffer,
      body
    })

    const tryCreateTradingAccount = async (brokerAccountUuid) => {
      let createdPayloadCandidate = null
      let providerPayloadCandidate = null
      let requestErrorCandidate = null

      for (const providerBody of createVariants) {
        try {
          const createdPayload = await this.client.post(
            `/v1/accounts/${encodeURIComponent(brokerAccountUuid)}/trading-accounts`,
            providerBody
          )
          const candidate = this.unwrapData(createdPayload)
          providerPayloadCandidate = candidate

          const candidateTradingId = this.findTradingAccountId(candidate)
          const candidateStatus = String(candidate.status || '').toUpperCase()
          if (candidateTradingId || candidateStatus === 'CONFIRM' || candidateStatus === 'PENDING') {
            createdPayloadCandidate = candidate
            break
          }
        } catch (error) {
          requestErrorCandidate = error
          if (error instanceof MatchTraderApiError) {
            const statusCode = Number(error.statusCode)
            if ([400, 404, 405, 409, 422].includes(statusCode)) {
              continue
            }
          }
          throw error
        }
      }

      return {
        created: createdPayloadCandidate,
        providerPayload: providerPayloadCandidate,
        requestError: requestErrorCandidate
      }
    }

    const shouldRetryWithFreshBrokerAccount = (attemptResult) => {
      if (!attemptResult || brokerAccount.source !== 'existing') return false
      if (attemptResult.created) return false

      if (
        attemptResult.requestError instanceof MatchTraderApiError &&
        [401, 403].includes(Number(attemptResult.requestError.statusCode))
      ) {
        return true
      }

      const providerStatus = String(
        attemptResult.providerPayload && attemptResult.providerPayload.status
      ).toUpperCase()

      return ['FAILED', 'REJECTED', 'DENIED'].includes(providerStatus)
    }

    let brokerAccountUuidUsed = brokerAccount.uuid
    let knownPassword = ''
    let providerPasswordReturned = false
    if (brokerAccount.generated_password) {
      knownPassword = brokerAccount.generated_password
      providerPasswordReturned = true
    } else if (brokerAccount.creation_password) {
      knownPassword = brokerAccount.creation_password
    }
    let attempt = await tryCreateTradingAccount(brokerAccountUuidUsed)

    // In sandbox/shared environments, existing account UUID may not be writable for current token.
    // Retry once with a freshly created broker account owned by this integration.
    if (shouldRetryWithFreshBrokerAccount(attempt)) {
      const preferredCreationPassword = this.pickFirstString([
        body.broker_password,
        body.brokerPassword
      ])
      try {
        const freshBrokerAccount = await this.createBrokerAccountForUser(
          user,
          preferredCreationPassword || undefined
        )
        const freshBrokerAccountPayload = freshBrokerAccount.account || {}
        const freshBrokerUuid = this.pickFirstString([
          freshBrokerAccountPayload.uuid,
          freshBrokerAccountPayload.accountUuid,
          freshBrokerAccountPayload.id
        ])
        if (freshBrokerUuid && freshBrokerUuid !== brokerAccountUuidUsed) {
          brokerAccountUuidUsed = freshBrokerUuid
          const fallbackProviderPassword = this.extractProviderGeneratedPassword(
            freshBrokerAccountPayload
          )
          if (!knownPassword && fallbackProviderPassword) {
            knownPassword = fallbackProviderPassword
            providerPasswordReturned = true
          }
          if (!knownPassword && freshBrokerAccount.password) {
            knownPassword = freshBrokerAccount.password
          }
          const retryAttempt = await tryCreateTradingAccount(brokerAccountUuidUsed)
          if (retryAttempt.created) {
            attempt = retryAttempt
          } else {
            attempt = {
              created: null,
              providerPayload: retryAttempt.providerPayload || attempt.providerPayload,
              requestError: retryAttempt.requestError || attempt.requestError
            }
          }
        }
      } catch (createFreshAccountError) {
        // Keep original error context if fallback account creation is not allowed.
      }
    }

    let created = attempt.created
    if (!created && attempt.providerPayload) {
      created = attempt.providerPayload
    }
    if (!created && attempt.requestError) {
      throw attempt.requestError
    }
    if (!created) {
      throw new MatchTraderApiError('Trading account creation failed for all provider payload variants', {
        statusCode: 502,
        code: 'TRADING_ACCOUNT_CREATION_FAILED'
      })
    }

    const tradingAccountGeneratedPassword = this.extractProviderGeneratedPassword(created)
    if (tradingAccountGeneratedPassword) {
      knownPassword = tradingAccountGeneratedPassword
      providerPasswordReturned = true
    }

    const tradingAccountId = this.findTradingAccountId(created)
    if (!tradingAccountId) {
      const providerStatus = String(created.status || '').toUpperCase()
      if (providerStatus === 'CONFIRM' || providerStatus === 'PENDING') {
        return {
          pending: true,
          status: providerStatus,
          mode,
          broker_account_uuid: brokerAccountUuidUsed,
          provider_password_returned: providerPasswordReturned,
          provider_generated_password: knownPassword || null,
          password_note: passwordNote,
          selected_offer: selectedOffer,
          message: 'Trading account request submitted and awaits broker confirmation.',
          provider: created
        }
      }
      if (providerStatus === 'FAILED') {
        throw new MatchTraderApiError('Trading account creation was rejected by provider', {
          statusCode: 422,
          code: 'TRADING_ACCOUNT_CREATION_REJECTED',
          providerError: {
            selected_offer: selectedOffer,
            provider: created
          }
        })
      }
      throw new MatchTraderApiError('Broker API did not return trading account id', {
        statusCode: 502,
        code: 'PROVIDER_INVALID_RESPONSE',
        providerError: created
      })
    }

    await this.upsertTradingAccountForUser({
      userId,
      tradingAccountId,
      mode,
      type: selectedOffer.offer_name || offerUuid,
      currency: created.currency || body.currency || null,
      leverage: created.leverage || body.leverage || null,
      status: created.status || 'ACTIVE'
    })

    const data = {
      trading_account_id: String(tradingAccountId),
      mode,
      broker_account_uuid: brokerAccountUuidUsed,
      provider_password_returned: providerPasswordReturned,
      provider_generated_password: knownPassword || null,
      password_note: passwordNote,
      selected_offer: selectedOffer,
      provider: created
    }

    if (mode === 'DEMO' && body.initial_balance !== undefined && body.initial_balance !== null) {
      const amount = Number(body.initial_balance)
      if (Number.isFinite(amount) && amount > 0) {
        data.initial_deposit = await this.demoDeposit(userId, {
          trading_account_id: tradingAccountId,
          amount
        })
      }
    }

    return data
  }

  async getTradingAccountDetailsFromProvider(tradingAccountId, options = {}) {
    const normalizedTradingAccountId = String(tradingAccountId || '').trim()
    const requestedSystemUuid = this.pickFirstString([options.systemUuid])
    const variants = this.buildTradingAccountQueryVariants(
      normalizedTradingAccountId,
      {},
      requestedSystemUuid
    )

    let lastError = null
    for (const query of variants) {
      try {
        const payload = await this.client.get('/v1/trading-account', query)
        return this.unwrapData(payload)
      } catch (error) {
        lastError = error
      }
    }

    const userEmail = this.pickFirstString([options.userEmail])
    const searchTerms = [normalizedTradingAccountId]
    if (userEmail) searchTerms.push(userEmail)

    for (const searchTerm of searchTerms) {
      try {
        const providerAccounts = await this.listProviderTradingAccounts(searchTerm)
        const matched = providerAccounts.find((item) =>
          String(this.findTradingAccountId(item) || '') === normalizedTradingAccountId
        )
        if (matched) {
          return matched
        }
      } catch (error) {
        lastError = error
      }
    }

    if (userEmail) {
      try {
        const providerAccountsByEmail = await this.listProviderTradingAccountsByEmail(userEmail)
        const matchedByEmail = providerAccountsByEmail.find((item) =>
          String(this.findTradingAccountId(item) || '') === normalizedTradingAccountId
        )
        if (matchedByEmail) {
          return matchedByEmail
        }
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) throw lastError
    throw new MatchTraderApiError('Trading account details could not be resolved from provider', {
      statusCode: 404,
      code: 'TRADING_ACCOUNT_PROVIDER_NOT_FOUND'
    })
  }

  async listCustomerTradingAccounts(userId) {
    const user = await this.getUserById(userId)
    try {
      await this.syncLocalTradingAccountsForUser(userId, user)
    } catch (error) {
      console.warn(`[MatchTrader][sync-warning] user=${userId} message=${error.message}`)
    }

    const local = await this.listLocalTradingAccountsByUser(userId)
    const providerAccountMap = new Map()
    try {
      const providerAccounts = await this.listProviderTradingAccountsByEmail(user.email)
      providerAccounts.forEach((providerAccount) => {
        const providerTradingAccountId = this.findTradingAccountId(providerAccount)
        if (!providerTradingAccountId) return
        providerAccountMap.set(String(providerTradingAccountId), providerAccount)
      })
    } catch (error) {
      // We can still continue by querying accounts individually.
    }

    const accounts = await Promise.all(local.map(async (item) => {
      try {
        const provider = providerAccountMap.get(String(item.id)) ||
          await this.getTradingAccountDetailsFromProvider(item.id, { userEmail: user.email })
        return {
          trading_account_id: item.id,
          mode: item.mode,
          status: this.extractTradingStatus(provider) || item.status,
          leverage: this.extractTradingLeverage(provider) || item.leverage,
          currency: this.extractTradingCurrency(provider) || item.currency,
          balance: this.toSafeNumberOrDefault(this.extractTradingBalance(provider), 0),
          equity: this.toSafeNumberOrDefault(this.extractTradingEquity(provider), 0),
          provider
        }
      } catch (error) {
        return {
          trading_account_id: item.id,
          mode: item.mode,
          status: item.status,
          leverage: item.leverage,
          currency: item.currency,
          balance: 0,
          equity: 0,
          provider_error: error.message
        }
      }
    }))

    return accounts
  }

  async changeTradingPassword(userId, body = {}) {
    const tradingAccountId = String(body.trading_account_id || '').trim()
    const newPassword = String(body.new_password || body.password || '').trim()

    if (!tradingAccountId || !newPassword) {
      throw new MatchTraderApiError('trading_account_id and new_password are required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    const user = await this.getUserById(userId)
    await this.getLocalTradingAccountForUser(userId, tradingAccountId)
    const currentPassword = this.pickFirstString([
      body.current_password,
      body.currentPassword,
      body.old_password,
      body.oldPassword
    ])

    let tradingAccountDetails = null
    try {
      tradingAccountDetails = await this.getTradingAccountDetailsFromProvider(tradingAccountId, {
        userEmail: user.email
      })
    } catch (error) {
      tradingAccountDetails = null
    }

    let accountUuid = this.extractBrokerAccountUuid(tradingAccountDetails || {})
    if (!accountUuid) {
      const byEmail = await this.findBrokerAccountByEmail(user.email)
      if (byEmail) {
        accountUuid = this.pickFirstString([byEmail.uuid, byEmail.accountUuid, byEmail.id])
      }
    }

    if (!accountUuid) {
      throw new MatchTraderApiError('Unable to resolve Match-Trader account UUID for password change', {
        statusCode: 422,
        code: 'BROKER_ACCOUNT_RESOLUTION_FAILED'
      })
    }

    const plans = this.buildAccountPasswordChangePlans(accountUuid, newPassword, currentPassword)

    const provider = await this.executePasswordChangePlans(plans)
    return {
      trading_account_id: tradingAccountId,
      changed: true,
      account_uuid: accountUuid || null,
      provider
    }
  }

  async fetchWithPayloadVariants(path, method, variants) {
    let lastError = null
    for (const variant of variants) {
      try {
        if (String(method).toUpperCase() === 'GET') {
          return await this.client.get(path, variant)
        }
        return await this.client.post(path, variant)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new MatchTraderApiError('No request variant succeeded', {
      statusCode: 502,
      code: 'MATCH_TRADER_VARIANT_FAILED'
    })
  }

  isSystemUuidMissingError(error) {
    if (!(error instanceof MatchTraderApiError)) return false
    const messageBlob = JSON.stringify({
      message: error.message,
      details: error.providerError || null
    }).toLowerCase()
    return messageBlob.includes('systemuuid') && messageBlob.includes('required')
  }

  buildTradingDataByIdsPayloadVariants(tradingAccountId, filters = {}, systemUuid = '') {
    const baseBody = {
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(systemUuid ? { systemUuid } : {})
    }
    return [
      { ...baseBody, logins: [tradingAccountId] },
      { ...baseBody, loginList: [tradingAccountId] },
      { ...baseBody, tradingAccountLogins: [tradingAccountId] },
      { ...baseBody, accountLogins: [tradingAccountId] },
      { ...baseBody, ids: [tradingAccountId] }
    ]
  }

  async fetchTradingDataCollection({
    primaryPath,
    fallbackByIdsPath = '',
    tradingAccountId,
    filters = {},
    queryVariants = [],
    systemUuid = ''
  }) {
    try {
      const payload = await this.fetchWithPayloadVariants(primaryPath, 'GET', queryVariants)
      return this.parseCollection(payload)
    } catch (error) {
      if (!fallbackByIdsPath || !this.isSystemUuidMissingError(error)) {
        throw error
      }

      const payload = await this.fetchWithPayloadVariants(
        fallbackByIdsPath,
        'POST',
        this.buildTradingDataByIdsPayloadVariants(tradingAccountId, filters, systemUuid)
      )
      return this.parseCollection(payload)
    }
  }

  normalizeOrderHistoryStatuses(filters = {}) {
    const byArray = Array.isArray(filters.statuses) ? filters.statuses : null
    const byCsv = typeof filters.statuses === 'string' ? filters.statuses.split(',') : null
    const byStatusCsv = typeof filters.status === 'string' ? filters.status.split(',') : null
    const candidates = byArray || byCsv || byStatusCsv || []

    const normalized = candidates
      .map((item) => String(item || '').trim().toUpperCase())
      .filter(Boolean)

    if (normalized.length) {
      return Array.from(new Set(normalized))
    }

    return ['FILLED', 'CANCELLED', 'REJECTED', 'ADDED']
  }

  mergeOrderCollections(primary = [], secondary = []) {
    const output = []
    const seen = new Set()

    const pushUnique = (item) => {
      const key = this.pickFirstString([
        item && item.id,
        item && item.orderId,
        item && item.uuid,
        item && item.closingOrderID,
        item && item.ticket
      ]) || JSON.stringify(item || {})

      if (seen.has(key)) return
      seen.add(key)
      output.push(item)
    }

    ;[...(primary || []), ...(secondary || [])].forEach(pushUnique)
    return output
  }

  buildTradingAccountQueryVariants(tradingAccountId, baseFilters = {}, systemUuid = '') {
    const queryBases = [
      { login: tradingAccountId },
      { accountLogin: tradingAccountId },
      { tradingAccountLogin: tradingAccountId }
    ]

    const withSystem = systemUuid
      ? queryBases.map((base) => ({ ...base, systemUuid, ...baseFilters }))
      : []
    const withoutSystem = queryBases.map((base) => ({ ...base, ...baseFilters }))

    return withSystem.length ? [...withSystem, ...withoutSystem] : withoutSystem
  }

  async resolveTradingSystemUuid(tradingAccountId, filters = {}, options = {}) {
    const explicitSystemUuid = this.pickFirstString([
      options.systemUuid,
      filters.system_uuid,
      filters.systemUuid
    ])
    if (explicitSystemUuid) return explicitSystemUuid

    const userEmail = this.pickFirstString([options.userEmail, filters.user_email, filters.userEmail])

    try {
      const details = await this.getTradingAccountDetailsFromProvider(tradingAccountId, {
        userEmail
      })
      const fromDetails = this.extractSystemUuid(details || {})
      if (fromDetails) return fromDetails
    } catch (error) {
      // fall through
    }

    if (userEmail) {
      try {
        const providerAccounts = await this.listProviderTradingAccountsByEmail(userEmail)
        const matched = providerAccounts.find(
          (item) => String(this.findTradingAccountId(item) || '') === String(tradingAccountId)
        )
        const fromList = this.extractSystemUuid(matched || {})
        if (fromList) return fromList
      } catch (error) {
        // fall through
      }
    }

    try {
      const providerAccounts = await this.listProviderTradingAccounts(String(tradingAccountId || ''))
      const matched = providerAccounts.find(
        (item) => String(this.findTradingAccountId(item) || '') === String(tradingAccountId)
      )
      const fromSearch = this.extractSystemUuid(matched || {})
      if (fromSearch) return fromSearch
    } catch (error) {
      // fall through
    }

    return ''
  }

  async fetchOrdersByLogin(tradingAccountId, filters = {}, options = {}) {
    const baseFilters = {
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {})
    }
    const systemUuid = await this.resolveTradingSystemUuid(tradingAccountId, filters, options)
    const queryVariants = this.buildTradingAccountQueryVariants(
      tradingAccountId,
      baseFilters,
      systemUuid
    )

    const [pending, openPositions, closedBase] = await Promise.all([
      this.fetchTradingDataCollection({
        primaryPath: '/v1/trading-accounts/trading-data/active-orders',
        fallbackByIdsPath: '/v1/trading-accounts/trading-data/active-orders-by-ids',
        tradingAccountId,
        filters: baseFilters,
        queryVariants,
        systemUuid
      }),
      this.fetchTradingDataCollection({
        primaryPath: '/v1/trading-accounts/trading-data/open-positions',
        fallbackByIdsPath: '/v1/trading-accounts/trading-data/open-positions-by-ids',
        tradingAccountId,
        filters: baseFilters,
        queryVariants,
        systemUuid
      }),
      this.fetchTradingDataCollection({
        primaryPath: '/v1/trading-accounts/trading-data/closed-positions',
        fallbackByIdsPath: '/v1/trading-accounts/trading-data/closed-positions-by-ids',
        tradingAccountId,
        filters: baseFilters,
        queryVariants,
        systemUuid
      })
    ])

    let closed = closedBase
    const includeHistoryFallback = String(
      filters.include_history !== undefined ? filters.include_history : (filters.includeHistory || '')
    ).toLowerCase()

    if (closed.length === 0 || ['true', '1', 'yes', 'y'].includes(includeHistoryFallback)) {
      try {
        const historyFilters = { ...filters }
        if (!historyFilters.from) {
          historyFilters.from = '2000-01-01T00:00:00.000Z'
        }
        if (!historyFilters.limit) {
          historyFilters.limit = 1000
        }
        if (!historyFilters.statuses && !historyFilters.status) {
          historyFilters.statuses = ['FILLED', 'CANCELLED', 'REJECTED']
        }

        const historyOrders = await this.getOrderHistoryByLogin(
          tradingAccountId,
          historyFilters,
          options
        )
        closed = this.mergeOrderCollections(closed, historyOrders)
      } catch (error) {
        // Keep closed positions result even if history endpoint fails.
      }
    }

    const active = openPositions

    return {
      active_orders: active,
      open_positions: openPositions,
      pending_orders: pending,
      closed_orders: closed
    }
  }

  async getCustomerOrders(userId, query = {}) {
    const tradingAccountId = String(query.trading_account_id || '').trim()
    if (!tradingAccountId) {
      throw new MatchTraderApiError('trading_account_id query param is required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    await this.getLocalTradingAccountForUser(userId, tradingAccountId)
    const user = await this.getUserById(userId)
    const orders = await this.fetchOrdersByLogin(tradingAccountId, query, {
      userEmail: user.email
    })

    return {
      trading_account_id: tradingAccountId,
      ...orders
    }
  }

  async getCustomerOpenPositions(userId, query = {}) {
    const tradingAccountId = String(query.trading_account_id || '').trim()
    if (!tradingAccountId) {
      throw new MatchTraderApiError('trading_account_id query param is required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    await this.getLocalTradingAccountForUser(userId, tradingAccountId)
    const user = await this.getUserById(userId)
    const orders = await this.fetchOrdersByLogin(tradingAccountId, query, {
      userEmail: user.email
    })

    return {
      trading_account_id: tradingAccountId,
      open_positions: orders.open_positions || orders.active_orders || []
    }
  }

  async getOrderHistoryByLogin(tradingAccountId, filters = {}, options = {}) {
    const baseBody = {
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.limit ? { limit: Number(filters.limit) } : {})
    }
    const systemUuid = await this.resolveTradingSystemUuid(tradingAccountId, filters, options)
    const systemBody = systemUuid ? { systemUuid } : {}
    const statuses = this.normalizeOrderHistoryStatuses(filters)

    const payload = await this.fetchWithPayloadVariants(
      '/v1/trading-accounts/trading-data/order-history',
      'POST',
      [
        { ...baseBody, ...systemBody, statuses, logins: [tradingAccountId] },
        { ...baseBody, ...systemBody, statuses, loginList: [tradingAccountId] },
        { ...baseBody, ...systemBody, statuses, tradingAccountLogins: [tradingAccountId] },
        { ...baseBody, ...systemBody, statuses, accountLogins: [tradingAccountId] },
        { ...baseBody, ...systemBody, statuses: ['FILLED', 'CANCELLED', 'REJECTED'], logins: [tradingAccountId] },
        { ...baseBody, ...systemBody, statuses: ['FILLED', 'ADDED'], logins: [tradingAccountId] }
      ]
    )

    return this.parseCollection(payload)
  }

  async getCustomerHistory(userId, query = {}) {
    const tradingAccountId = String(query.trading_account_id || '').trim()
    if (!tradingAccountId) {
      throw new MatchTraderApiError('trading_account_id query param is required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    await this.getLocalTradingAccountForUser(userId, tradingAccountId)
    const user = await this.getUserById(userId)

    let orderHistory = []
    try {
      orderHistory = await this.getOrderHistoryByLogin(tradingAccountId, query, {
        userEmail: user.email
      })
    } catch (error) {
      const fallbackOrders = await this.fetchOrdersByLogin(tradingAccountId, query, {
        userEmail: user.email
      })
      orderHistory = this.mergeOrderCollections(
        fallbackOrders.closed_orders,
        [
          ...(fallbackOrders.pending_orders || []),
          ...(fallbackOrders.open_positions || fallbackOrders.active_orders || [])
        ]
      )
    }

    return {
      trading_account_id: tradingAccountId,
      history: orderHistory
    }
  }

  async getCustomerAllOrders(userId, query = {}) {
    const user = await this.getUserById(userId)
    try {
      await this.syncLocalTradingAccountsForUser(userId, user)
    } catch (error) {
      console.warn(`[MatchTrader][sync-warning] user=${userId} message=${error.message}`)
    }

    const accounts = await this.listLocalTradingAccountsByUser(userId)
    const providerErrors = []

    const aggregated = await this.mapWithConcurrency(accounts, async (account) => {
      try {
        const orders = await this.fetchOrdersByLogin(account.id, query, {
          userEmail: user.email
        })
        return {
          account,
          orders
        }
      } catch (error) {
        providerErrors.push({
          trading_account_id: account.id,
          account_mode: account.mode,
          message: error.message
        })
        return {
          account,
          orders: {
            active_orders: [],
            open_positions: [],
            pending_orders: [],
            closed_orders: []
          }
        }
      }
    }, 4)

    const active = []
    const openPositions = []
    const pending = []
    const closed = []

    aggregated.forEach((row) => {
      const meta = {
        trading_account_id: row.account.id,
        account_mode: row.account.mode
      }
      row.orders.active_orders.forEach((order) => active.push({ ...meta, order }))
      ;(row.orders.open_positions || row.orders.active_orders || []).forEach((order) => {
        openPositions.push({ ...meta, order })
      })
      row.orders.pending_orders.forEach((order) => pending.push({ ...meta, order }))
      row.orders.closed_orders.forEach((order) => closed.push({ ...meta, order }))
    })

    return {
      active_orders: active,
      open_positions: openPositions,
      pending_orders: pending,
      closed_orders: closed,
      summary: {
        trading_accounts_count: accounts.length,
        active_count: active.length,
        open_positions_count: openPositions.length,
        pending_count: pending.length,
        closed_count: closed.length
      },
      ...(providerErrors.length ? { provider_errors: providerErrors } : {})
    }
  }

  async createDemoAccount(userId, body = {}) {
    return this.createTradingAccountForUser(userId, {
      ...body,
      mode: 'DEMO'
    })
  }

  async demoDeposit(userId, body = {}) {
    const tradingAccountId = String(body.trading_account_id || '').trim()
    const amount = Number(body.amount)

    if (!tradingAccountId || !Number.isFinite(amount) || amount <= 0) {
      throw new MatchTraderApiError('trading_account_id and positive amount are required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    await this.getLocalTradingAccountForUser(userId, tradingAccountId)

    const variants = [
      { login: tradingAccountId, amount, comment: body.note || 'Demo top-up' },
      { tradingAccountLogin: tradingAccountId, amount, comment: body.note || 'Demo top-up' }
    ]

    try {
      const providerPayload = await this.fetchWithPayloadVariants('/v1/credit/in', 'POST', variants)
      const provider = this.unwrapData(providerPayload)
      return {
        trading_account_id: tradingAccountId,
        amount,
        simulated: false,
        provider
      }
    } catch (error) {
      if (
        error instanceof MatchTraderApiError &&
        [400, 404, 405, 422].includes(Number(error.statusCode))
      ) {
        return {
          trading_account_id: tradingAccountId,
          amount,
          simulated: true,
          reason: 'Provider did not accept demo credit, virtual handling applied'
        }
      }
      throw error
    }
  }

  async getTradeAccess(userId, query = {}) {
    const tradingAccountId = String(query.trading_account_id || '').trim()
    if (!tradingAccountId) {
      throw new MatchTraderApiError('trading_account_id query param is required', {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })
    }

    await this.getLocalTradingAccountForUser(userId, tradingAccountId)

    return {
      trading_account_id: tradingAccountId,
      platform_url: this.platformUrl
    }
  }

  async getAdminAccounts() {
    const rows = await this.listAllLocalTradingAccounts()
    return rows.map((item) => ({
      user_id: item.user_id,
      email: item.email || null,
      first_name: item.first_name || null,
      last_name: item.last_name || null,
      trading_account_id: item.id,
      mode: item.mode,
      status: item.status,
      currency: item.currency,
      leverage: item.leverage,
      created_at: item.created_at
    }))
  }

  async mapWithConcurrency(items, mapper, limit = 5) {
    const output = []
    let index = 0

    const runWorker = async () => {
      while (index < items.length) {
        const current = index
        index += 1
        output[current] = await mapper(items[current], current)
      }
    }

    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, () => runWorker())
    await Promise.all(workers)
    return output
  }

  async getAdminOrders(query = {}) {
    const accounts = await this.listAllLocalTradingAccounts()
    const aggregated = await this.mapWithConcurrency(accounts, async (account) => {
      try {
        const orders = await this.fetchOrdersByLogin(account.id, query, {
          userEmail: account.email || ''
        })
        return {
          account,
          orders
        }
      } catch (error) {
        return {
          account,
          orders: {
            active_orders: [],
            open_positions: [],
            pending_orders: [],
            closed_orders: []
          },
          provider_error: error.message
        }
      }
    }, 4)

    const active = []
    const openPositions = []
    const pending = []
    const closed = []

    for (const row of aggregated) {
      const accountMeta = {
        trading_account_id: row.account.id,
        user_id: row.account.user_id,
        email: row.account.email
      }
      row.orders.active_orders.forEach((item) => active.push({ ...accountMeta, order: item }))
      ;(row.orders.open_positions || row.orders.active_orders || []).forEach((item) => {
        openPositions.push({ ...accountMeta, order: item })
      })
      row.orders.pending_orders.forEach((item) => pending.push({ ...accountMeta, order: item }))
      row.orders.closed_orders.forEach((item) => closed.push({ ...accountMeta, order: item }))
    }

    return {
      active_orders: active,
      open_positions: openPositions,
      pending_orders: pending,
      closed_orders: closed,
      summary: {
        active_count: active.length,
        open_positions_count: openPositions.length,
        pending_count: pending.length,
        closed_count: closed.length
      }
    }
  }

  async getAdminUserDetails(userId, query = {}) {
    const user = await this.getUserByIdForAdmin(userId)
    try {
      await this.syncLocalTradingAccountsForUser(userId, user)
    } catch (error) {
      console.warn(`[MatchTrader][admin-sync-warning] user=${userId} message=${error.message}`)
    }
    const localAccounts = await this.listLocalTradingAccountsByUser(userId)

    const tradingAccounts = await Promise.all(localAccounts.map(async (account) => {
      let providerDetails = null
      let history = []

      try {
        providerDetails = await this.getTradingAccountDetailsFromProvider(account.id, {
          userEmail: user.email || ''
        })
      } catch (error) {
        providerDetails = { provider_error: error.message }
      }

      try {
        history = await this.getOrderHistoryByLogin(account.id, query, {
          userEmail: user.email || ''
        })
      } catch (error) {
        history = []
      }

      return {
        trading_account_id: account.id,
        mode: account.mode,
        status: this.extractTradingStatus(providerDetails) || account.status,
        currency: this.extractTradingCurrency(providerDetails) || account.currency,
        leverage: this.extractTradingLeverage(providerDetails) || account.leverage,
        balance: this.toSafeNumberOrDefault(this.extractTradingBalance(providerDetails), 0),
        equity: this.toSafeNumberOrDefault(this.extractTradingEquity(providerDetails), 0),
        history
      }
    }))

    const balances = tradingAccounts.map((item) => ({
      trading_account_id: item.trading_account_id,
      balance: item.balance,
      equity: item.equity,
      currency: item.currency
    }))

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        created_at: user.created_at
      },
      trading_accounts: tradingAccounts,
      balances,
      order_history: tradingAccounts.flatMap((item) =>
        item.history.map((entry) => ({
          trading_account_id: item.trading_account_id,
          entry
        }))
      )
    }
  }
}

module.exports = new MatchTraderService()
