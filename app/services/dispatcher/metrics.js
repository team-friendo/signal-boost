const prometheus = require('prom-client')

const register = new prometheus.Registry()

function collectDefaults() {
  prometheus.collectDefaultMetrics({ register })    
}

const channelMessages = new prometheus.Counter({
  register,
  name: 'channel_message_count',
  help: 'The number of channel messages received since the process started.'
})

module.exports = {
  register,
  collectDefaults,
  channelMessages
}






