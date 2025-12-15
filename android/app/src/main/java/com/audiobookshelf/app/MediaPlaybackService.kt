package com.audiobookshelf.app

import android.net.Uri
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import androidx.media.MediaBrowserServiceCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * MediaBrowserService for Android Auto integration.
 *
 * This service exposes the app's media library to Android Auto,
 * allowing users to browse and play audiobooks from the car's display.
 *
 * The actual playback is handled by the React Native layer via expo-media-control,
 * which already manages the MediaSession. This service provides the browse tree
 * for the library navigation in Android Auto.
 *
 * Browse data is synced from React Native via a JSON file in the app's documents directory.
 */
class MediaPlaybackService : MediaBrowserServiceCompat() {

    companion object {
        private const val TAG = "MediaPlaybackService"
        private const val ROOT_ID = "root"
        private const val CONTINUE_LISTENING_ID = "continue-listening"
        private const val DOWNLOADS_ID = "downloads"
        private const val BROWSE_DATA_FILENAME = "android_auto_browse.json"
    }

    private lateinit var mediaSession: MediaSessionCompat

    override fun onCreate() {
        super.onCreate()

        Log.d(TAG, "MediaPlaybackService onCreate")

        // Create media session for Android Auto
        mediaSession = MediaSessionCompat(this, "AudiobookshelfService").apply {
            // Set initial playback state
            setPlaybackState(
                PlaybackStateCompat.Builder()
                    .setActions(
                        PlaybackStateCompat.ACTION_PLAY or
                        PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_SEEK_TO or
                        PlaybackStateCompat.ACTION_FAST_FORWARD or
                        PlaybackStateCompat.ACTION_REWIND or
                        PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID
                    )
                    .setState(PlaybackStateCompat.STATE_NONE, 0, 1.0f)
                    .build()
            )

            // Set flags for media buttons and transport controls
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )

            // Set callback for handling play requests
            setCallback(mediaSessionCallback)

            isActive = true
        }

        sessionToken = mediaSession.sessionToken
    }

    override fun onDestroy() {
        Log.d(TAG, "MediaPlaybackService onDestroy")
        mediaSession.release()
        super.onDestroy()
    }

    /**
     * Media session callback for handling playback commands
     */
    private val mediaSessionCallback = object : MediaSessionCompat.Callback() {
        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
            Log.d(TAG, "onPlayFromMediaId: $mediaId")
            // Send event to React Native to play this item
            mediaId?.let { id ->
                AndroidAutoModule.getInstance()?.emitPlayItemEvent(id)
                    ?: Log.w(TAG, "AndroidAutoModule not available, cannot emit play event")
            }
        }

        override fun onPlay() {
            Log.d(TAG, "onPlay")
            // Playback is handled by expo-media-control
        }

        override fun onPause() {
            Log.d(TAG, "onPause")
            // Playback is handled by expo-media-control
        }

        override fun onSkipToNext() {
            Log.d(TAG, "onSkipToNext")
            // Handled by expo-media-control
        }

        override fun onSkipToPrevious() {
            Log.d(TAG, "onSkipToPrevious")
            // Handled by expo-media-control
        }

        override fun onSeekTo(pos: Long) {
            Log.d(TAG, "onSeekTo: $pos")
            // Handled by expo-media-control
        }
    }

    /**
     * Called when Android Auto connects to browse the media library.
     * Returns the root of the browse tree.
     */
    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot {
        Log.d(TAG, "onGetRoot from: $clientPackageName")
        return BrowserRoot(ROOT_ID, null)
    }

    /**
     * Called when the client requests children of a browsable item.
     * This populates the browse tree for Android Auto.
     */
    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        Log.d(TAG, "onLoadChildren: $parentId")

        val items = mutableListOf<MediaBrowserCompat.MediaItem>()

        when (parentId) {
            ROOT_ID -> {
                // Root level - show main categories
                items.add(createBrowsableItem(
                    CONTINUE_LISTENING_ID,
                    "Continue Listening",
                    "Resume your audiobooks"
                ))
                items.add(createBrowsableItem(
                    DOWNLOADS_ID,
                    "Downloads",
                    "Offline audiobooks"
                ))
            }
            CONTINUE_LISTENING_ID -> {
                // Load continue listening items from JSON file
                val sectionItems = loadBrowseItems(CONTINUE_LISTENING_ID)
                items.addAll(sectionItems)
                Log.d(TAG, "Loaded ${sectionItems.size} continue listening items")
            }
            DOWNLOADS_ID -> {
                // Load downloaded items from JSON file
                val sectionItems = loadBrowseItems(DOWNLOADS_ID)
                items.addAll(sectionItems)
                Log.d(TAG, "Loaded ${sectionItems.size} download items")
            }
        }

        result.sendResult(items)
    }

    /**
     * Load browse items from the JSON file synced from React Native
     */
    private fun loadBrowseItems(sectionId: String): List<MediaBrowserCompat.MediaItem> {
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()

        try {
            val browseData = readBrowseDataFile()
            if (browseData == null) {
                Log.d(TAG, "No browse data file found")
                return items
            }

            val sections = JSONArray(browseData)
            for (i in 0 until sections.length()) {
                val section = sections.getJSONObject(i)
                if (section.getString("id") == sectionId) {
                    val sectionItems = section.getJSONArray("items")
                    for (j in 0 until sectionItems.length()) {
                        val item = sectionItems.getJSONObject(j)
                        val mediaItem = createPlayableItemFromJson(item)
                        items.add(mediaItem)
                    }
                    break
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading browse items: ${e.message}", e)
        }

        return items
    }

    /**
     * Read the browse data JSON file from app's documents directory
     */
    private fun readBrowseDataFile(): String? {
        try {
            // expo-file-system uses the files directory
            val documentsDir = filesDir
            val browseFile = File(documentsDir, BROWSE_DATA_FILENAME)

            if (!browseFile.exists()) {
                Log.d(TAG, "Browse data file does not exist: ${browseFile.absolutePath}")
                return null
            }

            val content = browseFile.readText()
            Log.d(TAG, "Read browse data file: ${content.length} chars")
            return content
        } catch (e: Exception) {
            Log.e(TAG, "Error reading browse data file: ${e.message}", e)
            return null
        }
    }

    /**
     * Create a playable media item from JSON
     */
    private fun createPlayableItemFromJson(json: JSONObject): MediaBrowserCompat.MediaItem {
        val id = json.getString("id")
        val title = json.optString("title", "Unknown Title")
        val subtitle = json.optString("subtitle", "Unknown Author")
        val imageUrl = json.optString("imageUrl", null)

        val descriptionBuilder = MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(subtitle)

        if (!imageUrl.isNullOrEmpty()) {
            descriptionBuilder.setIconUri(Uri.parse(imageUrl))
        }

        return MediaBrowserCompat.MediaItem(
            descriptionBuilder.build(),
            MediaBrowserCompat.MediaItem.FLAG_PLAYABLE
        )
    }

    /**
     * Create a browsable media item (folder/category)
     */
    private fun createBrowsableItem(
        id: String,
        title: String,
        subtitle: String? = null
    ): MediaBrowserCompat.MediaItem {
        val description = MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(subtitle)
            .build()

        return MediaBrowserCompat.MediaItem(
            description,
            MediaBrowserCompat.MediaItem.FLAG_BROWSABLE
        )
    }
}
