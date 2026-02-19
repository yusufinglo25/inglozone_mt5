
const swaggerJsdoc = require('swagger-jsdoc')
const fs = require('fs')
const swaggerUi = require('swagger-ui-express')
const path = require('path')

const swaggerJsdoc = require('swagger-jsdoc')
const options = {
const swaggerUi = require('swagger-ui-express')
  definition: {

    openapi: '3.0.0',
function getRouteMountMap() {
    info: {
  const indexPath = path.join(__dirname, '../../index.js')
      title: 'Trading Platform API',
  const content = fs.readFileSync(indexPath, 'utf8')
      version: '1.0.0'

    },
  const variableToRouteFile = {}
    servers: [
  const requireRegex = /const\s+(\w+)\s*=\s*require\(['"](\.\/src\/routes\/[\w.-]+)['"]\)/g
      { url: process.env.BASE_URL || 'http://localhost:4000' }
  let requireMatch
    ]

  },
  while ((requireMatch = requireRegex.exec(content)) !== null) {
  apis: ['./src/routes/*.js']
    variableToRouteFile[requireMatch[1]] = `${requireMatch[2]}.js`
}
  }


module.exports = { swaggerJsdoc, swaggerUi, options }
  const routeMountMap = {}
  const useRegex = /app\.use\(['"]([^'"]+)['"],\s*(\w+)\)/g
  let useMatch

  while ((useMatch = useRegex.exec(content)) !== null) {
    const mountPath = useMatch[1]
    const variableName = useMatch[2]
    const routeFile = variableToRouteFile[variableName]

    if (routeFile) {
      routeMountMap[routeFile] = mountPath
    }
  }

  return routeMountMap
}

function buildAutoPathDocs() {
  const routesDir = path.join(__dirname, '../routes')
  const files = fs.readdirSync(routesDir).filter((file) => file.endsWith('.routes.js'))
  const mountMap = getRouteMountMap()
  const paths = {}

  files.forEach((file) => {
    const filePath = path.join(routesDir, file)
    const key = `./src/routes/${file}`
    const mountPrefix = mountMap[key] || ''
    const content = fs.readFileSync(filePath, 'utf8')

    const routeRegex = /router\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g
    let match

    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1]
      const localPath = match[2]
      const fullPath = `${mountPrefix}${localPath}`.replace(/\/+/g, '/')

      if (!paths[fullPath]) {
        paths[fullPath] = {}
      }

      if (!paths[fullPath][method]) {
        const tag = mountPrefix.replace('/api/', '').replace('/', '') || 'General'
        paths[fullPath][method] = {
          tags: [tag.charAt(0).toUpperCase() + tag.slice(1)],
          summary: `Auto-generated documentation for ${method.toUpperCase()} ${fullPath}`,
          responses: {
            200: {
              description: 'Success'
            }
          }
        }
      }
    }
  })

  return paths
}

function getSwaggerSpec() {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Trading Platform API',
        version: '1.0.0',
        description: 'Auto-generated OpenAPI docs from existing route files + optional manual JSDoc docs.'
      },
      servers: [
        { url: process.env.BASE_URL || 'https://temp.inglozone.com' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [{ bearerAuth: [] }],
      paths: {
        '/health': {
          get: {
            tags: ['Health'],
            summary: 'Health check endpoint',
            responses: {
              200: {
                description: 'Server is healthy'
              }
            }
          }
        },
        ...buildAutoPathDocs()
      }
    },
    apis: ['./src/docs/*.js']
  }

  return swaggerJsdoc(options)
}

module.exports = { swaggerUi, getSwaggerSpec }
