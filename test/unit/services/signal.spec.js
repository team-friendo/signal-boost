import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import fs from 'fs-extra'
import net from 'net'
import { wait } from '../../../app/services/util'
import signal, { messageTypes } from '../../../app/services/signal'
import { EventEmitter } from 'events'
import { genPhoneNumber } from '../../support/factories/phoneNumber'

describe('signal module', () => {
  const sock = new EventEmitter()
  sock.setEncoding = () => null
  describe('getting a socket', () => {
    let pathExistsStub, connectStub

    beforeEach(() => {
      pathExistsStub = sinon.stub(fs, 'pathExists')
      connectStub = sinon.stub(net, 'createConnection').returns(sock)
    })

    afterEach(() => {
      pathExistsStub.restore()
      connectStub.restore()
    })

    describe('when socket is eventually available', () => {
      let result
      beforeEach(async () => {
        pathExistsStub.onCall(0).returns(Promise.resolve(false))
        pathExistsStub.onCall(1).returns(Promise.resolve(false))
        pathExistsStub.onCall(2).callsFake(() => {
          wait(5).then(() => sock.emit('connect', sock))
          return Promise.resolve(true)
        })
        result = await signal.getSocket()
      })

      it('looks for a socket descriptor at an interval', async () => {
        expect(pathExistsStub.callCount).to.eql(3)
      })

      it('connects to socket once it exists', () => {
        expect(connectStub.callCount).to.eql(1)
      })

      it('returns the connected socket', () => {
        expect(result).to.eql(sock)
      })
    })

    describe('when connection is never available', () => {
      beforeEach(() => pathExistsStub.returns(Promise.resolve(false)))

      it('attempts to connect a finite number of times then rejects', async () => {
        const result = await signal.getSocket().catch(a => a)
        expect(pathExistsStub.callCount).to.be.above(10)
        expect(connectStub.callCount).to.eql(0)
        expect(result.message).to.eql(signal.errorMessages.socketTimeout)
      })
    })
  })

  describe('sending signald commands', () => {
    const channelPhoneNumber = genPhoneNumber()
    const subscriberNumber = genPhoneNumber()
    const timestamp = new Date().getTime()
    const fp1 =
      '04 05 0e 12 19 1a 37 3f 46 4b 51 59 5d 61 64 69 7b 7f 80 82 91 9e 9f c2 d2 d4 d8 e0 e2 f3 f5 fd fe'
    const fp2 =
      'fe fd f5 f3 e2 e0 d8 d4 d2 c2 9f 9e 91 82 80 7f 7b 69 64 61 5d 59 51 4b 46 3f 37 1a 19 12 0e 05 04'
    const fp3 =
      '69 64 61 5d 59 51 4b 46 3f 37 1a 19 12 0e 05 04 fe fd f5 f3 e2 e0 d8 d4 d2 c2 9f 9e 91 82 80 7f 7b'
    const untrustedIdentities = [
      {
        trust_level: 'TRUSTED_UNVERIFIED',
        added: timestamp,
        fingerprint: fp1,
        username: subscriberNumber,
      },
      {
        trust_level: 'UNTRUSTED',
        added: timestamp + 1000,
        fingerprint: fp2,
        username: subscriberNumber,
      },
      {
        trust_level: 'UNTRUSTED',
        added: timestamp + 2000,
        fingerprint: fp3,
        username: subscriberNumber,
      },
    ]
    const trustedIdentities = [
      {
        trust_level: 'TRUSTED_UNVERIFIED',
        added: timestamp,
        fingerprint: fp1,
        username: subscriberNumber,
      },
      {
        trust_level: 'UNTRUSTED',
        added: timestamp + 1000,
        fingerprint: fp2,
        username: subscriberNumber,
      },
      {
        trust_level: 'TRUSTED_VERIFIED',
        added: timestamp + 2000,
        fingerprint: fp3,
        username: subscriberNumber,
      },
    ]

    let sock
    const emit = msg => sock.emit('data', JSON.stringify(msg) + '\n')
    const emitWithDelay = (delay, msg) => wait(delay).then(() => emit(msg))

    beforeEach(() => {
      sock = new EventEmitter()
      sock.write = sinon.stub()
    })

    it('sends a register command', async () => {
      signal.register(sock, channelPhoneNumber)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"register","username":"${channelPhoneNumber}"}\n`,
      )
    })

    it('sends a verify command', () => {
      signal.verify(sock, channelPhoneNumber, '111-222')

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"verify","username":"${channelPhoneNumber}","code":"111-222"}\n`,
      )
    })

    it('sends a subscribe command', () => {
      signal.subscribe(sock, channelPhoneNumber)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"subscribe","username":"${channelPhoneNumber}"}\n`,
      )
    })

    it('sends a signal message', () => {
      const sdMessage = {
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: null,
        messageBody: 'hello world!',
        attachments: [],
      }
      signal.sendMessage(sock, '+12223334444', sdMessage)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+12223334444","messageBody":"hello world!","attachments":[]}\n`,
      )
    })

    it('broadcasts a signal message', () => {
      const sdMessage = {
        type: 'send',
        username: channelPhoneNumber,
        recipientNumber: null,
        messageBody: 'hello world!',
        attachments: [],
      }
      const recipients = ['+11111111111', '+12222222222']
      signal.broadcastMessage(sock, recipients, sdMessage)

      expect(sock.write.getCall(0).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+11111111111","messageBody":"hello world!","attachments":[]}\n`,
      )

      expect(sock.write.getCall(1).args[0]).to.eql(
        `{"type":"send","username":"${channelPhoneNumber}","recipientNumber":"+12222222222","messageBody":"hello world!","attachments":[]}\n`,
      )
    })

    describe('fetching identities for a channel user', () => {
      describe('when the fetch returns results', async () => {
        it('returns an array of identities', async () => {
          const promises = await Promise.all([
            signal.fetchIdentities(sock, channelPhoneNumber, subscriberNumber),
            emitWithDelay(20, { type: 'identities', data: { identities: untrustedIdentities } }),
          ])
          const identities = promises[0]
          expect(identities).to.eql(untrustedIdentities)
        })
      })

      describe('when the fetch returns no results', () => {
        it('rejects a promise', async () => {
          const result = await signal
            .fetchIdentities(sock, channelPhoneNumber, subscriberNumber)
            .catch(a => a)

          expect(result.message).to.eql(
            signal.errorMessages.identityRequestTimeout(subscriberNumber),
          )
        })
      })
    })

    describe('trusting an expired safety number', () => {
      it('attempts to fetch identities for the untrusted user', async () => {
        await signal.trust(sock, channelPhoneNumber, subscriberNumber, fp3).catch(a => a)
        expect(sock.write.getCall(0).args[0]).to.eql(
          signal.signaldEncode({
            type: messageTypes.GET_IDENTITIES,
            username: channelPhoneNumber,
            recipientNumber: subscriberNumber,
          }),
        )
      })
      describe('when identities can be fetched', () => {
        it('attempts to trust most recently added untrusted fingerprint', async () => {
          await Promise.all([
            signal.trust(sock, channelPhoneNumber, subscriberNumber, fp3).catch(a => a),
            emitWithDelay(10, {
              type: messageTypes.IDENTITIES,
              data: { identities: untrustedIdentities },
            }),
          ])
          expect(sock.write.getCall(1).args[0]).to.eql(
            signal.signaldEncode({
              type: messageTypes.TRUST,
              username: channelPhoneNumber,
              recipientNumber: subscriberNumber,
              fingerprint: fp3,
            }),
          )
        })

        describe('when trusted identity can be verified', () => {
          it('returns a success object', async () => {
            const promises = await Promise.all([
              signal.trust(sock, channelPhoneNumber, subscriberNumber),
              emitWithDelay(10, {
                type: messageTypes.IDENTITIES,
                data: { identities: untrustedIdentities },
              }),
              emitWithDelay(20, {
                type: messageTypes.IDENTITIES,
                data: { identities: trustedIdentities },
              }),
            ])
            const result = promises[0]

            expect(result).to.eql({
              status: 'SUCCESS',
              message: signal.successMessages.trustSuccess(subscriberNumber),
            })
          })
        })

        describe('when trusted identity cannot be verified', () => {
          it('rejects with an error object', async () => {
            const promises = await Promise.all([
              signal.trust(sock, channelPhoneNumber, subscriberNumber).catch(a => a),
              emitWithDelay(10, {
                type: messageTypes.IDENTITIES,
                data: { identities: untrustedIdentities },
              }),
              emitWithDelay(20, {
                type: messageTypes.IDENTITIES,
                data: { identities: untrustedIdentities },
              }),
            ])
            const result = promises[0]
            expect(result).to.eql({
              status: 'ERROR',
              message: signal.errorMessages.trustError(subscriberNumber),
            })
          })
        })
      })

      describe('when identities request times out', () => {
        it('rejects with an error object', async () => {
          const promises = await Promise.all([
            signal.trust(sock, channelPhoneNumber, subscriberNumber).catch(a => a),
            emitWithDelay(10, {
              type: messageTypes.IDENTITIES,
              data: { identities: untrustedIdentities },
            }),
          ])
          const result = promises[0]
          expect(result).to.eql({
            status: 'ERROR',
            message: signal.errorMessages.identityRequestTimeout(subscriberNumber),
          })
        })
      })
    })

    describe('listening for a registration verification event', () => {
      const phoneNumber = genPhoneNumber()
      let result

      describe('when a verification success message for the listening channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            sock.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_SUCCESS,
                data: { username: phoneNumber },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(sock, phoneNumber)
        })

        it('resolves with the success message', async () => {
          expect(result).to.eql({ username: phoneNumber })
        })
      })

      describe('when a verification failure message for the listening channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            sock.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_ERROR,
                data: { username: phoneNumber },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(sock, phoneNumber).catch(a => a)
        })

        it('rejects with an error message', async () => {
          expect(result).to.be.an('Error')
          expect(result.message).to.eql(signal.errorMessages.verificationTimeout(phoneNumber))
        })
      })

      describe('when no verification message is emitted before the timeout threshold', () => {
        beforeEach(async () => {
          wait(5).then(() => sock.emit('data', JSON.stringify({ type: 'foo' })))
          result = await signal.awaitVerificationResult(sock, phoneNumber).catch(a => a)
        })

        it('rejects with an error message', async () => {
          expect(result).to.be.an('Error')
          expect(result.message).to.eql(signal.errorMessages.verificationTimeout(phoneNumber))
        })
      })

      describe('when a verification success message for another channel is emitted', () => {
        beforeEach(async () => {
          wait(5).then(() =>
            sock.emit(
              'data',
              JSON.stringify({
                type: messageTypes.VERIFICATION_ERROR,
                data: { username: genPhoneNumber() },
              }),
            ),
          )
          result = await signal.awaitVerificationResult(sock, phoneNumber).catch(a => a)
        })

        it('does nothing', () => {
          expect(result).to.be.an('Error')
        })
      })
    })
  })

  describe('message parsing', () => {
    it('parses an output signald message from an inbound signald message', () => {
      const inMessage = {
        type: messageTypes.MESSAGE,
        data: {
          username: '+14049486063',
          hasUuid: false,
          hasSource: true,
          source: '+18319176400',
          hasSourceDevice: true,
          sourceDevice: 1,
          type: 1,
          hasRelay: false,
          timestamp: 1556592441767,
          timestampISO: '2019-04-30T02:47:21.767Z',
          serverTimestamp: 1556592443934,
          hasLegacyMessage: false,
          hasContent: true,
          isSignalMessage: false,
          isPrekeySignalMessage: false,
          isReceipt: false,
          isUnidentifiedSender: false,
          dataMessage: {
            timestamp: 1556592441767,
            message: 'hello world!',
            expiresInSeconds: 0,
            attachments: [
              {
                contentType: 'image/jpeg',
                id: 1461823935771385721,
                size: 1756017,
                storedFilename: '/var/lib/signald/attachments/1461823935771385721',
                width: 4032,
                height: 3024,
                voiceNote: false,
                preview: { present: false },
                key:
                  'cpdTsaYm9fsE+T29HtCl8qWW2LZPhM32zy82K4VYjTcsqtCIsRxYivSEnxvP6qHD9VwZPrAjFlzZtw6DYWAiig==',
                digest: 'UYm6uzLlrw2xEezccQtb0jqE4jSDq0+09JvySk+EzrQ=',
              },
            ],
          },
        },
      }
      expect(signal.parseOutboundSdMessage(inMessage)).to.eql({
        type: messageTypes.SEND,
        username: '+14049486063',
        recipientNumber: null,
        messageBody: 'hello world!',
        attachments: [
          {
            filename: '/var/lib/signald/attachments/1461823935771385721',
            width: 4032,
            height: 3024,
            voiceNote: false,
          },
        ],
      })
    })
  })
})
