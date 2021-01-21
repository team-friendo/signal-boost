package info.signalboost.signalc

import info.signalboost.signalc.store.AccountStore
import info.signalboost.signalc.store.ProtocolStore
import io.mockk.mockk
import kotlinx.coroutines.CoroutineScope
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jetbrains.exposed.sql.Database
import org.whispersystems.libsignal.util.guava.Optional
import org.whispersystems.signalservice.api.groupsv2.ClientZkOperations
import org.whispersystems.signalservice.api.groupsv2.GroupsV2Operations
import org.whispersystems.signalservice.api.push.TrustStore
import org.whispersystems.signalservice.internal.configuration.*
import org.whispersystems.util.Base64
import java.io.FileInputStream
import java.io.InputStream
import java.security.Security
import java.io.IOException

import org.signal.libsignal.metadata.certificate.CertificateValidator
import org.whispersystems.libsignal.ecc.Curve
import java.security.InvalidKeyException


class Application(val config: Config.App, val coroutineScope: CoroutineScope) {

    companion object {

        data class Store(
            val account: AccountStore,
            val signalProtocol: ProtocolStore,
        )

        data class Signal(
            val agent: String,
            val certificateValidator: CertificateValidator,
            val clientZkOperations: ClientZkOperations?,
            val configs: SignalServiceConfiguration,
            val groupsV2Operations: GroupsV2Operations?,
            val trustStore: TrustStore,
        )
    }

    init {
        if (config.signal.addSecurityProvider) Security.addProvider(BouncyCastleProvider())
    }

    /**********
     * STORE
     **********/

    val db: Database by lazy {
        Database.connect(
            driver = config.db.driver,
            url = config.db.url,
            user = config.db.user,
        )
    }

    val store by lazy {
        Store(
            account = when(config.store.account) {
                Config.StoreType.SQL -> AccountStore(db)
                Config.StoreType.MOCK -> mockk()
            },
            signalProtocol = when(config.store.signalProtocol) {
                Config.StoreType.SQL -> ProtocolStore(db)
                Config.StoreType.MOCK -> mockk()
            }
        )
    }

    /**********
     * SIGNAL
     **********/

    val signal by lazy {
        Signal(
            agent = config.signal.agent,
            certificateValidator = certificateValidator,
            clientZkOperations = clientZkOperations,
            configs = signalConfigs,
            groupsV2Operations = groupsV2Operations,
            trustStore = trustStore,
        )
    }

    private val trustStore by lazy {
        object : TrustStore {
            override fun getKeyStoreInputStream(): InputStream = FileInputStream(config.signal.trustStorePath)
            override fun getKeyStorePassword(): String = config.signal.trustStorePassword
        }
    }

    private val signalConfigs by lazy {
        SignalServiceConfiguration(
            arrayOf(SignalServiceUrl(config.signal.serviceUrl, trustStore)),
            mapOf(
                0 to arrayOf(SignalCdnUrl(config.signal.cdnUrl, trustStore)),
                2 to arrayOf(SignalCdnUrl(config.signal.cdn2Url, trustStore))
            ).toMutableMap(),
            arrayOf(SignalContactDiscoveryUrl(config.signal.contactDiscoveryUrl, trustStore)),
            arrayOf(SignalKeyBackupServiceUrl(config.signal.keyBackupServiceUrl, trustStore)),
            arrayOf(SignalStorageUrl(config.signal.storageUrl, trustStore)),
            mutableListOf(),
            Optional.absent(),
            Base64.decode(config.signal.zkGroupServerPublicParams)
        )
    }

    private val clientZkOperations: ClientZkOperations? by lazy {
        try {
            ClientZkOperations.create(signalConfigs)
        } catch(ignored: Throwable) {
            null
        }
    }

    private val groupsV2Operations: GroupsV2Operations? by lazy {
        clientZkOperations?.let { GroupsV2Operations(it) }
    }

    private val certificateValidator: CertificateValidator by lazy {
        // TODO: what to do if this throws invalid key exception or io exception?
        CertificateValidator(Curve.decodePoint(Base64.decode(config.signal.unidentifiedSenderTrustRoot), 0))
    }

}