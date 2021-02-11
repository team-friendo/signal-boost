package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalMessageSender.Companion.asAddress
import info.signalboost.signalc.model.*
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.genTestScope
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.fixtures.Account.genVerifiedAccount
import info.signalboost.signalc.testSupport.matchers.SocketOutMessageMatchers.commandExecutionError
import info.signalboost.signalc.util.*
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers.IO
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.test.runBlockingTest
import org.newsclub.net.unix.AFUNIXServerSocket
import org.newsclub.net.unix.AFUNIXSocket
import org.newsclub.net.unix.AFUNIXSocketAddress
import java.io.File
import java.io.IOException
import java.io.PrintWriter
import java.net.Socket
import java.time.Instant
import kotlin.time.ExperimentalTime
import kotlin.time.milliseconds
import kotlin.time.times


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SocketMessageReceiverTest : FreeSpec({
    runBlockingTest {
        val testScope = genTestScope()
        val config = Config.mockAllExcept(SocketMessageReceiver::class)
        val app = Application(config).run(testScope)

        // TODO: use genPhoneNumber() here once we have un-hardcoded sender
        val senderPhoneNumber = Config.USER_PHONE_NUMBER
        val senderAccount = genVerifiedAccount(senderPhoneNumber)
        val recipientAccount = genVerifiedAccount()
        val now = Instant.now().toEpochMilli()
        val sendDelay = 10.milliseconds

        suspend fun startTestSocketServer(): ReceiveChannel<Socket> = testScope.async {
            val out = Channel<Socket>()
            AFUNIXServerSocket.newInstance().let {
                it.bind(AFUNIXSocketAddress(File(app.config.socket.path)))
                testScope.launch(IO) {
                    while (!out.isClosedForReceive && this.isActive) {
                        val sock = it.accept() as Socket
                        println("Got connection on ${sock.hashCode()}")
                        out.send(sock)
                    }
                }
            }
            out
        }.await()

        val serverSocketChannel: ReceiveChannel<Socket> = startTestSocketServer()


        beforeSpec {
            mockkObject(TimeUtil).also {
                every { TimeUtil.nowInMillis() } returns now
            }
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            app.stop()
            serverSocketChannel.cancel()
            unmockkAll()
            testScope.teardown()
        }

        suspend fun clientConnectsToSocket(): Pair<ServerSocket,PrintWriter> = testScope.async(Dispatchers.IO) {
            val clientSock = AFUNIXSocket.newInstance().also {
                it.connect(AFUNIXSocketAddress(File(config.socket.path)))
            }
            Pair(
                serverSocketChannel.receive(),
                PrintWriter(clientSock.getOutputStream(), true)
            )
        }.await()

        suspend fun socketEmits(vararg messages: String?): Pair<ServerSocket, Job> {
            val (sSock,writer) = clientConnectsToSocket()
            val listenJob = app.socketMessageReceiver.connect(sSock)
            messages.forEach{ writer.println(it) }
            delay(messages.size * sendDelay)
            return Pair(sSock, listenJob)
        }


        fun verifyClosed(socket: Socket) {
            app.socketMessageReceiver.readers[socket.hashCode()] shouldBe null
            coVerify {
                app.socketServer.disconnect(socket.hashCode())
            }
        }

        "#connect" - {
            "opens a reader on a socket and stores a reference to it" {
                val (socket) = clientConnectsToSocket()
                app.socketMessageReceiver.connect(socket)
                delay(1.milliseconds)

                app.socketMessageReceiver.readers[socket.hashCode()] shouldNotBe null
                app.socketMessageReceiver.disconnect(socket.hashCode())
            }

            "when client terminates socket connection" - {
                "closes server side of socket connection" {
                    val (socket) = clientConnectsToSocket()
                    val listenJob = app.socketMessageReceiver.connect(socket)
                    val writer = PrintWriter(socket.getOutputStream(), true)
                    writer.close()
                    delay(sendDelay)

                    listenJob.invokeOnCompletion {
                        socket.isClosed shouldBe true
                        verifyClosed(socket)
                    }
                }
            }


            "when socket emits CLOSE command" - {
                "closes socket connection to client" {
                    val (socket,listenJob) = socketEmits(",close,")
                    delay(sendDelay)

                    listenJob.invokeOnCompletion {
                        verifyClosed(socket)
                    }
                }
            }

            "when socket emits ABORT command" - {
                "shuts down the app" {
                    socketEmits(",abort,")
                    coVerify {
                        app.socketMessageSender.send(any<Shutdown>())
                        app.socketServer.stop()
                    }
                }
            }

            "when socket emits SEND command" - {
                val messageBody = "hi there"
                val sendCommand = "${recipientAccount.username},send,$messageBody"

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns senderAccount

                    "sends signal message" {
                        socketEmits(sendCommand)
                        coVerify {
                            app.signalMessageSender.send(
                                senderAccount,
                                recipientAccount.username.asAddress(),
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
                            socketEmits(sendCommand)
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
                            socketEmits(sendCommand)
                            coVerify {
                                // TODO(aguestuser|2021-02-04): we dont' actually want this.
                                //  we want halting errors to be treated like SendResult statuses below!
                                app.socketMessageSender.send(
                                    CommandExecutionError("send", error)
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
                            socketEmits(sendCommand)
                            coVerify {
                                app.socketMessageSender.send(SendFailure)
                            }
                        }
                    }
                }

                "and account is not verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns null

                    "sends error message to socket" {
                        socketEmits(sendCommand)
                        coVerify {
                            app.socketMessageSender.send(
                                commandExecutionError(
                                    "send",
                                    Error("Can't send to $senderPhoneNumber: not registered.")
                                )
                            )
                        }
                    }
                }
            }

            "when socket emits SUBSCRIBE command" - {
                val subscribeCommand = "${recipientAccount.username},subscribe,"

                "and account is verified" - {
                    coEvery { app.accountManager.loadVerified(any()) } returns recipientAccount

                    "when subscription succeeds" - {
                        coEvery {
                            app.signalMessageReceiver.subscribe(recipientAccount)
                        } returns Job()

                        "sends success to socket" {
                            socketEmits(subscribeCommand)
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
                            socketEmits(subscribeCommand)
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
                            socketEmits(subscribeCommand)
                            disruptedJob.cancel(error.message!!, error)
                            delay(sendDelay)

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
                        socketEmits(subscribeCommand)
                        coVerify {
                            app.socketMessageSender.send(
                                commandExecutionError(
                                    "subscribe",
                                    Error("Can't subscribe to messages for ${recipientAccount.username}: not registered."))
                            )
                        }
                    }
                }
            }
        }

        "#disconnect" - {

            "closes socket connection" {
                val (socket) = clientConnectsToSocket()
                val listenJob = app.socketMessageReceiver.connect(socket)
                app.socketMessageReceiver.disconnect(socket.hashCode())
                delay(sendDelay)

                listenJob.invokeOnCompletion {
                    verifyClosed(socket)
                }
            }
        }
    }
})