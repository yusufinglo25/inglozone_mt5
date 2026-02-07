const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Trading Platform API',
      version: '1.0.0'
    },
    servers: [
      { url: process.env.BASE_URL || 'http://localhost:4000' }
    ]
  },
  apis: ['./src/routes/*.js']
}

module.exports = { swaggerJsdoc, swaggerUi, options }
