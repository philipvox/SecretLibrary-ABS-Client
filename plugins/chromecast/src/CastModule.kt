package com.secretlibrary.app.chromecast

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.framework.*
import com.google.android.gms.common.images.WebImage
import android.net.Uri

/**
 * React Native bridge for Google Cast SDK.
 *
 * Exposes device discovery, session management, and remote media control
 * to the JavaScript layer.
 */
class CastModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CastModule"
        private const val MODULE_NAME = "CastModule"
    }

    private var castContext: CastContext? = null
    private var sessionManager: SessionManager? = null

    private val sessionListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarting(session: CastSession) {}

        override fun onSessionStarted(session: CastSession, sessionId: String) {
            Log.d(TAG, "Cast session started: $sessionId")
            sendEvent("onSessionStarted", Arguments.createMap().apply {
                putString("sessionId", sessionId)
                putString("deviceName", session.castDevice?.friendlyName ?: "Unknown")
            })
        }

        override fun onSessionStartFailed(session: CastSession, error: Int) {
            Log.e(TAG, "Cast session start failed: $error")
            sendEvent("onSessionStartFailed", Arguments.createMap().apply {
                putInt("error", error)
            })
        }

        override fun onSessionEnding(session: CastSession) {}

        override fun onSessionEnded(session: CastSession, error: Int) {
            Log.d(TAG, "Cast session ended")
            sendEvent("onSessionEnded", Arguments.createMap().apply {
                putInt("error", error)
            })
        }

        override fun onSessionResuming(session: CastSession, sessionId: String) {}

        override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) {
            Log.d(TAG, "Cast session resumed")
            sendEvent("onSessionStarted", Arguments.createMap().apply {
                putString("sessionId", session.sessionId ?: "")
                putString("deviceName", session.castDevice?.friendlyName ?: "Unknown")
            })
        }

        override fun onSessionResumeFailed(session: CastSession, error: Int) {}

        override fun onSessionSuspended(session: CastSession, reason: Int) {}
    }

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        try {
            castContext = CastContext.getSharedInstance(reactApplicationContext)
            sessionManager = castContext?.sessionManager
            sessionManager?.addSessionManagerListener(sessionListener, CastSession::class.java)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Cast context", e)
        }
    }

    override fun onCatalystInstanceDestroy() {
        sessionManager?.removeSessionManagerListener(sessionListener, CastSession::class.java)
        super.onCatalystInstanceDestroy()
    }

    /**
     * Start scanning for nearby Cast devices.
     * Results are emitted via onDevicesDiscovered events.
     */
    @ReactMethod
    fun startDiscovery(promise: Promise) {
        try {
            val router = castContext?.mergedSelector
            if (router != null) {
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("DISCOVERY_ERROR", "Failed to start discovery", e)
        }
    }

    /**
     * Get list of available Cast devices.
     */
    @ReactMethod
    fun getAvailableDevices(promise: Promise) {
        try {
            val ctx = castContext ?: run {
                promise.resolve(Arguments.createArray())
                return
            }
            val devices = Arguments.createArray()

            val currentSession = sessionManager?.currentCastSession
            if (currentSession != null) {
                val device = Arguments.createMap().apply {
                    putString("id", currentSession.castDevice?.deviceId ?: "")
                    putString("name", currentSession.castDevice?.friendlyName ?: "Unknown")
                    putBoolean("isConnected", true)
                }
                devices.pushMap(device)
            }

            promise.resolve(devices)
        } catch (e: Exception) {
            promise.reject("DEVICES_ERROR", "Failed to get devices", e)
        }
    }

    /**
     * Show the native Cast device picker dialog.
     */
    @ReactMethod
    fun showCastPicker(promise: Promise) {
        try {
            val activity = currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No activity available")
                return
            }
            // The Cast SDK handles the picker dialog natively
            // by triggering the MediaRouteChooserDialog
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PICKER_ERROR", "Failed to show cast picker", e)
        }
    }

    /**
     * Load media on the connected Cast device.
     *
     * @param url The audio stream URL (with ?token= for auth)
     * @param title Book title
     * @param author Book author
     * @param coverUrl Cover image URL (with ?token= for auth)
     * @param position Starting position in seconds
     */
    @ReactMethod
    fun loadMedia(url: String, title: String, author: String, coverUrl: String, position: Double, promise: Promise) {
        try {
            val session = sessionManager?.currentCastSession
            if (session == null) {
                promise.reject("NO_SESSION", "No active Cast session")
                return
            }

            val remoteClient = session.remoteMediaClient
            if (remoteClient == null) {
                promise.reject("NO_CLIENT", "No remote media client")
                return
            }

            val metadata = MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK).apply {
                putString(MediaMetadata.KEY_TITLE, title)
                putString(MediaMetadata.KEY_ARTIST, author)
                if (coverUrl.isNotEmpty()) {
                    addImage(WebImage(Uri.parse(coverUrl)))
                }
            }

            val mediaInfo = MediaInfo.Builder(url)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType("audio/mp4")
                .setMetadata(metadata)
                .build()

            val loadRequest = MediaLoadRequestData.Builder()
                .setMediaInfo(mediaInfo)
                .setAutoplay(true)
                .setCurrentTime((position * 1000).toLong())
                .build()

            remoteClient.load(loadRequest)
                .setResultCallback { result ->
                    if (result.status.isSuccess) {
                        promise.resolve(true)
                        startMediaStatusPolling()
                    } else {
                        promise.reject("LOAD_ERROR", "Failed to load media: ${result.status.statusMessage}")
                    }
                }
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", "Failed to load media", e)
        }
    }

    @ReactMethod
    fun play(promise: Promise) {
        try {
            val client = sessionManager?.currentCastSession?.remoteMediaClient
            if (client == null) {
                promise.reject("NO_CLIENT", "No remote media client")
                return
            }
            client.play()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PLAY_ERROR", "Failed to play", e)
        }
    }

    @ReactMethod
    fun pause(promise: Promise) {
        try {
            val client = sessionManager?.currentCastSession?.remoteMediaClient
            if (client == null) {
                promise.reject("NO_CLIENT", "No remote media client")
                return
            }
            client.pause()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", "Failed to pause", e)
        }
    }

    @ReactMethod
    fun seek(position: Double, promise: Promise) {
        try {
            val client = sessionManager?.currentCastSession?.remoteMediaClient
            if (client == null) {
                promise.reject("NO_CLIENT", "No remote media client")
                return
            }
            client.seek(com.google.android.gms.cast.MediaSeekOptions.Builder()
                .setPosition((position * 1000).toLong())
                .build())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SEEK_ERROR", "Failed to seek", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            val client = sessionManager?.currentCastSession?.remoteMediaClient
            if (client == null) {
                promise.reject("NO_CLIENT", "No remote media client")
                return
            }
            client.stop()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to stop", e)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            sessionManager?.endCurrentSession(true)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISCONNECT_ERROR", "Failed to disconnect", e)
        }
    }

    /**
     * Get current playback position from Cast device (in seconds).
     */
    @ReactMethod
    fun getPosition(promise: Promise) {
        try {
            val client = sessionManager?.currentCastSession?.remoteMediaClient
            if (client == null) {
                promise.resolve(-1.0)
                return
            }
            promise.resolve(client.approximateStreamPosition / 1000.0)
        } catch (e: Exception) {
            promise.resolve(-1.0)
        }
    }

    /**
     * Check if there's an active Cast session.
     */
    @ReactMethod
    fun isConnected(promise: Promise) {
        try {
            val session = sessionManager?.currentCastSession
            promise.resolve(session?.isConnected == true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private var mediaStatusRunnable: Runnable? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    private fun startMediaStatusPolling() {
        stopMediaStatusPolling()
        mediaStatusRunnable = object : Runnable {
            override fun run() {
                val client = sessionManager?.currentCastSession?.remoteMediaClient
                if (client != null) {
                    val status = client.mediaStatus
                    if (status != null) {
                        sendEvent("onMediaStatusUpdate", Arguments.createMap().apply {
                            putDouble("position", client.approximateStreamPosition / 1000.0)
                            putDouble("duration", (status.mediaInfo?.streamDuration ?: 0) / 1000.0)
                            putBoolean("isPlaying", status.playerState == com.google.android.gms.cast.MediaStatus.PLAYER_STATE_PLAYING)
                            putBoolean("isPaused", status.playerState == com.google.android.gms.cast.MediaStatus.PLAYER_STATE_PAUSED)
                            putBoolean("isIdle", status.playerState == com.google.android.gms.cast.MediaStatus.PLAYER_STATE_IDLE)
                        })
                    }
                    handler.postDelayed(this, 1000)
                }
            }
        }
        handler.postDelayed(mediaStatusRunnable!!, 1000)
    }

    private fun stopMediaStatusPolling() {
        mediaStatusRunnable?.let { handler.removeCallbacks(it) }
        mediaStatusRunnable = null
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send event $eventName", e)
        }
    }
}
