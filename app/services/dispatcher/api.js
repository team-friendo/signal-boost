const Koa = require('koa')
const requestLogger = require('koa-logger')
const Router = require('koa-router')
const { routesOf } = require('./routes')
const logger = require('./logger')

const startServer = async (port, metrics) => {
  const app = new Koa()

  // note: does not configure body parser so won't parse POST bodies
  configureLogger(app)
  configureRoutes(app, metrics)

  const server = await app.listen(port).on('error', logger.error)
  return Promise.resolve({ app, server })
}

const configureLogger = app => process.env.NODE_ENV !== 'test' && app.use(requestLogger())

const configureRoutes = (app, metrics) => {
  const router = new Router()
  routesOf(router, metrics)
  app.use(router.routes())
  app.use(router.allowedMethods())
}

module.exports = { startServer }
