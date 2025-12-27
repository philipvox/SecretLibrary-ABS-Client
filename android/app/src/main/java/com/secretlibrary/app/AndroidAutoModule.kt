package com.secretlibrary.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native native module for Android Auto integration.
 *
 * This module bridges the MediaPlaybackService with the React Native layer,
 * allowing the JS code to receive playback commands from Android Auto.
 */
class AndroidAutoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        private const val TAG = "AndroidAutoModule"
        private const val MODULE_NAME = "AndroidAutoModule"
        private const val EVENT_PLAY_ITEM = "androidAutoPlayItem"
        private const val EVENT_CONNECTION_CHANGED = "androidAutoConnectionChanged"
    }

    private var receiver: BroadcastReceiver? = null

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        Log.d(TAG, "AndroidAutoModule initialized")
        registerReceiver()
    }

    override fun invalidate() {
        unregisterReceiver()
        super.invalidate()
    }

    private fun registerReceiver() {
        if (receiver != null) return

        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                intent?.let { handleBroadcast(it) }
            }
        }

        val filter = IntentFilter("com.secretlibrary.app.ANDROID_AUTO_EVENT")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactApplicationContext.registerReceiver(
                receiver,
                filter,
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            reactApplicationContext.registerReceiver(receiver, filter)
        }

        Log.d(TAG, "Broadcast receiver registered")
    }

    private fun unregisterReceiver() {
        receiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering receiver", e)
            }
            receiver = null
        }
    }

    private fun handleBroadcast(intent: Intent) {
        val action = intent.getStringExtra("action") ?: return
        val data = intent.getStringExtra("data")

        Log.d(TAG, "Received broadcast: action=$action, data=$data")

        when (action) {
            "playItem" -> {
                data?.let { itemId ->
                    sendEvent(EVENT_PLAY_ITEM, Arguments.createMap().apply {
                        putString("itemId", itemId)
                    })
                }
            }
            "play" -> sendEvent("androidAutoPlay", null)
            "pause" -> sendEvent("androidAutoPause", null)
            "skipToNext" -> sendEvent("androidAutoSkipToNext", null)
            "skipToPrevious" -> sendEvent("androidAutoSkipToPrevious", null)
            "seekTo" -> {
                data?.let { position ->
                    sendEvent("androidAutoSeekTo", Arguments.createMap().apply {
                        putDouble("position", position.toLongOrNull()?.toDouble() ?: 0.0)
                    })
                }
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (!reactApplicationContext.hasActiveReactInstance()) {
            Log.w(TAG, "No active React instance, cannot send event: $eventName")
            return
        }

        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params ?: Arguments.createMap())
    }

    /**
     * Called from JS to update playback state
     */
    @ReactMethod
    fun updatePlaybackState(isPlaying: Boolean, position: Double, speed: Double) {
        Log.d(TAG, "updatePlaybackState: isPlaying=$isPlaying, position=$position, speed=$speed")

        // Note: In a full implementation, we would communicate with the MediaPlaybackService
        // For now, this is a placeholder as the service manages its own MediaSession
    }

    /**
     * Called from JS to update now playing metadata
     */
    @ReactMethod
    fun updateMetadata(title: String, author: String, duration: Double, artworkUrl: String?) {
        Log.d(TAG, "updateMetadata: title=$title, author=$author, duration=$duration")

        // Note: In a full implementation, we would communicate with the MediaPlaybackService
        // For now, this is a placeholder as the service manages its own MediaSession
    }

    /**
     * Check if Android Auto is connected
     */
    @ReactMethod
    fun isConnected(promise: Promise) {
        // Android Auto connection detection is complex and requires
        // listening to UiModeManager changes. For now, return false
        // as the primary integration is through MediaBrowserService.
        promise.resolve(false)
    }

    /**
     * Refresh the browse tree (e.g., after library update)
     */
    @ReactMethod
    fun refreshBrowseTree() {
        Log.d(TAG, "refreshBrowseTree called")
        // The MediaPlaybackService will re-read the JSON file on next onLoadChildren call
        // No explicit action needed here as Android Auto requests data on demand
    }

    /**
     * Required by NativeEventEmitter - called when a listener is added
     */
    @ReactMethod
    fun addListener(eventType: String) {
        Log.d(TAG, "addListener: $eventType")
        // No-op: required for NativeEventEmitter compatibility
    }

    /**
     * Required by NativeEventEmitter - called when listeners are removed
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        Log.d(TAG, "removeListeners: $count")
        // No-op: required for NativeEventEmitter compatibility
    }

    // Lifecycle callbacks
    override fun onHostResume() {
        Log.d(TAG, "onHostResume")
    }

    override fun onHostPause() {
        Log.d(TAG, "onHostPause")
    }

    override fun onHostDestroy() {
        Log.d(TAG, "onHostDestroy")
        unregisterReceiver()
    }
}
