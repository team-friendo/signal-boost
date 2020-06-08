import { expect } from 'chai'
const prometheus = require ('prom-client')
const Koa = require('koa')
const Router = require('koa-router')
const request = require('supertest')
const { prometheusMetricsRoute } = require('../prometheus_metrics_route')

const createApp(configureRoutes) {
  const app = new Koa()
  const router = new Router()
  configureRoutes(router)
  app.use(router.routes())
  app.use(router.allowedMethods())
  return app
}

describe('prometheus_metrics_route', () => {

  it("returns prometheus metrics from the configured route", () => {    

    const metrics = new prometheus.Registry()
    const app = createApp(router => {
      router.get("/metrics", prometheusMetricsRoute(metrics))
    })

    const counter = new client.Counter({
      name: 'test_count',
      help: 'test_count',
      registers: [metrics]
    });

    counter.inc()
    counter.inc()    

    return request(app)
      .get('/metrics')
      .expect(200)
  })   
})

