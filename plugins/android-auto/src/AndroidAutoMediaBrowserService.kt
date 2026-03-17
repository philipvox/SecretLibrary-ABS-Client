package com.secretlibrary.app.automotive

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.media.MediaBrowserServiceCompat
import com.secretlibrary.app.exoplayer.AudioPlaybackService
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * MediaBrowserService for Android Auto integration.
 *
 * This service:
 * 1. Reads browse data from JSON file written by React Native
 * 2. Populates the media tree for Android Auto browsing
 * 3. Shares MediaSession from AudioPlaybackService (ExoPlayer)
 *    — NO own MediaSession, NO playback state management, NO audio focus fighting
 * 4. Emits browse commands back to React Native via AndroidAutoModule
 * 5. Uses setIconUri() for browse item covers (Android Auto handles loading natively)
 */
class AndroidAutoMediaBrowserService : MediaBrowserServiceCompat() {

    companion object {
        private const val TAG = "AndroidAutoService"
        private const val MEDIA_ROOT_ID = "secret_library_media_root"
        private const val BROWSE_DATA_FILE = "android_auto_browse.json"

        // Media ID prefixes for routing
        const val PREFIX_SECTION = "section:"
        const val PREFIX_ITEM = "item:"
        const val PREFIX_SEARCH = "search:"  // For search results

        // Custom extras keys for progress
        const val EXTRA_PROGRESS = "com.secretlibrary.PROGRESS"
        const val EXTRA_DURATION_MS = "com.secretlibrary.DURATION_MS"

        // Android Auto content style hints (for grid vs list display)
        const val CONTENT_STYLE_SUPPORTED = "android.media.browse.CONTENT_STYLE_SUPPORTED"
        const val CONTENT_STYLE_BROWSABLE_HINT = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT"
        const val CONTENT_STYLE_PLAYABLE_HINT = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT"
        const val CONTENT_STYLE_LIST_ITEM_HINT_VALUE = 1
        const val CONTENT_STYLE_GRID_ITEM_HINT_VALUE = 2

        // Playback completion status for progress indicator
        const val DESCRIPTION_EXTRAS_KEY_COMPLETION_STATUS = "android.media.extra.PLAYBACK_STATUS"
        const val DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_NOT_PLAYED = 0
        const val DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_PARTIALLY_PLAYED = 1
        const val DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_FULLY_PLAYED = 2

        // Progress percentage (0-100)
        const val DESCRIPTION_EXTRAS_KEY_COMPLETION_PERCENTAGE = "android.media.extra.MEDIA_PROGRESS"

        // Instance reference for module communication
        @Volatile
        var instance: AndroidAutoMediaBrowserService? = null
            private set
    }

    // NO own MediaSession — we share the one from AudioPlaybackService
    private var browseData: JSONArray? = null

    // Coroutine scope for async operations
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.d(TAG, "AndroidAutoMediaBrowserService created")

        // Get MediaSession token from ExoPlayer's AudioPlaybackService
        // If ExoPlayer hasn't initialized yet, we'll retry in onGetRoot
        val exoSession = AudioPlaybackService.instance?.mediaSession
        if (exoSession != null) {
            sessionToken = exoSession.sessionToken
            Log.d(TAG, "Using ExoPlayer's MediaSession token")
        } else {
            Log.w(TAG, "ExoPlayer not initialized yet — will retry on onGetRoot")
        }

        // Load initial browse data
        loadBrowseData()
    }

    override fun onDestroy() {
        instance = null
        serviceScope.cancel()
        super.onDestroy()
        Log.d(TAG, "AndroidAutoMediaBrowserService destroyed")
    }

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot {
        Log.d(TAG, "onGetRoot called by: $clientPackageName")

        // Try to grab ExoPlayer's MediaSession token immediately (non-blocking).
        // If ExoPlayer hasn't initialized yet, onLoadChildren will retry.
        // NEVER block the binder thread here — Thread.sleep causes ANR.
        if (sessionToken == null) {
            val exoSession = AudioPlaybackService.instance?.mediaSession
            if (exoSession != null) {
                sessionToken = exoSession.sessionToken
                Log.d(TAG, "Got ExoPlayer's MediaSession token in onGetRoot")
            } else {
                Log.w(TAG, "ExoPlayer not initialized yet — will set session token when available")
            }
        }

        // Refresh browse data on connection
        loadBrowseData()

        // Notify JS that Android Auto (re)connected — forces metadata re-sync
        AndroidAutoModule.emitCommand("connected", null)

        // Return content style hints for grid/list display
        val extras = Bundle().apply {
            putBoolean(CONTENT_STYLE_SUPPORTED, true)
            putInt(CONTENT_STYLE_BROWSABLE_HINT, CONTENT_STYLE_LIST_ITEM_HINT_VALUE)
            putInt(CONTENT_STYLE_PLAYABLE_HINT, CONTENT_STYLE_GRID_ITEM_HINT_VALUE)
        }

        return BrowserRoot(MEDIA_ROOT_ID, extras)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        Log.d(TAG, "onLoadChildren: $parentId")

        // Lazily set session token if ExoPlayer became ready after onGetRoot
        if (sessionToken == null) {
            val exoSession = AudioPlaybackService.instance?.mediaSession
            if (exoSession != null) {
                sessionToken = exoSession.sessionToken
                Log.d(TAG, "Got ExoPlayer's MediaSession token in onLoadChildren")
            }
        }

        // Detach result so we can load async
        result.detach()

        serviceScope.launch {
            val items = try {
                loadChildrenAsync(parentId)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load children for $parentId", e)
                mutableListOf()
            }
            try {
                result.sendResult(items)
            } catch (e: IllegalStateException) {
                Log.w(TAG, "sendResult failed (framework timeout?): ${e.message}")
            }
        }
    }

    private fun loadChildrenAsync(parentId: String): MutableList<MediaBrowserCompat.MediaItem> {
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()

        when {
            parentId == MEDIA_ROOT_ID -> {
                // Root level: return sections
                browseData?.let { sections ->
                    for (i in 0 until sections.length()) {
                        val section = sections.getJSONObject(i)
                        val sectionId = section.getString("id")
                        val sectionTitle = section.getString("title")
                        val itemCount = section.optJSONArray("items")?.length() ?: 0

                        val description = MediaDescriptionCompat.Builder()
                            .setMediaId("$PREFIX_SECTION$sectionId")
                            .setTitle(sectionTitle)
                            .setSubtitle("$itemCount items")
                            .build()

                        items.add(MediaBrowserCompat.MediaItem(
                            description,
                            MediaBrowserCompat.MediaItem.FLAG_BROWSABLE
                        ))
                    }
                }
            }
            parentId.startsWith(PREFIX_SECTION) -> {
                // Section level: return items in that section with cover art
                val sectionId = parentId.removePrefix(PREFIX_SECTION)
                browseData?.let { sections ->
                    for (i in 0 until sections.length()) {
                        val section = sections.getJSONObject(i)
                        if (section.getString("id") == sectionId) {
                            val sectionItems = section.getJSONArray("items")

                            for (j in 0 until sectionItems.length()) {
                                val item = sectionItems.getJSONObject(j)
                                items.add(createMediaItemWithArt(item))
                            }
                            break
                        }
                    }
                }
            }
        }

        Log.d(TAG, "Returning ${items.size} items for $parentId")
        return items
    }

    /**
     * Create a media item with cover art URI.
     * Uses setIconUri() so Android Auto handles image loading natively —
     * no Glide, no bitmap cache, no auth token staleness issues.
     */
    private fun createMediaItemWithArt(item: JSONObject): MediaBrowserCompat.MediaItem {
        val id = item.getString("id")
        val title = item.getString("title")
        val subtitle = item.optString("subtitle", "")
        val imageUrl: String? = if (item.has("imageUrl") && !item.isNull("imageUrl")) item.getString("imageUrl") else null
        val isPlayable = item.optBoolean("isPlayable", true)
        val isBrowsable = item.optBoolean("isBrowsable", false)
        val progress = item.optDouble("progress", 0.0)
        val durationMs = item.optLong("durationMs", 0L)

        val descriptionBuilder = MediaDescriptionCompat.Builder()
            .setMediaId("$PREFIX_ITEM$id")
            .setTitle(title)
            .setSubtitle(subtitle)

        // Set cover art URI — Android Auto framework handles loading and caching
        if (!imageUrl.isNullOrEmpty()) {
            descriptionBuilder.setIconUri(Uri.parse(imageUrl))
        }

        // Add progress and duration as extras with Android Auto progress indicator support
        val extras = Bundle().apply {
            putDouble(EXTRA_PROGRESS, progress)
            putLong(EXTRA_DURATION_MS, durationMs)

            val completionStatus = when {
                progress >= 0.95 -> DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_FULLY_PLAYED
                progress > 0.0 -> DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_PARTIALLY_PLAYED
                else -> DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_NOT_PLAYED
            }
            putInt(DESCRIPTION_EXTRAS_KEY_COMPLETION_STATUS, completionStatus)

            if (progress > 0.0 && progress < 1.0) {
                putDouble(DESCRIPTION_EXTRAS_KEY_COMPLETION_PERCENTAGE, progress)
            }
        }
        descriptionBuilder.setExtras(extras)

        val description = descriptionBuilder.build()

        var flags = 0
        if (isPlayable) flags = flags or MediaBrowserCompat.MediaItem.FLAG_PLAYABLE
        if (isBrowsable) flags = flags or MediaBrowserCompat.MediaItem.FLAG_BROWSABLE

        return MediaBrowserCompat.MediaItem(description, flags)
    }

    private fun loadBrowseData() {
        try {
            val file = File(filesDir, BROWSE_DATA_FILE)
            if (file.exists()) {
                val content = file.readText()
                browseData = JSONArray(content)
                Log.d(TAG, "Loaded browse data: ${browseData?.length()} sections")
            } else {
                Log.d(TAG, "Browse data file not found, using empty data")
                browseData = JSONArray()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading browse data", e)
            browseData = JSONArray()
        }
    }

    /**
     * Notify that browse data has been updated - triggers refresh in Android Auto.
     */
    fun notifyBrowseDataChanged() {
        loadBrowseData()
        notifyChildrenChanged(MEDIA_ROOT_ID)
        browseData?.let { sections ->
            for (i in 0 until sections.length()) {
                val section = sections.getJSONObject(i)
                val sectionId = section.getString("id")
                notifyChildrenChanged("$PREFIX_SECTION$sectionId")
            }
        }
    }
}
