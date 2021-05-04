package com.viaversion.aas.packet.login

import com.viaversion.aas.packet.Packet
import com.viaversion.viaversion.api.type.Type
import io.netty.buffer.ByteBuf

class LoginDisconnect : Packet {
    lateinit var msg: String
    override fun decode(byteBuf: ByteBuf, protocolVersion: Int) {
        msg = Type.STRING.read(byteBuf)
    }

    override fun encode(byteBuf: ByteBuf, protocolVersion: Int) {
        Type.STRING.write(byteBuf, msg)
    }
}