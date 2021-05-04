const logger = require('./registrar/logger')
const phoneNumberRegistrar = require('./registrar/phoneNumber')
const inviteRepository = require('./db/repositories/invite')
const smsSenderRepository = require('./db/repositories/smsSender')
const hotlineMessageRepository = require('./db/repositories/hotlineMessage')
const diagnostics = require('./diagnostics')
const util = require('./util')
const sharding = require('./sharding')
const { values } = require('lodash')
const {
  jobs: {
    channelDestructionInterval,
    healthcheckInterval,
    inviteDeletionInterval,
    shouldRunKeystoreDeletion,
    shouldRunHealthchecks,
  },
  signal: { diagnosticsPhoneNumber, signaldStartupTime },
} = require('./config')

const cancelations = {
  deleteInvitesJob: null,
  requestDestructionsJob: null,
  processDestructionRequestsJob: null,
  healtcheckJob: null,
}

const run = async () => {
  logger.log('--- Running startup jobs...')

  /******************
   * ONE-OFF JOBS
   *****************/

  logger.log('----- Assigning channels to socket pool shards...')
  // TODO: `sharding` should probably be `sockets`
  await sharding.assignChannelsToSockets()
  logger.log('----- Assigned channels to socket pool shards!')

  if (process.env.REREGISTER_ON_STARTUP === '1') {
    logger.log('----- Registering phone numbers...')
    const regs = await phoneNumberRegistrar.registerAllUnregistered().catch(logger.error)
    logger.log(`----- Registered ${regs.length} phone numbers.`)
  }

  logger.log('----- Deleting expired sms sender records...')
  // rely on fact of nightly backups to ensure this task runs at least every 24 hr.
  const sendersDeleted = await smsSenderRepository.deleteExpired()
  logger.log(`----- Deleted ${sendersDeleted} expired sms sender records.`)

  logger.log('----- Deleting expired hotline message records...')
  // rely on fact of nightly backups to ensure this task runs at least every 24 hr.
  const messageIdsDeleted = await hotlineMessageRepository.deleteExpired()
  logger.log(`----- Deleted ${messageIdsDeleted} expired hotline records.`)

  if (shouldRunKeystoreDeletion) {
    logger.log('----- Deleting vestigal keystore entries....')
    const entriesDeleted = await phoneNumberRegistrar.deleteVestigalKeystoreEntries()
    logger.log(`----- Deleted ${entriesDeleted} vestigal keystore entries.`)
  }

  /******************
   * REPEATING JOBS
   *****************/

  logger.log('----- Launching invite scrubbing job...')
  cancelations.deleteInvitesJob = util.repeatUntilCancelled(
    () => inviteRepository.deleteExpired().catch(logger.error),
    inviteDeletionInterval,
  )
  logger.log('----- Launched invite scrubbing job.')

  logger.log('---- Launching job to issue destruction requests for stale channels...')
  cancelations.requestDestructionsJob = util.repeatUntilCancelled(() => {
    phoneNumberRegistrar.requestToDestroyStaleChannels().catch(logger.error)
  }, channelDestructionInterval)
  logger.log('---- Launched job to issue destruction requests for stale channels.')

  logger.log('---- Launching job to process channel destruction requests...')
  cancelations.processDestructionRequestsJob = util.repeatUntilCancelled(() => {
    phoneNumberRegistrar.processDestructionRequests().catch(logger.error)
  }, channelDestructionInterval)
  logger.log('---- Launched job to process channel destruction requests.')

  if (shouldRunHealthchecks) {
    logger.log('---- Launching healthcheck job...')
    const launchHealthchecks = async () => {
      await util.wait(signaldStartupTime)
      cancelations.healtcheckJob = util.repeatUntilCancelled(() => {
        diagnostics.sendHealthchecks().catch(logger.error)
      }, healthcheckInterval)
    }
    if (diagnosticsPhoneNumber) launchHealthchecks().catch(launchHealthchecks)
    logger.log('---- Launched healthcheck job...')
  }

  logger.log('--- Startup jobs complete!')
  logger.log('--- Registrar running!')

  return { stop }
}

const stop = () => values(cancelations).forEach(fn => fn())

module.exports = { run, stop }
