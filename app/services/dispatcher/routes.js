const { prometheusMetricsRoute } = require('../prometheus_metrics_route')

const routesOf = async (router, metrics) => {
  router.get('/dispatcher-metrics', prometheusMetricsRoute(metrics))
}

module.exports = { routesOf }
