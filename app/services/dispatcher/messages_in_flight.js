const _ = require('lodash')
const metrics = require('./metrics')

const inFlight = metrics.channelMessagesInFlight

function launch(channel, recipient) {
  inFlight.inc({ channel })    
}

function land(channel, recipient) {
  inFlight.dec({ channel })
}

module.exports = {
  launch, land
}



