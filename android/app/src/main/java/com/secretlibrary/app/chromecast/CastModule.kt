package com.secretlibrary.app.chromecast

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.MediaStatus
import com.google.android.gms.cast.framework.*
import com.google.android.gms.cast.framework.media.RemoteMediaClient
import com.google.android.gms.common.images.WebImage
import android.net.Uri
import java.util.concurrent.Executors

/**
 * React Native bridge for Google Cast SDK.
 *
 * Uses async CastContext initialization (required for Cast SDK 22+).
 * Shows the native MediaRouteButton picker dialog on tap.
 */
class CastModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CastModule"
        private const val MODULE_NAME = "CastModule"
    }

    private var castContext: CastContext? = null
    private var sessionManager: SessionManager? = null
    private var mediaClientCallback: RemoteMediaClient.Callback? = null

    private val sessionListener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarting(session: CastSession) {}

        override fun onSessionStarted(session: CastSession, sessionId: String) {
            Log.d(TAG, "Cast session started: $sessionId")
            registerMediaClientCallback(session)
            sendEvent("onSessionStarted", Arguments.createMap().apply {
                putString("sessionId", sessionId)
                putString("deviceName", session.castDevice?.friendlyName ?: "Unknown")
            })
            startMediaStatusPolling()
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
            unregisterMediaClientCallback(session)
            stopMediaStatusPolling()
            sendEvent("onSessionEnded", Arguments.createMap().apply {
                putInt("error", error)
            })
        }

        override fun onSessionResuming(session: CastSession, sessionId: String) {}

        override fun onSessionResumed(session: CastSession, wasSuspended: Boolean) {
            Log.d(TAG, "Cast session resumed")
            registerMediaClientCallback(session)
            sendEvent("onSessionStarted", Arguments.createMap().apply {
                putString("sessionId", session.sessionId ?: "")
                putString("deviceName", session.castDevice?.friendlyName ?: "Unknown")
            })
            startMediaStatusPolling()
        }

        override fun onSessionResumeFailed(session: CastSession, error: Int) {}

        override fun onSessionSuspended(session: CastSession, reason: Int) {}
    }

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        // Use async initialization (Cast SDK 22+ requirement)
        try {
            CastContext.getSharedInstance(reactApplicationContext, Executors.newSingleThreadExecutor())
                .addOnSuccessListener { ctx ->
                    Log.d(TAG, "CastContext initialized successfully")
                    castContext = ctx
                    sessionManager = ctx.sessionManager
                    sessionManager?.addSessionManagerListener(sessionListener, CastSession::class.java)

                    // Check if there's an existing session (app restart while casting)
                    val existingSession = ctx.sessionManager.currentCastSession
                    if (existingSession?.isConnected == true) {
                        Log.d(TAG, "Found existing Cast session on init")
                        registerMediaClientCallback(existingSession)
                        sendEvent("onSessionStarted", Arguments.createMap().apply {
                            putString("sessionId", existingSession.sessionId ?: "")
                            putString("deviceName", existingSession.castDevice?.friendlyName ?: "Unknown")
                        })
                        startMediaStatusPolling()
                    }
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "CastContext initialization failed", e)
                }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start Cast context initialization", e)
        }
    }

    /**
     * Register a RemoteMediaClient.Callback for immediate state change notifications.
     * This supplements the polling loop with instant events for play/pause/finish/error.
     */
    private fun registerMediaClientCallback(session: CastSession) {
        unregisterMediaClientCallback(session) // prevent duplicates
        val client = session.remoteMediaClient ?: return

        val callback = object : RemoteMediaClient.Callback() {
            override fun onStatusUpdated() {
                val status = client.mediaStatus ?: return
                val playerState = status.playerState

                // Detect playback finished (idle with FINISHED reason)
                if (playerState == MediaStatus.PLAYER_STATE_IDLE) {
                    val idleReason = status.idleReason
                    if (idleReason == MediaStatus.IDLE_REASON_FINISHED) {
                        Log.d(TAG, "Cast media playback finished")
                        sendEvent("onMediaFinished", Arguments.createMap().apply {
                            putDouble("position", client.approximateStreamPosition / 1000.0)
                            putDouble("duration", (status.mediaInfo?.streamDuration ?: 0) / 1000.0)
                        })
                    } else if (idleReason == MediaStatus.IDLE_REASON_ERROR) {
                        Log.e(TAG, "Cast media playback error")
                        sendEvent("onMediaError", Arguments.createMap().apply {
                            putString("error", "Media playback error on Cast device")
                        })
                    }
                }
            }
        }
        mediaClientCallback = callback
        client.registerCallback(callback)
    }

    private fun unregisterMediaClientCallback(session: CastSession) {
        val callback = mediaClientCallback ?: return
        session.remoteMediaClient?.unregisterCallback(callback)
        mediaClientCallback = null
    }

    @Suppress("DEPRECATION")
    override fun onCatalystInstanceDestroy() {
        sessionManager?.currentCastSession?.let { unregisterMediaClientCallback(it) }
        sessionManager?.removeSessionManagerListener(sessionListener, CastSession::class.java)
        stopMediaStatusPolling()
        super.onCatalystInstanceDestroy()
    }

    @ReactMethod
    fun startDiscovery(promise: Promise) {
        try {
            val selector = castContext?.mergedSelector
            promise.resolve(selector != null)
        } catch (e: Exception) {
            promise.reject("DISCOVERY_ERROR", "Failed to start discovery", e)
        }
    }

    @ReactMethod
    fun getAvailableDevices(promise: Promise) {
        try {
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
     *
     * A MediaRouteButton must be attached to a window for its click handler
     * to show the chooser dialog. We add a hidden button to the activity's
     * decor view, click it, then remove it on the next frame.
     */
    @ReactMethod
    fun showCastPicker(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available")
            return
        }

        val ctx = castContext
        if (ctx == null) {
            Log.w(TAG, "showCastPicker: CastContext not ready yet")
            promise.reject("NO_CAST_CONTEXT", "Cast not initialized yet")
            return
        }

        activity.runOnUiThread {
            try {
                val button = androidx.mediarouter.app.MediaRouteButton(activity)
                CastButtonFactory.setUpMediaRouteButton(activity, button)

                // The button must be in the view hierarchy to show its dialog.
                // Add it invisibly to the decor view, click, then remove.
                button.visibility = android.view.View.GONE
                val rootView = activity.window.decorView as android.view.ViewGroup
                rootView.addView(button)

                // showDialog() shows the route chooser when no device is
                // connected, or the controller dialog when already connected.
                button.showDialog()

                // Clean up: remove from hierarchy on the next frame
                button.post { rootView.removeView(button) }

                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "showCastPicker failed", e)
                promise.reject("PICKER_ERROR", "Failed to show cast picker", e)
            }
        }
    }

    @ReactMethod
    fun loadMedia(url: String, title: String, author: String, coverUrl: String, position: Double, contentType: String, promise: Promise) {
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

            // Use AUDIOBOOK_CHAPTER type for proper Cast device UI
            val metadata = MediaMetadata(MediaMetadata.MEDIA_TYPE_AUDIOBOOK_CHAPTER).apply {
                putString(MediaMetadata.KEY_TITLE, title)
                putString(MediaMetadata.KEY_ARTIST, author)
                // Also set book title for audiobook displays
                putString(MediaMetadata.KEY_BOOK_TITLE, title)
                if (coverUrl.isNotEmpty()) {
                    addImage(WebImage(Uri.parse(coverUrl)))
                }
            }

            // Use provided content type, fall back to audio/mp4 for m4b files
            val mimeType = if (contentType.isNotEmpty()) contentType else "audio/mp4"

            val mediaInfo = MediaInfo.Builder(url)
                .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                .setContentType(mimeType)
                .setMetadata(metadata)
                .build()

            val loadRequest = MediaLoadRequestData.Builder()
                .setMediaInfo(mediaInfo)
                .setAutoplay(true)
                .setCurrentTime((position * 1000).toLong())
                .build()

            Log.d(TAG, "Loading media: url=${url.take(80)}..., contentType=$mimeType, position=${position}s")

            remoteClient.load(loadRequest)
                .setResultCallback { result ->
                    if (result.status.isSuccess) {
                        Log.d(TAG, "Media loaded successfully on Cast device")
                        promise.resolve(true)
                        startMediaStatusPolling()
                    } else {
                        Log.e(TAG, "Failed to load media: ${result.status.statusMessage}")
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
                            putBoolean("isPlaying", status.playerState == MediaStatus.PLAYER_STATE_PLAYING)
                            putBoolean("isPaused", status.playerState == MediaStatus.PLAYER_STATE_PAUSED)
                            putBoolean("isIdle", status.playerState == MediaStatus.PLAYER_STATE_IDLE)
                            putInt("idleReason", status.idleReason)
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
