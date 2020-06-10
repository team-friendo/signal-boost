const { prometheusMetricsRoute } = require('../prometheus_metrics_route')
const metrics = require('./metrics')
const prometheus = require('prom-client')

const routesOf = async (router) => {
  router.get('/metrics', prometheusMetricsRoute(metrics.registry))
}

module.exports = { routesOf }
