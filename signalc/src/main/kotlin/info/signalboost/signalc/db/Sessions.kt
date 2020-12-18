package info.signalboost.signalc.db

import org.jetbrains.exposed.sql.Table

const val SESSION_BYTE_ARRAY_LENGTH = 32

object Sessions: Table()  {
    val accountId = varchar("account_id", 255)
    val name = varchar("name", 255)
    val deviceId = integer("device_id")
    val sessionBytes = binary("session_bytes", SESSION_BYTE_ARRAY_LENGTH)
    override val primaryKey = PrimaryKey(accountId, name, deviceId)
}