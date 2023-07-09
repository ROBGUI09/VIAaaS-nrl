package com.viaversion.aas.handler

import com.viaversion.aas.codec.CompressionCodec
import com.viaversion.aas.codec.CryptoCodec
import com.viaversion.aas.handler.state.ConnectionState
import com.viaversion.aas.handler.state.HandshakeState
import io.netty.channel.Channel

class ConnectionData(
    val frontChannel: Channel,
    var backChannel: Channel? = null,
    var state: ConnectionState = HandshakeState(),
    var frontVer: Int? = null,
    var backServerVer: Int? = null,
    var autoDetectProtocol: Boolean = false
) {
    val frontHandler get() = frontChannel.pipeline()[MinecraftHandler::class.java]
    val backHandler get() = backChannel?.pipeline()?.get(MinecraftHandler::class.java)
    val frontEncrypted get() = frontChannel.pipeline()[CryptoCodec::class.java] != null
    val compressionLevel get() = frontChannel.pipeline()[CompressionCodec::class.java]?.threshold ?: -1
}