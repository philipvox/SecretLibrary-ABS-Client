/**
 * src/features/player/services/audioService.ts
 *
 * Audio playback using expo-audio (compatible with New Architecture)
 * With expo-media-control for lock screen / notification controls
 */

import {
  createAudioPlayer,
  AudioPlayer,
  AudioStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { Platform } from 'react-native';

// Try to import expo-media-control, but handle if native module is missing (Expo Go)
let MediaControl: any = null;
let MediaPlaybackState: any = null;
let Command: any = null;
type MediaControlEvent = any;

try {
  const mediaControlModule = require('expo-media-control');
  MediaControl = mediaControlModule.MediaControl;
  MediaPlaybackState = mediaControlModule.PlaybackState;
  Command = mediaControlModule.Command;
} catch (e) {
  audioLog.warn('[AudioService] expo-media-control not available (Expo Go mode)');
}

// Try to import audio-noisy-module for Android headphone unplug detection
let AudioNoisyModule: any = null;
try {
  AudioNoisyModule = require('@modules/audio-noisy-module');
} catch (e) {
  // Module may not be available in Expo Go
  if (Platform.OS === 'android') {
    audioLog.warn('[AudioService] audio-noisy-module not available');
  }
}

// Remote command callback type for chapter navigation
type RemoteCommandCallback = (command: 'nextChapter' | 'prevChapter') => void;
let remoteCommandCallback: RemoteCommandCallback | null = null;

import {
  audioLog,
  createTimer,
  logSection,
  validateUrl,
  formatDuration,
} from '@/shared/utils/audioDebug';
import { getErrorMessage } from '@/shared/utils/errorUtils';
import { bufferRecoveryService } from './bufferRecoveryService';

export interface PlaybackState {
  isPlaying: boolean;
  position: number;       // Global position across all tracks
  duration: number;       // Total duration of all tracks
  isBuffering: boolean;
  didJustFinish: boolean; // True when last track in queue ends
  isStuck?: boolean;      // True when playback appears stuck (position unchanged for 5+ seconds)
}

export interface AudioTrackInfo {
  url: string;
  title: string;
  startOffset: number;    // Global start position of this track
  duration: number;
}

// Error types for error callback
export type AudioErrorType = 'URL_EXPIRED' | 'NETWORK_ERROR' | 'LOAD_FAILED';

export interface AudioError {
  type: AudioErrorType;
  message: string;
  httpStatus?: number;      // HTTP status code if applicable
  position?: number;        // Position when error occurred (for resume)
  bookId?: string;          // Book ID for session refresh
}

type StatusCallback = (status: PlaybackState) => void;
type ErrorCallback = (error: AudioError) => void;

const DEBUG = __DEV__;
const log = (...args: unknown[]) => audioLog.audio(args.map(String).join(' '));

class AudioService {
  private player: AudioPlayer | null = null;
  private preloadPlayer: AudioPlayer | null = null; // Pre-buffer next track
  private preloadedTrackIndex: number = -1; // Index of preloaded track
  private isSetup = false;
  private statusCallback: StatusCallback | null = null;
  private errorCallback: ErrorCallback | null = null;  // Callback for errors like URL expiration
  private currentBookId: string | null = null;  // Track current book for error reporting
  private currentUrl: string | null = null;
  private isLoaded = false;
  private progressInterval: NodeJS.Timeout | null = null;
  private setupPromise: Promise<void> | null = null;
  private loadId = 0; // Track load requests to cancel stale ones
  private tracks: AudioTrackInfo[] = []; // All tracks for multi-file books
  private currentTrackIndex = 0; // Current track in multi-file mode
  private totalDuration = 0; // Total duration across all tracks
  private lastKnownGoodPosition = 0; // Cache position during track switches to prevent flash to 0
  private metadata: { title?: string; artist?: string; artwork?: string } = {};
  private pendingSeekAfterLoad: number | null = null;
  private autoPlayAfterLoad = true;
  private hasReachedEnd = false; // Prevent repeated end handling
  private mediaControlEnabled = false;
  private removeMediaControlListener: (() => void) | null = null;
  private audioNoisySubscription: { remove: () => void } | null = null;  // Android headphone unplug

  // Buffer recovery tracking
  private wasBuffering = false;  // Track buffering state transitions

  // Dynamic polling rates for better performance
  private readonly POLL_RATE_PLAYING = 100;  // Sub-second accuracy (10 updates/sec)
  private readonly POLL_RATE_PAUSED = 2000;  // Save battery when paused
  private currentPollRate = 100;

  // Pre-buffer threshold (seconds before track end to start preloading)
  // 60 seconds gives ample time to prefetch next chapter for smooth transitions
  private readonly PRELOAD_THRESHOLD = 60;

  // Media control position update counter (every N updates)
  private mediaControlUpdateCounter = 0;
  private readonly MEDIA_CONTROL_UPDATE_INTERVAL = 10; // ~1 second at 100ms

  // Scrubbing optimization: debounce track changes during rapid seeking
  private isScrubbing = false;
  // Skip SmartRewind after scrubbing (prevents race condition with AsyncStorage clear)
  private skipNextSmartRewind = false;
  private lastSeekTime = 0;
  private pendingTrackSwitch: { trackIndex: number; positionInTrack: number } | null = null;
  private trackSwitchTimeout: NodeJS.Timeout | null = null;

  // Track switch synchronization - prevents stale position updates during switch
  private trackSwitchInProgress = false;
  private trackSwitchStartTime = 0;

  // Event listener tracking - prevents listener stacking on retry
  private playbackStatusSubscription: { remove: () => void } | null = null;

  // Continuous stuck detection - monitors playback during active play
  private stuckDetectionLastPosition = 0;
  private stuckDetectionLastTime = 0;
  private readonly STUCK_THRESHOLD_MS = 5000; // 5 seconds without position change = stuck

  // NETWORK RETRY CONFIG - for transient network failures (not 403/401)
  private readonly MAX_LOAD_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 1000;  // 1s, 2s, 4s exponential backoff

  constructor() {
    // Pre-warm on construction - don't await, let it run in background
    this.setupPromise = this.setup();
  }

  /**
   * Ensures the audio service is set up and ready.
   * Call this at app startup for eager initialization.
   * Safe to call multiple times - will reuse existing setup or retry if failed.
   */
  async ensureSetup(): Promise<void> {
    log('ensureSetup called, isSetup:', this.isSetup);

    // If already set up, return immediately
    if (this.isSetup) {
      log('Already set up, returning');
      return;
    }

    // If there's an existing setup promise, wait for it
    if (this.setupPromise) {
      try {
        log('Waiting for existing setup promise...');
        await this.setupPromise;
        return;
      } catch (error) {
        // Setup failed, will retry below
        audioLog.warn('Previous setup failed, retrying...');
      }
    }

    // (Re)attempt setup
    this.setupPromise = this.setup();
    await this.setupPromise;
  }

  private async setup(): Promise<void> {
    if (this.isSetup) return;

    const timing = createTimer('expo-audio.setup');

    try {
      logSection('EXPO-AUDIO SETUP');
      timing('Start');

      // Configure audio mode for background playback
      // CRITICAL: Use 'doNotMix' to properly handle audio focus
      // - On iOS: Pauses when other apps play audio (phone calls, Siri, etc.)
      // - On Android: Pauses when audio focus is lost (calls, navigation, assistant)
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'doNotMix', // iOS: Pause when other audio plays
        interruptionModeAndroid: 'doNotMix', // Android: Pause on audio focus loss
      });
      timing('setAudioModeAsync done (with audio focus handling)');

      // Create the audio player with no source (will be set when loading audio)
      // Note: Empty string '' causes ExoPlayer to try opening "/" which fails on Android
      this.player = createAudioPlayer({});
      timing('createAudioPlayer done');

      // Create preload player for seamless track transitions
      this.preloadPlayer = createAudioPlayer({});
      timing('preloadPlayer created');

      // Set up event listeners
      this.setupEventListeners();
      timing('event listeners done');

      // Initialize media controls for lock screen / notification
      await this.setupMediaControls();
      timing('media controls done');

      // Set up Android headphone unplug detection
      await this.setupAudioNoisyListener();
      timing('audio noisy listener done');

      this.isSetup = true;
      log('expo-audio ready');
    } catch (error) {
      audioLog.error('Setup failed:', getErrorMessage(error));
      audioLog.error('Stack:', (error instanceof Error ? error.stack : undefined));
      this.setupPromise = null;
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.player) return;

    // CRITICAL: Remove old listener before adding new one to prevent listener stacking
    // This can happen if setup() fails after adding listeners and is retried
    if (this.playbackStatusSubscription) {
      log('Removing previous playback status listener');
      this.playbackStatusSubscription.remove();
      this.playbackStatusSubscription = null;
    }

    // Listen for playback status updates
    this.playbackStatusSubscription = this.player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      // DEBUG: Log significant status changes
      const currentPos = this.player?.currentTime || 0;
      const isPlaying = this.player?.playing || false;
      const duration = this.player?.duration || 0;

      // Log when playback stops unexpectedly
      if (status.didJustFinish) {
        log(`🛑 STATUS: didJustFinish=true | pos=${currentPos.toFixed(1)}s | duration=${duration.toFixed(1)}s | totalDur=${this.totalDuration.toFixed(1)}s | tracks=${this.tracks.length} | hasReachedEnd=${this.hasReachedEnd} | isLoaded=${this.isLoaded}`);
        log(`🛑 Full status: playbackState=${status.playbackState} | timeControl=${status.timeControlStatus} | waitReason=${status.reasonForWaitingToPlay} | isBuffering=${status.isBuffering} | isLoaded=${status.isLoaded}`);
      }

      // Log if playback is waiting for some reason
      if (status.reasonForWaitingToPlay && status.reasonForWaitingToPlay !== 'none') {
        log(`⏳ WAITING: reason=${status.reasonForWaitingToPlay} | pos=${currentPos.toFixed(1)}s | playbackState=${status.playbackState}`);
      }

      // Handle track end - only once per load, and only if still loaded
      if (status.didJustFinish && !this.hasReachedEnd && this.isLoaded) {
        this.handleTrackEnd();
      }
    });

    // Note: expo-audio doesn't have a playbackError event
    // Errors will show up in playbackStatusUpdate with error property
  }

  /**
   * Initialize media controls for lock screen and notification center
   */
  private async setupMediaControls(): Promise<void> {
    // Skip if native module not available (Expo Go mode)
    if (!MediaControl || !Command) {
      log('Media controls not available (Expo Go mode) - skipping');
      return;
    }

    try {
      log('Setting up media controls...');

      await MediaControl.enableMediaControls({
        capabilities: [
          Command.PLAY,
          Command.PAUSE,
          Command.SKIP_FORWARD,
          Command.SKIP_BACKWARD,
          Command.SEEK,
          Command.NEXT_TRACK,      // For chapter navigation
          Command.PREVIOUS_TRACK,  // For chapter navigation
        ],
        notification: {
          color: '#1a1a1a',
        },
        ios: {
          skipInterval: 30,
        },
        android: {
          skipInterval: 30,
          // Show compact controls with skip buttons
          compactCapabilities: [
            Command.SKIP_BACKWARD,
            Command.PLAY,
            Command.PAUSE,
            Command.SKIP_FORWARD,
          ],
        },
      });

      // Set up event listener for remote commands
      this.removeMediaControlListener = MediaControl.addListener(
        (event: MediaControlEvent) => {
          this.handleMediaControlEvent(event);
        }
      );

      this.mediaControlEnabled = true;
      log('Media controls enabled');
    } catch (error) {
      audioLog.warn('Media controls setup failed:', getErrorMessage(error));
      // Non-fatal - continue without media controls
    }
  }

  /**
   * Set up Android headphone unplug detection.
   * When headphones are unplugged, we pause playback automatically.
   * iOS handles this natively through expo-audio's route change notification.
   */
  private async setupAudioNoisyListener(): Promise<void> {
    // Only needed on Android - iOS handles this natively
    if (Platform.OS !== 'android' || !AudioNoisyModule) {
      return;
    }

    try {
      // Start listening for audio becoming noisy events
      await AudioNoisyModule.startListening();

      // Add listener to pause when headphones are unplugged
      this.audioNoisySubscription = AudioNoisyModule.addAudioNoisyListener(
        (event: { reason: string; timestamp: number }) => {
          audioLog.warn('[HEADPHONE_UNPLUG] Audio becoming noisy - pausing playback');
          this.pause();
        }
      );

      log('Audio noisy listener set up (Android headphone unplug detection)');
    } catch (error) {
      audioLog.warn('Audio noisy listener setup failed:', getErrorMessage(error));
      // Non-fatal - playback continues without this feature
    }
  }

  /**
   * Handle remote control events from lock screen / notification
   */
  private handleMediaControlEvent(event: MediaControlEvent): void {
    audioLog.audio(`📱 Media control event: ${event.command} (PLAY=${Command?.PLAY}, PAUSE=${Command?.PAUSE})`);

    switch (event.command) {
      case Command.PLAY:
        audioLog.audio('📱 Received PLAY command from notification');
        this.play();
        break;
      case Command.PAUSE:
        audioLog.audio('📱 Received PAUSE command from notification');
        this.pause();
        break;
      case Command.SKIP_FORWARD:
        // Skip forward 30 seconds
        this.getPosition().then((pos) => {
          const newPos = Math.min(pos + 30, this.totalDuration);
          this.seekTo(newPos);
        });
        break;
      case Command.SKIP_BACKWARD:
        // Skip backward 30 seconds
        this.getPosition().then((pos) => {
          const newPos = Math.max(pos - 30, 0);
          this.seekTo(newPos);
        });
        break;
      case Command.SEEK:
        if (event.data?.position !== undefined) {
          this.seekTo(event.data.position);
        }
        break;
      case Command.NEXT_TRACK:
        // Delegate to player store for chapter navigation
        if (remoteCommandCallback) {
          remoteCommandCallback('nextChapter');
        }
        break;
      case Command.PREVIOUS_TRACK:
        // Delegate to player store for chapter navigation
        if (remoteCommandCallback) {
          remoteCommandCallback('prevChapter');
        }
        break;
    }
  }

  /**
   * Set callback for remote commands that need to be handled by player store
   */
  setRemoteCommandCallback(callback: RemoteCommandCallback | null): void {
    remoteCommandCallback = callback;
  }

  /**
   * Update media control metadata (call when loading new audio)
   * This is critical for lock screen display on both iOS and Android
   */
  private async updateMediaControlMetadata(): Promise<void> {
    if (!this.mediaControlEnabled || !MediaControl) {
      log('Media controls not enabled, skipping metadata update');
      return;
    }

    const metadata = {
      title: this.metadata.title || 'Unknown Title',
      artist: this.metadata.artist || 'Unknown Author',
      duration: this.totalDuration,
      artwork: this.metadata.artwork ? { uri: this.metadata.artwork } : undefined,
    };

    log('Updating media control metadata:', {
      title: metadata.title,
      artist: metadata.artist,
      duration: metadata.duration,
      hasArtwork: !!metadata.artwork,
    });

    try {
      await MediaControl.updateMetadata(metadata);
      log('Media metadata updated successfully');
    } catch (error) {
      audioLog.error('Failed to update media metadata:', getErrorMessage(error), (error instanceof Error ? error.stack : undefined));
    }
  }

  /**
   * Update media control playback state
   * This updates the lock screen play/pause button state
   */
  private async updateMediaControlPlaybackState(
    isPlaying: boolean,
    position?: number
  ): Promise<void> {
    if (!this.mediaControlEnabled || !MediaControl || !MediaPlaybackState) {
      log('Media controls not enabled, skipping playback state update');
      return;
    }

    try {
      const state = isPlaying ? MediaPlaybackState.PLAYING : MediaPlaybackState.PAUSED;
      const pos = position ?? this.getGlobalPositionSync();
      log('Updating playback state:', { isPlaying, state, position: pos });
      await MediaControl.updatePlaybackState(state, pos);
    } catch (error) {
      audioLog.error('Failed to update playback state:', getErrorMessage(error));
    }
  }

  /**
   * Pre-buffer the next track for seamless transitions.
   * Called when approaching the end of the current track.
   */
  private async preloadNextTrack(): Promise<void> {
    const nextIndex = this.currentTrackIndex + 1;

    // Don't preload if already preloaded or no more tracks
    if (nextIndex >= this.tracks.length) return;
    if (this.preloadedTrackIndex === nextIndex) return;
    if (!this.preloadPlayer) return;

    const nextTrack = this.tracks[nextIndex];
    log(`Pre-buffering track ${nextIndex}: ${nextTrack.title}`);

    try {
      this.preloadPlayer.replace({ uri: nextTrack.url });
      this.preloadedTrackIndex = nextIndex;
    } catch (err: any) {
      audioLog.warn('Preload failed:', err.message);
    }
  }

  private async handleTrackEnd(): Promise<void> {
    // Don't handle if already unloaded or not properly loaded
    if (!this.isLoaded) {
      log('🔸 handleTrackEnd called but not loaded - ignoring');
      return;
    }

    const currentPlayerPos = this.player?.currentTime || 0;
    const playerDuration = this.player?.duration || 0;
    log(`🔸 handleTrackEnd ENTRY: tracks=${this.tracks.length}, currentIndex=${this.currentTrackIndex}, playerPos=${currentPlayerPos.toFixed(1)}s, playerDur=${playerDuration.toFixed(1)}s, totalDur=${this.totalDuration.toFixed(1)}s`);
    // DIAGNOSTIC: Always log track end to debug 2-chapter issue
    console.error(`[AUDIO_DIAGNOSTIC] handleTrackEnd: track ${this.currentTrackIndex + 1}/${this.tracks.length}, playerPos=${currentPlayerPos.toFixed(1)}s, playerDur=${playerDuration.toFixed(1)}s`);

    // GUARD: Ignore spurious didJustFinish from pre-buffered tracks
    // Pre-buffered tracks can report didJustFinish=true with duration=0 or position=0
    // which causes a cascade of track advances. Only advance if we've actually played.
    if (playerDuration <= 0 || currentPlayerPos < 1) {
      log(`🔸 handleTrackEnd IGNORED: spurious event (dur=${playerDuration.toFixed(1)}s, pos=${currentPlayerPos.toFixed(1)}s)`);
      return;
    }

    // Check if there are more tracks in the queue
    if (this.tracks.length > 0 && this.currentTrackIndex < this.tracks.length - 1) {
      // CRITICAL: Set flag BEFORE changing track index to prevent race conditions
      // This ensures getGlobalPositionSync() returns cached position during transition
      this.trackSwitchInProgress = true;
      this.trackSwitchStartTime = Date.now();

      // Capture position BEFORE changing track index
      const positionBeforeSwitch = this.getGlobalPositionSync();
      this.lastKnownGoodPosition = positionBeforeSwitch;

      // Play next track
      this.currentTrackIndex++;
      const nextTrack = this.tracks[this.currentTrackIndex];
      log(`Auto-advancing to track ${this.currentTrackIndex}: ${nextTrack.title}`);
      // DIAGNOSTIC: Log track advance to help debug 2-chapter issue
      console.error(`[AUDIO_DIAGNOSTIC] Auto-advancing to track ${this.currentTrackIndex + 1}/${this.tracks.length}: ${nextTrack.title}`);

      // Use preloaded player if available for seamless transition
      if (this.preloadedTrackIndex === this.currentTrackIndex && this.preloadPlayer) {
        log('Using pre-buffered track for seamless transition');
        // CRITICAL: Stop the old player BEFORE swapping to prevent multiple audio streams
        this.player?.pause();

        // Remove listener from old player before swap
        if (this.playbackStatusSubscription) {
          this.playbackStatusSubscription.remove();
          this.playbackStatusSubscription = null;
        }

        // Swap players
        const temp = this.player;
        this.player = this.preloadPlayer;
        this.preloadPlayer = temp;

        // Re-attach listener to new player - CRITICAL for detecting next track end
        this.setupEventListeners();

        // Start playback immediately
        this.player?.play();

        // Verify playback started with retry
        await this.verifyPlaybackAfterTransition();

        // Reset preload state and start preloading next-next track
        this.preloadedTrackIndex = -1;
        this.preloadNextTrack();

        // Update lastKnownGoodPosition to new track start
        this.lastKnownGoodPosition = this.tracks[this.currentTrackIndex].startOffset;
      } else {
        // Fallback: load directly (may have brief gap)
        if (this.player) {
          log('[Audio] Loading next track directly (no preload available)');
          this.player.replace({ uri: nextTrack.url });
          this.player.play();

          // Wait for track to be ready with retry logic
          let trackReady = await this.waitForTrackReady(2000);
          if (!trackReady) {
            // Retry once on timeout
            log('[Audio] Track load timeout - retrying...');
            this.player.replace({ uri: nextTrack.url });
            this.player.play();
            trackReady = await this.waitForTrackReady(3000);
            if (!trackReady) {
              audioLog.error('[Audio] Track load failed after retry - chapter may be stuck');
            }
          }

          // Verify playback started with retry
          await this.verifyPlaybackAfterTransition();

          // Update lastKnownGoodPosition to new track start
          this.lastKnownGoodPosition = this.tracks[this.currentTrackIndex].startOffset;
        }
      }

      // Clear flag after transition is complete
      this.trackSwitchInProgress = false;
    } else if (this.tracks.length === 0) {
      // Single-track mode - check if we're actually at the end
      const currentPos = await this.getPosition();
      const nearEnd = this.totalDuration > 0 && currentPos >= this.totalDuration - 5;
      const playerPos = this.player?.currentTime || 0;
      const playerDur = this.player?.duration || 0;
      const playerPlaying = this.player?.playing || false;

      log(`🔹 SINGLE-TRACK MODE: globalPos=${currentPos.toFixed(1)}s, playerPos=${playerPos.toFixed(1)}s, playerDur=${playerDur.toFixed(1)}s, totalDur=${this.totalDuration.toFixed(1)}s, nearEnd=${nearEnd}, playerPlaying=${playerPlaying}`);

      if (nearEnd) {
        // Actually finished the book
        this.hasReachedEnd = true;
        log('✅ Single track finished - book complete');
        this.statusCallback?.({
          isPlaying: false,
          position: this.totalDuration,
          duration: this.totalDuration,
          isBuffering: false,
          didJustFinish: true,
        });
      } else {
        // Stream segment ended but book not finished - resume playback
        log(`⏯️ Stream segment ended at ${currentPos.toFixed(1)}s of ${this.totalDuration.toFixed(1)}s - attempting resume...`);

        // Check player state before resuming
        if (this.player) {
          log(`⏯️ Player state before resume: playing=${this.player.playing}, currentTime=${this.player.currentTime.toFixed(1)}, duration=${this.player.duration?.toFixed(1) || 'unknown'}`);
          this.player.play();

          // Verify playback resumed with retry logic
          await new Promise(resolve => setTimeout(resolve, 200));
          if (this.player && !this.player.playing && !this.player.isBuffering) {
            audioLog.warn('[Audio] Resume failed on first try - retrying...');
            this.player.play();

            // Second verification
            await new Promise(resolve => setTimeout(resolve, 300));
            if (this.player && !this.player.playing && !this.player.isBuffering) {
              audioLog.error('[Audio] Resume failed after retry - playback may be stuck');
              // Notify via status callback so UI can show error state
              this.statusCallback?.({
                isPlaying: false,
                position: currentPos,
                duration: this.totalDuration,
                isBuffering: false,
                didJustFinish: false,
              });
            }
          }
        } else {
          audioLog.error('[Audio] Cannot resume - player is null!');
        }
      }
    } else {
      // Last track in multi-track mode finished
      this.hasReachedEnd = true;
      log(`Last track (${this.currentTrackIndex + 1}/${this.tracks.length}) finished - book complete`);
      // DIAGNOSTIC: Always log when book is marked complete to debug 2-chapter issue
      console.error(`[AUDIO_DIAGNOSTIC] BOOK MARKED COMPLETE: track ${this.currentTrackIndex + 1}/${this.tracks.length}, totalDuration=${this.totalDuration.toFixed(1)}s`);
      this.statusCallback?.({
        isPlaying: false,
        position: this.totalDuration,
        duration: this.totalDuration,
        isBuffering: false,
        didJustFinish: true,
      });
    }
  }


  private getGlobalPositionSync(): number {
    if (!this.player) return this.lastKnownGoodPosition;

    // During track switch, return cached position to prevent UI flash to chapter 1
    // Also during scrubbing, trust the cached position set by seekTo()
    if (this.trackSwitchInProgress || this.isScrubbing) {
      return this.lastKnownGoodPosition;
    }

    let position: number;

    // For multi-track: add track's startOffset to get global position
    if (this.tracks.length > 0 && this.currentTrackIndex < this.tracks.length) {
      position = this.tracks[this.currentTrackIndex].startOffset + this.player.currentTime;
    } else {
      position = this.player.currentTime;
    }

    // Log significant position changes for debugging (> 30 seconds)
    // Note: We removed the strict 60s rejection because it was blocking legitimate
    // track switches and seeks. The trackSwitchInProgress and isScrubbing flags
    // already provide protection during transitions.
    const positionDelta = Math.abs(position - this.lastKnownGoodPosition);
    if (position > 0) {
      if (this.lastKnownGoodPosition > 0 && positionDelta > 30) {
        console.warn(`[POSITION_CHANGE] Large change (${positionDelta.toFixed(1)}s):`, {
          from: this.lastKnownGoodPosition.toFixed(1),
          to: position.toFixed(1),
          trackIndex: this.currentTrackIndex,
          playerCurrentTime: this.player?.currentTime?.toFixed(1),
        });
      }
      this.lastKnownGoodPosition = position;
    }

    return this.lastKnownGoodPosition;
  }

  getIsLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Check if audio is currently playing (for stuck detection)
   */
  getIsPlaying(): boolean {
    return this.player?.playing ?? false;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  setStatusUpdateCallback(callback: StatusCallback | null): void {
    this.statusCallback = callback;

    if (callback) {
      this.startProgressUpdates();
    } else {
      this.stopProgressUpdates();
    }
  }

  /**
   * Set callback for playback errors (URL expiration, network errors)
   * Used by playerStore to handle session refresh when URLs expire
   */
  setErrorCallback(callback: ErrorCallback | null): void {
    this.errorCallback = callback;
  }

  /**
   * Set the current book ID for error reporting
   * Called when loading a book so errors can include bookId for session refresh
   */
  setCurrentBookId(bookId: string | null): void {
    this.currentBookId = bookId;
  }

  /**
   * Report an error to the error callback if set
   */
  private reportError(type: AudioErrorType, message: string, httpStatus?: number): void {
    if (this.errorCallback) {
      this.errorCallback({
        type,
        message,
        httpStatus,
        position: this.lastKnownGoodPosition,
        bookId: this.currentBookId ?? undefined,
      });
    }
  }

  // Track last logged position for periodic debug output
  private lastLoggedPosition: number = 0;
  private playbackStartTime: number = 0;

  private startProgressUpdates(): void {
    this.stopProgressUpdates();
    this.playbackStartTime = Date.now();
    this.wasBuffering = false;

    // Start buffer recovery monitoring
    bufferRecoveryService.start({
      onRecoveryStart: () => {
        log('Buffer recovery started');
      },
      onRecoverySuccess: () => {
        log('Buffer recovery succeeded');
      },
      onRecoveryFailed: (attempts) => {
        audioLog.error(`Buffer recovery failed after ${attempts} attempts`);
        // Notify via error callback so UI can show user message
        this.errorCallback?.({
          type: 'NETWORK_ERROR',
          message: 'Streaming interrupted - please check your connection',
          position: this.getGlobalPositionSync(),
          bookId: this.currentBookId || undefined,
        });
      },
      getCurrentPosition: () => this.getGlobalPositionSync(),
      onSeekForRecovery: async (newPosition) => {
        await this.seekTo(newPosition);
      },
      retryPlay: async () => {
        try {
          await this.play();
          return this.player?.playing || false;
        } catch {
          return false;
        }
      },
    });

    const updateProgress = () => {
      if (!this.isLoaded || !this.player) return;

      // Track switch timeout fallback - clear flag after 1500ms
      // (extended from 500ms to handle slower network/track loads)
      if (this.trackSwitchInProgress) {
        const elapsed = Date.now() - this.trackSwitchStartTime;
        if (elapsed >= 1500) {
          log('Track switch timeout - clearing flag');
          this.trackSwitchInProgress = false;
        }
      }

      try {
        // ALWAYS get position from getGlobalPositionSync - it returns cached value during
        // track switch/scrubbing, ensuring consistent position even during transitions
        const position = this.getGlobalPositionSync();
        const isPlaying = this.player.playing;
        const isBuffering = this.player.isBuffering;

        // Report buffering state transitions to buffer recovery service
        if (isBuffering && !this.wasBuffering) {
          bufferRecoveryService.reportBufferingStarted();
        } else if (!isBuffering && this.wasBuffering) {
          bufferRecoveryService.reportBufferingEnded();
        }
        this.wasBuffering = isBuffering;

        // DEBUG: Log every 60 seconds of playback progress
        if (isPlaying && position - this.lastLoggedPosition >= 60) {
          const elapsed = ((Date.now() - this.playbackStartTime) / 1000).toFixed(0);
          log(`📍 PROGRESS: pos=${position.toFixed(1)}s (${(position/60).toFixed(1)}min) / ${this.totalDuration.toFixed(1)}s | wallTime=${elapsed}s | playing=${isPlaying} | buffering=${isBuffering}`);
          this.lastLoggedPosition = position;
        }

        // Dynamic polling: faster when playing, slower when paused
        const targetRate = isPlaying ? this.POLL_RATE_PLAYING : this.POLL_RATE_PAUSED;
        if (targetRate !== this.currentPollRate) {
          this.currentPollRate = targetRate;
          this.stopProgressUpdates();
          this.progressInterval = setInterval(updateProgress, this.currentPollRate);
        }

        // Trigger preload when approaching end of current track
        if (isPlaying && this.tracks.length > 1) {
          const currentTrack = this.tracks[this.currentTrackIndex];
          if (currentTrack) {
            const positionInTrack = position - currentTrack.startOffset;
            const timeRemaining = currentTrack.duration - positionInTrack;
            if (timeRemaining > 0 && timeRemaining < this.PRELOAD_THRESHOLD) {
              this.preloadNextTrack();
            }
          }
        }

        // Periodically sync position with media controls (for lock screen progress)
        if (isPlaying && this.mediaControlEnabled && MediaControl && MediaPlaybackState) {
          this.mediaControlUpdateCounter++;
          if (this.mediaControlUpdateCounter >= this.MEDIA_CONTROL_UPDATE_INTERVAL) {
            this.mediaControlUpdateCounter = 0;
            MediaControl.updatePlaybackState(MediaPlaybackState.PLAYING, position).catch(() => {});
          }
        }

        // CONTINUOUS STUCK DETECTION: Check if position is unchanged while "playing"
        // Only check when playing and not buffering (buffering is expected to pause position)
        if (isPlaying && !isBuffering && !this.trackSwitchInProgress && !this.isScrubbing) {
          const now = Date.now();
          const positionDelta = Math.abs(position - this.stuckDetectionLastPosition);

          if (positionDelta < 0.5) {
            // Position hasn't changed significantly
            if (now - this.stuckDetectionLastTime > this.STUCK_THRESHOLD_MS) {
              // STUCK! Position same for 5+ seconds while "playing"
              audioLog.warn(`[STUCK] Audio stuck - position unchanged at ${position.toFixed(1)}s for ${this.STUCK_THRESHOLD_MS}ms`);
              this.statusCallback?.({
                isPlaying,
                position,
                duration: this.totalDuration || this.player.duration,
                isBuffering,
                didJustFinish: false,
                isStuck: true,
              });
              // Reset timer to avoid spamming stuck events
              this.stuckDetectionLastTime = now;
              return; // Skip normal callback this cycle
            }
          } else {
            // Position changed, reset detection timer
            this.stuckDetectionLastPosition = position;
            this.stuckDetectionLastTime = now;
          }
        }

        this.statusCallback?.({
          isPlaying,
          position,
          duration: this.totalDuration || this.player.duration,
          isBuffering,
          didJustFinish: false,
        });
      } catch (e: any) {
        if (e.message && !e.message.includes('not initialized')) {
          audioLog.error('Progress update error:', e.message);
        }
      }
    };

    this.progressInterval = setInterval(updateProgress, this.currentPollRate);
  }

  private stopProgressUpdates(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    // Stop buffer recovery monitoring
    bufferRecoveryService.stop();
  }

  async loadAudio(
    url: string,
    startPositionSec: number = 0,
    metadata?: { title?: string; artist?: string; artwork?: string },
    autoPlay: boolean = true,
    knownDuration?: number  // Pass duration from session to skip waiting
  ): Promise<void> {
    const thisLoadId = ++this.loadId;
    const timing = createTimer('loadAudio');

    logSection('LOAD AUDIO (single track)');
    log('URL:', url.substring(0, 100) + (url.length > 100 ? '...' : ''));
    log('Start position:', startPositionSec.toFixed(1) + 's');
    log('AutoPlay:', autoPlay);
    log('Known duration:', knownDuration ? formatDuration(knownDuration) : 'none');

    // Validate URL
    if (!validateUrl(url, 'loadAudio')) {
      audioLog.error('Invalid URL provided to loadAudio');
      throw new Error('Invalid audio URL');
    }

    // Ensure setup is done first
    timing('Ensuring setup');
    await this.ensureSetup();
    timing('Setup ready');

    if (this.loadId !== thisLoadId) {
      log('Cancelled - newer load started');
      return;
    }

    // Reset buffer recovery for new playback session
    bufferRecoveryService.resetStatus();

    try {
      this.metadata = metadata || {};
      this.tracks = [];
      this.currentTrackIndex = 0;
      this.lastKnownGoodPosition = 0; // Reset position cache for new load
      this.hasReachedEnd = false; // Reset end flag for new load
      // Use known duration immediately if provided
      this.totalDuration = knownDuration || 0;
      // Reset debug tracking
      this.lastLoggedPosition = 0;
      this.playbackStartTime = Date.now();
      // Reset stuck detection for new load
      this.stuckDetectionLastPosition = 0;
      this.stuckDetectionLastTime = Date.now();

      timing('Loading audio with retry');
      await this.loadUrlWithRetry(url);

      if (this.loadId !== thisLoadId) {
        log('Cancelled after load');
        return;
      }
      timing('Audio loaded');

      this.currentUrl = url;
      this.isLoaded = true;

      // Skip waiting if we have known duration - start playback immediately!
      if (!knownDuration) {
        // Only wait if we don't know the duration (rare case)
        await this.waitForDuration(2000); // Reduced from 5s to 2s
        this.totalDuration = this.player?.duration || 0;
      }

      // Seek and play in parallel with duration detection
      if (startPositionSec > 0) {
        log(`Seeking to ${formatDuration(startPositionSec)}`);
        timing('Seeking');
        this.player?.seekTo(startPositionSec);
        timing('Seek done');
      }

      if (this.loadId !== thisLoadId) {
        log('Cancelled after seek');
        return;
      }

      if (autoPlay) {
        timing('Starting playback');
        this.player?.play();
        timing('Playback started');
      } else {
        // WORKAROUND: Prime the player with play-pause to initialize buffering
        // expo-audio has issues where calling play() later on an unprimed player
        // gets stuck in perpetual buffering state. See expo/expo#34162
        // NOTE: Mute during priming to prevent audible playback
        log('Priming player (silent play-pause trick)');
        if (this.player) {
          this.player.volume = 0;
          this.player.play();
          // Wait for playback to initialize - 500ms gives time for network buffering
          await new Promise(resolve => setTimeout(resolve, 500));
          this.player.pause();
          this.player.volume = 1;
        }
        log('Ready (paused, primed for playback)');
      }
      timing('Load complete');

      // Update duration from player in background if we used knownDuration
      if (knownDuration && this.player) {
        setTimeout(() => {
          if (this.player && this.player.duration > 0) {
            this.totalDuration = this.player.duration;
          }
        }, 1000);
      }

      // Update media controls with metadata
      await this.updateMediaControlMetadata();
      await this.updateMediaControlPlaybackState(autoPlay, startPositionSec);
    } catch (error) {
      if (this.loadId === thisLoadId) {
        const errorMsg = getErrorMessage(error);
        audioLog.error('Load failed:', errorMsg);
        audioLog.error('Stack:', (error instanceof Error ? error.stack : undefined));
        this.isLoaded = false;

        // URL_EXPIRED DETECTION: Check for 403/401 errors indicating session/token expiration
        // These can occur when streaming URLs expire or authentication tokens become invalid
        const is403 = errorMsg.includes('403') || errorMsg.toLowerCase().includes('forbidden');
        const is401 = errorMsg.includes('401') || errorMsg.toLowerCase().includes('unauthorized');

        if (is403 || is401) {
          audioLog.warn('[URL_EXPIRED] Detected expired URL/session - reporting for refresh');
          this.reportError('URL_EXPIRED', `Streaming URL expired (${is403 ? '403' : '401'})`, is403 ? 403 : 401);
        } else {
          this.reportError('LOAD_FAILED', errorMsg);
        }

        throw error;
      }
    }
  }

  private async waitForDuration(maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.player && this.player.duration > 0) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    log('Warning: Duration not available after waiting');
  }

  /**
   * Load audio URL with retry on network failures (CDN/server failover)
   * Retries with exponential backoff for transient network errors
   * Does NOT retry on 403/401 (those are handled by URL_EXPIRED)
   */
  private async loadUrlWithRetry(url: string): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_LOAD_RETRIES; attempt++) {
      try {
        if (this.player) {
          this.player.replace({ uri: url });
          // Wait briefly to detect immediate load failures
          await new Promise(resolve => setTimeout(resolve, 200));

          // Check if player is in error state (heuristic: duration is 0 or NaN after load)
          // Note: expo-audio may not throw on HTTP errors, they manifest as playback failures
          if (this.player.duration === 0 || Number.isNaN(this.player.duration)) {
            // Could be normal (duration not yet loaded) or an error
            // Wait a bit more for streaming content
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          return; // Success
        } else {
          throw new Error('Player not initialized');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = getErrorMessage(error);

        // Don't retry on auth errors - these need session refresh, not retries
        if (errorMsg.includes('403') || errorMsg.includes('401') ||
            errorMsg.toLowerCase().includes('forbidden') ||
            errorMsg.toLowerCase().includes('unauthorized')) {
          log(`[RETRY] Auth error detected (${errorMsg}) - not retrying`);
          throw error;
        }

        if (attempt < this.MAX_LOAD_RETRIES - 1) {
          const delay = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          audioLog.warn(`[RETRY] Load failed (attempt ${attempt + 1}/${this.MAX_LOAD_RETRIES}): ${errorMsg}`);
          audioLog.warn(`[RETRY] Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          audioLog.error(`[RETRY] All ${this.MAX_LOAD_RETRIES} attempts failed`);
        }
      }
    }

    // All retries exhausted
    this.reportError('NETWORK_ERROR', `Failed to load audio after ${this.MAX_LOAD_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
    throw lastError || new Error('Failed to load audio');
  }

  /**
   * Load multiple audio tracks (for multi-file audiobooks)
   * Adds all tracks to the queue and seeks to the correct position
   */
  async loadTracks(
    tracks: AudioTrackInfo[],
    startPositionSec: number = 0,
    metadata?: { title?: string; artist?: string; artwork?: string },
    autoPlay: boolean = true,
    knownTotalDuration?: number  // Pass total duration to skip calculation
  ): Promise<void> {
    const thisLoadId = ++this.loadId;
    const timing = createTimer('loadTracks');

    logSection('LOAD AUDIO (multi-track)');
    log(`Track count: ${tracks.length}`);
    log(`Start position: ${formatDuration(startPositionSec)} (${startPositionSec.toFixed(1)}s)`);
    log('AutoPlay:', autoPlay);

    // DIAGNOSTIC: Always log track count to help debug 2-chapter issue
    console.error(`[AUDIO_DIAGNOSTIC] Loading ${tracks.length} audio tracks, total duration: ${knownTotalDuration || 'calculating'}s`);

    // Log track details (only first and last to save time)
    if (tracks.length <= 3) {
      tracks.forEach((track, i) => {
        log(`  Track ${i}: offset=${formatDuration(track.startOffset)}, duration=${formatDuration(track.duration)}`);
      });
    } else {
      log(`  Track 0: offset=${formatDuration(tracks[0].startOffset)}, duration=${formatDuration(tracks[0].duration)}`);
      log(`  ... ${tracks.length - 2} more tracks ...`);
      log(`  Track ${tracks.length - 1}: offset=${formatDuration(tracks[tracks.length - 1].startOffset)}, duration=${formatDuration(tracks[tracks.length - 1].duration)}`);
    }

    await this.ensureSetup();
    if (this.loadId !== thisLoadId) return;

    // Reset buffer recovery for new playback session
    bufferRecoveryService.resetStatus();

    try {
      this.metadata = metadata || {};
      this.tracks = tracks;
      this.hasReachedEnd = false; // Reset end flag for new load
      // Use known duration or calculate from tracks
      this.totalDuration = knownTotalDuration || tracks.reduce((sum, t) => sum + t.duration, 0);
      log(`Total duration: ${formatDuration(this.totalDuration)}`);
      // Reset stuck detection for new load
      this.stuckDetectionLastPosition = 0;
      this.stuckDetectionLastTime = Date.now();

      // Find which track contains the start position
      let targetTrackIndex = 0;
      let positionInTrack = startPositionSec;

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (startPositionSec >= track.startOffset && startPositionSec < track.startOffset + track.duration) {
          targetTrackIndex = i;
          positionInTrack = startPositionSec - track.startOffset;
          break;
        }
        if (i === tracks.length - 1) {
          targetTrackIndex = i;
          positionInTrack = Math.min(startPositionSec - track.startOffset, track.duration);
        }
      }

      this.currentTrackIndex = targetTrackIndex;
      const firstTrack = tracks[targetTrackIndex];
      log(`Starting with track ${targetTrackIndex}, position ${formatDuration(positionInTrack)}`);
      log(`Platform: ${Platform.OS}`);
      log(`First track URL: ${firstTrack.url}`);

      // Verify file exists on Android before loading (helps diagnose file access issues)
      if (Platform.OS === 'android' && firstTrack.url.startsWith('file://')) {
        try {
          const FileSystem = await import('expo-file-system/legacy');
          const fileInfo = await FileSystem.getInfoAsync(firstTrack.url);
          const fileSize = fileInfo.exists && 'size' in fileInfo ? (fileInfo as { size: number }).size : 'unknown';
          log(`File exists: ${fileInfo.exists}, size: ${fileSize}`);
          if (!fileInfo.exists) {
            throw new Error(`Audio file not found: ${firstTrack.url}`);
          }
        } catch (fsError) {
          audioLog.error('File verification failed:', getErrorMessage(fsError));
          // Continue anyway - expo-audio might still be able to load it
        }
      }

      timing('Loading first track with retry');
      await this.loadUrlWithRetry(firstTrack.url);
      if (this.loadId !== thisLoadId) return;
      timing('First track loaded');

      this.currentUrl = firstTrack.url;
      this.isLoaded = true;

      // Seek within track if needed
      if (positionInTrack > 0) {
        log(`Seeking within track to ${formatDuration(positionInTrack)}`);
        timing('Seeking');
        this.player?.seekTo(positionInTrack);
        timing('Seek done');
      }
      if (this.loadId !== thisLoadId) return;

      if (autoPlay) {
        timing('Starting playback');
        this.player?.play();
        timing('Playback started');
      } else {
        // WORKAROUND: Prime the player with play-pause to initialize buffering
        // expo-audio has issues where calling play() later on an unprimed player
        // gets stuck in perpetual buffering state. See expo/expo#34162
        // NOTE: Mute during priming to prevent audible playback
        log('Priming player (silent play-pause trick)');
        if (this.player) {
          this.player.volume = 0;
          this.player.play();
          // Wait for playback to initialize - 500ms gives time for network buffering
          await new Promise(resolve => setTimeout(resolve, 500));
          this.player.pause();
          this.player.volume = 1;
        }
        log('Ready (paused, primed for playback)');
      }
      timing('Load complete');

      // Update media controls with metadata
      await this.updateMediaControlMetadata();
      await this.updateMediaControlPlaybackState(autoPlay, startPositionSec);
    } catch (error) {
      if (this.loadId === thisLoadId) {
        const errorMsg = getErrorMessage(error);
        audioLog.error('Load tracks failed:', errorMsg);
        audioLog.error('Stack:', (error instanceof Error ? error.stack : undefined));
        this.isLoaded = false;

        // URL_EXPIRED DETECTION: Check for 403/401 errors indicating session/token expiration
        // These can occur when streaming URLs expire or authentication tokens become invalid
        const is403 = errorMsg.includes('403') || errorMsg.toLowerCase().includes('forbidden');
        const is401 = errorMsg.includes('401') || errorMsg.toLowerCase().includes('unauthorized');

        if (is403 || is401) {
          audioLog.warn('[URL_EXPIRED] Detected expired URL/session - reporting for refresh');
          this.reportError('URL_EXPIRED', `Streaming URL expired (${is403 ? '403' : '401'})`, is403 ? 403 : 401);
        } else {
          this.reportError('LOAD_FAILED', errorMsg);
        }

        throw error;
      }
    }
  }

  /**
   * Seek to a global position across all tracks
   * Finds the correct track and seeks within it
   * Optimized for rapid scrubbing - debounces track switches
   */
  async seekToGlobal(globalPositionSec: number): Promise<void> {
    if (!this.player) return;

    if (this.tracks.length === 0) {
      // Single track mode - just seek directly
      await this.player.seekTo(globalPositionSec);
      return;
    }

    // Find which track contains this position
    let targetTrackIndex = 0;
    let positionInTrack = globalPositionSec;

    for (let i = 0; i < this.tracks.length; i++) {
      const track = this.tracks[i];
      if (globalPositionSec >= track.startOffset && globalPositionSec < track.startOffset + track.duration) {
        targetTrackIndex = i;
        positionInTrack = globalPositionSec - track.startOffset;
        break;
      }
      // If we're past the last track, stay on it
      if (i === this.tracks.length - 1) {
        targetTrackIndex = i;
        positionInTrack = Math.min(globalPositionSec - track.startOffset, track.duration);
      }
    }

    // If seeking to very near the end of a track, move to start of next track instead
    // This prevents immediate track-end events
    const track = this.tracks[targetTrackIndex];
    const trackDuration = track.duration;
    const nearEndThreshold = 0.5; // Within 0.5 seconds of track end

    if (positionInTrack >= trackDuration - nearEndThreshold && targetTrackIndex < this.tracks.length - 1) {
      // Move to start of next track instead
      targetTrackIndex++;
      positionInTrack = 0;
    }

    // If we need to change tracks
    if (targetTrackIndex !== this.currentTrackIndex) {
      // During scrubbing, debounce track switches to avoid rapid loading
      if (this.isScrubbing) {
        // Queue the track switch but don't execute immediately
        this.pendingTrackSwitch = { trackIndex: targetTrackIndex, positionInTrack };

        // Clear existing timeout
        if (this.trackSwitchTimeout) {
          clearTimeout(this.trackSwitchTimeout);
        }

        // Execute track switch after scrubbing settles
        // Increased from 50ms to 150ms - 50ms was too short for typical scrub gestures
        // and caused pending track switches to be overwritten during rapid scrubbing
        this.trackSwitchTimeout = setTimeout(() => {
          if (this.pendingTrackSwitch) {
            this.executeTrackSwitch(
              this.pendingTrackSwitch.trackIndex,
              this.pendingTrackSwitch.positionInTrack
            );
            this.pendingTrackSwitch = null;
          }
        }, 150);
        return;
      }

      // Not scrubbing - execute track switch immediately
      await this.executeTrackSwitch(targetTrackIndex, positionInTrack);
    } else {
      // Same track - seek directly (fast path)
      await this.player.seekTo(positionInTrack);
    }
  }

  /**
   * Execute a track switch - separated for debouncing during scrubbing
   * Uses pendingSeekAfterLoad to ensure seek happens after track is ready
   */
  private async executeTrackSwitch(targetTrackIndex: number, positionInTrack: number): Promise<void> {
    if (!this.player) return;

    // CRITICAL: Set flag FIRST to prevent race condition where currentTrackIndex
    // is updated but flag isn't set, causing getGlobalPositionSync to return bad value
    this.trackSwitchInProgress = true;
    this.trackSwitchStartTime = Date.now();

    const wasPlaying = this.player.playing;
    const newTrack = this.tracks[targetTrackIndex];

    // FIX: Set lastKnownGoodPosition to TARGET position BEFORE changing currentTrackIndex
    // This ensures that if the flag clears prematurely for any reason, getGlobalPositionSync()
    // will return the correct target position instead of a stale value
    const targetGlobalPosition = newTrack.startOffset + positionInTrack;
    log(`📍 Pre-setting lastKnownGoodPosition to ${targetGlobalPosition.toFixed(1)}s before track switch`);
    this.lastKnownGoodPosition = targetGlobalPosition;

    this.currentTrackIndex = targetTrackIndex;

    log(`⏩ Track switch → ${targetTrackIndex}, pos ${positionInTrack.toFixed(1)}s`);

    // Check if we have this track preloaded for instant switch
    if (this.preloadedTrackIndex === targetTrackIndex && this.preloadPlayer) {
      // CRITICAL: Stop the old player BEFORE swapping to prevent multiple audio streams
      this.player.pause();

      // Swap players for seamless transition
      const temp = this.player;
      this.player = this.preloadPlayer;
      this.preloadPlayer = temp;
      this.preloadedTrackIndex = -1;

      await this.player.seekTo(positionInTrack);
      if (wasPlaying) {
        this.player.play();
      }
      // Clear flag - seek is complete
      this.trackSwitchInProgress = false;
      return;
    }

    // Store the desired seek position - will be applied after track loads
    this.pendingSeekAfterLoad = positionInTrack;

    // CRITICAL: Pause before replacing to prevent audio overlap
    this.player.pause();

    // Load the new track
    this.player.replace({ uri: newTrack.url });

    // Wait for the player to be ready before seeking
    // expo-audio needs time to initialize after replace()
    await this.waitForTrackReady();

    // Now perform the seek
    if (this.pendingSeekAfterLoad !== null) {
      log(`📍 Applying pending seek to ${this.pendingSeekAfterLoad.toFixed(1)}s`);
      await this.player.seekTo(this.pendingSeekAfterLoad);
      this.pendingSeekAfterLoad = null;
    }

    if (wasPlaying) {
      this.player.play();
    }

    // Refine lastKnownGoodPosition with actual player position after seek completes
    // (We pre-set it before track switch as a safety net, now we update with actual value)
    if (this.player && this.tracks.length > 0 && targetTrackIndex < this.tracks.length) {
      const refinedPosition = this.tracks[targetTrackIndex].startOffset + this.player.currentTime;
      log(`📍 Refined lastKnownGoodPosition: ${this.lastKnownGoodPosition.toFixed(1)}s → ${refinedPosition.toFixed(1)}s`);
      this.lastKnownGoodPosition = refinedPosition;
    }

    // Clear flag after seek is complete
    this.trackSwitchInProgress = false;
  }

  /**
   * Wait for the current track to be ready for seeking
   * Polls player.duration until it's available (indicates track is loaded)
   * Returns true if track is ready, false if timeout occurred
   * Increased default timeout to 2000ms for slower networks
   */
  private async waitForTrackReady(maxWaitMs: number = 2000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.player && this.player.duration > 0) {
        log(`Track ready after ${Date.now() - startTime}ms, duration: ${this.player.duration.toFixed(1)}s`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    audioLog.warn(`[Audio] Track ready timeout after ${maxWaitMs}ms - may need retry`);
    return false;
  }

  /**
   * Verify playback actually started after a track transition.
   * Retries play command if player is not playing/buffering.
   */
  private async verifyPlaybackAfterTransition(): Promise<void> {
    if (!this.player) return;

    // Wait a brief moment for playback to initialize
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check if playing or buffering
    if (this.player.playing || this.player.isBuffering) {
      log('[Audio] Track transition verified - playback active');
      return;
    }

    // First retry
    log('[Audio] Track transition: playback not started, retrying...');
    this.player.play();
    await new Promise(resolve => setTimeout(resolve, 300));

    if (this.player.playing || this.player.isBuffering) {
      log('[Audio] Track transition verified after retry');
      return;
    }

    // Second retry
    audioLog.warn('[Audio] Track transition: second retry...');
    this.player.play();
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!this.player.playing && !this.player.isBuffering) {
      audioLog.error('[Audio] Track transition: playback failed to start after retries');
      // Emit status update so UI knows playback stopped
      this.statusCallback?.({
        isPlaying: false,
        position: this.getGlobalPositionSync(),
        duration: this.totalDuration,
        isBuffering: false,
        didJustFinish: false,
      });
    } else {
      log('[Audio] Track transition verified after second retry');
    }
  }

  /**
   * Check if currently in a scrubbing session
   */
  getIsScrubbing(): boolean {
    return this.isScrubbing;
  }

  /**
   * Check if player is in a transition state (track switch, scrubbing, etc.)
   * Use this to guard against position overwrites during transitions
   */
  isInTransition(): boolean {
    return this.trackSwitchInProgress || this.isScrubbing;
  }

  /**
   * Mark start of scrubbing session - enables optimizations
   */
  setScrubbing(scrubbing: boolean): void {
    this.isScrubbing = scrubbing;

    if (scrubbing) {
      // Scrubbing started - skip SmartRewind on next play
      // This prevents race condition where AsyncStorage clear hasn't completed
      this.skipNextSmartRewind = true;
    }

    if (!scrubbing) {
      // Scrubbing ended - clear any pending track switch
      // The final seekTo() call will handle the actual seek with the correct position
      if (this.trackSwitchTimeout) {
        clearTimeout(this.trackSwitchTimeout);
        this.trackSwitchTimeout = null;
      }
      // Clear pending switch - let the subsequent seekTo handle it
      this.pendingTrackSwitch = null;
    }
  }

  /**
   * Check and consume the skipNextSmartRewind flag.
   * Returns true if SmartRewind should be skipped, then clears the flag.
   */
  consumeSkipSmartRewind(): boolean {
    if (this.skipNextSmartRewind) {
      this.skipNextSmartRewind = false;
      return true;
    }
    return false;
  }

  async play(): Promise<void> {
    log('▶ Play');
    if (!this.player) {
      audioLog.error('Play called but player is null');
      throw new Error('Player not initialized');
    }

    try {
      this.player.play();

      // Verify playback started within 500ms
      const startTime = Date.now();
      while (Date.now() - startTime < 500) {
        if (this.player.playing || this.player.isBuffering) {
          // Playback started or buffering - success
          await this.updateMediaControlPlaybackState(true);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // If still not playing after 500ms, log warning but don't throw
      // (could be slow network, will be caught by stuck detection)
      audioLog.warn('Play: Playback not started after 500ms, may be slow network');
      await this.updateMediaControlPlaybackState(true);
    } catch (error) {
      audioLog.error('Play failed:', getErrorMessage(error));
      throw error;
    }
  }

  async pause(): Promise<void> {
    log('⏸ Pause');
    if (!this.player) {
      audioLog.warn('Pause called but player is null');
      return;
    }
    try {
      this.player.pause();
      this.updateMediaControlPlaybackState(false);

      // GHOST PAUSED DETECTION: Verify audio actually stopped
      // If the player is still playing after 500ms, we have a ghost paused state
      setTimeout(() => {
        if (this.player?.playing) {
          audioLog.warn('[GHOST_PAUSED] Audio still playing after pause command - forcing stop');
          // Try pause again
          this.player?.pause();
          // If still playing after second attempt, notify via callback
          setTimeout(() => {
            if (this.player?.playing) {
              audioLog.error('[GHOST_PAUSED] Failed to pause after 2 attempts');
              // Notify the status callback about the issue
              this.statusCallback?.({
                isPlaying: true, // Tell UI that audio is actually still playing
                position: this.getGlobalPositionSync(),
                duration: this.totalDuration,
                isBuffering: false,
                didJustFinish: false,
              });
            }
          }, 200);
        }
      }, 500);
    } catch (error) {
      audioLog.warn('Pause failed:', getErrorMessage(error));
    }
  }

  /**
   * Set the cached position without seeking audio.
   * Use during scrubbing to keep lastKnownGoodPosition in sync
   * with UI position even when actual audio seeks are throttled.
   */
  setPosition(positionSec: number): void {
    this.lastKnownGoodPosition = positionSec;
  }

  async seekTo(positionSec: number): Promise<void> {
    // Reset end flag on seek (allows replay after seeking backward)
    this.hasReachedEnd = false;

    // Update cached position immediately to prevent UI flash during seek
    this.lastKnownGoodPosition = positionSec;

    // Use global seek if we have multiple tracks
    if (this.tracks.length > 0) {
      await this.seekToGlobal(positionSec);
    } else if (this.player) {
      log(`⏩ Seek to ${positionSec.toFixed(1)}s`);
      await this.player.seekTo(positionSec);
    }
  }

  async setPlaybackRate(rate: number): Promise<void> {
    log(`Speed: ${rate}x`);
    if (!this.player) return;

    // Android needs pitch correction enabled separately
    // IMPORTANT: Must await for immediate effect
    if (Platform.OS === 'android') {
      this.player.shouldCorrectPitch = true;
      await this.player.setPlaybackRate(rate);
    } else {
      // iOS supports pitch correction quality parameter
      await this.player.setPlaybackRate(rate, 'high');
    }
  }

  async getPosition(): Promise<number> {
    return this.getGlobalPositionSync();
  }

  /**
   * Get the last known good position (for use during scrubbing/seeking)
   */
  getLastKnownGoodPosition(): number {
    return this.lastKnownGoodPosition;
  }

  async getDuration(): Promise<number> {
    if (this.totalDuration > 0) return this.totalDuration;
    return this.player?.duration || 0;
  }

  async unloadAudio(): Promise<void> {
    this.loadId++; // Cancel any pending loads
    this.stopProgressUpdates();

    if (this.player) {
      this.player.pause();
      // Don't replace with empty string - it causes ExoPlayer to try opening "/"
      // Just pause is sufficient for unloading
    }

    // Clean up preload player - just leave it, don't try to clear with empty URI
    // Preload player will be overwritten on next use

    // Update media controls to stopped state
    if (this.mediaControlEnabled && MediaControl && MediaPlaybackState) {
      try {
        await MediaControl.updatePlaybackState(MediaPlaybackState.STOPPED);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    this.currentUrl = null;
    this.isLoaded = false;
    this.tracks = [];
    this.currentTrackIndex = 0;
    this.totalDuration = 0;
    this.lastKnownGoodPosition = 0; // Reset position cache
    this.preloadedTrackIndex = -1;
    this.currentPollRate = 100; // Reset poll rate
    this.hasReachedEnd = false; // Reset end flag
  }

  /**
   * Get the underlying AudioPlayer instance for advanced features like audio sampling
   */
  getPlayer(): AudioPlayer | null {
    return this.player;
  }

  /**
   * Enable or disable audio sampling for waveform visualization
   */
  setAudioSamplingEnabled(enabled: boolean): void {
    // Audio sampling is an optional feature - use duck typing to check for method
    const playerWithSampling = this.player as AudioPlayer & { setAudioSamplingEnabled?: (enabled: boolean) => void };
    if (playerWithSampling?.setAudioSamplingEnabled) {
      playerWithSampling.setAudioSamplingEnabled(enabled);
    }
  }

  /**
   * Add a listener for audio sample updates
   * Returns a cleanup function to remove the listener
   */
  addAudioSampleListener(callback: (sample: { channels: Float32Array[]; sampleRate: number; timestamp: number }) => void): (() => void) | null {
    if (!this.player || !('addListener' in this.player)) {
      return null;
    }
    try {
      this.setAudioSamplingEnabled(true);
      type PlayerWithSampling = AudioPlayer & { addListener: (event: string, cb: (sample: unknown) => void) => { remove: () => void } };
      const wrappedCallback = (sample: unknown) => {
        callback(sample as { channels: Float32Array[]; sampleRate: number; timestamp: number });
      };
      const subscription = (this.player as PlayerWithSampling).addListener('audioSampleUpdate', wrappedCallback);
      return () => {
        subscription?.remove?.();
        this.setAudioSamplingEnabled(false);
      };
    } catch (e) {
      audioLog.warn('[AudioService] Audio sampling not supported:', e);
      return null;
    }
  }

  /**
   * Clean up media controls (call on app unmount if needed)
   */
  async cleanup(): Promise<void> {
    await this.unloadAudio();

    // Remove playback status listener
    if (this.playbackStatusSubscription) {
      this.playbackStatusSubscription.remove();
      this.playbackStatusSubscription = null;
    }

    // Remove media control listener
    if (this.removeMediaControlListener) {
      this.removeMediaControlListener();
      this.removeMediaControlListener = null;
    }

    // Disable media controls
    if (this.mediaControlEnabled && MediaControl) {
      try {
        await MediaControl.disableMediaControls();
        this.mediaControlEnabled = false;
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    // Clean up Android headphone unplug listener
    if (this.audioNoisySubscription) {
      this.audioNoisySubscription.remove();
      this.audioNoisySubscription = null;
    }
    if (Platform.OS === 'android' && AudioNoisyModule) {
      try {
        await AudioNoisyModule.stopListening();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  }
}

export const audioService = new AudioService();
