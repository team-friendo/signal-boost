/* eslint no-case-declarations: 0 */
const { get } = require('lodash')
const signal = require('../signal')
const channelRepository = require('./../../db/repositories/channel')
const executor = require('./executor')
const messenger = require('./messenger')
const logger = require('./logger')

/**
 * type Dispatchable = {
 *   db: SequelizeDatabaseConnection,
 *   sock: Socket,
 *   channel: models.Channel,
 *   sender: Sender,
 *   sdMessage: signal.OutBoundSignaldMessage,,
 * }
 *
 * type Sender = {
 *   phoneNumber: string,
 *   isPublisher: boolean,
 *   isSubscriber: boolean,
 * }
 *
 * type CommandResult = {
 *   status: string,
 *   command: string,
 *   message: string,
 * }
 */

const dispatchActions = {
  RELAY: 'RELAY',
  REPAIR_TRUST: 'REPAIR_TRUST',
}

// INITIALIZATION

const run = async (db, sock) => {
  logger.log('--- Initializing Dispatcher....')

  // for debugging...
  // sock.on('data', data => console.log(`+++++++++\n${data}\n++++++++\n`))

  logger.log(`----- Subscribing to channels...`)
  const channels = await channelRepository.findAllDeep(db).catch(logger.fatalError)
  const listening = await listenForInboundMessages(db, sock, channels).catch(logger.fatalError)
  logger.log(`----- Subscribed to ${listening.length} of ${channels.length} channels!`)

  logger.log(`--- Dispatcher running!`)
}

const listenForInboundMessages = async (db, sock, channels) =>
  Promise.all(channels.map(ch => signal.subscribe(sock, ch.phoneNumber))).then(listening => {
    sock.on('data', inboundMsg => dispatch(db, sock, parseSdMessage(inboundMsg)))
    return listening
  })

// MESSAGE DISPATCH

const dispatch = async (db, sock, inboundSdMsg) => {
  const dispatchAction = parseDistpatchAction(inboundSdMsg)
  if (!dispatchAction) return
  try {
    switch (dispatchAction) {
      case dispatchAction.RELAY:
        return dispatchRelay(db, sock, inboundSdMsg)
      case dispatchAction.REPAIR_TRUST:
        return dispatchRepairTrust(sock, inboundSdMsg)
    }
  } catch (e) {
    logger.error(e)
  }
}

const dispatchRelay = async (db, sock, sdMessage) => {
  const [channel, sender] = await parseChannelAndSender(sdMessage)
  return messenger.dispatch(
    await executor.processCommand({
      db,
      sock,
      channel,
      sender,
      sdMessage: signal.parseOutboundSdMessage(sdMessage),
    }),
  )
}

const dispatchRepairTrust = (sock, sdMessage) =>
  signal.trust(sock, parseChannelPhoneNumber(sdMessage), parseFailedRecipient(sdMessage))

// PARSERS

const parseSdMessage = inboundMsg => {
  try {
    return JSON.parse(inboundMsg)
  } catch (e) {
    return inboundMsg
  }
}

const parseChannelPhoneNumber = sdMessage => sdMessage.data.username
const parseFailedRecipient = sdMessage => get(sdMessage, 'data.request.recipientNumber')

const parseDistpatchAction = sdMessage => {
  if (shouldRelay(sdMessage)) return dispatchActions.RELAY
  if (shouldRepairTrust(sdMessage)) return dispatchActions.REPAIR_TRUST
  return null
}

const shouldRelay = sdMessage =>
  sdMessage.type === signal.messageTypes.MESSAGE && get(sdMessage, 'data.dataMessage')

const shouldRepairTrust = sdMessage =>
  sdMessage.type === signal.messageTypes.ERROR &&
  get(sdMessage, 'data.request.type') === signal.messageTypes.SEND

// (Database, SignaldMessage) -> [Channel, Sender]
const parseChannelAndSender = async (db, sdMessage) => {
  const channelPhoneNumber = parseChannelPhoneNumber(sdMessage)
  return Promise.all([
    channelRepository.findDeep(db, channelPhoneNumber),
    classifySender(db, channelPhoneNumber, sdMessage.data.source),
  ])
}

const classifySender = async (db, channelPhoneNumber, sender) => ({
  phoneNumber: sender,
  isPublisher: await channelRepository.isPublisher(db, channelPhoneNumber, sender),
  isSubscriber: await channelRepository.isSubscriber(db, channelPhoneNumber, sender),
})

// EXPORTS

module.exports = { run }
