const fs = require('fs')
const path = require('path')
const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

function getRouteMountMap() {
  const indexPath = path.join(__dirname, '../../index.js')
  const content = fs.readFileSync(indexPath, 'utf8')

  const variableToRouteFile = {}
  const requireRegex = /const\s+(\w+)\s*=\s*require\(['"](\.\/src\/routes\/[\w.-]+)['"]\)/g
  let requireMatch

  while ((requireMatch = requireRegex.exec(content)) !== null) {
    variableToRouteFile[requireMatch[1]] = `${requireMatch[2]}.js`
  }

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

function getDefaultJsonResponses(successExample = {}) {
  return {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiSuccessResponse' },
          examples: {
            success: {
              value: {
                success: true,
                message: 'Request completed successfully',
                data: successExample
              }
            }
          }
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponse' },
          examples: {
            badRequest: {
              value: {
                success: false,
                message: 'Validation failed',
                error: 'Bad request'
              }
            }
          }
        }
      }
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponse' },
          examples: {
            unauthorized: {
              value: {
                success: false,
                message: 'Authentication required',
                error: 'Unauthorized'
              }
            }
          }
        }
      }
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponse' },
          examples: {
            forbidden: {
              value: {
                success: false,
                message: 'Insufficient permissions',
                error: 'Forbidden'
              }
            }
          }
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponse' },
          examples: {
            notFound: {
              value: {
                success: false,
                message: 'Resource not found',
                error: 'Not Found'
              }
            }
          }
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ApiErrorResponse' },
          examples: {
            serverError: {
              value: {
                success: false,
                message: 'Something went wrong!',
                error: 'Internal Server Error'
              }
            }
          }
        }
      }
    }
  }
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
          responses: getDefaultJsonResponses({
            endpoint: fullPath,
            method: method.toUpperCase()
          })
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
        },
        schemas: {
          ApiSuccessResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Request completed successfully' },
              data: { type: 'object', additionalProperties: true }
            }
          },
          ApiErrorResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: false },
              message: { type: 'string', example: 'Request failed' },
              error: { type: 'string', example: 'Bad request' },
              details: { type: 'object', additionalProperties: true }
            }
          }
        }
      },
      security: [{ bearerAuth: [] }],
      paths: {
        '/health': {
          get: {
            tags: ['Health'],
            summary: 'Health check endpoint',
            security: [],
            responses: {
              200: {
                description: 'Server is healthy',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'ok' },
                        timestamp: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              },
              500: getDefaultJsonResponses()['500']
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