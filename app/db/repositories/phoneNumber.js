const app = require('../../../app')
const { Op } = require('sequelize')
const { statuses } = require('../models/phoneNumber')

const filters = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  VERIFIED: 'VERIFIED',
}

const create = ({ phoneNumber, twilioSid, status }) =>
  app.db.phoneNumber.create({ phoneNumber, twilioSid, status })

// (string, Transaction | null) => Promise<boolean>
const destroy = async (phoneNumber, transaction = null) => {
  const phoneNumberRecord = await find(phoneNumber)
  return phoneNumberRecord ? phoneNumberRecord.destroy({ transaction }).then(() => true) : false
}

const find = phoneNumber => app.db.phoneNumber.findOne({ where: { phoneNumber } })

const findAll = () => app.db.phoneNumber.findAll()

const findAllPurchased = () => app.db.phoneNumber.findAll({ where: { status: statuses.PURCHASED } })

const list = filter =>
  app.db.phoneNumber.findAll({ order: [['status', 'DESC']], where: parseQueryFilter(filter) })

const parseQueryFilter = filter => {
  switch (filter) {
    case filters.ACTIVE:
      return { status: statuses.ACTIVE }
    case filters.INACTIVE:
      return { status: { [Op.not]: statuses.ACTIVE } }
    case filters.VERIFIED:
      return { status: statuses.VERIFIED }
    default:
      return {}
  }
}

const update = (phoneNumber, attrs) =>
  app.db.phoneNumber
    .update({ ...attrs }, { where: { phoneNumber }, returning: true })
    .then(([, [pNumInstance]]) => pNumInstance)

module.exports = { filters, create, destroy, find, findAll, findAllPurchased, list, update }
