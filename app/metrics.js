const prometheus = require('prom-client')
const app = require('./index')

const register = (registry, metric) => ({ ...metric, registers: [registry] })

const run = () => {
  const registry = new prometheus.Registry()
  prometheus.collectDefaultMetrics({ registry })

  const relayableMessageCounter = new prometheus.Counter({
    name: 'relayable_messages',
    help: 'Counts the number of relayed messages',
    registers: [registry],
    labelNames: ['channelPhoneNumber'],
  })

  return { registry, relayableMessageCounter }
}

// (fn, [string]) -> void
const incrementCounter = (count, labels) => count(...labels)

// (channel) -> void
const incrementRelayableMessageCounter = channel =>
  app.metrics.relayableMessageCounter.labels(channel.phoneNumber).inc()

// { string: fn }
const COUNTERS = {
  relayableMessage: incrementRelayableMessageCounter,
}

module.exports = {
  run,
  register,
  incrementCounter,
  COUNTERS,
}
