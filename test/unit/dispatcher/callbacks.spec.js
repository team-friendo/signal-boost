import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { messageTypes } from '../../../app/signal'
import { statuses } from '../../../app/util'
import { genFingerprint } from '../../support/factories/deauthorization'
import callbacks from '../../../app/dispatcher/callbacks'

describe('callback registry', () => {
  const channelPhoneNumber = genPhoneNumber()
  const subscriberNumber = genPhoneNumber()
  const fingerprint = genFingerprint()
  const trustRequest = {
    type: messageTypes.TRUST,
    username: channelPhoneNumber,
    recipientNumber: subscriberNumber,
    fingerprint,
  }
  const trustResponse = {
    type: messageTypes.TRUSTED_FINGERPRINT,
    data: {
      msg_number: 0,
      message: 'Successfully trusted fingerprint',
      error: true,
      request: trustRequest,
    },
  }
  let resolveStub, rejectStub, noopSpy
  beforeEach(() => {
    resolveStub = sinon.stub()
    rejectStub = sinon.stub()
    noopSpy = sinon.stub(callbacks, '_noop')
  })
  afterEach(() => sinon.restore())

  describe('registering callbacks', () => {
    describe('for a trust request', () => {
      it('registers a trust response handler', () => {
        callbacks.register(trustRequest, resolveStub, rejectStub)
        expect(callbacks.registry[`${messageTypes.TRUST}-${fingerprint}`]).to.eql({
          callback: callbacks._handleTrustResponse,
          resolve: resolveStub,
          reject: rejectStub,
        })
      })
    })
  })

  describe('retrieving callbacks', () => {
    describe('for a trust reponse', () => {
      it('retrieves the trust resposnse handler', () => {
        callbacks.register(trustRequest, resolveStub, rejectStub)
        callbacks.handle(trustResponse)
        expect(resolveStub.getCall(0).args[0]).to.eql({
          status: statuses.SUCCESS,
          message: callbacks.messages.trust.success(channelPhoneNumber, subscriberNumber),
        })
      })
      describe('for an unregistered callback', () => {
        it('returns undefined', () => {
          callbacks.handle(trustResponse)
          callbacks.handle({ type: 'foo' })
          expect(noopSpy.callCount).to.eql(2)
        })
      })
    })
  })
})
