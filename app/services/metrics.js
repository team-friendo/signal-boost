const prometheus = require('prom-client')

const registry = new prometheus.Registry()

const register = metric => ({ ...metric, registers: [registry] })

const collectDefaults = () => prometheus.collectDefaultMetrics({ registry })

module.exports = {
  prometheus,
  registry,
  register,
  collectDefaults,
}
