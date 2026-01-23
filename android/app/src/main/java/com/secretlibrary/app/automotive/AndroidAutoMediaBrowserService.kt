package com.secretlibrary.app.automotive

import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.media.MediaBrowserServiceCompat
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.request.RequestOptions
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * MediaBrowserService for Android Auto integration.
 *
 * This service:
 * 1. Reads browse data from JSON file written by React Native
 * 2. Populates the media tree for Android Auto browsing
 * 3. Handles playback commands via MediaSession
 * 4. Emits events back to React Native via AndroidAutoModule
 * 5. Loads cover art asynchronously with caching
 */
class AndroidAutoMediaBrowserService : MediaBrowserServiceCompat() {

    companion object {
        private const val TAG = "AndroidAutoService"
        private const val MEDIA_ROOT_ID = "secret_library_media_root"
        private const val BROWSE_DATA_FILE = "android_auto_browse.json"

        // Cover art dimensions for Android Auto (recommended size)
        private const val COVER_ART_SIZE = 400

        // Media ID prefixes for routing
        const val PREFIX_SECTION = "section:"
        const val PREFIX_ITEM = "item:"
        const val PREFIX_FOLDER = "folder:"  // For browsable folders (authors, series, etc.)
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
        var instance: AndroidAutoMediaBrowserService? = null
            private set
    }

    private lateinit var mediaSession: MediaSessionCompat
    private var browseData: JSONArray? = null

    // Coroutine scope for async operations
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Cover art cache to avoid reloading
    private val coverArtCache = ConcurrentHashMap<String, Bitmap?>()

    // Glide request options for cover art
    private val glideOptions = RequestOptions()
        .diskCacheStrategy(DiskCacheStrategy.ALL)
        .override(COVER_ART_SIZE, COVER_ART_SIZE)
        .centerCrop()

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.d(TAG, "AndroidAutoMediaBrowserService created")

        // Initialize MediaSession
        mediaSession = MediaSessionCompat(this, TAG).apply {
            setCallback(MediaSessionCallback())
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            isActive = true
        }

        sessionToken = mediaSession.sessionToken

        // Load initial browse data
        loadBrowseData()
    }

    override fun onDestroy() {
        instance = null
        serviceScope.cancel()
        coverArtCache.clear()
        mediaSession.release()
        super.onDestroy()
        Log.d(TAG, "AndroidAutoMediaBrowserService destroyed")
    }

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot {
        Log.d(TAG, "onGetRoot called by: $clientPackageName")
        // Refresh browse data on connection
        loadBrowseData()

        // Return content style hints for grid/list display
        val extras = Bundle().apply {
            putBoolean(CONTENT_STYLE_SUPPORTED, true)
            // Use list style for browsable folders (authors, series, etc.)
            putInt(CONTENT_STYLE_BROWSABLE_HINT, CONTENT_STYLE_LIST_ITEM_HINT_VALUE)
            // Use grid style for playable items (books with cover art)
            putInt(CONTENT_STYLE_PLAYABLE_HINT, CONTENT_STYLE_GRID_ITEM_HINT_VALUE)
        }

        return BrowserRoot(MEDIA_ROOT_ID, extras)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        Log.d(TAG, "onLoadChildren: $parentId")

        // Detach result so we can load async
        result.detach()

        // Reload browse data to get latest
        loadBrowseData()

        // Load children with cover art asynchronously
        serviceScope.launch {
            val items = loadChildrenAsync(parentId)
            result.sendResult(items)
        }
    }

    private suspend fun loadChildrenAsync(parentId: String): MutableList<MediaBrowserCompat.MediaItem> {
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
            parentId.startsWith(PREFIX_FOLDER) -> {
                // Folder level: return children of a browsable folder (author, series, genre, narrator)
                // parentId format: "folder:author:Name" or "folder:series:Name" etc.
                val folderId = parentId.removePrefix(PREFIX_FOLDER)
                Log.d(TAG, "Loading folder children for: $folderId")

                // Search through all sections for items with matching id
                browseData?.let { sections ->
                    outer@ for (i in 0 until sections.length()) {
                        val section = sections.getJSONObject(i)
                        val sectionItems = section.optJSONArray("items") ?: continue

                        for (j in 0 until sectionItems.length()) {
                            val item = sectionItems.getJSONObject(j)
                            val itemId = item.getString("id")

                            if (itemId == folderId) {
                                // Found the folder, now return its children
                                val children = item.optJSONArray("children")
                                if (children != null) {
                                    Log.d(TAG, "Found ${children.length()} children for folder: $folderId")
                                    for (k in 0 until children.length()) {
                                        val child = children.getJSONObject(k)
                                        val mediaItem = createMediaItemWithArt(child)
                                        items.add(mediaItem)
                                    }
                                }
                                break@outer
                            }
                        }
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
                            val isBrowsableSection = section.optBoolean("isBrowsableSection", false)
                            val sectionItems = section.getJSONArray("items")

                            for (j in 0 until sectionItems.length()) {
                                val item = sectionItems.getJSONObject(j)
                                val mediaItem = if (isBrowsableSection) {
                                    // For browsable sections, create folder items
                                    createFolderItem(item)
                                } else {
                                    createMediaItemWithArt(item)
                                }
                                items.add(mediaItem)
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
     * Create a browsable folder item (for authors, series, genres, narrators)
     */
    private fun createFolderItem(item: JSONObject): MediaBrowserCompat.MediaItem {
        val id = item.getString("id")
        val title = item.getString("title")
        val subtitle = item.optString("subtitle", "")
        val itemCount = item.optInt("itemCount", 0)

        val description = MediaDescriptionCompat.Builder()
            .setMediaId("$PREFIX_FOLDER$id")
            .setTitle(title)
            .setSubtitle(if (subtitle.isNotEmpty()) subtitle else "$itemCount items")
            .build()

        return MediaBrowserCompat.MediaItem(
            description,
            MediaBrowserCompat.MediaItem.FLAG_BROWSABLE
        )
    }

    /**
     * Create a media item with cover art loaded asynchronously
     */
    private suspend fun createMediaItemWithArt(item: JSONObject): MediaBrowserCompat.MediaItem {
        val id = item.getString("id")
        val title = item.getString("title")
        val subtitle = item.optString("subtitle", "")
        val imageUrl = item.optString("imageUrl", null)
        val isPlayable = item.optBoolean("isPlayable", true)
        val isBrowsable = item.optBoolean("isBrowsable", false)
        val progress = item.optDouble("progress", 0.0)
        val durationMs = item.optLong("durationMs", 0L)

        val descriptionBuilder = MediaDescriptionCompat.Builder()
            .setMediaId("$PREFIX_ITEM$id")
            .setTitle(title)
            .setSubtitle(subtitle)

        // Load cover art
        if (!imageUrl.isNullOrEmpty()) {
            val bitmap = loadCoverArt(id, imageUrl)
            if (bitmap != null) {
                descriptionBuilder.setIconBitmap(bitmap)
            }
        }

        // Add progress and duration as extras with Android Auto progress indicator support
        val extras = Bundle().apply {
            putDouble(EXTRA_PROGRESS, progress)
            putLong(EXTRA_DURATION_MS, durationMs)

            // Add completion status for Android Auto progress bar
            val completionStatus = when {
                progress >= 0.95 -> DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_FULLY_PLAYED
                progress > 0.0 -> DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_PARTIALLY_PLAYED
                else -> DESCRIPTION_EXTRAS_VALUE_COMPLETION_STATUS_NOT_PLAYED
            }
            putInt(DESCRIPTION_EXTRAS_KEY_COMPLETION_STATUS, completionStatus)

            // Add progress percentage (0-100) for progress bar display
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

    /**
     * Load cover art using Glide with caching
     */
    private suspend fun loadCoverArt(itemId: String, imageUrl: String): Bitmap? {
        // Check cache first
        coverArtCache[itemId]?.let { return it }

        return withContext(Dispatchers.IO) {
            try {
                val bitmap = Glide.with(this@AndroidAutoMediaBrowserService)
                    .asBitmap()
                    .load(imageUrl)
                    .apply(glideOptions)
                    .submit()
                    .get()

                // Cache the result
                coverArtCache[itemId] = bitmap
                Log.d(TAG, "Loaded cover art for: $itemId")
                bitmap
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load cover art for $itemId: ${e.message}")
                null
            }
        }
    }

    /**
     * Clear cover art cache (call when library updates)
     */
    fun clearCoverArtCache() {
        coverArtCache.clear()
        Log.d(TAG, "Cover art cache cleared")
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
     * Update playback state - called from React Native module
     */
    fun updatePlaybackState(
        state: Int,
        position: Long,
        playbackSpeed: Float
    ) {
        val stateBuilder = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_STOP or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_REWIND or
                PlaybackStateCompat.ACTION_FAST_FORWARD
            )
            .setState(state, position, playbackSpeed)

        mediaSession.setPlaybackState(stateBuilder.build())
    }

    /**
     * Update metadata - called from React Native module
     */
    fun updateMetadata(
        title: String,
        author: String,
        duration: Long,
        artworkUrl: String?
    ) {
        serviceScope.launch {
            val metadataBuilder = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, author)
                .putString(MediaMetadataCompat.METADATA_KEY_AUTHOR, author)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration)

            // Load artwork for Now Playing screen
            if (!artworkUrl.isNullOrEmpty()) {
                val bitmap = loadCoverArt("now_playing", artworkUrl)
                if (bitmap != null) {
                    metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap)
                    metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                }
            }

            mediaSession.setMetadata(metadataBuilder.build())
        }
    }

    /**
     * Notify that browse data has been updated - triggers refresh in Android Auto
     */
    fun notifyBrowseDataChanged() {
        loadBrowseData()
        // Clear cache since data changed
        clearCoverArtCache()
        notifyChildrenChanged(MEDIA_ROOT_ID)
        browseData?.let { sections ->
            for (i in 0 until sections.length()) {
                val section = sections.getJSONObject(i)
                val sectionId = section.getString("id")
                notifyChildrenChanged("$PREFIX_SECTION$sectionId")

                // Also notify about folder changes for hierarchical sections
                val isBrowsableSection = section.optBoolean("isBrowsableSection", false)
                if (isBrowsableSection) {
                    val sectionItems = section.optJSONArray("items")
                    if (sectionItems != null) {
                        for (j in 0 until sectionItems.length()) {
                            val item = sectionItems.getJSONObject(j)
                            val itemId = item.getString("id")
                            notifyChildrenChanged("$PREFIX_FOLDER$itemId")
                        }
                    }
                }
            }
        }
    }

    /**
     * MediaSession callback - handles playback commands from Android Auto
     */
    private inner class MediaSessionCallback : MediaSessionCompat.Callback() {

        override fun onPlay() {
            Log.d(TAG, "onPlay")
            AndroidAutoModule.emitCommand("play", null)
        }

        override fun onPause() {
            Log.d(TAG, "onPause")
            AndroidAutoModule.emitCommand("pause", null)
        }

        override fun onStop() {
            Log.d(TAG, "onStop")
            AndroidAutoModule.emitCommand("stop", null)
        }

        override fun onSeekTo(pos: Long) {
            Log.d(TAG, "onSeekTo: $pos")
            AndroidAutoModule.emitCommand("seekTo", pos.toString())
        }

        override fun onSkipToNext() {
            Log.d(TAG, "onSkipToNext")
            AndroidAutoModule.emitCommand("skipToNext", null)
        }

        override fun onSkipToPrevious() {
            Log.d(TAG, "onSkipToPrevious")
            AndroidAutoModule.emitCommand("skipToPrevious", null)
        }

        override fun onFastForward() {
            Log.d(TAG, "onFastForward")
            AndroidAutoModule.emitCommand("fastForward", null)
        }

        override fun onRewind() {
            Log.d(TAG, "onRewind")
            AndroidAutoModule.emitCommand("rewind", null)
        }

        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
            Log.d(TAG, "onPlayFromMediaId: $mediaId")
            mediaId?.let {
                val itemId = if (it.startsWith(PREFIX_ITEM)) {
                    it.removePrefix(PREFIX_ITEM)
                } else {
                    it
                }
                AndroidAutoModule.emitCommand("playFromMediaId", itemId)
            }
        }

        override fun onPlayFromSearch(query: String?, extras: Bundle?) {
            Log.d(TAG, "onPlayFromSearch: $query")
            if (query.isNullOrBlank()) {
                // Empty query - play most recent or continue listening
                AndroidAutoModule.emitCommand("playFromSearch", "")
            } else {
                AndroidAutoModule.emitCommand("playFromSearch", query)
            }
        }

        override fun onCustomAction(action: String?, extras: Bundle?) {
            Log.d(TAG, "onCustomAction: $action")
            action?.let {
                AndroidAutoModule.emitCommand("customAction", it)
            }
        }
    }
}
