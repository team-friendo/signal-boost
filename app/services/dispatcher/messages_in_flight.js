const _ = require('lodash')
const metrics = require('./metrics')

module.exports.empty = function () {

  const counts = metrics.channelMessagesInFlight

  function launch(channel, recipient) {
    counts.inc({ channel })
  }

  function land(channel, recipient) {
    counts.dec({ channel })
  }

  counts.reset()
  return {
    launch, land
  }
}


