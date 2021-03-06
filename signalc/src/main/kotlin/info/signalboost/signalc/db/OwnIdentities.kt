package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table


object OwnIdentities: Table() {
    private const val IDENTITY_KEYPAIR_BYTE_ARRAY_LENGTH = 69

    val accountId = varchar("account_id", 255)
    val keyPairBytes = binary("keypair_bytes", IDENTITY_KEYPAIR_BYTE_ARRAY_LENGTH)
    val registrationId = integer("registration_id")

    override val primaryKey = PrimaryKey(accountId)
}