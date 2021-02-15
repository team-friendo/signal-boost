package info.signalboost.signalc.model

import kotlinx.serialization.Serializable
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.push.SignalServiceAddress
import java.util.*

@Serializable
data class SocketAddress(
    val number: String?,
    val uuid: String?,
) {
   companion object {
       fun SignalServiceAddress.asSocketAddress(): SocketAddress = SocketAddress(
           this.number.orNull(),
           this.uuid.orNull().toString(),
       )
   }

   fun asSignalAddress(): SignalServiceAddress = SignalServiceAddress(
       this.uuid?.let { Optional.of(UUID.fromString(it))} ?: Optional.absent(),
       this.number?.let { Optional.of(it) } ?: Optional.absent(),
   )
}