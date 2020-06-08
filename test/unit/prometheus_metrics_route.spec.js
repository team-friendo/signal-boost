import { expect } from 'chai'
const prometheus = require ('prom-client')
const Koa = require('koa')
const Router = require('koa-router')
const supertest = require('supertest')
const { prometheusMetricsRoute } = require('../../app/services/prometheus_metrics_route')

function createApp(configureRoutes) {
  const app = new Koa()
  const router = new Router()
  configureRoutes(router)
  app.use(router.routes())
  app.use(router.allowedMethods())
  return app
}

describe('prometheus_metrics_route', () => {

  let server, metrics
  before(() => {

    metrics = new prometheus.Registry()
    const app = createApp(router => {
      router.get("/metrics", prometheusMetricsRoute(metrics))
    })

    server = app.listen()    
  })
  after(() => {
    server.close()
  })  
  
  it("returns prometheus metrics from the configured route", () => {    

    const counter = new prometheus.Counter({
      name: 'test_count',
      help: 'test_count',
      registers: [metrics]
    });

    counter.inc()
    counter.inc()    

    return supertest(server)
      .get('/metrics')
      .expect(200)
  })   
})

