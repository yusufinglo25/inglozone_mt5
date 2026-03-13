const { v4: uuidv4 } = require('uuid')
const db = require('../config/db')
const {
  supportedCountries,
  normalizeCountryCode,
  normalizeCurrencyCode,
  findSupportedCountry
} = require('../data/supported-countries')

const COUNTRY_ALIASES = {
  UAE: 'AE',
  INDIA: 'IN',
  USA: 'US',
  'UNITED STATES OF AMERICA': 'US',
  'UNITED ARAB EMIRATES': 'AE'
}

class CurrencyService {
  toMoney(value, decimals = 2) {
    const num = Number(value)
    if (!Number.isFinite(num)) return 0
    return Number(num.toFixed(decimals))
  }

  parseCountryCode(input) {
    const raw = String(input || '').trim().toUpperCase()
    const normalized = normalizeCountryCode(raw)
    if (normalized) return normalized
    return COUNTRY_ALIASES[raw] || null
  }

  parseCurrencyCode(input) {
    return normalizeCurrencyCode(input)
  }

  getSupportedCountries() {
    return [...supportedCountries].sort((a, b) => a.countryName.localeCompare(b.countryName))
  }

  getSupportedCountryByCode(countryCode) {
    const code = this.parseCountryCode(countryCode)
    if (!code) return null
    return findSupportedCountry(code)
  }

  defaultRateForCountry(countryCode) {
    if (countryCode === 'AE') return 3.66
    if (countryCode === 'IN') return Number(process.env.INR_TO_USD_RATE || 83.5)
    return 1
  }

  async listCurrencyRates({ activeOnly = false } = {}) {
    const where = activeOnly ? 'WHERE is_active = true' : ''
    const [rows] = await db.promise().query(
      `SELECT id, country_code AS countryCode, country_name AS countryName, currency_code AS currencyCode,
              usd_rate AS usdRate, is_active AS isActive, updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
       FROM country_currency_rates
       ${where}
       ORDER BY country_name ASC`
    )

    return rows.map((row) => ({
      ...row,
      usdRate: Number(row.usdRate)
    }))
  }

  async getCurrencyRateByCountry(countryCode, { includeInactive = false, fallbackToDefault = true } = {}) {
    const normalizedCountry = this.parseCountryCode(countryCode)
    if (!normalizedCountry) {
      throw new Error('Invalid country code')
    }

    const [rows] = await db.promise().query(
      `SELECT id, country_code AS countryCode, country_name AS countryName, currency_code AS currencyCode,
              usd_rate AS usdRate, is_active AS isActive, updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
       FROM country_currency_rates
       WHERE country_code = ?
         ${includeInactive ? '' : 'AND is_active = true'}
       LIMIT 1`,
      [normalizedCountry]
    )

    if (rows.length > 0) {
      return {
        ...rows[0],
        usdRate: Number(rows[0].usdRate)
      }
    }

    if (!fallbackToDefault) return null

    const supported = this.getSupportedCountryByCode(normalizedCountry)
    return {
      id: null,
      countryCode: normalizedCountry,
      countryName: supported?.countryName || normalizedCountry,
      currencyCode: supported?.currencyCode || 'USD',
      usdRate: this.defaultRateForCountry(normalizedCountry),
      isActive: true,
      updatedBy: null,
      createdAt: null,
      updatedAt: null
    }
  }

  async upsertCurrencyRate({ id = null, countryCode, countryName, currencyCode, usdRate, updatedBy }) {
    const normalizedCountry = this.parseCountryCode(countryCode)
    if (!normalizedCountry) throw new Error('countryCode must be ISO-2 format')

    const supported = this.getSupportedCountryByCode(normalizedCountry)
    const resolvedCountryName = String(countryName || supported?.countryName || '').trim()
    const resolvedCurrencyCode = this.parseCurrencyCode(currencyCode || supported?.currencyCode || '')
    const numericRate = Number(usdRate)

    if (!resolvedCountryName) throw new Error('countryName is required')
    if (!resolvedCurrencyCode) throw new Error('currencyCode is required')
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      throw new Error('usdRate must be a positive number')
    }

    if (id) {
      await db.promise().query(
        `UPDATE country_currency_rates
         SET country_code = ?, country_name = ?, currency_code = ?, usd_rate = ?, is_active = true, updated_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [normalizedCountry, resolvedCountryName, resolvedCurrencyCode, numericRate, updatedBy || null, id]
      )
    } else {
      const [existing] = await db.promise().query(
        `SELECT id FROM country_currency_rates WHERE country_code = ? LIMIT 1`,
        [normalizedCountry]
      )
      if (existing.length > 0) {
        id = existing[0].id
        await db.promise().query(
          `UPDATE country_currency_rates
           SET country_name = ?, currency_code = ?, usd_rate = ?, is_active = true, updated_by = ?, updated_at = NOW()
           WHERE id = ?`,
          [resolvedCountryName, resolvedCurrencyCode, numericRate, updatedBy || null, id]
        )
      } else {
        id = uuidv4()
        await db.promise().query(
          `INSERT INTO country_currency_rates
           (id, country_code, country_name, currency_code, usd_rate, is_active, updated_by)
           VALUES (?, ?, ?, ?, ?, true, ?)`,
          [id, normalizedCountry, resolvedCountryName, resolvedCurrencyCode, numericRate, updatedBy || null]
        )
      }
    }

    const [rows] = await db.promise().query(
      `SELECT id, country_code AS countryCode, country_name AS countryName, currency_code AS currencyCode,
              usd_rate AS usdRate, is_active AS isActive, updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
       FROM country_currency_rates
       WHERE id = ?
       LIMIT 1`,
      [id]
    )
    return {
      ...rows[0],
      usdRate: Number(rows[0].usdRate)
    }
  }

  async updateCurrencyRateStatus({ id, isActive, updatedBy }) {
    if (!id) throw new Error('Rate id is required')
    await db.promise().query(
      `UPDATE country_currency_rates
       SET is_active = ?, updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [Boolean(isActive), updatedBy || null, id]
    )
  }

  async resolveRegistrationCountry(input = {}) {
    const normalizedCountry = this.parseCountryCode(input.countryCode || input.registrationCountryCode)
    if (!normalizedCountry) {
      throw new Error('registrationCountryCode must be ISO-2 format')
    }
    const rate = await this.getCurrencyRateByCountry(normalizedCountry, { fallbackToDefault: true })
    return {
      countryCode: normalizedCountry,
      countryName: rate.countryName,
      currencyCode: rate.currencyCode
    }
  }

  async getUserRegistrationCountry(userId) {
    const [rows] = await db.promise().query(
      `SELECT u.registration_country_code AS registrationCountryCode,
              u.registration_country_name AS registrationCountryName,
              u.registration_currency_code AS registrationCurrencyCode,
              kp.country_of_residence AS countryOfResidence
       FROM users u
       LEFT JOIN kyc_profiles kp ON kp.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [userId]
    )

    if (rows.length === 0) {
      throw new Error('User not found')
    }

    const row = rows[0]
    const fallbackFromKyc = this.parseCountryCode(row.countryOfResidence)
    const countryCode = this.parseCountryCode(row.registrationCountryCode) || fallbackFromKyc || 'AE'
    const rate = await this.getCurrencyRateByCountry(countryCode, { fallbackToDefault: true })
    const countryName = String(row.registrationCountryName || rate.countryName || '').trim() || rate.countryName
    const currencyCode = this.parseCurrencyCode(row.registrationCurrencyCode) || rate.currencyCode

    return {
      countryCode,
      countryName,
      currencyCode,
      usdRate: rate.usdRate
    }
  }

  async getUserDisplayCurrency(userId) {
    const country = await this.getUserRegistrationCountry(userId)
    return {
      countryCode: country.countryCode,
      countryName: country.countryName,
      currencyCode: country.currencyCode,
      usdRate: this.toMoney(country.usdRate, 6),
      conversionRule: `1 USD = ${this.toMoney(country.usdRate, 6)} ${country.currencyCode}`
    }
  }

  convertUsdToLocal(usdAmount, usdRate) {
    const usd = Number(usdAmount)
    const rate = Number(usdRate)
    if (!Number.isFinite(usd) || usd <= 0) {
      throw new Error('USD amount must be a positive number')
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('USD rate must be a positive number')
    }
    return this.toMoney(usd * rate)
  }

  async createConversionSnapshot({ userId, usdAmount }) {
    const amountUSD = this.toMoney(usdAmount)
    if (!Number.isFinite(amountUSD) || amountUSD <= 0) {
      throw new Error('USD amount must be a positive number')
    }

    const userCurrency = await this.getUserRegistrationCountry(userId)
    const localAmount = this.convertUsdToLocal(amountUSD, userCurrency.usdRate)
    return {
      amountUSD,
      localAmount,
      localCurrencyCode: userCurrency.currencyCode,
      usdToLocalRate: this.toMoney(userCurrency.usdRate, 6),
      countryCode: userCurrency.countryCode,
      countryName: userCurrency.countryName
    }
  }
}

module.exports = new CurrencyService()
