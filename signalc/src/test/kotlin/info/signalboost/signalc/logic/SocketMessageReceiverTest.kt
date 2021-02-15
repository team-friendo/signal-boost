package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.model.*
import info.signalboost.signalc.model.SocketAddress.Companion.asSocketAddress
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.fixtures.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSendRequest
import info.signalboost.signalc.testSupport.fixtures.SocketRequestGen.genSubscribeRequest
import info.signalboost.signalc.testSupport.matchers.SocketOutMessageMatchers.commandExecutionException
import info.signalboost.signalc.testSupport.socket.TestSocketClient
import info.signalboost.signalc.testSupport.socket.TestSocketServer.startTestSocketServer
import info.signalboost.signalc.util.*
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.test.runBlockingTest
import java.io.IOException
import java.net.Socket
import java.time.Instant
import kotlin.random.Random
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SocketMessageReceiver::class)
        val app = Application(config).run(testScope)

        val senderPhoneNumber = genPhoneNumber()
        val senderAccount = genVerifiedAccount(senderPhoneNumber)
        val recipientAccount = genVerifiedAccount()

        val now = Instant.now().toEpochMilli()
        val connectDelay = 1.milliseconds
        val closeDelay = 1.milliseconds

        val socketPath = app.config.socket.path + Random.nextInt(Int.MAX_VALUE).toString()
        val socketConnections: ReceiveChannel<Socket> = startTestSocketServer(socketPath, testScope)

        lateinit var client: TestSocketClient
        lateinit var socket: Socket
        lateinit var listenJob: Job

        beforeSpec {
            mockkObject(TimeUtil).also {
                every { TimeUtil.nowInMillis() } returns now
            }
        }

        beforeTest{
            client = TestSocketClient.connect(socketPath, testScope)
            socket = socketConnections.receive()
            listenJob = app.socketMessageReceiver.connect(socket)
            delay(connectDelay)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            socketConnections.cancel()
            unmockkAll()
            testScope.teardown()
        }

        fun verifyClosed(socket: Socket) {
            app.socketMessageReceiver.readers[socket.hashCode()] shouldBe null
            coVerify {
                app.socketServer.disconnect(socket.hashCode())
            }
        }

        "handling connections" - {
            afterTest{
                client.close()
            }

            "opens a reader on a socket and stores a reference to it" {
                app.socketMessageReceiver.readers[socket.hashCode()] shouldNotBe null
                app.socketMessageReceiver.disconnect(socket.hashCode())
            }
        }

        "handling messages" - {
            afterTest{
                client.close()
            }

            "SEND request" - {
                val messageBody = "hi there"
                val sendRequest = genSendRequest(
                    senderNumber = senderAccount.username,
                    recipientAddress = recipientAccount.address.asSocketAddress(),
                    messageBody = messageBody,
                )
                val sendRequestJson = sendRequest.toJson()
                val parseDelay = 20.milliseconds

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns senderAccount

                    "sends signal message" {
                        client.send(sendRequest.toJson(), wait=parseDelay)
                        coVerify {
                            app.signalMessageSender.send(
                                senderAccount,
                                recipientAccount.address,
                                messageBody,
                                any(),
                                any(),
                            )
                        }
                    }

                    "when sending signal message succeeds" - {
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } returns mockk(){
                            every { success } returns mockk()
                        }

                        "sends success message to socket" {
                            client.send(sendRequestJson, wait = parseDelay)
                            coVerify {
                                app.socketMessageSender.send(SendSuccess)
                            }
                        }
                    }

                    "when sending signal message throws" - {
                        val error = Throwable("arbitrary error!")
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } throws error

                        "sends error message to socket" {
                            client.send(sendRequestJson, wait = parseDelay)
                            coVerify {
                                // TODO(aguestuser|2021-02-04): we dont' actually want this.
                                //  we want halting errors to be treated like SendResult statuses below!
                                app.socketMessageSender.send(
                                    commandExecutionException(error, sendRequest)
                                )
                            }
                        }
                    }

                    "when sending signal message returns failure status" - {
                        coEvery {
                            app.signalMessageSender.send(any(),any(),any(),any(),any())
                        } returns mockk {
                            every { success } returns null
                        }

                        "sends error message to socket" {
                            client.send(sendRequestJson, wait = 5.milliseconds)
                            coVerify {
                                app.socketMessageSender.send(SendFailure)
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error message to socket" {
                        client.send(sendRequestJson)
                        coVerify {
                            app.socketMessageSender.send(
                                commandExecutionException(
                                    Error("Can't send to $senderPhoneNumber: not registered."),
                                    sendRequest
                                )
                            )
                        }
                    }
                }
            }

            "SUBSCRIBE request" - {
                val subscribeRequest = genSubscribeRequest(recipientAccount.username)
                val subscribeRequestJson = subscribeRequest.toJson()

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns recipientAccount

                    "when subscription succeeds" - {
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returns Job()

                        "sends success to socket" {
                            client.send(subscribeRequestJson)
                            coVerify {
                                app.socketMessageSender.send(SubscriptionSucceeded)
                            }
                        }
                    }

                    "when message pipe from signal cannot be initiated" - {
                        val error = SignalcError.MessagePipeNotCreated(IOException("whoops!"))
                        val subscribeJob = Job()
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returns subscribeJob

                        "sends error to socket" {
                            client.send(subscribeRequestJson)
                            subscribeJob.cancel(error.message!!, error)
                            coVerify {
                                app.socketMessageSender.send(SubscriptionFailed(error))
                            }
                        }
                    }

                    "when connection to signal is broken" - {
                        val error = IOException("whoops!")
                        val disruptedJob = Job()
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returnsMany listOf(disruptedJob, Job())

                        "sends error to socket and resubscribes" {
                            client.send(subscribeRequestJson)
                            disruptedJob.cancel(error.message!!, error)

                            coVerify {
                                app.socketMessageSender.send(SubscriptionDisrupted(error))

                            }

                            coVerify(atLeast = 2) {
                                app.signalMessageReceiver.subscribe(recipientAccount)
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error to socket" {
                        client.send(subscribeRequestJson)
                        coVerify {
                            app.socketMessageSender.send(
                                commandExecutionException(
                                    Error("Can't subscribe to messages for ${recipientAccount.username}: not registered."),
                                    subscribeRequest
                                )
                            )
                        }
                    }
                }
            }
        }

        "handling terminations" -{
            "when server calls #disconnect" - {
                "closes socket connection" {
                    app.socketMessageReceiver.disconnect(socket.hashCode())
                    delay(closeDelay)

                    listenJob.invokeOnCompletion {
                        verifyClosed(socket)
                    }
                }
            }

            "when client terminates socket connection" - {
                client.close()
                delay(closeDelay)

                "closes server side of socket connection" {
                    listenJob.invokeOnCompletion {
                        verifyClosed(socket)
                    }
                }
            }

            "CLOSE request" - {
                "closes socket connection to client" {
                    val closeRequest = SocketRequest.Close

                    client.send(closeRequest.toJson())
                    delay(closeDelay)

                    listenJob.invokeOnCompletion {
                        verifyClosed(socket)
                    }
                }
            }

            "ABORT request" - {
                "shuts down the app" {
                    client.send(SocketRequest.Abort.toJson())
                    coVerify {
                        app.socketMessageSender.send(any<Shutdown>())
                        app.socketServer.stop()
                    }
                }
            }
        }
    }

})