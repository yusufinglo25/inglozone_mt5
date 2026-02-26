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

function getDefaultJsonResponses() {
  return {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: { type: 'object', additionalProperties: true }
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
                error: 'Not found'
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
                error: 'Something went wrong!'
              }
            }
          }
        }
      }
    }
  }
}

function toOpenApiPath(pathname) {
  return pathname.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

const MANUALLY_DOCUMENTED_OPERATIONS = new Set([
  'POST /api/auth/register',
  'POST /api/auth/register-with-otp',
  'POST /api/auth/verify-otp',
  'POST /api/auth/resend-otp',
  'POST /api/auth/login',
  'POST /api/auth/check-email',
  'POST /api/auth/complete-profile',
  'GET /api/auth/status',
  'GET /api/auth/google',
  'GET /api/auth/google/callback',
  'POST /api/user/complete-profile',
  'POST /api/wallet/deposit',
  'POST /api/wallet/deposit/verify',
  'GET /api/wallet/balance',
  'GET /api/wallet/transactions',
  'GET /api/wallet/transactions/{id}',
  'POST /api/kyc/upload',
  'POST /api/kyc/upload/back',
  'GET /api/kyc/documents/completeness',
  'GET /api/kyc/country-codes',
  'POST /api/admin/auth/login',
  'POST /api/admin/auth/logout',
  'GET /api/admin/users',
  'PATCH /api/admin/users/role',
  'PATCH /api/admin/users/allow-login',
  'PATCH /api/admin/users/block-login',
  'GET /api/admin/kyc',
  'GET /api/admin/kyc/{userId}',
  'POST /api/admin/kyc/{userId}/approve',
  'POST /api/admin/kyc/{userId}/reject',
  'GET /api/admin/dashboard/stats',
  'POST /api/settings/email-change/request-old-otp',
  'POST /api/settings/email-change/verify-old-otp',
  'POST /api/settings/email-change/request-new-otp',
  'POST /api/settings/email-change/verify-new-otp',
  'POST /api/settings/password/change',
  'POST /api/settings/2fa/generate',
  'POST /api/settings/2fa/verify',
  'POST /api/settings/2fa/disable',
  'POST /api/settings/logout-all',
  'POST /api/settings/logout-others'
])

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
      const openApiPath = toOpenApiPath(fullPath)
      const operationKey = `${method.toUpperCase()} ${openApiPath}`

      if (MANUALLY_DOCUMENTED_OPERATIONS.has(operationKey)) {
        continue
      }

      if (!paths[openApiPath]) {
        paths[openApiPath] = {}
      }

      if (!paths[openApiPath][method]) {
        const tag = mountPrefix.replace('/api/', '').replace('/', '') || 'General'
        paths[openApiPath][method] = {
          tags: [tag.charAt(0).toUpperCase() + tag.slice(1)],
          summary: `Auto-generated documentation for ${method.toUpperCase()} ${openApiPath}`,
          responses: getDefaultJsonResponses()
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
            additionalProperties: true
          },
          ApiErrorResponse: {
            type: 'object',
            properties: {
              error: { type: 'string', example: 'Bad request' },
              message: { type: 'string', example: 'Request failed' },
              details: { type: 'object', additionalProperties: true }
            },
            additionalProperties: true
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
        ...buildAutoPathDocs(),
        '/api/kyc/status': {
          get: {
            tags: ['Kyc'],
            summary: 'Get current user KYC workflow status',
            responses: {
              200: {
                description: 'KYC status fetched successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        data: {
                          type: 'object',
                          properties: {
                            status: { type: 'string', example: 'NOT_SUBMITTED', enum: ['NOT_SUBMITTED', 'IN_PROGRESS', 'PENDING', 'APPROVED', 'REJECTED'] },
                            latestDocument: { type: 'object', nullable: true, additionalProperties: true },
                            allDocuments: { type: 'array', items: { type: 'object', additionalProperties: true } },
                            profileStatus: { type: 'string', example: 'NOT_STARTED', enum: ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] },
                            documentStatus: { type: 'string', example: 'NOT_SUBMITTED', enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'] },
                            nextAction: { type: 'string', example: 'fill_profile' },
                            completion: { type: 'number', example: 0 }
                          }
                        }
                      }
                    },
                    examples: {
                      notStarted: {
                        value: {
                          success: true,
                          data: {
                            status: 'NOT_SUBMITTED',
                            latestDocument: null,
                            allDocuments: [],
                            profileStatus: 'NOT_STARTED',
                            documentStatus: 'NOT_SUBMITTED',
                            nextAction: 'fill_profile',
                            completion: 0
                          }
                        }
                      }
                    }
                  }
                }
              },
              400: getDefaultJsonResponses()['400'],
              401: getDefaultJsonResponses()['401'],
              403: getDefaultJsonResponses()['403'],
              404: getDefaultJsonResponses()['404'],
              500: getDefaultJsonResponses()['500']
            }
          }
        }
      }
    },
    apis: ['./src/docs/*.js']
  }

  return swaggerJsdoc(options)
}

module.exports = { swaggerUi, getSwaggerSpec }
