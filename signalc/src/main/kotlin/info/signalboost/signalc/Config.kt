package info.signalboost.signalc

object Config {
    const val USER_PHONE_NUMBER = "+17347962920"

    // SCHEMA

    data class App(
        val db: Database,
        val signal: Signal,
        val store: Store,
    )

    data class Database(
        val driver: String,
        val url: String,
        val user: String,
    )

    data class Signal(
        val addSecurityProvider: Boolean,
        val agent: String,
        val cdnUrl: String,
        val cdn2Url: String,
        val contactDiscoveryUrl: String,
        val keyBackupServiceUrl: String,
        val serviceUrl: String,
        val storageUrl: String,
        val trustStorePassword: String,
        val trustStorePath: String,
        val unidentifiedSenderTrustRoot: String,
        val zkGroupServerPublicParams: String,
    )

    enum class StoreType {
        SQL,
        MOCK,
    }

    data class Store(
        val account: StoreType,
        val signalProtocol: StoreType,
    )

    // FACTORIES

    enum class Env(val value: String) {
        Dev("development"),
        Prod("production"),
        Test("test"),
    }

    fun fromEnv(env: String? = System.getenv("SIGNALC_ENV")): App = when(env) {
        Env.Dev.value -> dev
        Env.Prod.value -> prod
        Env.Test.value -> test
        else -> throw(Error("ERROR: missing or illegal value for \$SIGNALC_ENV: $env"))
    }

    private val dbHost = System.getenv("DB_HOST") ?: "localhost:5432"

    private val default  = App(
        db = Database(
            driver = "com.impossibl.postgres.jdbc.PGDriver",
            url = "jdbc:pgsql://$dbHost/signalc",
            user= "postgres"
        ),
        signal= Signal(
            addSecurityProvider = true,
            agent = "signalc",
            cdnUrl = "https://cdn.signal.org",
            cdn2Url = "https://cdn2.signal.org",
            contactDiscoveryUrl = "https://cms.souqcdn.com",
            keyBackupServiceUrl = "https://api.backup.signal.org",
            serviceUrl = "https://textsecure-service.whispersystems.org",
            storageUrl = "https://storage.signal.org",
            trustStorePassword = System.getenv("WHISPER_STORE_PASSWORD") ?: "whisper",
            trustStorePath = System.getenv("WHISPER_STORE_PATH") ?: "/signalc/whisper.store",
            unidentifiedSenderTrustRoot = "BXu6QIKVz5MA8gstzfOgRQGqyLqOwNKHL6INkv3IHWMF",
            zkGroupServerPublicParams = "AMhf5ywVwITZMsff/eCyudZx9JDmkkkbV6PInzG4p8x3VqVJSFiMvnvlEKWuRob/1eaIetR31IYeAbm0NdOuHH8Qi+Rexi1wLlpzIo1gstHWBfZzy1+qHRV5A4TqPp15YzBPm0WSggW6PbSn+F4lf57VCnHF7p8SvzAA2ZZJPYJURt8X7bbg+H3i+PEjH9DXItNEqs2sNcug37xZQDLm7X0=",
        ),
        store= Store(
            account = StoreType.SQL,
            signalProtocol = StoreType.SQL,
        ),
    )

    val prod = default
    val dev = default.copy(
        db = default.db.copy(
            url = "jdbc:pgsql://$dbHost/signalc_development",
        ),
    )
    val test = default.copy(
        db = default.db.copy(
            url = "jdbc:pgsql://$dbHost/signalc_test",
        ),
        store = default.store.copy(
            account = Config.StoreType.MOCK,
            signalProtocol = Config.StoreType.MOCK
        ),
    )
}
