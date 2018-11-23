const Router = require('koa-router')
const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const relayService = require('./service/relay.js')
const port = 3000

const run = async () => {
  // TODO(22 Nov 2018):
  // - extract api, message relay services, *and* signal cli daemon service into own files
  // - run each as a child process from index (or in some other clever way)

  const app = new Koa()
  
  configureBodyParser(app)
  configureRoutes(app)

  const server = await app.listen(port).on('error', console.error)
  console.log(`API Server listening on port ${port}...`)

  relayService.run()
  console.log('Relay Service listening for incoming messages...')

  return Promise.resolve({ app, server })
}

const configureBodyParser = (app) => {
  app.use(bodyParser({
    extendTypes: {
      json: ['application/x-javascript']
    }
  }))
}

const configureRoutes = (app) => {
  const router = new Router()

  router.post('/hello', async ctx => {
    ctx.body = { status: 200, msg: 'hello world' }
  })

  app.use(router.routes())
}
  
module.exports = run

