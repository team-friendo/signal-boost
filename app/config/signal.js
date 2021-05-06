const defaults = {
  attachmentSendDelay: 2000, // 2 seconds
  broadcastBatchInterval: 1300, // 1.3 seconds
  broadcastBatchSize: 1,
  broadcastSpacing: 100, // 100 millis
  client: process.env.SIGNAL_CLIENT || 'SIGNALD',
  defaultMessageExpiryTime: 60 * 60 * 24 * 7, // 1 week
  defaultSubscriberLimit: 500,
  expiryUpdateDelay: 200, // 200 millis
  healthcheckTimeout: 1000 * 60 * 15, // 15 min
  healthcheckSpacing: 100, // 100 millis
  intervalBetweenRegistrationBatches: 120000, // 2 minutes
  intervalBetweenRegistrations: 2000, // 2 seconds
  isAliveTimeout: 1000 * 30, // 30 sec
  keystorePath: '/var/lib/signald/data', // given by docker-compose file(s)
  maxResendInterval: 64 * 60 * 1000, // 64 min (6 tries)
  maxVouchLevel: 10,
  minResendInterval: 60 * 1000, // 1 min
  numbersToExcludeFromHealthcheck: JSON.parse(
    process.env.NUMBERS_TO_EXCLUDE_FROM_HEALTHCHECK || '[]',
  ),
  registrationBatchSize: 4,
  restartDelay: 1000 * 15, // 15 sec
  setExpiryInterval: 2000, // 2 sec
  signaldRequestTimeout: 1000 * 10, // 10 sec
  signaldVerifyTimeout: 1000 * 30, // 30 sec
  signaldSendTimeout: 1000 * 60 * 60, // 60 min
  signaldStartupTime: 3000 * 60, // 3 min
  supportPhoneNumber: (process.env.SUPPORT_CHANNEL_NUMBER || '').replace(/"/g, ''),
  diagnosticsPhoneNumber: (process.env.DIAGNOSTICS_CHANNEL_NUMBER || '').replace(/"/g, ''),
  welcomeDelay: 3000, // 3 sec
}

const test = {
  ...defaults,
  attachmentSendDelay: 10, // 10 millis
  broadcastBatchInterval: 10, // 10 millis
  broadcastBatchSize: 1,
  expiryUpdateDelay: 1, // millis
  healthcheckTimeout: 20, // millis
  healthcheckSpacing: 1, // millis
  intervalBetweenRegistrationBatches: 30, // millis
  intervalBetweenRegistrations: 5, // millis,
  isAliveTimeout: 25, // millis
  maxResendInterval: 256, // ~ 2.5 sec,
  maxVouchLevel: 10,
  minResendInterval: 2, // millis
  numbersToExcludeFromHealthcheck: ['+12223334444'],
  restartDelay: 1, // millis
  setExpiryInterval: 1, // millis
  signaldSendTimeout: 40, // millis
  signaldRequestTimeout: 10, // millis
  signaldVerifyTimeout: 20, // millis
  signaldStartupTime: 1, //  millis
  supportPhoneNumber: '+15555555555',
  welcomeDelay: 0.0001, // millis
  diagnosticsPhoneNumber: '+15554443333',
}

const development = {
  ...defaults,
  signaldStartupTime: 1000 * 10, // 10 sec
  healthcheckTimeout: 1000 * 10, // 10 sec
}

module.exports = {
  development,
  test,
  production: defaults,
}
