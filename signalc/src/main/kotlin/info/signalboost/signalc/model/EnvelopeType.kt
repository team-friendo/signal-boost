package info.signalboost.signalc.model

import org.whispersystems.signalservice.internal.push.SignalServiceProtos.Envelope.Type.*

enum class EnvelopeType(val asString: String) {
    UNKNOWN("UNKONWN"),
    CIPHERTEXT("CIPHERTEXT"),
    KEY_EXCHANGE("KEY_EXCHANGE"),
    PREKEY_BUNDLE("PREKEY_BUNDLE"),
    RECEIPT("RECEIPT"),
    UNIDENTIFIED_SENDER("UNIDENTIFIED_SENDER");

    companion object {
        fun fromInt(int: Int): EnvelopeType = when(int) {
            UNKNOWN_VALUE -> UNKNOWN // 0
            CIPHERTEXT_VALUE -> CIPHERTEXT // 1
            PREKEY_BUNDLE_VALUE -> PREKEY_BUNDLE // 3
            KEY_EXCHANGE_VALUE -> KEY_EXCHANGE // 2
            RECEIPT_VALUE -> RECEIPT // 5
            UNIDENTIFIED_SENDER_VALUE -> UNIDENTIFIED_SENDER // 6
            else -> UNKNOWN
        }

        fun Int.asEnum(): EnvelopeType = fromInt(this)
    }
}

