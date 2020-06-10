module.exports = () => {

  const prometheus = require('prom-client')
  
  const registry = new prometheus.Registry()
  
  function register(metric) {
    return { ...metric, registers: [registry] }           
  }
  
  function collectDefaults() {
    prometheus.collectDefaultMetrics({ registry })    
  }
  
  return {
    prometheus,
    registry,
    register,
    collectDefaults
  }
}

