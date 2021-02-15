package info.signalboost.signalc.model

import info.signalboost.signalc.util.SocketHashCode
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.push.SignalServiceAddress

sealed class SocketOutMessage

data class Cleartext(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val body: String,
): SocketOutMessage()

data class CommandExecutionException(
    val cause: Throwable,
    val command: SocketRequest,
): SocketOutMessage()

data class CommandInvalidException(
    val cause: Throwable,
    val commandStr: String,
): SocketOutMessage()

data class DecryptionError(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val error: Throwable,
): SocketOutMessage()

data class Dropped(
    val sender: SignalServiceAddress,
    val recipient: SignalServiceAddress,
    val envelope: SignalServiceEnvelope,
): SocketOutMessage()

object Empty : SocketOutMessage()

// TODO: flesh these out!
object SendSuccess: SocketOutMessage()
object SendFailure: SocketOutMessage()

object SubscriptionSucceeded: SocketOutMessage()
data class SubscriptionFailed(
    val error: Throwable,
): SocketOutMessage()
data class SubscriptionDisrupted(
    val error: Throwable,
): SocketOutMessage()

data class Shutdown(
    val socketHash: SocketHashCode,
) : SocketOutMessage()

