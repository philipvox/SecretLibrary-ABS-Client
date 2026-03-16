package com.secretlibrary.app.exoplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaStyleNotificationHelper
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.request.RequestOptions
import kotlinx.coroutines.*
import java.util.concurrent.TimeUnit

/**
 * Foreground Service that owns all audio playback on Android via ExoPlayer.
 *
 * Single ExoPlayer + single MediaSession = single source of truth.
 * JS becomes a thin control surface via ExoPlayerModule.
 * Android Auto, lock screen, and notification all share this MediaSession.
 *
 * Lifecycle: started once, stays alive across book switches.
 * cleanup() just clears current audio. destroy() fully releases on service death.
 */
class AudioPlaybackService : Service() {

    companion object {
        private const val TAG = "AudioPlaybackService"
        private const val NOTIFICATION_CHANNEL_ID = "audio_playback_channel"
        private const val NOTIFICATION_ID = 1

        // Position update interval (ms)
        private const val POSITION_UPDATE_INTERVAL_MS = 100L

        // Cover art dimensions
        private const val COVER_ART_SIZE = 400

        // Stuck detection threshold
        private const val STUCK_THRESHOLD_MS = 3000L

        // Singleton instance — accessible by ExoPlayerModule and AndroidAutoMediaBrowserService
        @Volatile
        var instance: AudioPlaybackService? = null
            private set

        /**
         * Start the service from ExoPlayerModule.
         */
        fun start(context: Context) {
            val intent = Intent(context, AudioPlaybackService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
                Log.d(TAG, "Service start intent sent")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start service: ${e.message}", e)
            }
        }
    }

    data class TrackInfo(
        val url: String,
        val title: String,
        val startOffset: Double,  // Global start position of this track (seconds)
        val duration: Double      // Track duration (seconds)
    )

    // Core components
    private var exoPlayer: ExoPlayer? = null
    var mediaSession: MediaSessionCompat? = null
        private set
    private var media3Session: MediaSession? = null

    // Track management
    private var tracks: List<TrackInfo> = emptyList()
    private var currentTrackIndex: Int = 0
    private var totalDuration: Double = 0.0

    // Position update handler
    private val mainHandler = Handler(Looper.getMainLooper())
    private var positionUpdateRunnable: Runnable? = null

    // Stuck detection
    private var lastReportedPosition: Double = 0.0
    private var lastPositionChangeTime: Long = 0L

    // MediaSession update throttle — max once per second to avoid audio focus renegotiation
    private var lastMediaSessionUpdateTime: Long = 0L
    private val MEDIA_SESSION_UPDATE_INTERVAL_MS = 1000L

    // State
    var isInitialized = false
        private set
    private var hasReachedEnd = false

    // Prepare timeout — emits error if buffering takes too long
    private var prepareTimeoutRunnable: Runnable? = null
    private var prepareCallback: ((Boolean, String?) -> Unit)? = null
    private val PREPARE_TIMEOUT_MS = 30_000L

    // Cover art
    private val glideOptions = RequestOptions()
        .diskCacheStrategy(DiskCacheStrategy.ALL)
        .override(COVER_ART_SIZE, COVER_ART_SIZE)
        .centerCrop()

    // Coroutine scope for async operations (cover art loading)
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    // Metadata for notification/lock screen
    private var currentTitle: String = ""
    private var currentAuthor: String = ""
    private var currentArtworkUrl: String? = null
    private var currentArtworkBitmap: Bitmap? = null
    private var currentChapterTitle: String? = null

    // Supported playback actions for MediaSession
    private val SUPPORTED_ACTIONS =
        PlaybackStateCompat.ACTION_PLAY or
        PlaybackStateCompat.ACTION_PAUSE or
        PlaybackStateCompat.ACTION_PLAY_PAUSE or
        PlaybackStateCompat.ACTION_STOP or
        PlaybackStateCompat.ACTION_SEEK_TO or
        PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
        PlaybackStateCompat.ACTION_REWIND or
        PlaybackStateCompat.ACTION_FAST_FORWARD or
        PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID or
        PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand called")

        try {
            // Create notification channel FIRST (required before startForeground on Android 8+)
            createNotificationChannel()

            // Must call startForeground within 5 seconds of startForegroundService()
            val notification = buildNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            Log.d(TAG, "startForeground called successfully")

            // Initialize ExoPlayer AFTER startForeground (so service won't be killed)
            if (!isInitialized) {
                initialize()
            }
        } catch (e: Exception) {
            Log.e(TAG, "onStartCommand failed: ${e.message}", e)
        }

        // ALWAYS set instance so the polling can find us
        instance = this

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.d(TAG, "Service onDestroy")
        destroy()
        super.onDestroy()
    }

    /**
     * Initialize ExoPlayer and MediaSession. Called once from onStartCommand.
     */
    private fun initialize() {
        if (isInitialized) return

        Log.d(TAG, "Initializing AudioPlaybackService")

        try {
            // Create ExoPlayer
            val player = ExoPlayer.Builder(applicationContext)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                        .setUsage(C.USAGE_MEDIA)
                        .build(),
                    true  // handleAudioFocus = true (ExoPlayer manages audio focus automatically)
                )
                .setHandleAudioBecomingNoisy(true)  // Auto-pause on headphone unplug
                .setWakeMode(C.WAKE_MODE_NETWORK)   // Keep CPU + WiFi awake during playback
                .build()

            exoPlayer = player
            Log.d(TAG, "ExoPlayer created")

            // Create legacy MediaSessionCompat (for Android Auto compatibility)
            mediaSession = MediaSessionCompat(applicationContext, TAG).apply {
                setFlags(
                    MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                    MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
                )
                setCallback(LegacyMediaSessionCallback())
                isActive = true
            }
            Log.d(TAG, "MediaSessionCompat created")

            // Create Media3 MediaSession (wraps ExoPlayer, auto-syncs state)
            media3Session = MediaSession.Builder(applicationContext, player)
                .build()
            Log.d(TAG, "Media3 MediaSession created")

            // Set up ExoPlayer listeners
            player.addListener(PlayerEventListener())

            // Set initial playback state and placeholder metadata
            // so lock screen shows app name instead of blank until JS loads a book
            updateMediaSessionMetadata()
            updateMediaSessionState()

            isInitialized = true
            Log.d(TAG, "AudioPlaybackService fully initialized")
        } catch (e: Exception) {
            Log.e(TAG, "initialize() FAILED: ${e.message}", e)
            // Don't set isInitialized — will retry on next loadTracks call
        }
    }

    /**
     * Build the persistent media notification for the foreground service.
     */
    private fun buildNotification(): Notification {
        val launchIntent = applicationContext.packageManager
            .getLaunchIntentForPackage(applicationContext.packageName)
        val pendingIntent = PendingIntent.getActivity(
            applicationContext, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle(currentTitle.ifEmpty { "Secret Library" })
            .setContentText(currentAuthor.ifEmpty { "Ready to play" })
            .setSmallIcon(applicationContext.applicationInfo.icon)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        val session = mediaSession
        if (session != null) {
            builder.setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(session.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
        }

        currentArtworkBitmap?.let { builder.setLargeIcon(it) }

        return builder.build()
    }

    /**
     * Ensure ExoPlayer is initialized. Retries if previous init failed.
     * Returns true if ready, false if init failed.
     */
    fun ensureReady(): Boolean {
        if (isInitialized && exoPlayer != null) return true
        // Retry initialization
        Log.w(TAG, "ensureReady: not initialized, retrying...")
        initialize()
        return isInitialized && exoPlayer != null
    }

    /**
     * Load tracks into ExoPlayer and optionally start playback.
     *
     * @param onPrepared Optional callback invoked when ExoPlayer reaches STATE_READY
     *                   or on error/timeout. (success: Boolean, errorMessage: String?)
     */
    fun loadTracks(
        trackInfos: List<TrackInfo>,
        startIndex: Int,
        startPositionMs: Long,
        autoPlay: Boolean,
        onPrepared: ((Boolean, String?) -> Unit)? = null
    ) {
        // Ensure initialized — retry if needed
        if (!ensureReady()) {
            throw IllegalStateException("ExoPlayer failed to initialize")
        }

        val player = exoPlayer!!
        Log.d(TAG, "loadTracks: ${trackInfos.size} tracks, startIndex=$startIndex, startPos=${startPositionMs}ms, autoPlay=$autoPlay")

        // Stop position updates during load
        stopPositionUpdates()

        // Cancel any pending prepare timeout from previous load
        cancelPrepareTimeout()

        // Reset state
        hasReachedEnd = false
        tracks = trackInfos
        currentTrackIndex = startIndex
        totalDuration = if (trackInfos.isNotEmpty()) {
            val lastTrack = trackInfos.last()
            lastTrack.startOffset + lastTrack.duration
        } else 0.0

        // Build MediaItems from tracks
        val mediaItems = trackInfos.map { track ->
            MediaItem.Builder()
                .setUri(Uri.parse(track.url))
                .setMediaId(track.title)
                .build()
        }

        // Log ALL track URLs for debugging
        trackInfos.forEachIndexed { idx, track ->
            val url = track.url
            val isLocal = url.startsWith("file://") || url.startsWith("/")
            val urlType = if (isLocal) "LOCAL" else "STREAM"
            Log.d(TAG, "Track[$idx] $urlType: ${url.take(150)}${if (url.length > 150) "..." else ""}")
            Log.d(TAG, "Track[$idx] title=${track.title}, offset=${track.startOffset}s, dur=${track.duration}s")
        }

        // Clear and set new playlist
        player.stop()
        player.clearMediaItems()
        player.setMediaItems(mediaItems, startIndex, startPositionMs)
        player.playWhenReady = autoPlay

        // Store prepare callback and start timeout
        prepareCallback = onPrepared
        if (onPrepared != null) {
            startPrepareTimeout()
        }

        player.prepare()
        Log.d(TAG, "player.prepare() called — waiting for STATE_READY...")

        // Reset stuck detection
        lastReportedPosition = 0.0
        lastPositionChangeTime = System.currentTimeMillis()

        // Start position updates (emits buffering state to JS during prepare)
        startPositionUpdates()

        // Update notification metadata
        updateMediaSessionMetadata()

        Log.d(TAG, "Tracks loaded, totalDuration=${totalDuration}s")
    }

    private fun startPrepareTimeout() {
        cancelPrepareTimeout()
        val timeout = Runnable {
            val player = exoPlayer
            val state = player?.playbackState
            Log.e(TAG, "Prepare timeout (${PREPARE_TIMEOUT_MS}ms) — ExoPlayer state: $state")

            prepareCallback?.let { cb ->
                prepareCallback = null
                cb(false, "Audio buffering timeout (${PREPARE_TIMEOUT_MS / 1000}s). The server may be slow or the file format may require processing.")
            }

            // Also emit error event so JS shows error to user
            ExoPlayerModule.emitEvent("onError", Bundle().apply {
                putString("type", "LOAD_FAILED")
                putString("message", "Audio failed to load after ${PREPARE_TIMEOUT_MS / 1000}s — buffering timeout")
                putDouble("position", getCurrentPositionSec())
                putInt("errorCode", -1)
            })
        }
        prepareTimeoutRunnable = timeout
        mainHandler.postDelayed(timeout, PREPARE_TIMEOUT_MS)
    }

    private fun cancelPrepareTimeout() {
        prepareTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        prepareTimeoutRunnable = null
    }

    fun play() {
        val player = exoPlayer ?: return
        if (player.isPlaying) return  // Already playing — skip to avoid audio focus renegotiation
        player.play()
        updateMediaSessionState()
    }

    fun pause() {
        val player = exoPlayer ?: return
        if (!player.isPlaying && !player.playWhenReady) return  // Already paused — skip
        player.pause()
        updateMediaSessionState()
    }

    /**
     * Seek to a global position across all tracks.
     * Converts global position (seconds) to track-local position.
     */
    fun seekTo(globalPositionSec: Double) {
        val player = exoPlayer ?: return

        if (tracks.isEmpty()) {
            // Single track mode
            player.seekTo((globalPositionSec * 1000).toLong())
            return
        }

        // Find which track contains this position
        var targetIndex = 0
        var positionInTrack = globalPositionSec

        for (i in tracks.indices) {
            val track = tracks[i]
            if (globalPositionSec >= track.startOffset &&
                globalPositionSec < track.startOffset + track.duration) {
                targetIndex = i
                positionInTrack = globalPositionSec - track.startOffset
                break
            }
            if (i == tracks.lastIndex) {
                targetIndex = i
                positionInTrack = (globalPositionSec - track.startOffset)
                    .coerceAtMost(track.duration - 0.5)
                    .coerceAtLeast(0.0)
            }
        }

        // If near end of track, jump to start of next
        if (targetIndex < tracks.lastIndex) {
            val trackDur = tracks[targetIndex].duration
            if (positionInTrack >= trackDur - 0.5) {
                targetIndex++
                positionInTrack = 0.0
            }
        }

        currentTrackIndex = targetIndex
        hasReachedEnd = false
        player.seekTo(targetIndex, (positionInTrack * 1000).toLong())
    }

    fun setRate(rate: Float) {
        exoPlayer?.playbackParameters = PlaybackParameters(rate)
    }

    fun setVolume(volume: Float) {
        exoPlayer?.volume = volume
    }

    /**
     * Get current global position in seconds.
     */
    fun getCurrentPositionSec(): Double {
        val player = exoPlayer ?: return 0.0
        val windowIndex = player.currentMediaItemIndex
        val positionMs = player.currentPosition

        if (tracks.isEmpty()) {
            return positionMs / 1000.0
        }

        if (windowIndex < tracks.size) {
            return tracks[windowIndex].startOffset + positionMs / 1000.0
        }

        return positionMs / 1000.0
    }

    /**
     * Get current playback state for synchronous reads from JS.
     */
    fun getCurrentState(): Bundle {
        val player = exoPlayer
        val bundle = Bundle()

        if (player == null) {
            bundle.putBoolean("isPlaying", false)
            bundle.putDouble("position", 0.0)
            bundle.putDouble("duration", 0.0)
            bundle.putBoolean("isBuffering", false)
            bundle.putBoolean("didJustFinish", false)
            return bundle
        }

        bundle.putBoolean("isPlaying", player.isPlaying)
        bundle.putDouble("position", getCurrentPositionSec())
        bundle.putDouble("duration", totalDuration)
        bundle.putBoolean("isBuffering", player.playbackState == Player.STATE_BUFFERING)
        bundle.putBoolean("didJustFinish", hasReachedEnd)

        return bundle
    }

    /**
     * Update metadata for notification/lock screen display.
     */
    fun setMetadata(title: String, author: String, artworkUrl: String?, chapterTitle: String?) {
        currentTitle = title
        currentAuthor = author
        currentChapterTitle = chapterTitle

        // Load artwork async if URL changed
        if (artworkUrl != currentArtworkUrl) {
            currentArtworkUrl = artworkUrl
            currentArtworkBitmap = null
            if (!artworkUrl.isNullOrEmpty()) {
                loadArtworkAsync(artworkUrl)
            }
        }

        updateMediaSessionMetadata()
        updateNotification()
    }

    /**
     * Unload current audio but keep the service and ExoPlayer alive for the next book.
     * Called from ExoPlayerModule.cleanup() when switching books.
     */
    fun cleanup() {
        Log.d(TAG, "Unloading current audio (service stays alive)")
        cancelPrepareTimeout()
        prepareCallback = null
        stopPositionUpdates()

        exoPlayer?.stop()
        exoPlayer?.clearMediaItems()

        // Reset track state
        tracks = emptyList()
        currentTrackIndex = 0
        totalDuration = 0.0
        hasReachedEnd = false
        lastReportedPosition = 0.0
        lastPositionChangeTime = System.currentTimeMillis()

        // Clear metadata
        currentTitle = ""
        currentAuthor = ""
        currentArtworkUrl = null
        currentArtworkBitmap?.let { if (!it.isRecycled) it.recycle() }
        currentArtworkBitmap = null
        currentChapterTitle = null

        // Update MediaSession to idle state so lock screen doesn't show stale book info
        updateMediaSessionMetadata()  // Clears title/author/artwork on lock screen
        updateMediaSessionState()
        updateNotification()
    }

    /**
     * Fully destroy the service — release all resources and stop.
     * Only called from onDestroy().
     */
    private fun destroy() {
        Log.d(TAG, "Destroying AudioPlaybackService")
        stopPositionUpdates()
        serviceScope.cancel()

        media3Session?.release()
        media3Session = null

        mediaSession?.release()
        mediaSession = null

        exoPlayer?.release()
        exoPlayer = null

        currentArtworkBitmap?.let {
            if (!it.isRecycled) it.recycle()
        }
        currentArtworkBitmap = null

        isInitialized = false
        instance = null
    }

    /**
     * Update the foreground notification with current metadata.
     */
    private fun updateNotification() {
        if (!isInitialized) return
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.notify(NOTIFICATION_ID, buildNotification())
        } catch (e: Exception) {
            Log.w(TAG, "Failed to update notification: ${e.message}")
        }
    }

    // ── Private helpers ──────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Audio Playback",
                NotificationManager.IMPORTANCE_LOW  // Low = no sound for notification
            ).apply {
                description = "Controls for audio playback"
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.createNotificationChannel(channel)
        }
    }

    private fun updateMediaSessionState() {
        val player = exoPlayer ?: return
        val session = mediaSession ?: return

        val state = when {
            player.isPlaying -> PlaybackStateCompat.STATE_PLAYING
            player.playbackState == Player.STATE_BUFFERING -> PlaybackStateCompat.STATE_BUFFERING
            player.playWhenReady -> PlaybackStateCompat.STATE_BUFFERING
            else -> PlaybackStateCompat.STATE_PAUSED
        }

        val positionMs = (getCurrentPositionSec() * 1000).toLong()
        val speed = player.playbackParameters.speed

        val stateBuilder = PlaybackStateCompat.Builder()
            .setActions(SUPPORTED_ACTIONS)
            .setState(state, positionMs, speed)

        session.setPlaybackState(stateBuilder.build())
    }

    private fun updateMediaSessionMetadata() {
        val session = mediaSession ?: return

        val builder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentAuthor)
            .putString(MediaMetadataCompat.METADATA_KEY_AUTHOR, currentAuthor)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (totalDuration * 1000).toLong())

        if (!currentChapterTitle.isNullOrEmpty()) {
            builder.putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentChapterTitle)
            builder.putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentTitle)
        } else {
            builder.putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
        }

        currentArtworkBitmap?.let { bitmap ->
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap)
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
        }

        session.setMetadata(builder.build())
    }

    private fun loadArtworkAsync(url: String) {
        val savedUrl = url
        serviceScope.launch {
            try {
                val bitmap = withContext(Dispatchers.IO) {
                    Glide.with(applicationContext)
                        .asBitmap()
                        .load(url)
                        .apply(glideOptions)
                        .submit()
                        .get(5, TimeUnit.SECONDS)
                }
                // Re-check URL hasn't changed during async load
                if (currentArtworkUrl == savedUrl) {
                    // Recycle the previous bitmap before assigning the new one
                    currentArtworkBitmap?.let { if (!it.isRecycled) it.recycle() }
                    currentArtworkBitmap = bitmap
                    updateMediaSessionMetadata()
                    updateNotification()
                    Log.d(TAG, "Artwork loaded: ${bitmap.width}x${bitmap.height}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load artwork: ${e.message}")
            }
        }
    }

    private fun startPositionUpdates() {
        stopPositionUpdates()

        val runnable = object : Runnable {
            override fun run() {
                val player = exoPlayer ?: return
                val now = System.currentTimeMillis()

                val position = getCurrentPositionSec()
                val isPlaying = player.isPlaying
                val isBuffering = player.playbackState == Player.STATE_BUFFERING

                // Stuck detection
                if (isPlaying && !isBuffering) {
                    val posDelta = Math.abs(position - lastReportedPosition)

                    if (posDelta < 0.5) {
                        if (now - lastPositionChangeTime > STUCK_THRESHOLD_MS) {
                            Log.w(TAG, "Stuck detected at ${position}s")
                            ExoPlayerModule.emitPlaybackState(
                                isPlaying = true,
                                position = position,
                                duration = totalDuration,
                                isBuffering = false,
                                didJustFinish = false,
                                isStuck = true
                            )
                            lastPositionChangeTime = now
                            mainHandler.postDelayed(this, POSITION_UPDATE_INTERVAL_MS)
                            return
                        }
                    } else {
                        lastReportedPosition = position
                        lastPositionChangeTime = now
                    }
                }

                // Emit position to JS
                ExoPlayerModule.emitPlaybackState(
                    isPlaying = isPlaying,
                    position = position,
                    duration = totalDuration,
                    isBuffering = isBuffering,
                    didJustFinish = false,
                    isStuck = false
                )

                // Update MediaSession state on a fixed interval (every ~1s, not every 100ms)
                // to keep lock screen/Android Auto in sync without excessive updates.
                // Uses wall-clock time instead of unreliable modulo on position.
                if (now - lastMediaSessionUpdateTime >= MEDIA_SESSION_UPDATE_INTERVAL_MS) {
                    lastMediaSessionUpdateTime = now
                    updateMediaSessionState()
                }

                mainHandler.postDelayed(this, POSITION_UPDATE_INTERVAL_MS)
            }
        }

        positionUpdateRunnable = runnable
        mainHandler.post(runnable)
    }

    private fun stopPositionUpdates() {
        positionUpdateRunnable?.let { mainHandler.removeCallbacks(it) }
        positionUpdateRunnable = null
    }

    // ── ExoPlayer event listener ──────────────────────────────────────

    private inner class PlayerEventListener : Player.Listener {

        override fun onPlaybackStateChanged(playbackState: Int) {
            val stateName = when (playbackState) {
                Player.STATE_IDLE -> "IDLE"
                Player.STATE_BUFFERING -> "BUFFERING"
                Player.STATE_READY -> "READY"
                Player.STATE_ENDED -> "ENDED"
                else -> "UNKNOWN($playbackState)"
            }
            Log.d(TAG, "onPlaybackStateChanged: $stateName")

            when (playbackState) {
                Player.STATE_ENDED -> {
                    val player = exoPlayer ?: return
                    // Check if this is truly the end of the playlist
                    if (player.currentMediaItemIndex >= player.mediaItemCount - 1) {
                        hasReachedEnd = true
                        Log.d(TAG, "Book complete — last track ended")
                        ExoPlayerModule.emitPlaybackState(
                            isPlaying = false,
                            position = totalDuration,
                            duration = totalDuration,
                            isBuffering = false,
                            didJustFinish = true,
                            isStuck = false
                        )
                        ExoPlayerModule.emitEvent("onBookEnd", null)
                        updateMediaSessionState()
                    }
                }
                Player.STATE_READY -> {
                    Log.d(TAG, "ExoPlayer STATE_READY — audio prepared and ready to play")
                    cancelPrepareTimeout()
                    prepareCallback?.let { cb ->
                        prepareCallback = null
                        cb(true, null)
                    }
                    updateMediaSessionState()
                }
                Player.STATE_BUFFERING -> {
                    Log.d(TAG, "ExoPlayer STATE_BUFFERING — waiting for data...")
                    updateMediaSessionState()
                }
                Player.STATE_IDLE -> {
                    // Player stopped or not initialized
                }
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            Log.d(TAG, "onIsPlayingChanged: $isPlaying")
            updateMediaSessionState()
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val player = exoPlayer ?: return
            val newIndex = player.currentMediaItemIndex
            Log.d(TAG, "Track transition: $currentTrackIndex → $newIndex (reason=$reason)")

            currentTrackIndex = newIndex

            // Emit track change event to JS
            val trackData = Bundle().apply {
                putInt("trackIndex", newIndex)
                putInt("totalTracks", tracks.size)
                if (newIndex < tracks.size) {
                    putString("title", tracks[newIndex].title)
                    putDouble("startOffset", tracks[newIndex].startOffset)
                }
            }
            ExoPlayerModule.emitEvent("onTrackChange", trackData)
        }

        override fun onPlayerError(error: PlaybackException) {
            Log.e(TAG, "Player error: ${error.message}, code=${error.errorCode}, cause=${error.cause}")

            // Cancel prepare timeout — error is the resolution
            cancelPrepareTimeout()
            prepareCallback?.let { cb ->
                prepareCallback = null
                cb(false, error.message ?: "Playback error (code ${error.errorCode})")
            }

            val errorData = Bundle().apply {
                putString("message", error.message ?: "Unknown error")
                putInt("errorCode", error.errorCode)
                putDouble("position", getCurrentPositionSec())
            }

            // Detect URL expiration (HTTP 403/401)
            val isAuthError = error.errorCode == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
            if (isAuthError) {
                errorData.putString("type", "URL_EXPIRED")
                Log.e(TAG, "HTTP error — likely expired/invalid streaming URL")
            } else {
                errorData.putString("type", "PLAYBACK_ERROR")
            }

            ExoPlayerModule.emitEvent("onError", errorData)
        }
    }

    // ── Legacy MediaSession callback (for Android Auto compatibility) ──

    /**
     * Handles commands from Android Auto, lock screen, and notification.
     * These commands are forwarded to JS via ExoPlayerModule events,
     * EXCEPT play/pause/seek which are handled natively by ExoPlayer.
     */
    private inner class LegacyMediaSessionCallback : MediaSessionCompat.Callback() {

        override fun onPlay() {
            Log.d(TAG, "MediaSession: onPlay")
            play()
        }

        override fun onPause() {
            Log.d(TAG, "MediaSession: onPause")
            pause()
        }

        override fun onStop() {
            Log.d(TAG, "MediaSession: onStop")
            pause()
        }

        override fun onSeekTo(pos: Long) {
            Log.d(TAG, "MediaSession: onSeekTo $pos ms")
            seekTo(pos / 1000.0)
        }

        override fun onSkipToNext() {
            Log.d(TAG, "MediaSession: onSkipToNext")
            // Forward to JS for chapter navigation
            ExoPlayerModule.emitEvent("onRemoteCommand", Bundle().apply {
                putString("command", "nextChapter")
            })
        }

        override fun onSkipToPrevious() {
            Log.d(TAG, "MediaSession: onSkipToPrevious")
            ExoPlayerModule.emitEvent("onRemoteCommand", Bundle().apply {
                putString("command", "prevChapter")
            })
        }

        override fun onFastForward() {
            Log.d(TAG, "MediaSession: onFastForward")
            ExoPlayerModule.emitEvent("onRemoteCommand", Bundle().apply {
                putString("command", "skipForward")
            })
        }

        override fun onRewind() {
            Log.d(TAG, "MediaSession: onRewind")
            ExoPlayerModule.emitEvent("onRemoteCommand", Bundle().apply {
                putString("command", "skipBackward")
            })
        }

        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
            Log.d(TAG, "MediaSession: onPlayFromMediaId: $mediaId")
            mediaId?.let { id ->
                val itemId = if (id.startsWith("item:")) id.removePrefix("item:") else id
                ExoPlayerModule.emitEvent("onRemoteCommand", Bundle().apply {
                    putString("command", "playFromMediaId")
                    putString("param", itemId)
                })
            }
        }

        override fun onPlayFromSearch(query: String?, extras: Bundle?) {
            Log.d(TAG, "MediaSession: onPlayFromSearch: $query")
            ExoPlayerModule.emitEvent("onRemoteCommand", Bundle().apply {
                putString("command", "playFromSearch")
                putString("param", query ?: "")
            })
        }
    }
}
