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

const channelMessagesInFlight = new prometheus.Gauge(register({
  name: 'channel_messages_in_flight',
  help: 'The number of messages sent that have not yet reported receipt from signald.',
  labelNames: ['channel']
}))

const channelMessageDuration = new prometheus.Gauge(register({
  name: 'channel_message_duration',
  help: 'An estimate of the duration of each channel+recipient message broadcast ' +
    'from sending it to signald to receiving isReceipt: true from signald.',
  labelNames: ['channel', 'recipient']
}))

module.exports = {
  registry,  
  collectDefaults,
  signaldMessages,
  channelMessages,
  channelMessagesInFlight,
  channelMessageDuration
}






