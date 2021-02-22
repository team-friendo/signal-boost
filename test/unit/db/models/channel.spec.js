import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import { times } from 'lodash'
import { run } from '../../../../app/db/index'
import { banFactory } from '../../../support/factories/ban'
import { channelFactory } from '../../../support/factories/channel'
import { membershipFactory } from '../../../support/factories/membership'
import { inviteFactory } from '../../../support/factories/invite'
import { deauthorizationFactory } from '../../../support/factories/deauthorization'
import { hotlineMessageFactory } from '../../../support/factories/hotlineMessages'
const {
  signal: { defaultMessageExpiryTime },
} = require('../../../../app/config')

describe('channel model', () => {
  let db, channel

  const createChannelWithMemberships = () =>
    db.channel.create(
      {
        ...channelFactory(),
        memberships: [membershipFactory(), membershipFactory()],
      },
      {
        include: [{ model: db.membership }],
      },
    )

  const createChannelWithMessageCount = () =>
    db.channel.create(
      {
        ...channelFactory(),
        messageCount: {},
      },
      {
        include: [{ model: db.messageCount }],
      },
    )

  const createChannelWithInvites = () =>
    db.channel.create(
      {
        ...channelFactory(),
        invites: [inviteFactory(), inviteFactory()],
      },
      {
        include: [{ model: db.invite }],
      },
    )

  const createChannelWithBans = () =>
    db.channel.create(
      {
        ...channelFactory(),
        bans: [banFactory(), banFactory()],
      },
      {
        include: [{ model: db.ban }],
      },
    )

  const createChannelWithDeauthorizations = () =>
    db.channel.create(
      {
        ...channelFactory(),
        deauthorizations: [deauthorizationFactory(), deauthorizationFactory()],
      },
      {
        include: [{ model: db.deauthorization }],
      },
    )

  const createChannelWithHotlineMessages = () =>
    db.channel.create(
      {
        ...channelFactory(),
        hotlineMessages: [hotlineMessageFactory(), hotlineMessageFactory()],
      },
      {
        include: [{ model: db.hotlineMessage }],
      },
    )

  const createChannelWithDestructionRequest = () =>
    db.channel.create(
      {
        ...channelFactory(),
        destructionRequest: {},
      },
      {
        include: [{ model: db.destructionRequest }],
      },
    )

  before(async () => {
    db = await run()
  })

  afterEach(async () => {
    await Promise.all([
      db.messageCount.destroy({ where: {}, force: true }),
      db.membership.destroy({ where: {}, force: true }),
      db.hotlineMessage.destroy({ where: {}, force: true }),
      db.destructionRequest.destroy({ where: {}, force: true }),
      db.ban.destroy({ where: {}, force: true }),
    ])
    await db.channel.destroy({ where: {}, force: true })
  })

  after(async () => {
    await db.sequelize.close()
  })

  it('has correct fields', async () => {
    channel = await db.channel.create(channelFactory())

    expect(channel.phoneNumber).to.be.a('string')
    expect(channel.hotlineOn).to.be.a('boolean')
    expect(channel.messageExpiryTime).to.be.a('number')
    expect(channel.vouchMode).to.be.a('string')
    expect(channel.vouchLevel).to.be.a('number')
    expect(channel.socketId).to.be.a('number')
    expect(channel.nextAdminId).to.be.a('number')
    expect(channel.subscriberLimit).to.be.a('number')
    expect(channel.createdAt).to.be.a('Date')
    expect(channel.updatedAt).to.be.a('Date')
  })

  it('sets correct defaults', async () => {
    channel = await db.channel.create(
      channelFactory({
        hotlineOn: undefined,
        messageExpiryTime: undefined,
        socketId: undefined,
        vouchLevel: undefined,
        vouchMode: undefined,
        subscriberLimit: undefined,
        nextAdminId: undefined,
      }),
    )

    expect(channel.hotlineOn).to.equal(true)
    expect(channel.messageExpiryTime).to.equal(defaultMessageExpiryTime)
    expect(channel.socketId).to.equal(0)
    expect(channel.vouchMode).to.equal('OFF')
    expect(channel.vouchLevel).to.equal(1)
    expect(channel.subscriberLimit).to.equal(500)
    expect(channel.nextAdminId).to.equal(1)
  })

  describe('validations', () => {
    it('does not allow null phone numbers', async () => {
      const err = await db.channel.create(channelFactory({ phoneNumber: null })).catch(e => e)
      expect(err.message).to.include('channel.phoneNumber cannot be null')
    })

    it('does not allow duplicate phone number', async () => {
      const attrs = channelFactory()
      const err = await db.channel.bulkCreate([attrs, attrs]).catch(e => e)
      expect(err.errors[0].message).to.eql('phoneNumber must be unique')
    })
  })

  describe('associations', () => {
    let channel, messageCount, memberships, invites, deauthorizations, hotlineMessages, bans

    describe('memberships', () => {
      beforeEach(async () => {
        channel = await createChannelWithMemberships()
        memberships = await channel.getMemberships()
      })

      it('has many memberships', async () => {
        expect(memberships).to.have.length(2)
      })

      it('sets the channel phone number as the foreign key in each membership', () => {
        expect(memberships.map(s => s.channelPhoneNumber)).to.eql(
          times(2, () => channel.phoneNumber),
        )
      })

      it('deletes memberships when it deletes channel', async () => {
        const membershipCount = await db.membership.count()
        await channel.destroy()
        expect(await db.membership.count()).to.eql(membershipCount - 2)
      })
    })

    describe('message count', () => {
      beforeEach(async () => {
        channel = await createChannelWithMessageCount()
        messageCount = await channel.getMessageCount()
      })

      it('has one message count', async () => {
        expect(messageCount).to.be.an('object')
      })

      it('sets the channel phone number as foreign key on the message count', () => {
        expect(messageCount.channelPhoneNumber).to.eql(channel.phoneNumber)
      })

      it('sets default counts when creating empty message count', () => {
        expect(messageCount.broadcastOut).to.eql(0)
      })

      it('deletes message count when it deletes channel', async () => {
        const messageCountCount = await db.messageCount.count()
        await channel.destroy()
        expect(await db.messageCount.count()).to.eql(messageCountCount - 1)
      })
    })

    describe('invites', () => {
      beforeEach(async () => {
        channel = await createChannelWithInvites()
        invites = await channel.getInvites()
      })

      it('has many invites', async () => {
        expect(invites).to.have.length(2)
      })

      it('sets the channel phone number as the foreign key in each invite', () => {
        expect(invites.map(s => s.channelPhoneNumber)).to.eql(times(2, () => channel.phoneNumber))
      })

      it('deletes invites when it deletes channel', async () => {
        const inviteCount = await db.invite.count()
        await channel.destroy()
        expect(await db.invite.count()).to.eql(inviteCount - 2)
      })
    })

    describe('bans', () => {
      beforeEach(async () => {
        channel = await createChannelWithBans()
        bans = await channel.getBans()
      })

      it('has many bans', async () => {
        expect(bans).to.have.length(2)
      })
    })

    describe('deauthorizations', () => {
      beforeEach(async () => {
        channel = await createChannelWithDeauthorizations()
        deauthorizations = await channel.getDeauthorizations()
      })

      it('has many deauthorizations', async () => {
        expect(deauthorizations).to.have.length(2)
      })

      it('sets the channel phone number as the foreign key in each invite', () => {
        expect(deauthorizations.map(s => s.channelPhoneNumber)).to.eql(
          times(2, () => channel.phoneNumber),
        )
      })

      it('deletes deauthorizations when it deletes channel', async () => {
        const deauthorizationCount = await db.deauthorization.count()
        await channel.destroy()
        expect(await db.deauthorization.count()).to.eql(deauthorizationCount - 2)
      })
    })

    describe('hotline messages', () => {
      beforeEach(async () => {
        channel = await createChannelWithHotlineMessages()
        hotlineMessages = await channel.getHotlineMessages()
      })

      it('has many hotlineMessages', async () => {
        expect(hotlineMessages).to.have.length(2)
      })

      it('sets the channel phone number as the foreign key in each invite', () => {
        expect(hotlineMessages.map(s => s.channelPhoneNumber)).to.eql(
          times(2, () => channel.phoneNumber),
        )
      })

      it('deletes hotlineMessages when it deletes channel', async () => {
        const hotlineMessageCount = await db.hotlineMessage.count()
        await channel.destroy()
        expect(await db.hotlineMessage.count()).to.eql(hotlineMessageCount - 2)
      })
    })

    describe('destruction request', () => {
      let destructionRequest
      beforeEach(async () => {
        channel = await createChannelWithDestructionRequest()
        destructionRequest = await channel.getDestructionRequest()
      })

      it('has one destruction request', () => {
        expect(destructionRequest).to.be.an('object')
      })

      it('deletes the destruction request when it deletes channel', async () => {
        const destructionRequestCount = await db.destructionRequest.count()
        await channel.destroy()
        expect(await db.destructionRequest.count()).to.eql(destructionRequestCount - 1)
      })

      it('returns null if no destruction requests exist for the account', async () => {
        channel = await db.channel.create(channelFactory())
        expect(await channel.getDestructionRequest()).to.be.null
      })
    })
  })
})
