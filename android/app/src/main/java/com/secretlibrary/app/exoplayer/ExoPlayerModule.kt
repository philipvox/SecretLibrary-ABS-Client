package com.secretlibrary.app.exoplayer

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native bridge module for ExoPlayer playback service.
 *
 * JS calls methods here → forwarded to AudioPlaybackService.
 * AudioPlaybackService emits events → forwarded to JS via RCTDeviceEventEmitter.
 */
class ExoPlayerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    // Main thread handler — ExoPlayer MUST be accessed on the main thread only.
    // React Native @ReactMethod functions run on 'mqt_v_native' thread,
    // so all ExoPlayer calls must be dispatched here.
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "ExoPlayerModule"

        // Event names
        const val EVENT_PLAYBACK_STATE = "ExoPlayerPlaybackState"
        const val EVENT_TRACK_CHANGE = "ExoPlayerTrackChange"
        const val EVENT_ERROR = "ExoPlayerError"
        const val EVENT_BOOK_END = "ExoPlayerBookEnd"
        const val EVENT_REMOTE_COMMAND = "ExoPlayerRemoteCommand"

        // Static reference for AudioPlaybackService to emit events
        @Volatile
        private var moduleInstance: ExoPlayerModule? = null

        /**
         * Emit playback state update to JS.
         * Called from AudioPlaybackService's position update loop.
         */
        fun emitPlaybackState(
            isPlaying: Boolean,
            position: Double,
            duration: Double,
            isBuffering: Boolean,
            didJustFinish: Boolean,
            isStuck: Boolean
        ) {
            val instance = moduleInstance ?: return
            if (!instance.reactContext.hasActiveReactInstance()) return

            try {
                val params = Arguments.createMap().apply {
                    putBoolean("isPlaying", isPlaying)
                    putDouble("position", position)
                    putDouble("duration", duration)
                    putBoolean("isBuffering", isBuffering)
                    putBoolean("didJustFinish", didJustFinish)
                    putBoolean("isStuck", isStuck)
                }
                instance.reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(EVENT_PLAYBACK_STATE, params)
            } catch (e: Exception) {
                Log.e(TAG, "Error emitting playback state", e)
            }
        }

        /**
         * Emit a named event with optional data to JS.
         */
        fun emitEvent(eventName: String, data: Bundle?) {
            val instance = moduleInstance ?: return
            if (!instance.reactContext.hasActiveReactInstance()) return

            try {
                val params = Arguments.createMap()
                data?.let { bundle ->
                    for (key in bundle.keySet()) {
                        when (val value = bundle.get(key)) {
                            is String -> params.putString(key, value)
                            is Int -> params.putInt(key, value)
                            is Double -> params.putDouble(key, value)
                            is Boolean -> params.putBoolean(key, value)
                            is Long -> params.putDouble(key, value.toDouble())
                        }
                    }
                }

                val targetEvent = when (eventName) {
                    "onTrackChange" -> EVENT_TRACK_CHANGE
                    "onError" -> EVENT_ERROR
                    "onBookEnd" -> EVENT_BOOK_END
                    "onRemoteCommand" -> EVENT_REMOTE_COMMAND
                    else -> eventName
                }

                instance.reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(targetEvent, params)

                Log.d(TAG, "Emitted event: $targetEvent")
            } catch (e: Exception) {
                Log.e(TAG, "Error emitting event: $eventName", e)
            }
        }
    }

    init {
        val previous = moduleInstance
        if (previous != null && previous !== this) {
            Log.w(TAG, "ExoPlayerModule: overwriting existing moduleInstance — bridge recreation race detected")
        }
        moduleInstance = this
        Log.d(TAG, "ExoPlayerModule initialized")
    }

    override fun getName(): String = "ExoPlayerModule"

    /**
     * Wait for AudioPlaybackService to be ready (instance set AND initialized),
     * then run the callback on the main thread.
     * Polls every 100ms up to 5 seconds. Retries service start if needed.
     */
    private fun ensureServiceThen(promise: Promise, block: (AudioPlaybackService) -> Unit) {
        val doWork = Runnable {
            val service = AudioPlaybackService.instance
            if (service != null && service.isInitialized) {
                block(service)
            } else if (service != null && !service.isInitialized) {
                // Service exists but init failed — try to recover
                Log.w(TAG, "Service exists but not initialized, calling ensureReady()")
                if (service.ensureReady()) {
                    block(service)
                } else {
                    promise.reject("INIT_FAILED", "ExoPlayer failed to initialize")
                }
            } else {
                // Service not started yet — try starting it, then poll
                Log.d(TAG, "Service not found, starting and polling...")
                AudioPlaybackService.start(reactContext.applicationContext)

                var attempts = 0
                val maxAttempts = 50 // 50 * 100ms = 5s
                val pollRunnable = object : Runnable {
                    override fun run() {
                        val svc = AudioPlaybackService.instance
                        if (svc != null && svc.isInitialized) {
                            Log.d(TAG, "Service ready after ${attempts * 100}ms of polling")
                            block(svc)
                        } else if (svc != null && !svc.isInitialized) {
                            // Service exists but not initialized — retry init
                            if (svc.ensureReady()) {
                                block(svc)
                            } else if (++attempts >= maxAttempts) {
                                promise.reject("INIT_FAILED", "ExoPlayer failed to initialize after retries")
                            } else {
                                mainHandler.postDelayed(this, 100)
                            }
                        } else if (++attempts >= maxAttempts) {
                            promise.reject("NOT_INITIALIZED", "AudioPlaybackService not ready after 5s")
                        } else {
                            mainHandler.postDelayed(this, 100)
                        }
                    }
                }
                mainHandler.postDelayed(pollRunnable, 100)
            }
        }
        // Ensure we're on the main thread
        if (Looper.myLooper() == Looper.getMainLooper()) {
            doWork.run()
        } else {
            mainHandler.post(doWork)
        }
    }

    override fun invalidate() {
        Log.d(TAG, "ExoPlayerModule invalidated")
        if (moduleInstance === this) {
            moduleInstance = null
        }
        super.invalidate()
    }

    /**
     * Initialize the native playback service.
     * Starts AudioPlaybackService as a foreground service.
     * Must be called before any other methods.
     */
    @ReactMethod
    fun initialize(promise: Promise) {
        try {
            // If already initialized, resolve immediately
            if (AudioPlaybackService.instance != null) {
                promise.resolve(true)
                return
            }

            AudioPlaybackService.start(reactContext.applicationContext)

            // Poll for service readiness — check every 50ms, up to 5 seconds
            var attempts = 0
            val maxAttempts = 100 // 100 * 50ms = 5s
            val pollRunnable = object : Runnable {
                override fun run() {
                    if (AudioPlaybackService.instance != null) {
                        Log.d(TAG, "Service ready after ${attempts * 50}ms")
                        promise.resolve(true)
                    } else if (++attempts >= maxAttempts) {
                        Log.e(TAG, "Service did not start after 5s")
                        promise.reject("INIT_ERROR", "Service did not start in time")
                    } else {
                        mainHandler.postDelayed(this, 50)
                    }
                }
            }
            mainHandler.postDelayed(pollRunnable, 50)
        } catch (e: Exception) {
            Log.e(TAG, "Initialize failed", e)
            promise.reject("INIT_ERROR", e.message, e)
        }
    }

    /**
     * Load tracks into ExoPlayer.
     *
     * @param tracksArray Array of track objects with url, title, startOffset, duration
     * @param startIndex Which track to start with
     * @param startPositionMs Position within that track (milliseconds)
     * @param autoPlay Whether to start playing immediately
     */
    @ReactMethod
    fun loadTracks(tracksArray: ReadableArray, startIndex: Int, startPositionMs: Double, autoPlay: Boolean, promise: Promise) {
        // Parse tracks on the calling thread (ReadableArray is not thread-safe)
        val trackInfos = mutableListOf<AudioPlaybackService.TrackInfo>()
        try {
            for (i in 0 until tracksArray.size()) {
                val trackMap = tracksArray.getMap(i) ?: continue
                trackInfos.add(AudioPlaybackService.TrackInfo(
                    url = trackMap.getString("url") ?: "",
                    title = trackMap.getString("title") ?: "Track ${i + 1}",
                    startOffset = trackMap.getDouble("startOffset"),
                    duration = trackMap.getDouble("duration")
                ))
            }
        } catch (e: Exception) {
            Log.e(TAG, "loadTracks parse failed", e)
            promise.reject("LOAD_ERROR", e.message, e)
            return
        }

        // Dispatch to main thread, waiting for service if needed
        ensureServiceThen(promise) { service ->
            try {
                service.loadTracks(trackInfos, startIndex, startPositionMs.toLong(), autoPlay) { success, errorMsg ->
                    // This callback fires when ExoPlayer reaches STATE_READY, errors, or times out
                    if (success) {
                        Log.d(TAG, "loadTracks prepare complete — audio ready")
                        promise.resolve(true)
                    } else {
                        Log.e(TAG, "loadTracks prepare failed: $errorMsg")
                        promise.reject("LOAD_ERROR", errorMsg ?: "Failed to load audio")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "loadTracks failed", e)
                promise.reject("LOAD_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun play() {
        mainHandler.post { AudioPlaybackService.instance?.play() }
    }

    @ReactMethod
    fun pause() {
        mainHandler.post { AudioPlaybackService.instance?.pause() }
    }

    /**
     * Seek to global position in seconds.
     */
    @ReactMethod
    fun seekTo(positionSec: Double) {
        mainHandler.post { AudioPlaybackService.instance?.seekTo(positionSec) }
    }

    @ReactMethod
    fun setRate(rate: Double) {
        mainHandler.post { AudioPlaybackService.instance?.setRate(rate.toFloat()) }
    }

    @ReactMethod
    fun setVolume(volume: Double) {
        mainHandler.post { AudioPlaybackService.instance?.setVolume(volume.toFloat()) }
    }

    /**
     * Update metadata for notification/lock screen display.
     */
    @ReactMethod
    fun setMetadata(title: String, author: String, artworkUrl: String?, chapterTitle: String?) {
        mainHandler.post { AudioPlaybackService.instance?.setMetadata(title, author, artworkUrl, chapterTitle) }
    }

    /**
     * Get current playback state synchronously.
     */
    @ReactMethod
    fun getCurrentState(promise: Promise) {
        mainHandler.post {
            try {
                val service = AudioPlaybackService.instance
                if (service == null) {
                    val map = Arguments.createMap().apply {
                        putBoolean("isPlaying", false)
                        putDouble("position", 0.0)
                        putDouble("duration", 0.0)
                        putBoolean("isBuffering", false)
                        putBoolean("didJustFinish", false)
                    }
                    promise.resolve(map)
                    return@post
                }

                val state = service.getCurrentState()
                val map = Arguments.createMap().apply {
                    putBoolean("isPlaying", state.getBoolean("isPlaying"))
                    putDouble("position", state.getDouble("position"))
                    putDouble("duration", state.getDouble("duration"))
                    putBoolean("isBuffering", state.getBoolean("isBuffering"))
                    putBoolean("didJustFinish", state.getBoolean("didJustFinish"))
                }
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("STATE_ERROR", e.message, e)
            }
        }
    }

    /**
     * Clean up ExoPlayer and release resources.
     */
    @ReactMethod
    fun cleanup(promise: Promise) {
        mainHandler.post {
            try {
                AudioPlaybackService.instance?.cleanup()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CLEANUP_ERROR", e.message, e)
            }
        }
    }

    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "EVENT_PLAYBACK_STATE" to EVENT_PLAYBACK_STATE,
            "EVENT_TRACK_CHANGE" to EVENT_TRACK_CHANGE,
            "EVENT_ERROR" to EVENT_ERROR,
            "EVENT_BOOK_END" to EVENT_BOOK_END,
            "EVENT_REMOTE_COMMAND" to EVENT_REMOTE_COMMAND
        )
    }

    @ReactMethod
    fun addListener(eventName: String) {
        Log.d(TAG, "addListener: $eventName")
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        Log.d(TAG, "removeListeners: $count")
    }
}
