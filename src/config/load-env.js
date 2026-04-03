const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const envFileMap = {
  production: '.env.prod',
  staging: '.env.staging',
  development: '.env.dev',
  dev: '.env.dev'
}

if (!global.__inglozoneEnvLoaded) {
  const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase()
  const envFile = envFileMap[nodeEnv] || '.env.dev'
  const envPath = path.resolve(process.cwd(), envFile)

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath })
  } else {
    dotenv.config()
  }

  global.__inglozoneEnvLoaded = true
}

module.exports = true
