package info.signalboost.signalc.testSupport.dataGenerators

import info.signalboost.signalc.model.SignalcAddress
import org.whispersystems.libsignal.SignalProtocolAddress
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.UUID
import kotlin.random.Random


object AddressGen {
    fun genPhoneNumber(): String =
        "+1" + List(10) { Random.nextInt(0, 9) }.joinToString("")

    fun genUuid(): UUID = UUID.randomUUID()


    fun genUuidStr(): String = UUID.randomUUID().toString()

    fun genDeviceId(): Int = (0..100).random()

    fun genSignalServiceAddress(verified: Boolean = true): SignalServiceAddress =
        SignalServiceAddress(
            if (verified) UUID.randomUUID() else null,
            genPhoneNumber(),
        )

    fun genSignalcAddress(verified: Boolean = true): SignalcAddress =
        SignalcAddress(
            genPhoneNumber(),
            if(verified) genUuid() else null
        )

    fun genSignalProtocolAddress(): SignalProtocolAddress =
        SignalProtocolAddress(
            genPhoneNumber(), genDeviceId()
        )

    fun String.asSignalServiceAddress() = SignalServiceAddress(null, this)
    fun UUID.asSignalServiceAddress() = SignalServiceAddress(this, null)
    fun String.asSignalcAddress() = SignalcAddress(this, null)
    fun UUID.asSignalcAddress() = SignalcAddress(null, this)
}