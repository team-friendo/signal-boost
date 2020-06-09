const prometheus = require('prom-client')

const register = new prometheus.Registry()

function collectDefaults() {
  prometheus.collectDefaultMetrics({ register })    
}

module.exports = {
  register,
  collectDefaults
}
