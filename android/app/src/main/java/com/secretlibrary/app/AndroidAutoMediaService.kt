package com.secretlibrary.app

import android.content.Intent
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.media.MediaBrowserServiceCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * MediaBrowserServiceCompat for Android Auto integration.
 *
 * This service provides the browse tree for Android Auto to display
 * audiobooks in the car's head unit. It reads browse data from a JSON file
 * that is synced by the React Native layer.
 */
class AndroidAutoMediaService : MediaBrowserServiceCompat() {

    companion object {
        private const val TAG = "AndroidAutoMediaService"
        private const val BROWSE_ROOT = "root"
        private const val BROWSE_FILE = "android_auto_browse.json"

        // Media IDs
        private const val MEDIA_ID_ROOT = "/"
        private const val MEDIA_ID_CONTINUE = "continue-listening"
        private const val MEDIA_ID_DOWNLOADS = "downloads"
    }

    private lateinit var mediaSession: MediaSessionCompat

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "MediaPlaybackService created")

        // Create media session
        mediaSession = MediaSessionCompat(this, TAG).apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )

            // Set initial playback state
            setPlaybackState(
                PlaybackStateCompat.Builder()
                    .setActions(
                        PlaybackStateCompat.ACTION_PLAY or
                        PlaybackStateCompat.ACTION_PAUSE or
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackStateCompat.ACTION_SEEK_TO or
                        PlaybackStateCompat.ACTION_PLAY_PAUSE
                    )
                    .setState(PlaybackStateCompat.STATE_NONE, 0, 1f)
                    .build()
            )

            // Set callback for media controls
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    Log.d(TAG, "onPlay")
                    sendEventToReactNative("play", null)
                }

                override fun onPause() {
                    Log.d(TAG, "onPause")
                    sendEventToReactNative("pause", null)
                }

                override fun onSkipToNext() {
                    Log.d(TAG, "onSkipToNext")
                    sendEventToReactNative("skipToNext", null)
                }

                override fun onSkipToPrevious() {
                    Log.d(TAG, "onSkipToPrevious")
                    sendEventToReactNative("skipToPrevious", null)
                }

                override fun onSeekTo(pos: Long) {
                    Log.d(TAG, "onSeekTo: $pos")
                    sendEventToReactNative("seekTo", pos.toString())
                }

                override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
                    Log.d(TAG, "onPlayFromMediaId: $mediaId")
                    mediaId?.let {
                        sendEventToReactNative("playItem", it)
                    }
                }
            })

            isActive = true
        }

        sessionToken = mediaSession.sessionToken
    }

    override fun onDestroy() {
        mediaSession.release()
        super.onDestroy()
    }

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot {
        Log.d(TAG, "onGetRoot called by: $clientPackageName")
        return BrowserRoot(MEDIA_ID_ROOT, null)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        Log.d(TAG, "onLoadChildren: $parentId")

        // Defer result to load asynchronously
        result.detach()

        Thread {
            val items = when (parentId) {
                MEDIA_ID_ROOT -> loadRootItems()
                MEDIA_ID_CONTINUE -> loadSectionItems("continue-listening")
                MEDIA_ID_DOWNLOADS -> loadSectionItems("downloads")
                else -> mutableListOf()
            }
            result.sendResult(items)
        }.start()
    }

    private fun loadRootItems(): MutableList<MediaBrowserCompat.MediaItem> {
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()

        // Add "Continue Listening" folder
        items.add(
            MediaBrowserCompat.MediaItem(
                MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_CONTINUE)
                    .setTitle("Continue Listening")
                    .setSubtitle("Resume where you left off")
                    .build(),
                MediaBrowserCompat.MediaItem.FLAG_BROWSABLE
            )
        )

        // Add "Downloads" folder
        items.add(
            MediaBrowserCompat.MediaItem(
                MediaDescriptionCompat.Builder()
                    .setMediaId(MEDIA_ID_DOWNLOADS)
                    .setTitle("Downloads")
                    .setSubtitle("Offline audiobooks")
                    .build(),
                MediaBrowserCompat.MediaItem.FLAG_BROWSABLE
            )
        )

        return items
    }

    private fun loadSectionItems(sectionId: String): MutableList<MediaBrowserCompat.MediaItem> {
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()

        try {
            val browseFile = File(filesDir, BROWSE_FILE)
            if (!browseFile.exists()) {
                Log.d(TAG, "Browse file not found: ${browseFile.absolutePath}")
                return items
            }

            val json = browseFile.readText()
            val sections = JSONArray(json)

            for (i in 0 until sections.length()) {
                val section = sections.getJSONObject(i)
                if (section.getString("id") == sectionId) {
                    val sectionItems = section.getJSONArray("items")

                    for (j in 0 until sectionItems.length()) {
                        val item = sectionItems.getJSONObject(j)
                        val mediaItem = createMediaItem(item)
                        items.add(mediaItem)
                    }
                    break
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading section items", e)
        }

        return items
    }

    private fun createMediaItem(json: JSONObject): MediaBrowserCompat.MediaItem {
        val id = json.getString("id")
        val title = json.optString("title", "Unknown Title")
        val subtitle = json.optString("subtitle", "")
        val imageUrl = json.optString("imageUrl", null)

        val description = MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(subtitle)

        // Note: For album art, Android Auto will use the URI if provided
        // The actual image loading is handled by Android Auto
        if (!imageUrl.isNullOrEmpty()) {
            try {
                description.setIconUri(android.net.Uri.parse(imageUrl))
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing image URL: $imageUrl", e)
            }
        }

        return MediaBrowserCompat.MediaItem(
            description.build(),
            MediaBrowserCompat.MediaItem.FLAG_PLAYABLE
        )
    }

    private fun sendEventToReactNative(action: String, data: String?) {
        Log.d(TAG, "Sending event to RN: $action, data: $data")

        // Send broadcast that the AndroidAutoModule will receive
        val intent = Intent("com.secretlibrary.app.ANDROID_AUTO_EVENT").apply {
            putExtra("action", action)
            data?.let { putExtra("data", it) }
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    /**
     * Update playback state from React Native
     */
    fun updatePlaybackState(state: Int, position: Long, speed: Float) {
        mediaSession.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                    PlaybackStateCompat.ACTION_PAUSE or
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                    PlaybackStateCompat.ACTION_SEEK_TO or
                    PlaybackStateCompat.ACTION_PLAY_PAUSE
                )
                .setState(state, position, speed)
                .build()
        )
    }

    /**
     * Update now playing metadata from React Native
     */
    fun updateMetadata(title: String, author: String, duration: Long, artworkUrl: String?) {
        val builder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, author)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, title)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration)

        artworkUrl?.let {
            builder.putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, it)
        }

        mediaSession.setMetadata(builder.build())
    }
}
