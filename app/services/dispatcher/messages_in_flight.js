const _ = require('lodash')
const metrics = require('./metrics')

const inFlight = metrics.channelMessagesInFlight
const durations = metrics.channelMessageDuration

/*
  A hash table of timers, one per recipient message sent.

  Each key is channel+recipient, and each value is an array of stop-timer lambdas
  provided by prom-client to record the duration of the timer.

  Note that this could consume considerable memory 
  if many thousands of messages (message = channel+recipient)
  are in flight at once.
  
  A scalable alternative would be to store each channel+recipient's launch timestamp
  in a data store, and retrieve it to record the duration at land time. 
  
  Using a data store for queued messages would also provide durability if used instead 
  of DBUS as signald's queue, so worth exploring overall.
*/
const timers = {}

function startTimer(channel, recipient) {
  const key = channel+recipient
  timers[key] = [...timers[key] || [],
                 durations.startTimer({ channel, recipient })]
}

function stopTimer(channel, recipient) {
  const key = channel+recipient

  // since these come from outside, let's not assume this can't happen
  if (! timers[key])
    console.error("Received message receipt for a message without a timer!")
  else {

    const stop = timers[key][0]
    stop()

    const remaining = timers[key].slice(1)
    if (! remaining)
      delete timers[key]
    else
      timers[key] = remaining
  }
}

function launch(channel, recipient) {  
  inFlight.inc({ channel })
  startTimer(channel, recipient)
}

function land(channel, recipient) {  
  inFlight.dec({ channel })
  stopTimer(channel, recipient)
}

module.exports = {
  launch, land
}



