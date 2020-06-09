const { prometheusMetricsRoute } = require('../prometheus_metrics_route')
const metrics = require('./metrics')

const routesOf = async (router) => {
  router.get('/metrics', prometheusMetricsRoute(metrics.register))
}

module.exports = { routesOf }
