const { prometheus, registry, register, collectDefaults } = require('../metrics_module')()

const signaldMessages = new prometheus.Counter(register({
  name: 'signald_message_count',
  help: 'The number of messages received from signald since the process started.',
  labelNames: ['type']
}))

const channelMessages = new prometheus.Counter(register({
  name: 'channel_message_count',
  help: 'The number of channel messages received from signald since the process started.',
  labelNames: ['channel']
}))

module.exports = {
  registry,  
  collectDefaults,
  signaldMessages,
  channelMessages
}






