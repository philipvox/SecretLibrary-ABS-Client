/**
 * src/features/player/services/audioService.ts
 *
 * Audio playback using expo-audio (compatible with New Architecture)
 */

import {
  createAudioPlayer,
  AudioPlayer,
  AudioStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { Platform } from 'react-native';

import {
  audioLog,
  createTimer,
  logSection,
  validateUrl,
  formatDuration,
} from '@/shared/utils/audioDebug';

export interface PlaybackState {
  isPlaying: boolean;
  position: number;       // Global position across all tracks
  duration: number;       // Total duration of all tracks
  isBuffering: boolean;
  didJustFinish: boolean; // True when last track in queue ends
}

export interface AudioTrackInfo {
  url: string;
  title: string;
  startOffset: number;    // Global start position of this track
  duration: number;
}

type StatusCallback = (status: PlaybackState) => void;

const DEBUG = __DEV__;
const log = (...args: any[]) => audioLog.audio(args.join(' '));

class AudioService {
  private player: AudioPlayer | null = null;
  private preloadPlayer: AudioPlayer | null = null; // Pre-buffer next track
  private preloadedTrackIndex: number = -1; // Index of preloaded track
  private isSetup = false;
  private statusCallback: StatusCallback | null = null;
  private currentUrl: string | null = null;
  private isLoaded = false;
  private progressInterval: NodeJS.Timeout | null = null;
  private setupPromise: Promise<void> | null = null;
  private loadId = 0; // Track load requests to cancel stale ones
  private tracks: AudioTrackInfo[] = []; // All tracks for multi-file books
  private currentTrackIndex = 0; // Current track in multi-file mode
  private totalDuration = 0; // Total duration across all tracks
  private metadata: { title?: string; artist?: string; artwork?: string } = {};
  private pendingSeekAfterLoad: number | null = null;
  private autoPlayAfterLoad = true;
  private hasReachedEnd = false; // Prevent repeated end handling

  // Dynamic polling rates for better performance
  private readonly POLL_RATE_PLAYING = 250;  // More responsive when playing
  private readonly POLL_RATE_PAUSED = 2000;  // Save battery when paused
  private currentPollRate = 500;

  // Pre-buffer threshold (seconds before track end to start preloading)
  private readonly PRELOAD_THRESHOLD = 30;

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
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        shouldRouteThroughEarpiece: false,
      });
      timing('setAudioModeAsync done');

      // Create the audio player
      this.player = createAudioPlayer({ uri: '' });
      timing('createAudioPlayer done');

      // Create preload player for seamless track transitions
      this.preloadPlayer = createAudioPlayer({ uri: '' });
      timing('preloadPlayer created');

      // Set up event listeners
      this.setupEventListeners();
      timing('event listeners done');

      this.isSetup = true;
      log('expo-audio ready');
    } catch (error: any) {
      audioLog.error('Setup failed:', error.message);
      audioLog.error('Stack:', error.stack);
      this.setupPromise = null;
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.player) return;

    // Listen for playback status updates
    this.player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      // Handle track end - only once per load, and only if still loaded
      if (status.didJustFinish && !this.hasReachedEnd && this.isLoaded) {
        this.handleTrackEnd();
      }
    });

    // Listen for playback errors
    this.player.addListener('playbackError', (error: any) => {
      audioLog.error('Playback error:', error?.message || error);
      audioLog.error('Error details:', JSON.stringify(error));
    });
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
      log('handleTrackEnd called but not loaded - ignoring');
      return;
    }

    log(`handleTrackEnd: tracks=${this.tracks.length}, currentIndex=${this.currentTrackIndex}`);

    // Check if there are more tracks in the queue
    if (this.tracks.length > 0 && this.currentTrackIndex < this.tracks.length - 1) {
      // Play next track
      this.currentTrackIndex++;
      const nextTrack = this.tracks[this.currentTrackIndex];
      log(`Auto-advancing to track ${this.currentTrackIndex}: ${nextTrack.title}`);

      // Use preloaded player if available for seamless transition
      if (this.preloadedTrackIndex === this.currentTrackIndex && this.preloadPlayer) {
        log('Using pre-buffered track for seamless transition');
        // Swap players
        const temp = this.player;
        this.player = this.preloadPlayer;
        this.preloadPlayer = temp;

        // Start playback immediately
        this.player?.play();

        // Reset preload state and start preloading next-next track
        this.preloadedTrackIndex = -1;
        this.preloadNextTrack();
      } else {
        // Fallback: load directly (may have brief gap)
        if (this.player) {
          this.player.replace({ uri: nextTrack.url });
          this.player.play();
        }
      }
    } else if (this.tracks.length === 0) {
      // Single-track mode - check if we're actually at the end
      const currentPos = await this.getPosition();
      const nearEnd = this.totalDuration > 0 && currentPos >= this.totalDuration - 5;

      if (nearEnd) {
        // Actually finished the book
        this.hasReachedEnd = true;
        log('Single track finished - book complete');
        this.statusCallback?.({
          isPlaying: false,
          position: this.totalDuration,
          duration: this.totalDuration,
          isBuffering: false,
          didJustFinish: true,
        });
      } else {
        // Stream segment ended but book not finished - resume playback
        log(`Stream segment ended at ${currentPos}s of ${this.totalDuration}s - resuming`);
        this.player?.play();
      }
    } else {
      // Last track in multi-track mode finished
      this.hasReachedEnd = true;
      log(`Last track (${this.currentTrackIndex + 1}/${this.tracks.length}) finished - book complete`);
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
    if (!this.player) return 0;

    // For multi-track: add track's startOffset to get global position
    if (this.tracks.length > 0 && this.currentTrackIndex < this.tracks.length) {
      return this.tracks[this.currentTrackIndex].startOffset + this.player.currentTime;
    }

    return this.player.currentTime;
  }

  getIsLoaded(): boolean {
    return this.isLoaded;
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

  private startProgressUpdates(): void {
    this.stopProgressUpdates();

    const updateProgress = () => {
      if (!this.isLoaded || !this.player) return;

      try {
        const position = this.getGlobalPositionSync();
        const isPlaying = this.player.playing;
        const isBuffering = this.player.isBuffering;

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

    try {
      this.metadata = metadata || {};
      this.tracks = [];
      this.currentTrackIndex = 0;
      this.hasReachedEnd = false; // Reset end flag for new load
      // Use known duration immediately if provided
      this.totalDuration = knownDuration || 0;

      timing('Loading audio');
      if (this.player) {
        this.player.replace({ uri: url });
      }

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
        log('Priming player (play-pause trick)');
        this.player?.play();
        // Wait for playback to initialize - 500ms gives time for network buffering
        await new Promise(resolve => setTimeout(resolve, 500));
        this.player?.pause();
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
    } catch (error: any) {
      if (this.loadId === thisLoadId) {
        audioLog.error('Load failed:', error.message);
        audioLog.error('Stack:', error.stack);
        this.isLoaded = false;
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

    try {
      this.metadata = metadata || {};
      this.tracks = tracks;
      this.hasReachedEnd = false; // Reset end flag for new load
      // Use known duration or calculate from tracks
      this.totalDuration = knownTotalDuration || tracks.reduce((sum, t) => sum + t.duration, 0);
      log(`Total duration: ${formatDuration(this.totalDuration)}`);

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

      timing('Loading first track');
      if (this.player) {
        this.player.replace({ uri: firstTrack.url });
      }
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
        log('Priming player (play-pause trick)');
        this.player?.play();
        // Wait for playback to initialize - 500ms gives time for network buffering
        await new Promise(resolve => setTimeout(resolve, 500));
        this.player?.pause();
        log('Ready (paused, primed for playback)');
      }
      timing('Load complete');
    } catch (error: any) {
      if (this.loadId === thisLoadId) {
        audioLog.error('Load tracks failed:', error.message);
        audioLog.error('Stack:', error.stack);
        this.isLoaded = false;
        throw error;
      }
    }
  }

  /**
   * Seek to a global position across all tracks
   * Finds the correct track and seeks within it
   */
  async seekToGlobal(globalPositionSec: number): Promise<void> {
    if (!this.player) return;

    if (this.tracks.length === 0) {
      // Single track mode - just seek directly
      this.player.seekTo(globalPositionSec);
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
      log(`⏩ Global seek ${globalPositionSec.toFixed(1)}s → adjusted to track ${targetTrackIndex} start (was near end of previous)`);
    } else {
      log(`⏩ Global seek ${globalPositionSec.toFixed(1)}s → track ${targetTrackIndex}, pos ${positionInTrack.toFixed(1)}s`);
    }

    // If we need to change tracks
    if (targetTrackIndex !== this.currentTrackIndex) {
      const wasPlaying = this.player.playing;
      this.currentTrackIndex = targetTrackIndex;
      const newTrack = this.tracks[targetTrackIndex];

      this.player.replace({ uri: newTrack.url });

      // Wait a moment for the new track to load
      await new Promise(resolve => setTimeout(resolve, 100));

      this.player.seekTo(positionInTrack);

      if (wasPlaying) {
        this.player.play();
      }
    } else {
      this.player.seekTo(positionInTrack);
    }
  }

  async play(): Promise<void> {
    log('▶ Play');
    this.player?.play();
  }

  async pause(): Promise<void> {
    log('⏸ Pause');
    this.player?.pause();
  }

  async seekTo(positionSec: number): Promise<void> {
    // Reset end flag on seek (allows replay after seeking backward)
    this.hasReachedEnd = false;

    // Use global seek if we have multiple tracks
    if (this.tracks.length > 0) {
      await this.seekToGlobal(positionSec);
    } else {
      log(`⏩ Seek to ${positionSec.toFixed(1)}s`);
      this.player?.seekTo(positionSec);
    }
  }

  async setPlaybackRate(rate: number): Promise<void> {
    log(`Speed: ${rate}x`);
    if (!this.player) return;

    // Android needs pitch correction enabled separately
    if (Platform.OS === 'android') {
      this.player.shouldCorrectPitch = true;
      this.player.setPlaybackRate(rate);
    } else {
      // iOS supports pitch correction quality parameter
      this.player.setPlaybackRate(rate, 'high');
    }
  }

  async getPosition(): Promise<number> {
    return this.getGlobalPositionSync();
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
      this.player.replace({ uri: '' });
    }

    // Clean up preload player
    if (this.preloadPlayer) {
      this.preloadPlayer.replace({ uri: '' });
    }

    this.currentUrl = null;
    this.isLoaded = false;
    this.tracks = [];
    this.currentTrackIndex = 0;
    this.totalDuration = 0;
    this.preloadedTrackIndex = -1;
    this.currentPollRate = 500; // Reset poll rate
    this.hasReachedEnd = false; // Reset end flag
  }
}

export const audioService = new AudioService();
