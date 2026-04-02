const getPrismaClient = require('../lib/prisma')

const HEALTH_CACHE_TTL_MS = 5000
const DB_TIMEOUT_MS = 80

const healthState = {
  checkedAt: 0,
  isConnected: false,
  inFlightCheck: null
}

const setNoStoreHeaders = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  res.set('Surrogate-Control', 'no-store')
}

const runDatabaseProbe = async () => {
  const prisma = getPrismaClient()
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Database health check timed out after ${DB_TIMEOUT_MS}ms`)), DB_TIMEOUT_MS)
  })

  await Promise.race([
    prisma.$queryRaw`SELECT 1`,
    timeoutPromise
  ])

  healthState.checkedAt = Date.now()
  healthState.isConnected = true

  return true
}

const refreshDatabaseHealth = async () => {
  if (healthState.inFlightCheck) {
    return healthState.inFlightCheck
  }

  healthState.inFlightCheck = runDatabaseProbe()
    .catch((error) => {
      healthState.checkedAt = Date.now()
      healthState.isConnected = false
      return false
    })
    .finally(() => {
      healthState.inFlightCheck = null
    })

  return healthState.inFlightCheck
}

const getDatabaseHealth = async () => {
  if (!healthState.checkedAt) {
    return refreshDatabaseHealth()
  }

  const cacheAge = Date.now() - healthState.checkedAt

  if (cacheAge >= HEALTH_CACHE_TTL_MS && !healthState.inFlightCheck) {
    void refreshDatabaseHealth()
  }

  return healthState.isConnected
}

void refreshDatabaseHealth()

setInterval(() => {
  void refreshDatabaseHealth()
}, HEALTH_CACHE_TTL_MS).unref()

exports.getHealth = async (req, res) => {
  try {
    const isDatabaseConnected = await getDatabaseHealth()
    const payload = {
      status: isDatabaseConnected ? 'ok' : 'error',
      uptime: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
      database: isDatabaseConnected ? 'connected' : 'disconnected'
    }

    setNoStoreHeaders(res)

    return res.status(isDatabaseConnected ? 200 : 503).json(payload)
  } catch (error) {
    console.error('Health endpoint failed unexpectedly:', error)

    setNoStoreHeaders(res)

    return res.status(503).json({
      status: 'error',
      uptime: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    })
  }
}
