const app = require('../../../app')
const moment = require('moment')
const { Op } = require('sequelize')
const membershipRepository = require('./membership')
const {
  defaultLanguage,
  jobs: { inviteExpiryInMillis },
} = require('../../config')

// (string, string, string) -> Promise<boolean>
const issue = async (channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber) => {
  // issues invite IFF invitee is not already invited
  const [, wasCreated] = await app.db.invite.findOrCreate({
    where: { channelPhoneNumber, inviterPhoneNumber, inviteePhoneNumber },
  })
  return wasCreated
}

// (string, string) -> Promise<number>
const count = (channelPhoneNumber, inviteePhoneNumber) =>
  app.db.invite.count({ where: { channelPhoneNumber, inviteePhoneNumber } })

// (string, string) -> Promise<Membership | null>
const findInviter = async (channelPhonenumber, inviteePhoneNumber) => {
  const invite = await app.db.invite.findOne({ where: { inviteePhoneNumber } })
  if (!invite) return Promise.reject('No invite found')
  return membershipRepository.findMembership(channelPhonenumber, invite.inviterPhoneNumber)
}

// (string, string, string) -> Promise<Array<Membership,number>>
const accept = (channelPhoneNumber, inviteePhoneNumber, language = defaultLanguage) =>
  Promise.all([
    membershipRepository.addSubscriber(channelPhoneNumber, inviteePhoneNumber, language),
    app.db.invite.destroy({ where: { channelPhoneNumber, inviteePhoneNumber } }),
  ])

// (string, string) -> Promise<number>
const decline = async (channelPhoneNumber, inviteePhoneNumber) =>
  app.db.invite.destroy({ where: { channelPhoneNumber, inviteePhoneNumber } })

// () -> Promise<number>
const deleteExpired = async () =>
  app.db.invite.destroy({
    where: {
      createdAt: {
        [Op.lte]: moment().subtract(inviteExpiryInMillis, 'ms'),
      },
    },
  })

module.exports = { issue, count, accept, decline, deleteExpired, findInviter }
