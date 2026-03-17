package com.secretlibrary.app.automotive

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

/**
 * React Native native module for Android Auto integration.
 *
 * This module:
 * 1. Receives commands from the MediaBrowserService and emits them to JS
 * 2. Manages the browse data file that the service reads
 *
 * Playback state and metadata are now managed by ExoPlayer's AudioPlaybackService.
 * This module no longer calls updatePlaybackState() or updateMetadata() — those
 * operations caused audio focus fighting and are no longer needed.
 */
class AndroidAutoModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AndroidAutoModule"
        private const val EVENT_NAME = "AndroidAutoCommand"
        private const val BROWSE_DATA_FILE = "android_auto_browse.json"
        private const val MAX_RETRY_ATTEMPTS = 30
        private const val RETRY_DELAY_MS = 200L

        @Volatile
        private var moduleInstance: AndroidAutoModule? = null

        private val mainHandler = Handler(Looper.getMainLooper())

        /**
         * Called by MediaBrowserService to emit commands to JavaScript.
         */
        fun emitCommand(command: String, param: String?) {
            emitCommandWithRetry(command, param, 0)
        }

        private fun emitCommandWithRetry(command: String, param: String?, attempt: Int) {
            val instance = moduleInstance
            if (instance != null && instance.tryEmitEvent(command, param)) {
                Log.d(TAG, "Command emitted successfully: $command (attempt $attempt)")
                return
            }

            if (attempt < MAX_RETRY_ATTEMPTS) {
                Log.w(TAG, "React context not ready, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/$MAX_RETRY_ATTEMPTS)")
                mainHandler.postDelayed({
                    emitCommandWithRetry(command, param, attempt + 1)
                }, RETRY_DELAY_MS)
            } else {
                Log.e(TAG, "Failed to emit command after $MAX_RETRY_ATTEMPTS attempts: $command")
            }
        }
    }

    init {
        moduleInstance = this
        Log.d(TAG, "AndroidAutoModule initialized, instance set")
    }

    override fun getName(): String = "AndroidAutoModule"

    override fun invalidate() {
        Log.d(TAG, "AndroidAutoModule invalidated")
        if (moduleInstance === this) {
            moduleInstance = null
        }
        super.invalidate()
    }

    private fun tryEmitEvent(command: String, param: String?): Boolean {
        if (!reactContext.hasActiveReactInstance()) {
            Log.w(TAG, "React context not active")
            return false
        }

        val eventData = Arguments.createMap().apply {
            putString("command", command)
            if (param != null) {
                putString("param", param)
            }
        }

        return try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_NAME, eventData)
            Log.d(TAG, "Emitted event: $command, param: $param")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting event", e)
            false
        }
    }

    /**
     * updatePlaybackState — DEPRECATED.
     * ExoPlayer's AudioPlaybackService now owns the MediaSession and updates state natively.
     * This method is kept as a no-op so existing JS callers don't crash.
     */
    @ReactMethod
    fun updatePlaybackState(isPlaying: Boolean, position: Double, speed: Double) {
        // No-op — ExoPlayer handles MediaSession state natively.
        // Keeping this method prevents crashes from automotiveService.ts calls
        // that haven't been removed yet.
        Log.d(TAG, "updatePlaybackState called (no-op, ExoPlayer handles this)")
    }

    /**
     * updateMetadata — DEPRECATED.
     * ExoPlayer's AudioPlaybackService now owns metadata via setMetadata().
     */
    @ReactMethod
    fun updateMetadata(title: String, author: String, duration: Double, artworkUrl: String?) {
        // No-op — ExoPlayer handles metadata natively.
        Log.d(TAG, "updateMetadata called (no-op, ExoPlayer handles this)")
    }

    /**
     * updateMetadataExtended — DEPRECATED.
     * ExoPlayer's AudioPlaybackService now owns metadata via setMetadata().
     */
    @ReactMethod
    fun updateMetadataExtended(
        title: String,
        author: String,
        duration: Double,
        artworkUrl: String?,
        chapterTitle: String?,
        seriesName: String?,
        speed: Double,
        progress: Double
    ) {
        // No-op — ExoPlayer handles metadata natively.
        Log.d(TAG, "updateMetadataExtended called (no-op, ExoPlayer handles this)")
    }

    /**
     * Notify that browse data has been updated
     */
    @ReactMethod
    fun notifyBrowseDataUpdated() {
        AndroidAutoMediaBrowserService.instance?.notifyBrowseDataChanged()
        Log.d(TAG, "Browse data update notified")
    }

    /**
     * Write browse data to file for service to read
     */
    @ReactMethod
    fun writeBrowseData(jsonData: String, promise: Promise) {
        try {
            val file = File(reactContext.filesDir, BROWSE_DATA_FILE)
            file.writeText(jsonData)
            Log.d(TAG, "Browse data written to file: ${jsonData.length} chars")

            AndroidAutoMediaBrowserService.instance?.notifyBrowseDataChanged()

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error writing browse data", e)
            promise.reject("WRITE_ERROR", e.message, e)
        }
    }

    /**
     * Check if Android Auto is connected
     */
    @ReactMethod
    fun isConnected(promise: Promise) {
        val connected = AndroidAutoMediaBrowserService.instance != null
        promise.resolve(connected)
    }

    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "EVENT_NAME" to EVENT_NAME
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
