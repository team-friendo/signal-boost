const channelRepository = require('../repository/channel')

// CONSTANTS

const statuses = {
  NOOP: 'NOOP',
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
}

const commands = {
  ADD: 'ADD',
  LEAVE: 'LEAVE',
  NOOP: 'NOOP',
}

const messages = {
  INVALID: "Whoops! That's not a command!",
  ADD_SUCCESS: "You've been added to the channel! Yay!",
  ADD_FAILURE: 'Whoops! There was an error adding you to the channel. Please try again!',
  ADD_NOOP: 'Whoops! You are already a member of that channel!',
  LEAVE_SUCCESS: "You've been removed from the channel! Bye!",
  LEAVE_FAILURE: 'Whoops! There was an error removing you from the channel. Please try again!',
  LEAVE_NOOP: 'Whoops! You are not subscribed to that channel. How ya gonna leave it?',
}

// PUBLIC FUNCTIONS

const parseCommand = msg => {
  const _msg = msg.trim()
  if (_msg.match(/^add$/i)) return commands.ADD
  if (_msg.match(/^leave$/i)) return commands.LEAVE
  else return commands.NOOP
}

const execute = (command, { db, channelPhoneNumber, sender }) => {
  switch (command) {
    case commands.ADD:
      return maybeAdd(db, channelPhoneNumber, sender)
    case commands.LEAVE:
      return maybeRemove(db, channelPhoneNumber, sender)
    default:
      return noop()
  }
}

// PRIVATE FUNCTIONS

const maybeAdd = async (db, channelPhoneNumber, sender) => {
  const shouldAbort = await channelRepository.isSubscriber(db, channelPhoneNumber, sender)
  return shouldAbort
    ? Promise.resolve({ status: statuses.SUCCESS, message: messages.ADD_NOOP })
    : add(db, channelPhoneNumber, sender)
}

const add = (db, channelPhoneNumber, sender) =>
  channelRepository
    .addSubscriber(db, channelPhoneNumber, sender)
    .then(() => ({ status: statuses.SUCCESS, message: messages.ADD_SUCCESS }))
    .catch(err => {
      console.error(`ERROR: ${err}`)
      return { status: statuses.FAILURE, message: messages.ADD_FAILURE }
    })

const maybeRemove = async (db, channelPhoneNumber, sender) => {
  const shouldContinue = await channelRepository.isSubscriber(db, channelPhoneNumber, sender)
  return shouldContinue
    ? remove(db, channelPhoneNumber, sender)
    : Promise.resolve({ status: statuses.SUCCESS, message: messages.LEAVE_NOOP })
}

const remove = (db, channelPhoneNumber, sender) =>
  channelRepository
    .removeSubscriber(db, channelPhoneNumber, sender)
    .then(() => ({ status: statuses.SUCCESS, message: messages.LEAVE_SUCCESS }))
    .catch(err => {
      console.error(`ERROR: ${err}`)
      return { status: statuses.FAILURE, message: messages.LEAVE_FAILURE }
    })

const noop = () =>
  Promise.resolve({
    status: statuses.NOOP,
    message: messages.INVALID,
  })

module.exports = { statuses, commands, messages, parseCommand, execute }
