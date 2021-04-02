package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.Config
import info.signalboost.signalc.logic.SignalSender.Companion.asAddress
import info.signalboost.signalc.model.SocketRequest.Companion.DEFAULT_EXPIRY_TIME
import info.signalboost.signalc.testSupport.coroutines.CoroutineUtil.teardown
import info.signalboost.signalc.testSupport.dataGenerators.AccountGen.genVerifiedAccount
import info.signalboost.signalc.testSupport.dataGenerators.AddressGen.genPhoneNumber
import info.signalboost.signalc.testSupport.matchers.SignalMessageMatchers.signalDataMessage
import info.signalboost.signalc.testSupport.matchers.SignalMessageMatchers.signalExpirationUpdate
import info.signalboost.signalc.util.TimeUtil
import io.kotest.core.spec.style.FreeSpec
import io.kotest.matchers.shouldNotBe
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.ObsoleteCoroutinesApi
import kotlinx.coroutines.test.runBlockingTest
import org.whispersystems.libsignal.util.guava.Optional.absent
import org.whispersystems.signalservice.api.SignalServiceMessageSender
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import kotlin.time.ExperimentalTime

@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalSenderTest : FreeSpec({
    runBlockingTest {

        val testScope = this
        val app = Application(Config.mockStore).run(testScope)
        val verifiedAccount = genVerifiedAccount()
        val messageSender = app.signalSender

        beforeSpec {
            mockkObject(TimeUtil)
            mockkConstructor(SignalServiceMessageSender::class)
        }

        afterTest {
            clearAllMocks(answers = false, childMocks = false, objectMocks = false)
        }

        afterSpec {
            unmockkAll()
            testScope.teardown()
        }

        "#send" - {
            val recipientPhone = genPhoneNumber()
            every {
                anyConstructed<SignalServiceMessageSender>().sendMessage(any(), any(), any())
            } returns mockk {
                every { success } returns mockk()
            }

            "sends a data message to intended recipient" {
                val now = TimeUtil.nowInMillis()
                val result = messageSender.send(
                    sender = verifiedAccount,
                    recipient = recipientPhone.asAddress(),
                    body = "hello!",
                    expiration = 5000,
                    timestamp = now,
                )
                verify {
                    anyConstructed<SignalServiceMessageSender>().sendMessage(
                        SignalServiceAddress(null, recipientPhone),
                        absent(),
                        signalDataMessage(
                            body = "hello!",
                            timestamp = now,
                            expiresInSeconds = 5000,
                        )
                    )
                }
                result.success shouldNotBe null
            }

            "provides a default timestamp if none provided" {
                every { TimeUtil.nowInMillis() } returns 1000L
                messageSender.send(verifiedAccount, recipientPhone.asAddress(), "hello!", DEFAULT_EXPIRY_TIME)
                verify {
                    anyConstructed<SignalServiceMessageSender>().sendMessage(
                        any(),
                        any(),
                        signalDataMessage(timestamp = 1000L)
                    )
                }
            }
        }

        "#setExpiration" - {
            val recipientPhone = genPhoneNumber()
            every {
                anyConstructed<SignalServiceMessageSender>().sendMessage(any(), any(), any())
            } returns mockk {
                every { success } returns mockk()
            }

            "sends an expiration update to intended recipient" {
                val result = messageSender.setExpiration(
                    sender = verifiedAccount,
                    recipient = recipientPhone.asAddress(),
                    expiresInSeconds = 60,
                )
                verify {
                    anyConstructed<SignalServiceMessageSender>().sendMessage(
                        SignalServiceAddress(null, recipientPhone),
                        absent(),
                        signalExpirationUpdate(60)
                    )
                }
                result.success shouldNotBe null
            }
        }
    }
})
