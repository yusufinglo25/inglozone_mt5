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
      payload.id,
      payload.uuid
    ]
      .map((item) => (item === undefined || item === null ? null : String(item).trim()))
      .filter(Boolean)
    return candidates[0] || null
  }

  toSafeNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  toBoolean(value) {
    if (typeof value === 'boolean') return value
    const normalized = String(value || '').trim().toLowerCase()
    return ['true', '1', 'yes', 'y'].includes(normalized)
  }

  generatePassword() {
    const raw = crypto.randomBytes(20).toString('base64url')
    return `Mt#${raw.slice(0, 16)}1!`
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
    const rows = await this.query(
      `SELECT id, user_id, mode, type, currency, leverage, status, created_at
       FROM trading_accounts
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [String(tradingAccountId), userId]
    )
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
    return this.unwrapData(created)
  }

  async ensureBrokerAccount(user, body = {}) {
    if (body.broker_account_uuid) {
      return { uuid: String(body.broker_account_uuid), source: 'request' }
    }

    const byEmail = await this.findBrokerAccountByEmail(user.email)
    if (byEmail) {
      return {
        uuid: String(byEmail.uuid || byEmail.accountUuid || byEmail.id || ''),
        source: 'existing'
      }
    }

    const created = await this.createBrokerAccountForUser(user, body.broker_password)
    return {
      uuid: String(created.uuid || created.accountUuid || created.id || ''),
      source: 'created'
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
      verification_required: Boolean(offer.verificationRequired)
    }
  }

  async listOffers(query = {}) {
    const mode = String(query.mode || '').trim().toUpperCase()
    const includeHidden = this.toBoolean(query.include_hidden)
    const payload = await this.client.get('/v1/offers')
    const offers = this.parseCollection(payload).map((offer) => this.mapOffer(offer))

    return offers.filter((offer) => {
      if (!offer.offer_uuid) return false
      if (!includeHidden && offer.hidden) return false
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

    const brokerAccount = await this.ensureBrokerAccount(user, body)
    if (!brokerAccount.uuid) {
      throw new MatchTraderApiError('Unable to resolve broker account uuid', {
        statusCode: 502,
        code: 'BROKER_ACCOUNT_RESOLUTION_FAILED'
      })
    }

    const providerBody = {
      offerUuid,
      ...(body.commission_uuid || body.commissionUuid ? { commissionUuid: body.commission_uuid || body.commissionUuid } : {}),
      ...(body.currency ? { currency: body.currency } : {}),
      ...(body.leverage ? { leverage: body.leverage } : {}),
      ...(mode === 'DEMO' ? { demo: true } : {})
    }

    const createdPayload = await this.client.post(
      `/v1/accounts/${encodeURIComponent(brokerAccount.uuid)}/trading-accounts`,
      providerBody
    )
    const created = this.unwrapData(createdPayload)

    const tradingAccountId = this.findTradingAccountId(created)
    if (!tradingAccountId) {
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
      broker_account_uuid: brokerAccount.uuid,
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

  async getTradingAccountDetailsFromProvider(tradingAccountId) {
    const variants = [
      { login: tradingAccountId },
      { accountLogin: tradingAccountId },
      { tradingAccountLogin: tradingAccountId }
    ]

    let lastError = null
    for (const query of variants) {
      try {
        const payload = await this.client.get('/v1/trading-account', query)
        return this.unwrapData(payload)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  }

  async listCustomerTradingAccounts(userId) {
    const local = await this.listLocalTradingAccountsByUser(userId)

    const accounts = await Promise.all(local.map(async (item) => {
      try {
        const provider = await this.getTradingAccountDetailsFromProvider(item.id)
        return {
          trading_account_id: item.id,
          mode: item.mode,
          status: provider.status || item.status,
          leverage: provider.leverage || item.leverage,
          currency: provider.currency || item.currency,
          balance: this.toSafeNumber(provider.balance),
          equity: this.toSafeNumber(provider.equity),
          provider
        }
      } catch (error) {
        return {
          trading_account_id: item.id,
          mode: item.mode,
          status: item.status,
          leverage: item.leverage,
          currency: item.currency,
          balance: null,
          equity: null,
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

    await this.getLocalTradingAccountForUser(userId, tradingAccountId)

    const variants = [
      { login: tradingAccountId, newPassword, currentPassword: body.current_password || undefined },
      { login: tradingAccountId, password: newPassword, currentPassword: body.current_password || undefined },
      { tradingAccountLogin: tradingAccountId, newPassword, oldPassword: body.current_password || undefined }
    ]

    let lastError = null
    for (const payload of variants) {
      try {
        const providerPayload = await this.client.post('/v1/change-password', payload)
        const provider = this.unwrapData(providerPayload)
        return {
          trading_account_id: tradingAccountId,
          changed: true,
          provider
        }
      } catch (error) {
        lastError = error
        if (!(error instanceof MatchTraderApiError) || error.statusCode >= 500) {
          break
        }
      }
    }

    throw lastError || new MatchTraderApiError('Failed to change trading password', {
      statusCode: 502,
      code: 'MATCH_TRADER_PASSWORD_CHANGE_FAILED'
    })
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

  classifyPendingOrders(activeOrders) {
    const pendingKeywords = ['pending', 'limit', 'stop']
    return activeOrders.filter((order) => {
      const blob = JSON.stringify(order).toLowerCase()
      return pendingKeywords.some((item) => blob.includes(item))
    })
  }

  async fetchOrdersByLogin(tradingAccountId, filters = {}) {
    const baseFilters = {
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {})
    }

    const activeOrders = await this.fetchWithPayloadVariants(
      '/v1/trading-accounts/trading-data/active-orders',
      'GET',
      [
        { login: tradingAccountId, ...baseFilters },
        { accountLogin: tradingAccountId, ...baseFilters },
        { tradingAccountLogin: tradingAccountId, ...baseFilters }
      ]
    )

    const closedOrders = await this.fetchWithPayloadVariants(
      '/v1/trading-accounts/trading-data/closed-positions',
      'GET',
      [
        { login: tradingAccountId, ...baseFilters },
        { accountLogin: tradingAccountId, ...baseFilters },
        { tradingAccountLogin: tradingAccountId, ...baseFilters }
      ]
    )

    const active = this.parseCollection(activeOrders)
    const closed = this.parseCollection(closedOrders)
    const pending = this.classifyPendingOrders(active)

    return {
      active_orders: active,
      pending_orders: pending.length ? pending : active,
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
    const orders = await this.fetchOrdersByLogin(tradingAccountId, query)

    return {
      trading_account_id: tradingAccountId,
      ...orders
    }
  }

  async getOrderHistoryByLogin(tradingAccountId, filters = {}) {
    const baseBody = {
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {})
    }

    const payload = await this.fetchWithPayloadVariants(
      '/v1/trading-accounts/trading-data/order-history',
      'POST',
      [
        { ...baseBody, logins: [tradingAccountId] },
        { ...baseBody, loginList: [tradingAccountId] },
        { ...baseBody, tradingAccountLogins: [tradingAccountId] },
        { ...baseBody, accountLogins: [tradingAccountId] }
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

    let orderHistory = []
    try {
      orderHistory = await this.getOrderHistoryByLogin(tradingAccountId, query)
    } catch (error) {
      const fallbackOrders = await this.fetchOrdersByLogin(tradingAccountId, query)
      orderHistory = [
        ...fallbackOrders.closed_orders,
        ...fallbackOrders.active_orders
      ]
    }

    return {
      trading_account_id: tradingAccountId,
      history: orderHistory
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
        const orders = await this.fetchOrdersByLogin(account.id, query)
        return {
          account,
          orders
        }
      } catch (error) {
        return {
          account,
          orders: {
            active_orders: [],
            pending_orders: [],
            closed_orders: []
          },
          provider_error: error.message
        }
      }
    }, 4)

    const active = []
    const pending = []
    const closed = []

    for (const row of aggregated) {
      const accountMeta = {
        trading_account_id: row.account.id,
        user_id: row.account.user_id,
        email: row.account.email
      }
      row.orders.active_orders.forEach((item) => active.push({ ...accountMeta, order: item }))
      row.orders.pending_orders.forEach((item) => pending.push({ ...accountMeta, order: item }))
      row.orders.closed_orders.forEach((item) => closed.push({ ...accountMeta, order: item }))
    }

    return {
      active_orders: active,
      pending_orders: pending,
      closed_orders: closed,
      summary: {
        active_count: active.length,
        pending_count: pending.length,
        closed_count: closed.length
      }
    }
  }

  async getAdminUserDetails(userId, query = {}) {
    const user = await this.getUserByIdForAdmin(userId)
    const localAccounts = await this.listLocalTradingAccountsByUser(userId)

    const tradingAccounts = await Promise.all(localAccounts.map(async (account) => {
      let providerDetails = null
      let history = []

      try {
        providerDetails = await this.getTradingAccountDetailsFromProvider(account.id)
      } catch (error) {
        providerDetails = { provider_error: error.message }
      }

      try {
        history = await this.getOrderHistoryByLogin(account.id, query)
      } catch (error) {
        history = []
      }

      return {
        trading_account_id: account.id,
        mode: account.mode,
        status: providerDetails.status || account.status,
        currency: providerDetails.currency || account.currency,
        leverage: providerDetails.leverage || account.leverage,
        balance: this.toSafeNumber(providerDetails.balance),
        equity: this.toSafeNumber(providerDetails.equity),
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
