import { expect } from 'chai'
import { describe, it, test, before, after } from 'mocha'
import { keys } from 'lodash'
import { initDb } from '../../../../app/db/index'
import { subscriptionFactory } from '../../../support/factories/subscription'
import { channelFactory } from '../../../support/factories/channel'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'
import { defaultLanguage } from '../../../../app/config'

describe('subscription model', () => {
  let db, subscription

  before(async () => {
    db = initDb()
  })

  after(async () => {
    await db.subscription.destroy({ where: {} })
    await db.channel.destroy({ where: {} })
    await db.sequelize.close()
  })

  test('fields', async () => {
    subscription = await db.subscription.create(subscriptionFactory())
    expect(keys(subscription.get())).to.have.members([
      'id',
      'channelPhoneNumber',
      'subscriberPhoneNumber',
      'language',
      'createdAt',
      'updatedAt',
    ])
  })

  describe('defaults', () => {
    it('sets language to DEFAULT_LANGUAGE if none provided', async () => {
      const sub = await db.subscription.create(subscriptionFactory({ language: undefined }))
      expect(sub.language).to.eql(defaultLanguage)
    })
  })

  describe('associations', () => {
    before(async () => {
      const channel = await db.channel.create(channelFactory())
      subscription = await db.subscription.create({
        subscriberPhoneNumber: genPhoneNumber(),
        channelPhoneNumber: channel.phoneNumber,
      })
    })

    it('belongs to a channel', async () => {
      expect(await subscription.getChannel()).to.be.an('object')
    })
  })
})
