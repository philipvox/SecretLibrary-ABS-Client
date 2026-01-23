package com.secretlibrary.app.automotive

import android.os.Handler
import android.os.Looper
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

/**
 * React Native native module for Android Auto integration.
 *
 * This module:
 * 1. Receives commands from the MediaBrowserService and emits them to JS
 * 2. Receives state updates from JS and updates the MediaSession
 * 3. Manages the browse data file that the service reads
 */
class AndroidAutoModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AndroidAutoModule"
        private const val EVENT_NAME = "AndroidAutoCommand"
        private const val BROWSE_DATA_FILE = "android_auto_browse.json"
        private const val MAX_RETRY_ATTEMPTS = 5
        private const val RETRY_DELAY_MS = 500L

        // Static reference for service to emit events
        // Note: This can become stale if React Native creates a new context
        @Volatile
        private var moduleInstance: AndroidAutoModule? = null

        // Handler for retry logic
        private val mainHandler = Handler(Looper.getMainLooper())

        /**
         * Called by MediaBrowserService to emit commands to JavaScript.
         * Includes retry logic for when React context isn't ready yet.
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

            // Retry if we haven't exceeded max attempts
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
        // Only clear if we're the current instance
        if (moduleInstance === this) {
            moduleInstance = null
        }
        super.invalidate()
    }

    /**
     * Try to send event to JavaScript.
     * Returns true if successful, false if React context not ready.
     */
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
     * Update playback state in MediaSession
     */
    @ReactMethod
    fun updatePlaybackState(isPlaying: Boolean, position: Double, speed: Double) {
        val state = if (isPlaying) {
            PlaybackStateCompat.STATE_PLAYING
        } else {
            PlaybackStateCompat.STATE_PAUSED
        }

        AndroidAutoMediaBrowserService.instance?.updatePlaybackState(
            state,
            (position * 1000).toLong(), // Convert seconds to ms
            speed.toFloat()
        )
        Log.d(TAG, "Updated playback state: playing=$isPlaying, pos=$position, speed=$speed")
    }

    /**
     * Update metadata in MediaSession
     */
    @ReactMethod
    fun updateMetadata(title: String, author: String, duration: Double, artworkUrl: String?) {
        AndroidAutoMediaBrowserService.instance?.updateMetadata(
            title,
            author,
            (duration * 1000).toLong(), // Convert seconds to ms
            artworkUrl
        )
        Log.d(TAG, "Updated metadata: $title by $author")
    }

    /**
     * Notify that browse data has been updated
     * Called after React Native writes the JSON file
     */
    @ReactMethod
    fun notifyBrowseDataUpdated() {
        AndroidAutoMediaBrowserService.instance?.notifyBrowseDataChanged()
        Log.d(TAG, "Browse data update notified")
    }

    /**
     * Write browse data to file for service to read
     * This is called from the androidAutoBridge.ts
     */
    @ReactMethod
    fun writeBrowseData(jsonData: String, promise: Promise) {
        try {
            val file = File(reactContext.filesDir, BROWSE_DATA_FILE)
            file.writeText(jsonData)
            Log.d(TAG, "Browse data written to file: ${jsonData.length} chars")

            // Notify service of update
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

    /**
     * Get constants exposed to JavaScript
     */
    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "EVENT_NAME" to EVENT_NAME
        )
    }

    /**
     * Add listener (required for NativeEventEmitter)
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN NativeEventEmitter
        Log.d(TAG, "addListener: $eventName")
    }

    /**
     * Remove listeners (required for NativeEventEmitter)
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN NativeEventEmitter
        Log.d(TAG, "removeListeners: $count")
    }
}
