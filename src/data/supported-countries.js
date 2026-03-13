const supportedCountries = [
  { countryCode: 'AE', countryName: 'United Arab Emirates', currencyCode: 'AED' },
  { countryCode: 'IN', countryName: 'India', currencyCode: 'INR' },
  { countryCode: 'US', countryName: 'United States', currencyCode: 'USD' },
  { countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP' },
  { countryCode: 'EU', countryName: 'Eurozone', currencyCode: 'EUR' },
  { countryCode: 'CA', countryName: 'Canada', currencyCode: 'CAD' },
  { countryCode: 'AU', countryName: 'Australia', currencyCode: 'AUD' },
  { countryCode: 'NZ', countryName: 'New Zealand', currencyCode: 'NZD' },
  { countryCode: 'SA', countryName: 'Saudi Arabia', currencyCode: 'SAR' },
  { countryCode: 'QA', countryName: 'Qatar', currencyCode: 'QAR' },
  { countryCode: 'OM', countryName: 'Oman', currencyCode: 'OMR' },
  { countryCode: 'KW', countryName: 'Kuwait', currencyCode: 'KWD' },
  { countryCode: 'BH', countryName: 'Bahrain', currencyCode: 'BHD' },
  { countryCode: 'SG', countryName: 'Singapore', currencyCode: 'SGD' },
  { countryCode: 'MY', countryName: 'Malaysia', currencyCode: 'MYR' },
  { countryCode: 'TH', countryName: 'Thailand', currencyCode: 'THB' },
  { countryCode: 'JP', countryName: 'Japan', currencyCode: 'JPY' },
  { countryCode: 'KR', countryName: 'South Korea', currencyCode: 'KRW' },
  { countryCode: 'HK', countryName: 'Hong Kong', currencyCode: 'HKD' },
  { countryCode: 'CN', countryName: 'China', currencyCode: 'CNY' },
  { countryCode: 'TR', countryName: 'Turkey', currencyCode: 'TRY' },
  { countryCode: 'EG', countryName: 'Egypt', currencyCode: 'EGP' },
  { countryCode: 'ZA', countryName: 'South Africa', currencyCode: 'ZAR' },
  { countryCode: 'NG', countryName: 'Nigeria', currencyCode: 'NGN' },
  { countryCode: 'KE', countryName: 'Kenya', currencyCode: 'KES' },
  { countryCode: 'PK', countryName: 'Pakistan', currencyCode: 'PKR' },
  { countryCode: 'BD', countryName: 'Bangladesh', currencyCode: 'BDT' },
  { countryCode: 'LK', countryName: 'Sri Lanka', currencyCode: 'LKR' },
  { countryCode: 'NP', countryName: 'Nepal', currencyCode: 'NPR' },
  { countryCode: 'PH', countryName: 'Philippines', currencyCode: 'PHP' },
  { countryCode: 'ID', countryName: 'Indonesia', currencyCode: 'IDR' },
  { countryCode: 'VN', countryName: 'Vietnam', currencyCode: 'VND' },
  { countryCode: 'BR', countryName: 'Brazil', currencyCode: 'BRL' },
  { countryCode: 'MX', countryName: 'Mexico', currencyCode: 'MXN' },
  { countryCode: 'AR', countryName: 'Argentina', currencyCode: 'ARS' },
  { countryCode: 'CL', countryName: 'Chile', currencyCode: 'CLP' },
  { countryCode: 'CO', countryName: 'Colombia', currencyCode: 'COP' },
  { countryCode: 'CH', countryName: 'Switzerland', currencyCode: 'CHF' },
  { countryCode: 'SE', countryName: 'Sweden', currencyCode: 'SEK' },
  { countryCode: 'NO', countryName: 'Norway', currencyCode: 'NOK' },
  { countryCode: 'DK', countryName: 'Denmark', currencyCode: 'DKK' }
]

function normalizeCountryCode(value) {
  const code = String(value || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  return code
}

function normalizeCurrencyCode(value) {
  const code = String(value || '').trim().toUpperCase()
  if (!/^[A-Z]{3,10}$/.test(code)) return null
  return code
}

function findSupportedCountry(countryCode) {
  const normalized = normalizeCountryCode(countryCode)
  if (!normalized) return null
  return supportedCountries.find((item) => item.countryCode === normalized) || null
}

module.exports = {
  supportedCountries,
  normalizeCountryCode,
  normalizeCurrencyCode,
  findSupportedCountry
}
