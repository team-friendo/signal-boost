import { expect } from 'chai'
import { describe, it, before, beforeEach, after, afterEach } from 'mocha'
import sinon from 'sinon'
import { times, values } from 'lodash'
import { memberTypes } from '../../../app/db/repositories/membership'
import signal from '../../../app/signal'
import messageCountRepository from '../../../app/db/repositories/messageCount'
import messenger, { messageTypes } from '../../../app/dispatcher/messenger'
import { commands } from '../../../app/dispatcher/commands/constants'
import { statuses } from '../../../app/util'
import { genPhoneNumber } from '../../support/factories/phoneNumber'
import { sdMessageOf } from '../../../app/signal/constants'
import { messagesIn } from '../../../app/dispatcher/strings/messages'
import app from '../../../app'
import testApp from '../../support/testApp'
import channelRepository from '../../../app/db/repositories/channel'
import hotlineMessageRepository from '../../../app/db/repositories/hotlineMessage'
import { defaultLanguage } from '../../../app/language'

describe('messenger service', () => {
  const channelPhoneNumber = genPhoneNumber()
  const subscriberPhoneNumbers = times(2, genPhoneNumber)
  const adminPhoneNumbers = times(4, genPhoneNumber)
  const messageId = 42
  const channel = {
    phoneNumber: channelPhoneNumber,
    messageExpiryTime: 60,
    socketId: 42,
    memberships: [
      {
        type: memberTypes.ADMIN,
        channelPhoneNumber,
        memberPhoneNumber: adminPhoneNumbers[0],
        language: defaultLanguage,
      },
      { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber: adminPhoneNumbers[1] },
      { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber: adminPhoneNumbers[2] },
      { type: memberTypes.ADMIN, channelPhoneNumber, memberPhoneNumber: adminPhoneNumbers[3] },
      {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber,
        memberPhoneNumber: subscriberPhoneNumbers[0],
      },
      {
        type: memberTypes.SUBSCRIBER,
        channelPhoneNumber,
        memberPhoneNumber: subscriberPhoneNumbers[1],
      },
    ],
    messageCount: { broadcastIn: 42 },
  }
  const hotlineEnabledChannel = { ...channel, hotlineOn: true }

  const attachments = [{ filename: 'some/path', width: 42, height: 42 }]
  const sdMessage = {
    type: 'send',
    username: channel.phoneNumber,
    messageBody: 'please help!',
    attachments,
  }
  const adminSender = {
    phoneNumber: adminPhoneNumbers[0],
    type: memberTypes.ADMIN,
    language: defaultLanguage,
  }
  const subscriberSender = {
    phoneNumber: subscriberPhoneNumbers[0],
    type: memberTypes.SUBSCRIBER,
    language: defaultLanguage,
  }
  const randomSender = {
    phoneNumber: genPhoneNumber(),
    type: memberTypes.NONE,
    language: defaultLanguage,
  }

  before(async () => app.run(testApp))
  after(async () => app.stop(testApp))

  describe('classifying a command result', () => {
    describe('when someone sends a non-command prefixed message', () => {
      it('recognizes an error as a missing command', () => {
        const msg = { command: 'NONE', status: statuses.ERROR }
        expect(messenger.parseMessageType(msg)).to.eql(messageTypes.COMMAND)
      })
      it('recognizes success as a hotline message', () => {
        const msg = { command: 'NONE', status: statuses.SUCCESS }
        expect(messenger.parseMessageType(msg)).to.eql(messageTypes.HOTLINE_MESSAGE)
      })
    })

    it('recognizes a broadcast message', () => {
      const msg = { command: 'BROADCAST', status: statuses.SUCCESS }
      expect(messenger.parseMessageType(msg)).to.eql(messageTypes.BROADCAST_MESSAGE)
    })

    it('recognizes a command result', () => {
      const msg = { command: 'JOIN', status: statuses.SUCCESS }
      expect(messenger.parseMessageType(msg)).to.eql(messageTypes.COMMAND)
    })
  })

  describe('dispatching a message', () => {
    let broadcastSpy,
      respondSpy,
      sendNotificationsSpy,
      sendMessageStub,
      countCommandStub,
      countBroadcastStub,
      countHotlineStub,
      setExpirationStub

    beforeEach(() => {
      broadcastSpy = sinon.spy(messenger, 'broadcast')
      respondSpy = sinon.spy(messenger, 'respond')
      sendNotificationsSpy = sinon.spy(messenger, 'sendNotifications')
      sendMessageStub = sinon.stub(signal, 'sendMessage').returns(Promise.resolve())
      countCommandStub = sinon
        .stub(messageCountRepository, 'countCommand')
        .returns(Promise.resolve())
      countBroadcastStub = sinon
        .stub(messageCountRepository, 'countBroadcast')
        .returns(Promise.resolve())
      countHotlineStub = sinon
        .stub(messageCountRepository, 'countHotline')
        .returns(Promise.resolve())
      setExpirationStub = sinon.stub(signal, 'setExpiration').returns(Promise.resolve())
      sinon.stub(hotlineMessageRepository, 'getMessageId').returns(Promise.resolve(messageId))
    })

    afterEach(() => {
      sinon.restore()
    })

    describe('sending a broadcast message', () => {
      const payload = 'foobar'
      const adminMemberships = channel.memberships.slice(0, 4)
      const subscriberMemberships = channel.memberships.slice(4)

      const notifications = [
        ...adminMemberships.map(m => ({
          recipient: m.memberPhoneNumber,
          message: `[BROADCAST]\n${payload}`,
          attachments,
        })),
        ...subscriberMemberships.map(m => ({
          recipient: m.memberPhoneNumber,
          message: payload,
          attachments,
        })),
      ]

      beforeEach(
        async () =>
          await messenger.dispatch({
            commandResult: {
              command: commands.BROADCAST,
              status: statuses.SUCCESS,
              payload,
              message: '',
              notifications,
            },
            dispatchable: { channel, sender: adminSender, sdMessage },
          }),
      )
      it('does not respond to the sender', () => {
        expect(respondSpy.callCount).to.eql(0)
      })

      it('does not increment the command count for the channel', () => {
        expect(countCommandStub.callCount).to.eql(0)
      })

      it('sends the message and attachments to all channel subscribers and admins', () => {
        expect(sendMessageStub.getCall(0).args).to.eql([
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: adminPhoneNumbers[0],
            message: `[BROADCAST]\n${payload}`,
            attachments,
            expiresInSeconds: channel.messageExpiryTime,
          }),
          channel.socketId,
        ])

        expect(sendMessageStub.getCall(1).args).to.eql([
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: adminPhoneNumbers[1],
            message: `[BROADCAST]\n${payload}`,
            attachments,
            expiresInSeconds: channel.messageExpiryTime,
          }),
          channel.socketId,
        ])

        expect(sendMessageStub.getCall(2).args).to.eql([
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: adminPhoneNumbers[2],
            message: `[BROADCAST]\n${payload}`,
            attachments,
            expiresInSeconds: channel.messageExpiryTime,
          }),
          channel.socketId,
        ])

        expect(sendMessageStub.getCall(4).args).to.eql([
          sdMessageOf({
            sender: channel.phoneNumber,
            recipient: subscriberPhoneNumbers[0],
            message: payload,
            attachments,
            expiresInSeconds: channel.messageExpiryTime,
          }),
          channel.socketId,
        ])
      })

      it('it increments the broadcast count for the channel exactly once', () => {
        expect(countBroadcastStub.callCount).to.eql(1)
        expect(countBroadcastStub.getCall(0).args).to.eql([channel])
      })
    })

    describe('forwarding a hotline message', () => {
      const sender = subscriberSender

      describe('when the hotline is off', () => {
        const response = messagesIn(sender.language).notifications.hotlineMessagesDisabled(true)

        beforeEach(async () => {
          await messenger.dispatch({
            commandResult: {
              status: statuses.UNAUTHORIZED,
              message: response,
              notifications: [],
            },
            dispatchable: { channel, sender, sdMessage },
          })
        })

        it('does not broadcast a message', () => {
          expect(broadcastSpy.callCount).to.eql(0)
        })

        it('does not send out any notifications', () => {
          expect(sendNotificationsSpy.callCount).to.eql(0)
        })

        it('responds to the message sender with an error message', () => {
          expect(sendMessageStub.getCall(0).args).to.eql([
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: sender.memberPhoneNumber,
              message: response,
              expiresInSeconds: channel.messageExpiryTime,
            }),
            channel.socketId,
          ])
        })
      })

      describe('when the hotline is on', () => {
        const message = `[${messagesIn(sender.language).prefixes.hotlineMessage(11)}]\nplease help!`

        const notifications = [
          ...adminPhoneNumbers.map(phoneNumber => ({
            recipient: phoneNumber,
            message,
            attachments,
          })),
        ]

        beforeEach(async () => {
          await messenger.dispatch({
            commandResult: {
              command: commands.NONE,
              status: statuses.SUCCESS,
              message: messagesIn(sender.language).notifications.hotlineMessageSent,
              notifications,
            },
            dispatchable: { channel: hotlineEnabledChannel, sender, sdMessage },
          })
        })

        it('responds to sender that their message has been sent', () => {
          const response = messagesIn(sender.language).notifications.hotlineMessageSent
          expect(sendMessageStub.getCall(0).args).to.eql([
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: sender.memberPhoneNumber,
              message: response,
              expiresInSeconds: channel.messageExpiryTime,
            }),
            channel.socketId,
          ])
        })

        it("forwards the message to all the channel's admins", () => {
          adminPhoneNumbers.forEach((phoneNumber, index) => {
            expect(sendMessageStub.getCall(index + 1).args).to.eql([
              sdMessageOf({
                sender: channel.phoneNumber,
                recipient: phoneNumber,
                message,
                attachments,
                expiresInSeconds: channel.messageExpiryTime,
              }),
              channel.socketId,
            ])
          })
        })

        it('counts the hotline message', () => {
          expect(countHotlineStub.callCount).to.eql(1)
        })
      })
    })

    describe('when message has a command result', () => {
      describe('a successful command result', () => {
        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: { channel, sender: adminSender, sdMessage: commands.JOIN },
            commandResult: {
              command: commands.JOIN,
              status: statuses.SUCCESS,
              message: 'yay!',
              notifications: [],
            },
          })
        })

        it('does not broadcast a message', () => {
          expect(broadcastSpy.callCount).to.eql(0)
        })

        it('does not increment the broadcast count', () => {
          expect(countBroadcastStub.callCount).to.eql(0)
        })

        it('sends a command result to the message sender', () => {
          expect(sendMessageStub.getCall(0).args).to.eql([
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: adminSender.memberPhoneNumber,
              message: 'yay!',
              expiresInSeconds: channel.messageExpiryTime,
            }),
            channel.socketId,
          ])
        })

        it('increments the command count for the channel', () => {
          expect(countCommandStub.getCall(0).args).to.eql([channel])
        })
      })
      describe('a command result with an error', () => {
        const errorMessage = messagesIn(defaultLanguage).parseErrors.invalidHotlineMessageId('foo')

        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: { channel, sender: adminSender, sdMessage: commands.REPLY },
            commandResult: {
              command: commands.REPLY,
              status: statuses.ERROR,
              message: errorMessage,
              notifications: [],
            },
          })
        })

        it('sends a command result to the message sender', () => {
          expect(sendMessageStub.getCall(0).args).to.eql([
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: adminSender.memberPhoneNumber,
              message: errorMessage,
              expiresInSeconds: channel.messageExpiryTime,
            }),
            channel.socketId,
          ])
        })
      })
    })

    // special case for private && hotline replies
    describe('when message has a command result but should not be responded to', () => {
      describe('a hotline reply', () => {
        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: { channel, sender: adminSender, sdMessage: commands.REPLY },
            commandResult: {
              command: commands.REPLY,
              status: statuses.SUCCESS,
              message: 'hello!',
              notifications: [],
            },
          })
        })

        it('does not respond to the sender', () => {
          expect(respondSpy.callCount).to.eql(0)
        })
      })

      describe('a private message', () => {
        beforeEach(async () => {
          await messenger.dispatch({
            dispatchable: { channel, sender: adminSender, sdMessage: commands.PRIVATE },
            commandResult: {
              command: commands.PRIVATE,
              status: statuses.SUCCESS,
              message: 'hello!',
              notifications: [],
            },
          })
        })

        it('does not respond to the sender', () => {
          expect(respondSpy.callCount).to.eql(0)
        })
      })
    })
    describe('when command result is INFO from a sysadmin', () => {
      beforeEach(async () => {
        sinon.stub(channelRepository, 'isMaintainer').returns(Promise.resolve(true))
        await messenger.dispatch({
          dispatchable: { channel, sender: adminSender, sdMessage: commands.JOIN },
          commandResult: {
            command: commands.INFO,
            status: statuses.SUCCESS,
            message: 'yay!',
            notifications: [],
          },
        })
      })
      it('does not increment the command count for the channel', async () => {
        expect(countCommandStub.callCount).to.eql(0)
      })
    })

    describe('when command result includes notification(s)', () => {
      beforeEach(async () => {
        await messenger.dispatch({
          dispatchable: { channel, sender: adminSender, sdMessage },
          commandResult: {
            command: commands.ADD,
            status: statuses.SUCCESS,
            message: 'boofar',
            notifications: [
              ...adminPhoneNumbers.map(phoneNumber => ({
                recipient: phoneNumber,
                message: 'foobar',
              })),
            ],
          },
        })
      })

      // the first call to signal.sendMessage is to send the commandResponse, so start after that
      it('sends out each notification', () => {
        adminPhoneNumbers.forEach((phoneNumber, index) => {
          expect(sendMessageStub.getCall(index + 1).args).to.eql([
            sdMessageOf({
              sender: channel.phoneNumber,
              recipient: phoneNumber,
              message: 'foobar',
              attachments: [],
              expiresInSeconds: channel.messageExpiryTime,
            }),
            channel.socketId,
          ])
        })
      })
    })

    describe('modifying expiry times', () => {
      describe('for successful commands originating from a new user', () => {
        ;[commands.JOIN, commands.ACCEPT].forEach(command => {
          it(`updates the expiry time between the channel and the sender of a ${command} command`, async () => {
            await messenger.dispatch({
              dispatchable: {
                channel,
                sender: randomSender,
                sdMessage: sdMessageOf({ sender: channel.phoneNumber, message: command }),
              },
              commandResult: {
                command,
                status: statuses.SUCCESS,
                message: 'fake welcome!',
                notifications: [],
              },
            })
            expect(setExpirationStub.getCall(0).args).to.eql([
              channel.phoneNumber,
              randomSender.memberPhoneNumber,
              channel.messageExpiryTime,
              channel.socketId,
            ])
          })
        })
      })

      describe('for successful commands that add a new user', () => {
        const rawNewMemberPhoneNumber = '+1 (222) 333-4444'
        const parsedNewMemberPhoneNumber = '+12223334444'
        ;[commands.ADD, commands.INVITE].forEach(command => {
          it(`updates the expiry time between the channel and the sender of a ${command} command`, async () => {
            await messenger.dispatch({
              dispatchable: {
                channel,
                sender: randomSender,
                sdMessage: sdMessageOf({
                  sender: channel.phoneNumber,
                  message: `${command} ${rawNewMemberPhoneNumber}`,
                }),
              },
              commandResult: {
                command,
                payload:
                  command === commands.ADD
                    ? parsedNewMemberPhoneNumber
                    : [parsedNewMemberPhoneNumber],
                status: statuses.SUCCESS,
                message: 'fake welcome!',
                notifications: [],
              },
            })
            expect(setExpirationStub.getCall(0).args).to.eql([
              channel.phoneNumber,
              parsedNewMemberPhoneNumber,
              channel.messageExpiryTime,
              channel.socketId,
            ])
          })
        })
      })

      describe('for all other successful commands', () => {
        const cs = values(commands).filter(
          command =>
            ![commands.JOIN, commands.ACCEPT, commands.ADD, commands.INVITE].includes(command),
        )

        cs.forEach(command => {
          it(`does not update expiry times in response to a ${command} command`, async () => {
            await messenger.dispatch({
              dispatchable: {
                channel,
                sender: randomSender,
                sdMessage: sdMessageOf({ sender: channel, message: command }),
              },
              commandResult: {
                command,
                payload: '',
                status: statuses.SUCCESS,
                message: 'fake command response message!',
                notifications: [],
              },
            })
            expect(setExpirationStub.callCount).to.eql(0)
          })
        })
      })

      describe('for an unsuccessful command', () => {
        it('does not modify any expiry times', async () => {
          await messenger.dispatch({
            dispatchable: {
              channel,
              sender: randomSender,
              sdMessage: sdMessageOf({ sender: channel, message: commands.JOIN }),
            },
            commandResult: {
              command: commands.JOIN,
              status: statuses.ERROR,
              message: 'fake command response error message!',
            },
          })
          expect(setExpirationStub.callCount).to.eql(0)
        })
      })
    })
  })
})
