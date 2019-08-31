import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { times } from 'lodash'
import signal from '../../../../app/services/signal'
import messageCountRepository from '../../../../app/db/repositories/messageCount'
import messenger, { messageTypes, sdMessageOf } from '../../../../app/services/dispatcher/messenger'
import messages from '../../../../app/services/dispatcher/messages'
import { statuses, commands } from '../../../../app/services/dispatcher/executor'
import { genPhoneNumber } from '../../../support/factories/phoneNumber'

describe('messenger service', () => {
  const [db, sock] = [{}, { write: () => {} }]
  const channelPhoneNumber = genPhoneNumber()
  const subscriberNumbers = times(2, genPhoneNumber)
  const publisherNumbers = [genPhoneNumber(), genPhoneNumber()]
  const channel = {
    name: 'foobar',
    phoneNumber: channelPhoneNumber,
    publications: [
      { channelPhoneNumber, publisherPhoneNumber: publisherNumbers[0] },
      { channelPhoneNumber, publisherPhoneNumber: publisherNumbers[1] },
    ],
    subscriptions: [
      { channelPhoneNumber, subscriberPhoneNumber: subscriberNumbers[0] },
      { channelPhoneNumber, subscriberPhoneNumber: subscriberNumbers[1] },
    ],
    messageCount: { broadcastIn: 42 },
  }
  const responseEnabledChannel = { ...channel, responsesEnabled: true }

  const attachments = [{ filename: 'some/path', width: 42, height: 42 }]
  const sdMessage = {
    type: 'send',
    messageBody: 'please help!',
    recipientNumber: null,
    attachments,
  }
  const publisherSender = {
    phoneNumber: publisherNumbers[0],
    isPublisher: true,
    isSubscriber: true,
  }
  const subscriberSender = {
    phoneNumber: subscriberNumbers[0],
    isPublisher: false,
    isSubscriber: true,
  }
  const randomSender = {
    phoneNumber: genPhoneNumber(),
    isPublisher: false,
    isSubscriber: false,
  }

  describe('parsing a message type from a command result', () => {
    it('parses a broadcast message', () => {
      const msg = { command: 'foo', status: statuses.NOOP }
      expect(messenger.parseMessageType(msg, publisherSender)).to.eql(
        messageTypes.BROADCAST_MESSAGE,
      )
    })

    it('parses a broadcast response from a subscriber', () => {
      const msg = { command: 'foo', status: statuses.NOOP }
      expect(messenger.parseMessageType(msg, subscriberSender)).to.eql(
        messageTypes.BROADCAST_RESPONSE,
      )
    })

    it('parses a broadcast response from a random person', () => {
      const msg = { command: 'foo', status: statuses.NOOP }
      expect(messenger.parseMessageType(msg, randomSender)).to.eql(messageTypes.BROADCAST_RESPONSE)
    })

    it('parses a command result', () => {
      const msg = { command: 'JOIN', status: statuses.SUCCESS }
      expect(messenger.parseMessageType(msg, randomSender)).to.eql(messageTypes.COMMAND_RESULT)
    })

    it('parses a publisher welcome message', () => {
      expect(
        messenger.parseMessageType({
          command: 'ADD',
          status: statuses.SUCCESS,
          payload: publisherSender.phoneNumber,
        }),
      ).to.eql(messageTypes.NEW_PUBLISHER_WELCOME)
    })
  })

  describe('dispatching a message', () => {
    let broadcastSpy,
      respondSpy,
      broadcastMessageStub,
      sendMessageStub,
      incrementCommandCountStub,
      incrementBroadcastCountStub

    beforeEach(() => {
      broadcastSpy = sinon.spy(messenger, 'broadcast')
      respondSpy = sinon.spy(messenger, 'respond')
      broadcastMessageStub = sinon.stub(signal, 'broadcastMessage').returns(Promise.resolve())
      sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve())
      incrementCommandCountStub = sinon
        .stub(messageCountRepository, 'incrementCommandCount')
        .returns(Promise.resolve())
      incrementBroadcastCountStub = sinon
        .stub(messageCountRepository, 'incrementBroadcastCount')
        .returns(Promise.resolve())
    })

    afterEach(() => {
      broadcastSpy.restore()
      respondSpy.restore()
      broadcastMessageStub.restore()
      sendMessageStub.restore()
      incrementCommandCountStub.restore()
      incrementBroadcastCountStub.restore()
    })

    describe('when message is a broadcast message', () => {
      describe('when sender is a publisher', () => {
        beforeEach(
          async () =>
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, messageBody: messages.notifications.noop },
              dispatchable: { db, sock, channel, sender: publisherSender, sdMessage },
            }),
        )
        it('does not respond to the sender', () => {
          expect(respondSpy.callCount).to.eql(0)
        })

        it('does not imcrement the command count for the channel', () => {
          expect(incrementCommandCountStub.callCount).to.eql(0)
        })

        it('broadcasts the message to all channel subscribers and publishers', () => {
          expect(broadcastMessageStub.getCall(0).args).to.eql([
            sock,
            [...subscriberNumbers, ...publisherNumbers],
            { ...sdMessage, messageBody: '[foobar]\nplease help!' },
          ])
        })

        it('it increments the command count for the channel', () => {
          expect(incrementBroadcastCountStub.getCall(0).args).to.eql([db, channel.phoneNumber, 2])
        })
      })

      describe('when sender is a subscriber', () => {
        describe('and responses are disabled', () => {
          const sender = subscriberSender

          beforeEach(async () => {
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, messageBody: messages.notifications.noop },
              dispatchable: { db, sock, channel, sender, sdMessage },
            })
          })

          it('does not broadcast a message', () => {
            expect(broadcastSpy.callCount).to.eql(0)
          })

          it('sends an error message to the message sender', () => {
            expect(sendMessageStub.getCall(0).args).to.eql([
              sock,
              sender.phoneNumber,
              sdMessageOf(channel, messages.notifications.unauthorized),
            ])
          })
        })

        describe('and responses are enabled', () => {
          const sender = subscriberSender

          beforeEach(async () => {
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, messageBody: messages.notifications.noop },
              dispatchable: { db, sock, channel: responseEnabledChannel, sender, sdMessage },
            })
          })

          it('forwards the message to channel admins', () => {
            expect(broadcastMessageStub.getCall(0).args).to.eql([
              sock,
              publisherNumbers,
              sdMessageOf(channel, `[SUBSCRIBER RESPONSE]\n${sdMessage.messageBody}`),
            ])
          })

          it('responds to sender with a broadcast response notification', () => {
            expect(sendMessageStub.getCall(0).args).to.eql([
              sock,
              sender.phoneNumber,
              sdMessageOf(
                channel,
                `[${channel.name}]\n${messages.notifications.broadcastResponseSent(channel)}`,
              ),
            ])
          })
        })
      })

      describe('when sender is a random person', () => {
        const sender = randomSender

        describe('and responses are enabled', () => {
          beforeEach(async () => {
            await messenger.dispatch({
              commandResult: { status: statuses.NOOP, messageBody: messages.notifications.noop },
              dispatchable: { db, sock, channel: responseEnabledChannel, sender, sdMessage },
            })
          })

          it('does not broadcast the message or forward it to admins ', () => {
            expect(broadcastSpy.callCount).to.eql(0)
          })

          it('sends an error message to the message sender', () => {
            expect(sendMessageStub.getCall(0).args).to.eql([
              sock,
              sender.phoneNumber,
              sdMessageOf(channel, messages.notifications.unauthorized),
            ])
          })
        })
      })
    })

    describe('when message is a command response', () => {
      beforeEach(async () => {
        await messenger.dispatch({
          dispatchable: { db, sock, channel, sender: publisherSender, sdMessage: commands.JOIN },
          commandResult: { command: commands.JOIN, status: statuses.SUCCESS, message: 'yay!' },
        })
      })

      it('does not broadcast a message', () => {
        expect(broadcastSpy.callCount).to.eql(0)
      })

      it('does not increment the broadcast count', () => {
        expect(incrementBroadcastCountStub.callCount).to.eql(0)
      })

      it('sends a command result to the message sender', () => {
        expect(sendMessageStub.getCall(0).args).to.eql([
          sock,
          publisherSender.phoneNumber,
          sdMessageOf(channel, '[foobar]\nyay!'),
        ])
      })

      it('increments the command count for the channel', () => {
        expect(incrementCommandCountStub.getCall(0).args).to.eql([db, channel.phoneNumber])
      })
    })

    describe('when message is a command notification', () => {
      describe('for a newly added publisher', () => {
        const newPublisher = genPhoneNumber()
        const sdMessage = `${commands.ADD} ${newPublisher}`
        const response = messages.commandResponses.publisher.add.success(newPublisher)
        const welcome = messages.notifications.welcome(channel, publisherSender.phoneNumber)

        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: { db, sock, channel, sender: publisherSender, sdMessage },
            commandResult: {
              command: commands.ADD,
              status: statuses.SUCCESS,
              message: response,
              payload: newPublisher,
            },
          })
        })

        it('does not broadcast a message', () => {
          expect(broadcastSpy.callCount).to.eql(0)
        })

        it('does not increment the broadcast count', () => {
          expect(incrementBroadcastCountStub.callCount).to.eql(0)
        })

        it('sends a response to the command sender', () => {
          expect(sendMessageStub.getCall(0).args).to.eql([
            sock,
            publisherSender.phoneNumber,
            sdMessageOf(channel, `[${channel.name}]\n${response}`),
          ])
        })

        it('sends a welcome notification to the newly added publisher', () => {
          expect(broadcastMessageStub.getCall(0).args).to.eql([
            sock,
            [newPublisher],
            sdMessageOf(channel, `[${channel.name}]\n${welcome}`),
          ])
        })
      })
    })
  })

  describe('formatting messages', () => {
    describe('broadcast messages', () => {
      it('adds a prefix', () => {
        const msg = { channel, sdMessage: sdMessageOf(channel, 'blah') }
        expect(messenger.format(msg)).to.eql(sdMessageOf(channel, '[foobar]\nblah'))
      })
    })

    describe('most commands', () => {
      it('adds a prefix', () => {
        const msg = {
          channel,
          messageBody: 'blah',
          command: 'JOIN',
          status: 'SUCCESS',
        }
        expect(messenger.format(msg)).to.eql(sdMessageOf(channel, '[foobar]\nblah'))
      })
    })

    describe('when message is the response to a RENAME comand', () => {
      it('does not add a prefix', () => {
        const msg = {
          channel,
          messageBody: 'blah',
          command: 'RENAME',
          status: 'SUCCESS',
        }
        expect(messenger.format(msg)).to.eql(sdMessageOf(channel, 'blah'))
      })
    })

    describe('when the message is the response to an unauthorized command attempt', () => {
      it('does not add a prefix', () => {
        const msg = { channel, messageBody: 'blah', command: 'INFO', status: 'UNAUTHORIZED' }
        expect(messenger.format(msg)).to.eql(sdMessageOf(channel, 'blah'))
      })
    })

    describe('when there is no command but status is UNAUTHORIZED', () => {
      it('does not add a prefix', () => {
        const msg = { channel, messageBody: 'blah', command: 'INFO', status: 'UNAUTHORIZED' }
        expect(messenger.format(msg)).to.eql(sdMessageOf(channel, 'blah'))
      })
    })
  })
})
