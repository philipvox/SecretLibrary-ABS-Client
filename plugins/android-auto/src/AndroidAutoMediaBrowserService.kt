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

        // Retry constants for browse data polling
        private const val BROWSE_DATA_POLL_INTERVAL_MS = 1000L
        private const val BROWSE_DATA_POLL_MAX_ATTEMPTS = 120  // 120 seconds total

        // Instance reference for module communication
        @Volatile
        var instance: AndroidAutoMediaBrowserService? = null
            private set
    }

    // NO own MediaSession — we share the one from AudioPlaybackService
    // @Volatile: these fields are accessed from binder thread (onLoadChildren),
    // Main dispatcher (polling coroutine), and RN bridge thread (notifyBrowseDataChanged)
    @Volatile private var browseData: JSONArray? = null
    @Volatile private var browseDataLoaded = false  // true once we have non-empty data
    @Volatile private var isPollingForData = false  // prevents duplicate poll loops
    @Volatile private var hasPolledOnce = false     // true after first polling cycle completes

    // Coroutine scope for async operations
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.d(TAG, "AndroidAutoMediaBrowserService created")

        // Get MediaSession token from ExoPlayer's AudioPlaybackService
        // If ExoPlayer hasn't initialized yet, we'll retry in onGetRoot
        trySetSessionToken()

        // Load initial browse data (may exist from previous session)
        loadBrowseData()

        // Persistent retry for session token — runs independently of browse data polling.
        // ExoPlayer may start well after the browse data arrives, so we keep trying
        // every 2 seconds until we have it or the service is destroyed.
        if (sessionToken == null) {
            serviceScope.launch {
                for (attempt in 1..60) { // Up to 120 seconds
                    delay(2000)
                    trySetSessionToken()
                    if (sessionToken != null) {
                        Log.d(TAG, "Session token acquired after ${attempt * 2}s of retrying")
                        break
                    }
                }
                if (sessionToken == null) {
                    Log.w(TAG, "Session token still null after 120s — playback controls may not work")
                }
            }
        }

        // On cold start, Android Auto only starts this service — React Native
        // doesn't boot automatically. Launch the main activity so JS can write
        // fresh browse data and initialize ExoPlayer for playback.
        if (!hasBrowseData() || sessionToken == null) {
            launchMainApp()
        }
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

        // Try to grab ExoPlayer's MediaSession token
        trySetSessionToken()

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
        trySetSessionToken()

        // If we already have browse data, serve it immediately
        if (hasBrowseData()) {
            val items = try {
                loadChildrenAsync(parentId)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load children for $parentId", e)
                mutableListOf()
            }
            result.sendResult(items)
            return
        }

        // No data yet — return a placeholder immediately so Android Auto
        // doesn't hang. A background poll will call notifyChildrenChanged when data arrives.
        if (parentId == MEDIA_ROOT_ID) {
            val placeholder = if (isPollingForData || !hasPolledOnce) {
                // Still waiting for data — show loading
                Log.d(TAG, "No browse data yet — returning loading placeholder, starting background poll")
                MediaBrowserCompat.MediaItem(
                    MediaDescriptionCompat.Builder()
                        .setMediaId("loading")
                        .setTitle("Loading library...")
                        .setSubtitle("Please wait")
                        .build(),
                    MediaBrowserCompat.MediaItem.FLAG_PLAYABLE // Not browsable — prevents empty drill-down
                )
            } else {
                // Polling completed but no data — user not signed in
                Log.d(TAG, "No browse data after polling — showing sign-in prompt")
                MediaBrowserCompat.MediaItem(
                    MediaDescriptionCompat.Builder()
                        .setMediaId("sign_in")
                        .setTitle("Open Secret Library to get started")
                        .setSubtitle("Sign in to your server to browse audiobooks")
                        .build(),
                    MediaBrowserCompat.MediaItem.FLAG_PLAYABLE // Not browsable — prevents empty drill-down
                )
            }
            result.sendResult(mutableListOf(placeholder))

            // Start background polling — when data arrives, notify Android Auto to refresh
            if (!isPollingForData) {
                isPollingForData = true
                serviceScope.launch {
                    waitForBrowseData()
                    isPollingForData = false
                    hasPolledOnce = true
                    if (hasBrowseData()) {
                        notifyChildrenChanged(MEDIA_ROOT_ID)
                    } else {
                        // Polling timed out — show sign-in prompt instead of empty list
                        notifyChildrenChanged(MEDIA_ROOT_ID)
                    }
                }
            }
            return
        }

        // Non-root request with no data — return empty
        result.sendResult(mutableListOf())
    }

    /**
     * Launch the main app activity so React Native boots and writes browse data.
     * Uses the package manager's launch intent so it works regardless of activity name.
     * Won't bring the app to the foreground if it's already running.
     */
    private fun launchMainApp() {
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                // Don't bring to foreground — just ensure the process starts
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                startActivity(launchIntent)
                Log.d(TAG, "Launched main app for cold start initialization")
            } else {
                Log.w(TAG, "Could not find launch intent for $packageName")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch main app", e)
        }
    }

    /**
     * Try to set the MediaSession token from ExoPlayer.
     * Safe to call multiple times — only sets once.
     */
    private fun trySetSessionToken() {
        if (sessionToken != null) return
        val exoSession = AudioPlaybackService.instance?.mediaSession
        if (exoSession != null) {
            sessionToken = exoSession.sessionToken
            Log.d(TAG, "Got ExoPlayer's MediaSession token")
        } else {
            Log.w(TAG, "ExoPlayer not initialized yet — will retry")
        }
    }

    /**
     * Check if we have non-empty browse data.
     * Thread-safe: captures @Volatile field in local val to avoid TOCTOU race.
     */
    private fun hasBrowseData(): Boolean {
        val data = browseData  // snapshot volatile field
        return browseDataLoaded && data != null && data.length() > 0
    }

    /**
     * Poll for browse data file with exponential backoff.
     * Called when onLoadChildren fires before JS has written the browse data file.
     * Blocks the coroutine (not the main thread) until data arrives or timeout.
     */
    private suspend fun waitForBrowseData() {
        for (attempt in 1..BROWSE_DATA_POLL_MAX_ATTEMPTS) {
            delay(BROWSE_DATA_POLL_INTERVAL_MS)
            loadBrowseData()
            if (hasBrowseData()) {
                Log.d(TAG, "Browse data arrived after ${attempt * BROWSE_DATA_POLL_INTERVAL_MS}ms")
                return
            }
            // Also retry session token while waiting
            trySetSessionToken()
        }
        Log.w(TAG, "Browse data still empty after polling — Android Auto will show empty list")
    }

    private fun loadChildrenAsync(parentId: String): MutableList<MediaBrowserCompat.MediaItem> {
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()
        // Snapshot volatile field once — all reads in this method use the same reference,
        // preventing TOCTOU crashes if another thread updates browseData mid-iteration.
        val sections = browseData ?: return items

        when {
            parentId == MEDIA_ROOT_ID -> {
                // Root level: return sections
                for (i in 0 until sections.length()) {
                    try {
                        val section = sections.getJSONObject(i)
                        val sectionId = section.optString("id", "unknown")
                        val sectionTitle = section.optString("title", "")
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
                    } catch (e: Exception) {
                        Log.e(TAG, "Skipping malformed section at index $i", e)
                    }
                }
            }
            parentId.startsWith(PREFIX_SECTION) -> {
                // Section level: return items in that section with cover art
                val sectionId = parentId.removePrefix(PREFIX_SECTION)
                for (i in 0 until sections.length()) {
                    try {
                        val section = sections.getJSONObject(i)
                        if (section.optString("id") == sectionId) {
                            val sectionItems = section.optJSONArray("items") ?: break
                            for (j in 0 until sectionItems.length()) {
                                try {
                                    val item = sectionItems.getJSONObject(j)
                                    items.add(createMediaItemWithArt(item))
                                } catch (e: Exception) {
                                    Log.e(TAG, "Skipping malformed item at index $j in section $sectionId", e)
                                }
                            }
                            break
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error reading section at index $i", e)
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
            // Try file first (written by JS via AndroidAutoModule)
            val file = File(filesDir, BROWSE_DATA_FILE)
            if (file.exists()) {
                val content = file.readText()
                val data = JSONArray(content)
                browseData = data
                browseDataLoaded = data.length() > 0
                if (browseDataLoaded) {
                    // Cache in SharedPreferences for instant read on next cold start
                    getSharedPreferences("android_auto", MODE_PRIVATE)
                        .edit().putString("browse_cache", content).apply()
                    Log.d(TAG, "Loaded browse data from file: ${data.length()} sections")
                    return
                }
            }

            // Fallback: read from SharedPreferences (instant, survives file deletion)
            val cached = getSharedPreferences("android_auto", MODE_PRIVATE)
                .getString("browse_cache", null)
            if (cached != null) {
                val data = JSONArray(cached)
                if (data.length() > 0) {
                    browseData = data
                    browseDataLoaded = true
                    Log.d(TAG, "Loaded browse data from SharedPreferences cache: ${data.length()} sections")
                    return
                }
            }

            Log.d(TAG, "No browse data available (file or cache)")
            browseData = JSONArray()
            browseDataLoaded = false
        } catch (e: Exception) {
            Log.e(TAG, "Error loading browse data", e)
            browseData = JSONArray()
            browseDataLoaded = false
        }
    }

    /**
     * Notify that browse data has been updated - triggers refresh in Android Auto.
     */
    fun notifyBrowseDataChanged() {
        loadBrowseData()
        if (hasBrowseData()) {
            // Reset polling state so Auto re-fetches children properly
            // This is critical for cold start: if polling timed out before data arrived,
            // hasPolledOnce=true would show "sign in" instead of the real browse tree.
            hasPolledOnce = false
            isPollingForData = false
            Log.d(TAG, "Browse data updated — notifying all children")
        }
        notifyChildrenChanged(MEDIA_ROOT_ID)
        // Snapshot volatile field to avoid TOCTOU race during iteration
        val sections = browseData ?: return
        for (i in 0 until sections.length()) {
            try {
                val sectionId = sections.getJSONObject(i).optString("id", "")
                if (sectionId.isNotEmpty()) {
                    notifyChildrenChanged("$PREFIX_SECTION$sectionId")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error notifying section at index $i", e)
            }
        }
    }
}
