import { expect } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'
import phoneNumberService from '../../../../../app/services/registrar/phoneNumber/index'
import sinon from 'sinon'
import phoneNumberRepository from '../../../../../app/db/repositories/phoneNumber'
import channelRepository from '../../../../../app/db/repositories/channel'
import signal from '../../../../../app/services/signal'

describe('phone number services -- recycle module', () => {
  const validPhoneNumbers = '+11111111111,+12222222222'
  const invalidPhoneNumbers = '9999999,+123456'
  let db = {}
  const sock = {}
  let updatePhoneNumberStub,
    broadcastMessageStub,
    findChannelStub,
    getMemberPhoneNumbersStub,
    getAdminPhoneNumbersStub,
    destroyChannelSpy

  beforeEach(() => {
    updatePhoneNumberStub = sinon.stub(phoneNumberRepository, 'update')
    broadcastMessageStub = sinon.stub(signal, 'broadcastMessage')
    findChannelStub = sinon.stub(channelRepository, 'findDeep')
    getMemberPhoneNumbersStub = sinon.stub(channelRepository, 'getMemberPhoneNumbers')
    getAdminPhoneNumbersStub = sinon.stub(channelRepository, 'getAdminPhoneNumbers')
    destroyChannelSpy = sinon.spy()
  })

  afterEach(() => {
    updatePhoneNumberStub.restore()
    broadcastMessageStub.restore()
    findChannelStub.restore()
    getMemberPhoneNumbersStub.restore()
    getAdminPhoneNumbersStub.restore()
  })

  const updatePhoneNumberSucceeds = () =>
    updatePhoneNumberStub.callsFake((_, phoneNumber, { status }) =>
      Promise.resolve({ phoneNumber, status }),
    )

  const updatePhoneNumberFails = () =>
    updatePhoneNumberStub.callsFake((_, _phoneNumber, { _status }) =>
      Promise.resolve({
        then: _ => {
          throw 'DB phoneNumber update failure'
        },
      }),
    )

  const destroyChannelSucceeds = () =>
    findChannelStub.callsFake((_, phoneNumber) =>
      Promise.resolve({ destroy: destroyChannelSpy, phoneNumber }),
    )

  const destroyChannelFails = () =>
    findChannelStub.callsFake((_, phoneNumber) =>
      Promise.resolve({
        destroy: () => {
          throw 'Failed to destroy channel'
        },
        phoneNumber,
      }),
    )

  describe('recycling phone numbers', () => {
    describe('when phone numbers are in an invalid format', () => {
      it('returns a channel not found status', async () => {
        const response = await phoneNumberService.recycle({
          db,
          sock,
          phoneNumbers: invalidPhoneNumbers,
        })
        expect(response).to.eql([])
      })
    })

    describe('when phone numbers are in a valid format', () => {
      describe('when phone numbers do not exist in channels db', () => {
        beforeEach(async () => {
          findChannelStub.returns(Promise.resolve(null))
        })

        it('returns a channel not found status', async () => {
          const response = await phoneNumberService.recycle({
            db,
            sock,
            phoneNumbers: validPhoneNumbers,
          })

          expect(response).to.eql([
            {
              message: 'Channel not found for +11111111111',
              status: 'ERROR',
            },
            {
              message: 'Channel not found for +12222222222',
              status: 'ERROR',
            },
          ])
        })
      })

      describe('when phone numbers do exist in channels db', () => {
        beforeEach(async () => {
          findChannelStub.returns(Promise.resolve({}))
        })

        it('notifies the members of the channel of destruction', async () => {
          await phoneNumberService.recycle({
            db,
            sock,
            phoneNumbers: validPhoneNumbers,
          })

          expect(broadcastMessageStub.called).to.eql(true)
        })

        describe('when the channel destruction succeeds', () => {
          beforeEach(() => {
            destroyChannelSucceeds()
          })

          describe('when the phoneNumber update succeeds', () => {
            beforeEach(() => {
              updatePhoneNumberSucceeds()
            })

            it('updates the phone number record to verified', async () => {
              await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: validPhoneNumbers,
              })

              expect(updatePhoneNumberStub.getCall(0).args).to.eql([
                {},
                '+11111111111',
                {
                  status: 'VERIFIED',
                },
              ])
            })

            it('successfully destroys the channel', async () => {
              await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: validPhoneNumbers,
              })

              expect(destroyChannelSpy.callCount).to.eql(2)
            })

            it('returns successful recycled phone number statuses', async () => {
              const response = await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: validPhoneNumbers,
              })

              expect(response).to.eql([
                {
                  data: {
                    phoneNumber: '+11111111111',
                    status: 'VERIFIED',
                  },
                  status: 'SUCCESS',
                },
                {
                  data: {
                    phoneNumber: '+12222222222',
                    status: 'VERIFIED',
                  },
                  status: 'SUCCESS',
                },
              ])
            })
          })

          describe('when the phoneNumber status update fails', () => {
            beforeEach(() => {
              updatePhoneNumberFails()
            })

            it('returns a failed status', async () => {
              const response = await phoneNumberService.recycle({
                db,
                sock,
                phoneNumbers: validPhoneNumbers,
              })

              expect(response).to.eql([
                {
                  message: 'Failed to recycle channel. Error: DB phoneNumber update failure',
                  status: 'ERROR',
                },
                {
                  message: 'Failed to recycle channel. Error: DB phoneNumber update failure',
                  status: 'ERROR',
                },
              ])
            })
          })
        })

        describe('when the channel destruction fails', () => {
          beforeEach(() => {
            destroyChannelFails()
            getAdminPhoneNumbersStub.returns(['+16154804259', '+12345678910'])
          })

          it('notifies the correct instance maintainers', async () => {
            await phoneNumberService.recycle({
              db,
              sock,
              phoneNumbers: validPhoneNumbers,
            })

            expect(broadcastMessageStub.getCall(2).args[1]).to.eql(['+16154804259', '+12345678910'])
          })

          it('notifies the instance maintainers with a channel failure message', async () => {
            await phoneNumberService.recycle({
              db,
              sock,
              phoneNumbers: validPhoneNumbers,
            })

            expect(broadcastMessageStub.getCall(2).args[2]).to.eql({
              messageBody: 'Failed to recycle channel for phone number: +11111111111',
              type: 'send',
              username: '+15555555555',
            })
          })

          it('returns a failed status', async () => {
            const response = await phoneNumberService.recycle({
              db,
              sock,
              phoneNumbers: validPhoneNumbers,
            })

            expect(response).to.eql([
              {
                message: 'Failed to recycle channel. Error: Failed to destroy channel',
                status: 'ERROR',
              },
              {
                message: 'Failed to recycle channel. Error: Failed to destroy channel',
                status: 'ERROR',
              },
            ])
          })
        })
      })
    })
  })
})
