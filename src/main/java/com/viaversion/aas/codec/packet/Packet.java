package com.viaversion.aas.codec.packet;

import com.viaversion.viaversion.api.protocol.version.ProtocolVersion;
import io.netty.buffer.ByteBuf;
import org.jetbrains.annotations.NotNull;

// Some code based on https://github.com/VelocityPowered/Velocity/tree/dev/1.1.0/proxy/src/main/java/com/velocitypowered/proxy/protocol/packet

/**
 * A mutable object which represents a Minecraft packet data
 */
public interface Packet {
	void decode(@NotNull ByteBuf byteBuf, ProtocolVersion protocolVersion) throws Exception;

	void encode(@NotNull ByteBuf byteBuf, ProtocolVersion protocolVersion) throws Exception;
}
