const seedrandom = require('seedrandom')

function generateStats(userId, type) {
  const rng = seedrandom(userId + type)

  const balance = Math.floor(rng() * 5000 + 1000)
  const profit = Math.floor(rng() * 500 - 100)
  const equity = balance + profit
  const freeMargin = Math.floor(balance * (0.6 + rng() * 0.3))
  const leverage = ['1:100', '1:200', '1:500'][Math.floor(rng() * 3)]

  return {
    balance: `${balance}.00 USD`,
    equity: `${equity}.00 USD`,
    floatingPL: `${profit}.00 USD`,
    freeMargin: `${freeMargin}.00 USD`,
    leverage
  }
}

exports.getAccountStats = async (userId, accountType) => {
  return generateStats(userId, accountType)
}

exports.getPlatformStats = async () => ({
  platform: 'MT5',
  uptime: '100%',
  activeSessions: Math.floor(Math.random() * 200 + 50),
  lastUpdated: 'Just Now'
})

exports.getServerInfo = async () => ({
  address: 'inglozone.com',
  dmt: '2:16:03:06',
  status: 'Connected'
})
