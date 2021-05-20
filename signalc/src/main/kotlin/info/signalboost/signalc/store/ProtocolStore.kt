package info.signalboost.signalc.store


import info.signalboost.signalc.db.*
import info.signalboost.signalc.model.Account
import info.signalboost.signalc.store.protocol.*
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction
import org.whispersystems.libsignal.groups.state.SenderKeyStore
import org.whispersystems.libsignal.state.*
import org.whispersystems.signalservice.api.SignalServiceProtocolStore
import org.whispersystems.signalservice.api.SignalServiceSessionStore
import org.whispersystems.signalservice.api.SignalSessionLock


class ProtocolStore(private val db: Database) {
    fun of(account: Account): AccountProtocolStore = AccountProtocolStore(db, account.username)

    fun countOwnIdentities(): Long =
        transaction(db) { OwnIdentities.selectAll().count() }

    class AccountProtocolStore(
        private val db: Database,
        private val accountId: String,
        val lock: SignalSessionLock = SessionLock(),
        private val identityStore: IdentityKeyStore = SignalcIdentityStore(db, accountId, lock),
        private val preKeyStore: PreKeyStore = SignalcPreKeyStore(db, accountId, lock),
        private val senderKeyStore: SenderKeyStore = SignalcSenderKeyStore(db, accountId, lock),
        private val sessionStore: SignalServiceSessionStore = SignalcSessionStore(db, accountId, lock),
        private val signedPreKeyStore: SignedPreKeyStore = SignalcSignedPreKeyStore(db, accountId, lock),
    ) : SignalServiceProtocolStore,
        IdentityKeyStore by identityStore,
        PreKeyStore by preKeyStore,
        SenderKeyStore by senderKeyStore,
        SignalServiceSessionStore by sessionStore,
        SignedPreKeyStore by signedPreKeyStore {

        /**
         * NON-INTERFACE (DECORATOR) FUNCTIONS
         **/

        private val scIdentityStore = identityStore as SignalcIdentityStore
        val removeIdentity = scIdentityStore::removeIdentity
        val removeOwnIdentity = scIdentityStore::removeOwnIdentity
        val saveFingerprintForAllIdentities = scIdentityStore::saveFingerprintForAllIdentities
        val trustFingerprintForAllIdentities = scIdentityStore::trustFingerprintForAllIdentities

        private val scPreKeyStore = preKeyStore as SignalcPreKeyStore
        val getLastPreKeyId = scPreKeyStore::getLastPreKeyId
    }
}