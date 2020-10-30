import { expect } from 'chai'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import sinon from 'sinon'
import commonService from '../../../../app/registrar/phoneNumber/common'
import fs from 'fs-extra'
import { times, map, flatten } from 'lodash'
import channelRepository from '../../../../app/db/repositories/channel'
import destructionRequestRepository from '../../../../app/db/repositories/destructionRequest'
import eventRepository from '../../../../app/db/repositories/event'
import phoneNumberRepository from '../../../../app/db/repositories/phoneNumber'
import notifier, { notificationKeys } from '../../../../app/notifier'
import signal from '../../../../app/signal'
import app from '../../../../app'
import testApp from '../../../support/testApp'
import {
  destroy,
  redeem,
  requestToDestroy,
  processDestructionRequests,
} from '../../../../app/registrar/phoneNumber'
import { eventTypes } from '../../../../app/db/models/event'
import { channelFactory, deepChannelFactory } from '../../../support/factories/channel'

import { genPhoneNumber, phoneNumberFactory } from '../../../support/factories/phoneNumber'
import { eventFactory } from '../../../support/factories/event'
import { requestToDestroyStaleChannels } from '../../../../app/registrar/phoneNumber/destroy'

describe('phone number registrar -- destroy module', () => {
  const phoneNumber = genPhoneNumber()
  const phoneNumberRecord = phoneNumberFactory({ phoneNumber })
  const phoneNumbers = times(2, genPhoneNumber)
  const channel = deepChannelFactory({ phoneNumber })
  const sender = channel.memberships[0].memberPhoneNumber

  let findChannelStub,
    findPhoneNumberStub,
    destroyPhoneNumberStub,
    deleteDirStub,
    twilioRemoveStub,
    signaldUnsubscribeStub,
    commitStub,
    rollbackStub,
    notifyMembersExceptStub,
    updatePhoneNumberStub,
    destroyChannelStub,
    logEventStub,
    notifyAdminsStub,
    notifyMaintainersStub,
    notifyMembersStub,
    requestToDestroyStub

  before(async () => {
    await app.run(testApp)
  })

  beforeEach(() => {
    commitStub = sinon.stub()
    rollbackStub = sinon.stub()
    sinon.stub(app.db.sequelize, 'transaction').returns({
      commit: commitStub,
      rollback: rollbackStub,
    })
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    destroyChannelStub = sinon.stub(channelRepository, 'destroy')
    requestToDestroyStub = sinon.stub(destructionRequestRepository, 'requestToDestroy')
    findPhoneNumberStub = sinon.stub(phoneNumberRepository, 'find')
    destroyPhoneNumberStub = sinon.stub(phoneNumberRepository, 'destroy')

    notifyAdminsStub = sinon.stub(notifier, 'notifyAdmins')
    notifyMembersStub = sinon.stub(notifier, 'notifyMembers')
    notifyMaintainersStub = sinon.stub(notifier, 'notifyMaintainers')
    notifyMembersExceptStub = sinon.stub(notifier, 'notifyMembersExcept').returns(Promise.resolve())

    twilioRemoveStub = sinon.stub()
    sinon.stub(commonService, 'getTwilioClient').callsFake(() => ({
      incomingPhoneNumbers: () => ({ remove: twilioRemoveStub }),
    }))
    deleteDirStub = sinon.stub(fs, 'remove').returns(['/var/lib'])
    signaldUnsubscribeStub = sinon.stub(signal, 'unsubscribe')
    logEventStub = sinon
      .stub(eventRepository, 'log')
      .returns(Promise.resolve(eventFactory({ type: eventTypes.CHANNEL_DESTROYED })))
  })

  afterEach(() => sinon.restore())
  after(async () => await app.stop())

  // TESTS

  describe('#destroy', () => {
    describe('when phone number does not exist in channels db', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      describe('when phone number does not exist in phone number db', () => {
        beforeEach(async () => {
          findPhoneNumberStub.returns(Promise.resolve(null))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `No records found for ${phoneNumber}`,
            status: 'ERROR',
          })
        })
      })

      describe('when phone number exists but no channel uses it', () => {
        beforeEach(async () => {
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          findChannelStub.returns(Promise.resolve(null))
        })

        it('destroys the phone number', async () => {
          await destroy({ phoneNumber })
          expect(destroyPhoneNumberStub.callCount).to.eql(1)
        })

        it('releases the phone number back to twilio', async () => {
          await destroy({ phoneNumber })
          expect(twilioRemoveStub.callCount).to.eql(1)
        })

        it('returns SUCCESS', async () => {
          const response = await destroy({ phoneNumber })
          expect(response.status).to.eql('SUCCESS')
        })

        it('does not attempt to notify members of non-existent channel', async () => {
          await destroy({ phoneNumber })
          expect(notifyMembersExceptStub.callCount).to.eql(0)
        })

        it('does not attempt to destroy a channel', async () => {
          await destroy({ phoneNumber })
          expect(destroyChannelStub.callCount).to.eql(0)
        })
      })
    })

    describe('when channel exists with given phone number', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve({}))
      })

      describe('all tasks succeed', () => {
        beforeEach(async () => {
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          notifyMembersExceptStub.returns(Promise.resolve())
          notifyMaintainersStub.returns(Promise.resolve())
          deleteDirStub.returns(Promise.resolve())
          twilioRemoveStub.returns(Promise.resolve())
          destroyPhoneNumberStub.returns(Promise.resolve())
        })

        describe('destroy command called from maintainer', () => {
          it('notifies all the members of the channel of destruction', async () => {
            await destroy({ phoneNumber })
            expect(notifyMembersExceptStub.getCall(0).args).to.eql([
              channel,
              undefined,
              notificationKeys.CHANNEL_DESTROYED,
            ])
          })
        })

        describe('destroy command called from admin of channel', () => {
          it('notifies all members of the channel except for the sender', async () => {
            await destroy({ phoneNumber, sender })
            expect(notifyMembersExceptStub.getCall(0).args).to.eql([
              channel,
              sender,
              notificationKeys.CHANNEL_DESTROYED,
            ])
          })
        })

        it('destroys the channel in the db', async () => {
          await destroy({ phoneNumber })
          expect(destroyChannelStub.callCount).to.eql(1)
        })

        it('logs a CHANNEL_DESTROYED event', async () => {
          await destroy({ phoneNumber })
          expect(logEventStub.getCall(0).args.slice(0, -1)).to.eql([
            eventTypes.CHANNEL_DESTROYED,
            phoneNumber,
          ])
        })

        it("deletes the channel's signal keystore", async () => {
          await destroy({ phoneNumber })
          expect(map(deleteDirStub.getCalls(), 'args')).to.eql([
            [`/var/lib/signald/data/${phoneNumber}`],
            [`/var/lib/signald/data/${phoneNumber}.d`],
          ])
        })

        it('releases the phone number to twilio', async () => {
          await destroy({ phoneNumber })
          expect(twilioRemoveStub.callCount).to.eql(1)
        })

        it('destroys the phoneNumber in the db', async () => {
          await destroy({ phoneNumber })
          expect(destroyPhoneNumberStub.callCount).to.eql(1)
        })

        it('unsubscribes the phoneNumber from signald', async () => {
          await destroy({ phoneNumber })
          expect(signaldUnsubscribeStub.callCount).to.eql(1)
        })

        it('commits the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(commitStub.callCount).to.eql(1)
        })

        it('returns a success status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            status: 'SUCCESS',
            message: `Channel ${phoneNumber} destroyed.`,
          })
        })
      })

      describe('when notifying members fails', () => {
        beforeEach(async () => {
          // business logic succeeds
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          destroyChannelStub.returns(Promise.resolve(true))
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.returns(Promise.resolve())
          deleteDirStub.returns(Promise.resolve())
          // notifying members fails
          notifyMembersExceptStub.callsFake(() => Promise.reject('Failed to broadcast message'))
          // notifying maintainers of error succeeds
          notifyMaintainersStub.returns(Promise.resolve())
        })

        it('commits the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(commitStub.callCount).to.eql(1)
        })

        it('returns a success status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            status: 'SUCCESS',
            message: `Channel ${phoneNumber} destroyed.`,
          })
        })
      })

      describe('when deleting the phone number from the db fails', () => {
        beforeEach(async () => {
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          destroyPhoneNumberStub.callsFake(() => Promise.reject('Gnarly db error!'))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Channel ${phoneNumber} failed to be destroyed. Error: Gnarly db error!`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when releasing the phone number back to twilio fails', () => {
        beforeEach(async () => {
          // finding works
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // destroying phone number works
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.callsFake(() => Promise.reject({ message: 'oh noes!' }))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Channel ${phoneNumber} failed to be destroyed. Error: Failed to release phone number back to Twilio: {"message":"oh noes!"}`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when deleting the channel from the db fails', () => {
        beforeEach(async () => {
          // finding works
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // destroying/releasing phone number works
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.returns(Promise.resolve)
          // destroying channel throws
          destroyChannelStub.callsFake(() => Promise.reject('Gnarly db error!'))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Channel ${phoneNumber} failed to be destroyed. Error: Gnarly db error!`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when destroying the signal entry data fails', () => {
        beforeEach(async () => {
          // finding works
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // destroying phone number & channel works
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.returns(Promise.resolve())
          destroyChannelStub.returns(Promise.resolve())
          // destroying keystore fails
          deleteDirStub.callsFake(() => Promise.reject('File system go BOOM!'))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Channel ${phoneNumber} failed to be destroyed. Error: Failed to destroy signal entry data in keystore`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })

      describe('when unsubscribing from signald fails', () => {
        beforeEach(async () => {
          // finding works
          findChannelStub.returns(Promise.resolve(channel))
          findPhoneNumberStub.returns(Promise.resolve(phoneNumberRecord))
          // destroying phone number & channel works
          destroyPhoneNumberStub.returns(Promise.resolve(true))
          twilioRemoveStub.returns(Promise.resolve())
          destroyChannelStub.returns(Promise.resolve())
          // destroying keystore succeds
          deleteDirStub.returns(Promise.resolve())
          signaldUnsubscribeStub.callsFake(() => Promise.reject('BOOM!'))
        })

        it('returns an error status', async () => {
          const response = await destroy({ phoneNumber })
          expect(response).to.eql({
            message: `Channel ${phoneNumber} failed to be destroyed. Error: BOOM!`,
            status: 'ERROR',
          })
        })

        it('rolls back the db transaction', async () => {
          await destroy({ phoneNumber })
          expect(rollbackStub.callCount).to.eql(1)
          expect(commitStub.callCount).to.eql(0)
        })
      })
    })
  })
  describe('#requestToDestroy', () => {
    describe('when a phone number does not belong to a valid channel', () => {
      beforeEach(async () => {
        findChannelStub.returns(Promise.resolve(null))
      })

      it('returns an ERROR status and message', async () => {
        expect(await requestToDestroy(phoneNumbers)).to.have.deep.members([
          {
            status: 'ERROR',
            message: `${
              phoneNumbers[0]
            } must be associated with a channel in order to be destroyed.`,
          },
          {
            status: 'ERROR',
            message: `${
              phoneNumbers[1]
            } must be associated with a channel in order to be destroyed.`,
          },
        ])
      })
    })

    describe('when the phone number belongs to a valid channel', () => {
      beforeEach(() => {
        findChannelStub.callsFake(phoneNumber => Promise.resolve(channelFactory({ phoneNumber })))
      })

      describe('when a destruction request has already been issued for the phone number', () => {
        beforeEach(() => {
          requestToDestroyStub.returns(Promise.resolve({ wasCreated: false }))
        })

        it('attempts to issue a destruction request', async () => {
          await requestToDestroy(phoneNumbers)
          expect(requestToDestroyStub.callCount).to.eql(2)
        })

        it('returns an ERROR status and message', async () => {
          expect(await requestToDestroy(phoneNumbers)).to.have.deep.members([
            {
              status: 'ERROR',
              message: `${phoneNumbers[0]} has already been enqueued for destruction.`,
            },
            {
              status: 'ERROR',
              message: `${phoneNumbers[1]} has already been enqueued for destruction.`,
            },
          ])
        })
      })

      describe('when no destruction requests have been issued for any phone numbers', () => {
        beforeEach(() => {
          requestToDestroyStub.returns(Promise.resolve({ wasCreated: true }))
        })

        it('returns a SUCCESS status and message', async () => {
          expect(await requestToDestroy(phoneNumbers)).to.have.deep.members([
            {
              status: 'SUCCESS',
              message: `Issued request to destroy ${phoneNumbers[0]}.`,
            },
            {
              status: 'SUCCESS',
              message: `Issued request to destroy ${phoneNumbers[1]}.`,
            },
          ])
        })

        it('notifies the channel admins that their channel will be destroyed soon', async () => {
          await requestToDestroy(phoneNumbers)
          notifyAdminsStub
            .getCalls()
            .map(call => call.args)
            .forEach(([channel, notificationKey]) => {
              expect(phoneNumbers).to.include(channel.phoneNumber)
              expect(notificationKey).to.eql('channelEnqueuedForDestruction')
            })
        })
      })
    })

    describe('when updating the DB throws an error', () => {
      beforeEach(() => findChannelStub.callsFake(() => Promise.reject('DB err')))

      it('returns an ERROR status and message', async () => {
        const result = await requestToDestroy(phoneNumbers)

        expect(result).to.have.deep.members([
          {
            status: 'ERROR',
            message: `Database error trying to issue destruction request for ${phoneNumbers[0]}.`,
          },
          {
            status: 'ERROR',
            message: `Database error trying to issue destruction request for ${phoneNumbers[1]}.`,
          },
        ])
      })
    })

    describe('when some requests succeed and others fail', () => {
      const _phoneNumbers = times(4, genPhoneNumber)
      const createChannelFake = phoneNumber => Promise.resolve(channelFactory({ phoneNumber }))
      const requestIssuedFake = () => Promise.resolve({ wasCreated: true })
      const requestNotIssuedFake = () => Promise.resolve({ wasCreated: false })

      beforeEach(() => {
        findChannelStub
          .onCall(0)
          .callsFake(() => Promise.reject('BOOM!'))
          .onCall(1)
          .returns(Promise.resolve(null))
          .onCall(2)
          .callsFake(createChannelFake)
          .onCall(3)
          .callsFake(createChannelFake)
        requestToDestroyStub
          .onCall(0)
          .callsFake(requestNotIssuedFake)
          .onCall(1)
          .callsFake(requestIssuedFake)
      })
      it('returns different results for each phone number', async () => {
        expect(await requestToDestroy(_phoneNumbers)).to.eql([
          {
            status: 'ERROR',
            message: `Database error trying to issue destruction request for ${_phoneNumbers[0]}.`,
          },
          {
            status: 'ERROR',
            message: `${
              _phoneNumbers[1]
            } must be associated with a channel in order to be destroyed.`,
          },
          {
            status: 'ERROR',
            message: `${_phoneNumbers[2]} has already been enqueued for destruction.`,
          },
          {
            status: 'SUCCESS',
            message: `Issued request to destroy ${_phoneNumbers[3]}.`,
          },
        ])
      })
    })
  })

  describe('#requestToDestroyStaleChannels', () => {
    const staleChannels = times(2, deepChannelFactory)
    beforeEach(() => {
      sinon.stub(channelRepository, 'getStaleChannels').returns(Promise.resolve(staleChannels))
      findChannelStub.callsFake(phoneNumber => Promise.resolve(deepChannelFactory({ phoneNumber })))
      requestToDestroyStub.returns(Promise.resolve({ wasCreated: true }))
    })

    it('issues destroy request for channels not used during ttl window', async () => {
      const result = await requestToDestroyStaleChannels()

      expect(flatten(map(requestToDestroyStub.getCalls(), 'args'))).to.have.members([
        staleChannels[0].phoneNumber,
        staleChannels[1].phoneNumber,
      ])

      expect(result).to.have.deep.members([
        {
          message: `Issued request to destroy ${staleChannels[0].phoneNumber}.`,
          status: 'SUCCESS',
        },
        {
          message: `Issued request to destroy ${staleChannels[1].phoneNumber}.`,
          status: 'SUCCESS',
        },
      ])
    })
  })

  describe('#processDestructionRequests', () => {
    const toDestroy = times(3, genPhoneNumber)
    let getMatureDestructionRequestsStub, destroyDestructionRequestsStub

    beforeEach(() => {
      // recycle helpers that should always succeed
      notifyMembersStub.returns(Promise.resolve('42'))
      logEventStub.returns(Promise.resolve(eventFactory()))
      updatePhoneNumberStub.returns(phoneNumberFactory())
      findChannelStub.callsFake(phoneNumber => Promise.resolve(channelFactory({ phoneNumber })))

      // processRecycle helpers that should always succeed
      destroyDestructionRequestsStub = sinon
        .stub(destructionRequestRepository, 'destroyMany')
        .returns(Promise.resolve(toDestroy.length))
      notifyMaintainersStub.returns(Promise.resolve(['42']))
      notifyAdminsStub.returns(Promise.resolve(['42', '42']))

      // if this fails, processDestructionRequests will fail
      getMatureDestructionRequestsStub = sinon.stub(
        destructionRequestRepository,
        'getMatureDestructionRequests',
      )
    })

    describe('when processing succeeds', () => {
      beforeEach(async () => {
        // destroy succeeds twice, fails once
        destroyChannelStub
          .onCall(0)
          .returns(Promise.resolve(true))
          .onCall(1)
          .returns(Promise.resolve(true))
          .onCall(2)
          .callsFake(() => Promise.reject('BOOM!'))
        // overall job succeeds
        getMatureDestructionRequestsStub.returns(Promise.resolve(toDestroy))
        await processDestructionRequests()
      })

      it('destroys channels with mature destruction requests', () => {
        expect(flatten(map(destroyChannelStub.getCalls(), x => x.args[0]))).to.eql(toDestroy)
      })

      it('destroys all destruction requests that were just processed', () => {
        expect(destroyDestructionRequestsStub.getCall(0).args).to.eql([toDestroy])
      })

      it('notifies maintainers of results', () => {
        expect(notifyMaintainersStub.getCall(0).args).to.eql([
          '3 destruction requests processed:\n\n' +
            `Channel ${toDestroy[0]} destroyed.\n` +
            `Channel ${toDestroy[1]} destroyed.\n` +
            `Channel ${toDestroy[2]} failed to be destroyed. Error: BOOM!`,
        ])
      })
    })

    describe('when job fails', () => {
      beforeEach(() => getMatureDestructionRequestsStub.callsFake(() => Promise.reject('BOOM!')))
      it('notifies maintainers of error', async () => {
        await processDestructionRequests()
        expect(notifyMaintainersStub.getCall(0).args).to.eql([
          'Error processing destruction job: BOOM!',
        ])
      })
    })
  })

  describe('#redeem', () => {
    const channelToRedeem = deepChannelFactory({ phoneNumber })
    let destroyDestructionRequestStub
    beforeEach(
      () => (destroyDestructionRequestStub = sinon.stub(destructionRequestRepository, 'destroy')),
    )

    describe('when all tasks succeed', () => {
      beforeEach(async () => {
        destroyDestructionRequestStub.returns(Promise.resolve(1))
        notifyMaintainersStub.returns(Promise.resolve(['42']))
        notifyAdminsStub.returns(Promise.resolve(['42', '42']))
        await redeem(channelToRedeem)
      })

      it('deletes the destruction requests for redeemed channels', () => {
        expect(destroyDestructionRequestStub.getCall(0).args).to.eql([phoneNumber])
      })

      it('notifies admins of redeemed channels of redemption', () => {
        expect(notifyAdminsStub.getCall(0).args).to.eql([
          channelToRedeem,
          notificationKeys.CHANNEL_REDEEMED,
        ])
      })

      it('notifies maintainers of results', () => {
        expect(notifyMaintainersStub.getCall(0).args).to.eql([
          `${phoneNumber} had been scheduled for destruction, but was just redeemed.`,
        ])
      })
    })
  })
})
