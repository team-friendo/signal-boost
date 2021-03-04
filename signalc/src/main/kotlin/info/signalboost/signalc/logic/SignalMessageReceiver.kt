package info.signalboost.signalc.logic

import info.signalboost.signalc.Application
import info.signalboost.signalc.error.SignalcError
import info.signalboost.signalc.model.*
import info.signalboost.signalc.model.EnvelopeType.Companion.asEnum
import info.signalboost.signalc.model.SignalcAddress.Companion.asSignalcAddress
import kotlinx.coroutines.*
import mu.KLoggable
import org.whispersystems.signalservice.api.SignalServiceMessageReceiver
import org.whispersystems.signalservice.api.crypto.SignalServiceCipher
import org.whispersystems.signalservice.api.messages.SignalServiceEnvelope
import org.whispersystems.signalservice.api.util.UptimeSleepTimer
import java.util.concurrent.TimeUnit
import kotlin.time.ExperimentalTime


@ExperimentalTime
@ObsoleteCoroutinesApi
@ExperimentalCoroutinesApi
class SignalMessageReceiver(private val app: Application) {
    companion object: Any(), KLoggable {
        override val logger = logger()
        private const val TIMEOUT = 1000L * 60 * 60 // 1 hr (copied from signald)
    }

    // FACTORIES

    private fun messagePipeOf(account: VerifiedAccount) = SignalServiceMessageReceiver(
        app.signal.configs,
        account.credentialsProvider,
        app.signal.agent,
        null, // TODO: see [1] below
        UptimeSleepTimer(),
        app.signal.clientZkOperations?.profileOperations,
    ).createMessagePipe()

    // TODO: memoize this?
    private fun cipherOf(account: VerifiedAccount) = SignalServiceCipher(
        account.address,
        app.protocolStore.of(account),
        app.signal.certificateValidator
    )

    // MESSAGE LISTENING

    suspend fun subscribe(account: VerifiedAccount): Job {
        // TODO(aguestuser|2021-01-21):
        //  make this resilient to duplicate subscriptions by:
        //  - keeping hashmap of messagePipes
        //  - if caller tries to create a message pipe for an account that already has one, return null
        //  -> caller only gets a receive channel if one doesn't already exist somewhere else
        //  -> we can leverage the hashmap for unsubscribing
        //  handle:
        //  - timeout
        //  - closed connection (understand `readyOrEmtpy()`?)
        //  - closed channel
        //  - random runtime error
        //  - cleanup message pipe on unsubscribe (by calling messagePipe.shutdown())
        // TODO: custom error for messagePipeCreation
        return app.coroutineScope.launch {
            val messagePipe = try {
                messagePipeOf(account)
            } catch(e: Throwable) {
                throw SignalcError.MessagePipeNotCreated(e)
            }
            while (this.isActive) {
                withContext(Dispatchers.IO) {
                    val envelope = messagePipe.read(TIMEOUT, TimeUnit.MILLISECONDS)
                    logger.debug { "Got ${envelope.type.asEnum()} message from ${envelope.sourceAddress.number}"}
                    dispatch(account, envelope)
                }
            }
        }
    }

    // MESSAGE HANDLING

    private suspend fun dispatch(account: VerifiedAccount, envelope: SignalServiceEnvelope) {
        when(envelope.type.asEnum()) {
            EnvelopeType.CIPHERTEXT,
            EnvelopeType.PREKEY_BUNDLE -> handleCiphertext(envelope, account)
            // TODO(aguestuser|2021-03-04): handle any of these?
            EnvelopeType.KEY_EXCHANGE,
            EnvelopeType.RECEIPT,
            EnvelopeType.UNIDENTIFIED_SENDER,
            EnvelopeType.UNKNOWN -> drop(envelope, account)
        }
    }

    private suspend fun handleCiphertext(envelope: SignalServiceEnvelope, account: VerifiedAccount){
        // Attempt to decrypt envelope in a new coroutine within CPU-intensive thread-pool
        // (don't suspend execution in the current coroutine or consume IO threadpool),
        // then relay result to socket message sender for handling.
        val (sender, recipient) = Pair(envelope.asSignalcAddress(), account.asSignalcAddress())
        app.coroutineScope.launch(Dispatchers.Default) {
            try {
                val dataMessage = cipherOf(account).decrypt(envelope).dataMessage.orNull()
                dataMessage?.body?.orNull()
                    ?.let {
                        app.socketMessageSender.send(
                            SocketResponse.Cleartext.of(
                                sender,
                                recipient,
                                it,
                                emptyList(), //TODO: actually handle attachments!
                                dataMessage.expiresInSeconds,
                                dataMessage.timestamp,
                            )
                        )
                    }
                    ?: app.socketMessageSender.send(SocketResponse.Empty)
            } catch(e: Throwable) {
                app.socketMessageSender.send(SocketResponse.DecryptionError(sender, recipient, e))
            }
        }
    }

    private suspend fun drop(envelope: SignalServiceEnvelope, account: VerifiedAccount) {
        app.socketMessageSender.send(
            SocketResponse.Dropped(envelope.asSignalcAddress(), account.asSignalcAddress(), envelope)
        )
    }
}

/*[1]**********
 * TODO: signald (and thus we) leave ConnectivityListener unimplemented.
 *  We likely should not follow suit. Here is what a ConnectivityListener does:
 *
 *  public interface ConnectivityListener {
 *    void onConnected();
 *    void onConnecting();
 *    void onDisconnected();
 *    void onAuthenticationFailure();
 * }
 *
 **/
