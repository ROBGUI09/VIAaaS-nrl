package com.viaversion.aas.codec.packet.login;

import com.viaversion.aas.codec.packet.Packet;
import com.viaversion.viaversion.api.protocol.version.ProtocolVersion;
import io.netty.buffer.ByteBuf;
import org.jetbrains.annotations.NotNull;

public class LoginAck implements Packet {
	@Override
	public void decode(@NotNull ByteBuf byteBuf, ProtocolVersion protocolVersion) throws Exception {
	}

	@Override
	public void encode(@NotNull ByteBuf byteBuf, ProtocolVersion protocolVersion) throws Exception {
	}
}
