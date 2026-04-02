const { PrismaClient } = require('@prisma/client')
const { PrismaMariaDb } = require('@prisma/adapter-mariadb')

const createAdapter = () => {
  const hasDiscreteConfig = process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME

  if (hasDiscreteConfig) {
    return new PrismaMariaDb({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000)
    })
  }

  if (process.env.DATABASE_URL) {
    return new PrismaMariaDb(process.env.DATABASE_URL, {
      database: process.env.DB_NAME
    })
  }

  throw new Error('Prisma health check is missing database configuration. Set DB_HOST/DB_USER/DB_NAME or DATABASE_URL.')
}

const createPrismaClient = () => new PrismaClient({
  adapter: createAdapter()
})

const getPrismaClient = () => {
  if (process.env.NODE_ENV === 'production') {
    global.__prismaClientProd ??= createPrismaClient()
    return global.__prismaClientProd
  }

  global.__prismaClientDev ??= createPrismaClient()
  return global.__prismaClientDev
}

module.exports = getPrismaClient
