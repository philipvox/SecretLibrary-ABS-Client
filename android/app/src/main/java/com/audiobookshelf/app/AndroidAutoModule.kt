package com.audiobookshelf.app

import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Native module for Android Auto communication with React Native.
 *
 * Provides:
 * - Event emission for play requests from Android Auto
 * - Methods to check Android Auto connection status
 */
class AndroidAutoModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AndroidAutoModule"
        const val NAME = "AndroidAutoModule"

        // Event names
        const val EVENT_PLAY_ITEM = "androidAutoPlayItem"
        const val EVENT_CONNECTION_CHANGED = "androidAutoConnectionChanged"

        // Singleton instance for MediaPlaybackService to use
        private var instance: AndroidAutoModule? = null

        fun getInstance(): AndroidAutoModule? = instance
    }

    init {
        instance = this
    }

    override fun getName(): String = NAME

    /**
     * Send a play item event to React Native
     * Called by MediaPlaybackService when user selects an item in Android Auto
     */
    fun emitPlayItemEvent(itemId: String) {
        Log.d(TAG, "Emitting play item event for: $itemId")

        try {
            val params = Arguments.createMap().apply {
                putString("itemId", itemId)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(EVENT_PLAY_ITEM, params)

            Log.d(TAG, "Play item event emitted successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit play item event: ${e.message}", e)
        }
    }

    /**
     * Send connection state change event to React Native
     */
    fun emitConnectionChanged(isConnected: Boolean) {
        Log.d(TAG, "Emitting connection changed: $isConnected")

        try {
            val params = Arguments.createMap().apply {
                putBoolean("isConnected", isConnected)
                putString("platform", "android_auto")
            }

            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(EVENT_CONNECTION_CHANGED, params)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit connection event: ${e.message}", e)
        }
    }

    /**
     * Check if React Native bridge is ready
     */
    @ReactMethod
    fun isReady(promise: Promise) {
        promise.resolve(true)
    }

    /**
     * Force refresh of browse data (called from React Native)
     */
    @ReactMethod
    fun refreshBrowseData(promise: Promise) {
        Log.d(TAG, "Refresh browse data requested")
        // The automotiveService will handle updating the JSON file
        promise.resolve(true)
    }

    /**
     * Required for RN event emitter
     */
    @ReactMethod
    fun addListener(eventName: String) {
        Log.d(TAG, "Added listener for: $eventName")
    }

    /**
     * Required for RN event emitter
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        Log.d(TAG, "Removed $count listeners")
    }
}
