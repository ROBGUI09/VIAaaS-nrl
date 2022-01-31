package com.viaversion.aas.web

import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.http.content.*
import io.ktor.server.plugins.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.util.*
import io.ktor.websocket.*
import kotlinx.coroutines.channels.consumeEach
import org.slf4j.event.Level
import java.io.File
import java.nio.channels.ClosedChannelException
import java.nio.file.Path
import java.time.Duration

class ViaWebApp(val viaWebServer: WebServer) {
    fun Application.main() {
        install(DefaultHeaders)
        install(ConditionalHeaders)
        install(CachingHeaders) {
            options {
                CachingOptions(CacheControl.MaxAge(600, visibility = CacheControl.Visibility.Public))
            }
        }
        install(CallLogging) {
            level = Level.DEBUG
            this.format {
                "${it.request.local.method.value} ${it.response.status()?.value} ${it.request.local.remoteHost} (O: ${it.request.origin.remoteHost}) " +
                        "${it.request.local.scheme}://${it.request.local.host}:${it.request.local.port}${it.request.local.uri}"
            }
        }
        install(WebSockets) {
            maxFrameSize = Short.MAX_VALUE.toLong()
            pingPeriod = Duration.ofSeconds(20)
            timeout = Duration.ofSeconds(15)
        }
        install(XForwardedHeaderSupport)
        install(ForwardedHeaderSupport)
        // i think we aren't vulnerable to breach, dynamic things are websockets
        // https://ktor.io/docs/compression.html#security
        install(Compression)
        install(PartialContent)

        routing {
            routeStatic()
            routeWs()
        }
    }

    private fun Route.routeStatic() {
        static {
            get("{path...}") {
                val relativePath = Path.of(call.parameters.getAll("path")?.joinToString("/") ?: "")
                val index = Path.of("index.html")

                var resource = call.resolveResource(relativePath.toString(), "web")
                if (resource == null) {
                    resource = call.resolveResource(relativePath.resolve(index).toString(), "web")
                }

                var file = File("config/web").combineSafe(relativePath)
                if (file.isDirectory) {
                    file = file.resolve("index.html")
                }

                when {
                    file.isFile -> call.respondFile(file)
                    resource != null -> call.respond(resource)
                }
            }
        }
    }

    private fun Route.routeWs() {
        webSocket("/ws") {
            try {
                viaWebServer.connected(this)
                incoming.consumeEach { frame ->
                    if (frame is Frame.Text) {
                        viaWebServer.onMessage(this, frame.readText())
                    }
                }
            } catch (ignored: ClosedChannelException) {
            } catch (e: Exception) {
                viaWebServer.onException(this, e)
                this.close(CloseReason(CloseReason.Codes.INTERNAL_ERROR, "INTERNAL ERROR"))
            } finally {
                viaWebServer.disconnected(this)
            }
        }
    }
}
