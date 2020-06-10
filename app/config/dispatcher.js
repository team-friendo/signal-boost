const defaults = {
  server: {
    host: process.env.SIGNALBOOST_HOST_URL,    
    port: 3030
  }
}

module.exports = {
  development: {
    ...defaults,
    logSignaldData: true
  },
  test: defaults,
  production: defaults,
}
