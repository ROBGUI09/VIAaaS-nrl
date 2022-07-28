package com.viaversion.aas.protocol

import com.viaversion.aas.protocol.id47toid5.Protocol1_8To1_7_6
import com.viaversion.aas.protocol.sharewareto1_14.ProtocolSharewareto1_14
import com.viaversion.viaversion.api.Via
import com.viaversion.viaversion.api.protocol.version.ProtocolVersion

// cursed 1.7 -> 1.8 from https://github.com/Gerrygames/ClientViaVersion
// + https://github.com/creeper123123321/ViaRewind/tree/17to18

val sharewareVersion = ProtocolVersion.register(1, "3D Shareware v1.34")
fun registerAspirinProtocols() {
    Via.getManager().protocolManager.setOnlyCheckLoweringPathEntries(false) // Fixes 1.19.1 -> 1.18.2 -> 1.19 path
    Via.getManager().protocolManager.registerProtocol(Protocol1_8To1_7_6, ProtocolVersion.v1_8, ProtocolVersion.v1_7_6)
    // todo fix version checks
    Via.getManager().protocolManager.registerProtocol(ProtocolSharewareto1_14(), sharewareVersion, ProtocolVersion.v1_14)
}
