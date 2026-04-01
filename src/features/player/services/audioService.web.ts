/**
 * src/features/player/services/audioService.web.ts
 *
 * Web-specific audio service using HTML5 Audio API.
 * Provides the same public interface as the iOS (AVPlayer) and Android (ExoPlayer)
 * implementations so playerStore.ts sees no difference.
 *
 * Features:
 * - Single-track and multi-track playback via HTMLAudioElement
 * - Automatic track transitions for multi-file audiobooks
 * - Playback rate control (0.25x–4.0x)
 * - Media Session API integration for browser-level controls
 * - Position polling at ~100ms intervals (matching native implementations)
 * - Stuck detection (position unchanged for 5+ seconds while playing)
 * - HTTP 401/403 detection for expired streaming URLs
 */

import {
  audioLog,
  createTimer,
  logSection,
  formatDuration,
  validateUrl,
} from '@/shared/utils/audioDebug';
import { getErrorMessage } from '@/shared/utils/errorUtils';
import type {
  PlaybackState,
  AudioTrackInfo,
  AudioErrorType,
  AudioError,
  StatusCallback,
  ErrorCallback,
  RemoteCommandCallback,
} from './audioServiceTypes';

// Re-export shared types so existing consumers can still import from this file
export type { PlaybackState, AudioTrackInfo, AudioErrorType, AudioError } from './audioServiceTypes';

const log = (...args: unknown[]) => audioLog.audio(args.map(String).join(' '));

// Stuck detection: if position hasn't changed for this long while playing, emit isStuck
const STUCK_THRESHOLD_MS = 5000;

// Position polling interval in ms (matches native 100ms callback rate)
const POSITION_POLL_INTERVAL = 100;

class WebAudioService {
  private statusCallback: StatusCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private remoteCommandCallback: RemoteCommandCallback | null = null;
  private currentBookId: string | null = null;
  private currentUrl: string | null = null;
  private isLoaded = false;
  private isSetup = false;
  private setupPromise: Promise<void> | null = null;
  private loadId = 0;

  // Track state
  private tracks: AudioTrackInfo[] = [];
  private currentTrackIndex = 0;
  private totalDuration = 0;
  private lastKnownGoodPosition = 0;
  private lastIsPlaying = false;

  // Scrubbing state (kept in JS since it's UI-driven)
  private isScrubbing = false;
  private skipNextSmartRewind = false;

  // HTML5 Audio element
  private audio: HTMLAudioElement | null = null;

  // Position polling — uses setTimeout, not setInterval, so each poll
  // waits for the previous emit to complete before scheduling the next
  private pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Stuck detection
  private lastPositionChangeTime = 0;
  private lastReportedPosition = -1;

  // Metadata for Media Session API
  private currentMetadata: { title?: string; artist?: string; artwork?: string } = {};

  // Track transition flag to prevent double-firing
  private isTransitioning = false;

  // Stored listener references for cleanup (prevents duplicates on setup retry)
  private boundOnEnded: (() => void) | null = null;
  private boundOnError: (() => void) | null = null;
  private boundOnPlay: (() => void) | null = null;
  private boundOnPause: (() => void) | null = null;

  constructor() {
    this.setupPromise = this.setup();
  }

  async ensureSetup(): Promise<void> {
    if (this.isSetup) return;
    if (this.setupPromise) {
      try {
        await this.setupPromise;
        return;
      } catch {
        audioLog.warn('Previous setup failed, retrying...');
      }
    }
    this.setupPromise = this.setup();
    await this.setupPromise;
  }

  private async setup(): Promise<void> {
    if (this.isSetup) return;

    const timing = createTimer('web-audio.setup');
    try {
      logSection('WEB AUDIO SETUP');
      timing('Start');

      // Create the audio element
      this.audio = new Audio();
      this.audio.preload = 'auto';

      // Set up event listeners on the audio element
      this.setupAudioEventListeners();
      timing('Audio element created');

      this.isSetup = true;
      log('Web Audio ready');
    } catch (error) {
      audioLog.error('Web Audio setup failed:', getErrorMessage(error));
      this.setupPromise = null;
      throw error;
    }
  }

  private setupAudioEventListeners(): void {
    if (!this.audio) return;

    // Remove previous listeners if any (prevents duplicates on setup retry)
    this.removeAudioEventListeners();

    // Track ended — handle auto-advance to next track
    this.boundOnEnded = () => {
      if (this.isTransitioning) return;

      if (this.tracks.length > 0 && this.currentTrackIndex < this.tracks.length - 1) {
        // Multi-track: advance to next track
        this.advanceToNextTrack();
      } else {
        // Single track or last track: book finished
        log('Book end — last track finished');
        this.lastIsPlaying = false;
        this.statusCallback?.({
          isPlaying: false,
          position: this.totalDuration,
          duration: this.totalDuration,
          isBuffering: false,
          didJustFinish: true,
        });
      }
    };

    // Error handling
    this.boundOnError = () => {
      const mediaError = this.audio?.error;
      const errorMsg = mediaError
        ? `MediaError code=${mediaError.code} message=${mediaError.message || 'unknown'}`
        : 'Unknown audio error';

      audioLog.error('Web Audio error:', errorMsg);

      // MEDIA_ERR_NETWORK (code 2) during playback typically means the streaming
      // URL expired (403/401). Emit URL_EXPIRED so playerStore.handleAudioError()
      // can refresh the session and retry — matching native iOS/Android behavior.
      if (mediaError && mediaError.code === 2) {
        this.errorCallback?.({
          type: 'URL_EXPIRED',
          message: `Network error during playback (likely expired URL)`,
          position: this.lastKnownGoodPosition,
          bookId: this.currentBookId ?? undefined,
        });
      } else {
        this.errorCallback?.({
          type: 'LOAD_FAILED',
          message: errorMsg,
          position: this.lastKnownGoodPosition,
          bookId: this.currentBookId ?? undefined,
        });
      }
    };

    // Playing state change
    this.boundOnPlay = () => {
      this.lastIsPlaying = true;
      this.lastPositionChangeTime = Date.now();
    };

    this.boundOnPause = () => {
      this.lastIsPlaying = false;
    };

    this.audio.addEventListener('ended', this.boundOnEnded);
    this.audio.addEventListener('error', this.boundOnError);
    this.audio.addEventListener('play', this.boundOnPlay);
    this.audio.addEventListener('pause', this.boundOnPause);
  }

  private removeAudioEventListeners(): void {
    if (!this.audio) return;
    if (this.boundOnEnded) this.audio.removeEventListener('ended', this.boundOnEnded);
    if (this.boundOnError) this.audio.removeEventListener('error', this.boundOnError);
    if (this.boundOnPlay) this.audio.removeEventListener('play', this.boundOnPlay);
    if (this.boundOnPause) this.audio.removeEventListener('pause', this.boundOnPause);
    this.boundOnEnded = null;
    this.boundOnError = null;
    this.boundOnPlay = null;
    this.boundOnPause = null;
  }

  /**
   * Advance to the next track in a multi-track audiobook.
   */
  private async advanceToNextTrack(): Promise<void> {
    if (!this.audio || this.isTransitioning) return;

    const nextIndex = this.currentTrackIndex + 1;
    if (nextIndex >= this.tracks.length) return;

    this.isTransitioning = true;
    const nextTrack = this.tracks[nextIndex];
    this.currentTrackIndex = nextIndex;
    this.currentUrl = nextTrack.url;

    log(`Track transition → ${nextIndex + 1}/${this.tracks.length}: ${nextTrack.title}`);

    try {
      this.audio.src = nextTrack.url;
      await this.audio.play();
    } catch (error) {
      audioLog.error('Track transition failed:', getErrorMessage(error));
      this.errorCallback?.({
        type: 'LOAD_FAILED',
        message: getErrorMessage(error),
        position: this.lastKnownGoodPosition,
        bookId: this.currentBookId ?? undefined,
      });
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Start polling for position updates.
   * Emits PlaybackState at ~100ms intervals, matching native behavior.
   * Uses a recursive setTimeout so each poll waits for emit to complete.
   */
  private startPositionPolling(): void {
    this.stopPositionPolling();
    this.lastPositionChangeTime = Date.now();
    this.lastReportedPosition = -1;

    const poll = () => {
      this.emitPlaybackState();
      this.pollTimeoutId = setTimeout(poll, POSITION_POLL_INTERVAL);
    };

    poll();
  }

  /**
   * Stop position polling.
   */
  private stopPositionPolling(): void {
    if (this.pollTimeoutId !== null) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
  }

  /**
   * Calculate the global position across all tracks.
   */
  private getGlobalPosition(): number {
    if (!this.audio) return this.lastKnownGoodPosition;

    if (this.tracks.length > 0 && this.currentTrackIndex < this.tracks.length) {
      return this.tracks[this.currentTrackIndex].startOffset + this.audio.currentTime;
    }

    return this.audio.currentTime;
  }

  /**
   * Emit the current playback state via the status callback.
   */
  private emitPlaybackState(): void {
    if (!this.audio || !this.statusCallback) return;

    const globalPosition = this.getGlobalPosition();
    const isPlaying = !this.audio.paused && !this.audio.ended;
    const isBuffering = this.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && isPlaying;

    // Stuck detection
    let isStuck = false;
    const now = Date.now();
    if (isPlaying && !isBuffering) {
      if (Math.abs(globalPosition - this.lastReportedPosition) > 0.05) {
        this.lastPositionChangeTime = now;
        this.lastReportedPosition = globalPosition;
      } else if (now - this.lastPositionChangeTime > STUCK_THRESHOLD_MS) {
        isStuck = true;
      }
    } else {
      this.lastPositionChangeTime = now;
    }

    // Track isPlaying for sync reads
    this.lastIsPlaying = isPlaying;

    // Skip position updates during scrubbing (same as native path)
    if (!this.isScrubbing) {
      this.lastKnownGoodPosition = globalPosition;
    }

    this.statusCallback({
      isPlaying,
      position: this.isScrubbing ? this.lastKnownGoodPosition : globalPosition,
      duration: this.totalDuration,
      isBuffering,
      didJustFinish: false,
      isStuck: isStuck || undefined,
    });
  }

  /**
   * Update the Media Session API for browser-level controls.
   */
  private updateMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      const artwork: MediaImage[] = [];
      if (this.currentMetadata.artwork) {
        artwork.push({
          src: this.currentMetadata.artwork,
          sizes: '512x512',
          type: 'image/jpeg',
        });
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.currentMetadata.title || 'Unknown Title',
        artist: this.currentMetadata.artist || 'Unknown Author',
        album: 'Secret Library',
        artwork,
      });

      // Set action handlers
      navigator.mediaSession.setActionHandler('play', () => {
        this.play();
        this.remoteCommandCallback?.('play');
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause();
        this.remoteCommandCallback?.('pause');
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          this.seekTo(details.seekTime);
          this.remoteCommandCallback?.('seek', details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.remoteCommandCallback?.('prevChapter');
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.remoteCommandCallback?.('nextChapter');
      });

      navigator.mediaSession.setActionHandler('seekbackward', () => {
        this.remoteCommandCallback?.('skipBackward');
      });

      navigator.mediaSession.setActionHandler('seekforward', () => {
        this.remoteCommandCallback?.('skipForward');
      });
    } catch (error) {
      audioLog.warn('Media Session API error:', getErrorMessage(error));
    }
  }

  /**
   * Update Media Session position state for browser seekbar.
   */
  private updateMediaSessionPositionState(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      if (navigator.mediaSession.setPositionState && this.totalDuration > 0) {
        navigator.mediaSession.setPositionState({
          duration: this.totalDuration,
          playbackRate: this.audio?.playbackRate || 1,
          position: Math.min(this.lastKnownGoodPosition, this.totalDuration),
        });
      }
    } catch {
      // setPositionState can throw if values are out of range
    }
  }

  // ============================================================================
  // PUBLIC API — identical to iOS/Android implementations
  // ============================================================================

  setRemoteCommandCallback(callback: RemoteCommandCallback | null): void {
    this.remoteCommandCallback = callback;
  }

  setStatusUpdateCallback(callback: StatusCallback | null): void {
    this.statusCallback = callback;
  }

  setErrorCallback(callback: ErrorCallback | null): void {
    this.errorCallback = callback;
  }

  setCurrentBookId(bookId: string | null): void {
    this.currentBookId = bookId;
  }

  getIsLoaded(): boolean {
    return this.isLoaded;
  }

  getIsPlaying(): boolean {
    return this.lastIsPlaying;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  getIsScrubbing(): boolean {
    return this.isScrubbing;
  }

  isInTransition(): boolean {
    return this.isScrubbing || this.isTransitioning;
  }

  getLastKnownGoodPosition(): number {
    return this.lastKnownGoodPosition;
  }

  /**
   * Load single track (used for single-file audiobooks or streaming)
   */
  async loadAudio(
    url: string,
    startPositionSec: number = 0,
    metadata?: { title?: string; artist?: string; artwork?: string },
    autoPlay: boolean = true,
    knownDuration?: number
  ): Promise<void> {
    const thisLoadId = ++this.loadId;
    logSection('LOAD AUDIO (Web single track)');
    log('URL:', url.substring(0, 100) + (url.length > 100 ? '...' : ''));
    log('Start position:', startPositionSec.toFixed(1) + 's');

    if (!validateUrl(url, 'loadAudio')) {
      throw new Error('Invalid audio URL');
    }
    if (!Number.isFinite(startPositionSec) || startPositionSec < 0) {
      startPositionSec = 0;
    }

    await this.ensureSetup();
    if (this.loadId !== thisLoadId) return;

    this.tracks = [];
    this.currentTrackIndex = 0;
    this.totalDuration = knownDuration || 0;
    this.lastKnownGoodPosition = startPositionSec;
    this.isScrubbing = false;
    this.isTransitioning = false;
    this.currentMetadata = metadata || {};

    if (!this.audio) {
      throw new Error('Audio element not initialized');
    }

    // Stop polling during load
    this.stopPositionPolling();

    try {
      await this.loadSource(url, startPositionSec, autoPlay);

      if (this.loadId !== thisLoadId) return;

      this.currentUrl = url;
      this.isLoaded = true;

      // Update duration from audio element if not provided
      if (!knownDuration && this.audio.duration && isFinite(this.audio.duration)) {
        this.totalDuration = this.audio.duration;
      }

      // Start position polling
      this.startPositionPolling();

      // Set up Media Session
      this.updateMediaSession();
      this.updateMediaSessionPositionState();

      log('Single track loaded via Web Audio');
    } catch (error) {
      if (this.loadId === thisLoadId) {
        this.isLoaded = false;
        const errorMsg = getErrorMessage(error);
        audioLog.error('Web Audio load failed:', errorMsg);

        const is403 = errorMsg.includes('403') || errorMsg.toLowerCase().includes('forbidden');
        const is401 = errorMsg.includes('401') || errorMsg.toLowerCase().includes('unauthorized');
        if (is403 || is401) {
          this.errorCallback?.({
            type: 'URL_EXPIRED',
            message: `Streaming URL expired (${is403 ? '403' : '401'})`,
            httpStatus: is403 ? 403 : 401,
            position: this.lastKnownGoodPosition,
            bookId: this.currentBookId ?? undefined,
          });
        } else {
          this.errorCallback?.({ type: 'LOAD_FAILED', message: errorMsg });
        }
        throw error;
      }
    }
  }

  /**
   * Load multiple tracks (for multi-file audiobooks)
   */
  async loadTracks(
    tracks: AudioTrackInfo[],
    startPositionSec: number = 0,
    metadata?: { title?: string; artist?: string; artwork?: string },
    autoPlay: boolean = true,
    knownTotalDuration?: number
  ): Promise<void> {
    const thisLoadId = ++this.loadId;
    logSection('LOAD AUDIO (Web multi-track)');

    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      throw new Error('No audio tracks provided');
    }
    if (!Number.isFinite(startPositionSec) || startPositionSec < 0) {
      startPositionSec = 0;
    }

    log(`Track count: ${tracks.length}`);
    log(`Start position: ${formatDuration(startPositionSec)}`);

    await this.ensureSetup();
    if (this.loadId !== thisLoadId) return;

    this.tracks = tracks;
    this.totalDuration = knownTotalDuration || tracks.reduce((sum, t) => sum + t.duration, 0);
    this.lastKnownGoodPosition = startPositionSec;
    this.isScrubbing = false;
    this.isTransitioning = false;
    this.currentMetadata = metadata || {};

    if (!this.audio) {
      throw new Error('Audio element not initialized');
    }

    // Stop polling during load
    this.stopPositionPolling();

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
        positionInTrack = Math.max(0, Math.min(startPositionSec - track.startOffset, track.duration));
      }
    }

    this.currentTrackIndex = targetTrackIndex;

    try {
      const targetTrack = tracks[targetTrackIndex];
      await this.loadSource(targetTrack.url, positionInTrack, autoPlay);

      if (this.loadId !== thisLoadId) return;

      this.currentUrl = targetTrack.url;
      this.isLoaded = true;

      // Start position polling
      this.startPositionPolling();

      // Set up Media Session
      this.updateMediaSession();
      this.updateMediaSessionPositionState();

      log(`${tracks.length} tracks loaded via Web Audio, starting at track ${targetTrackIndex}`);
    } catch (error) {
      if (this.loadId === thisLoadId) {
        this.isLoaded = false;
        const errorMsg = getErrorMessage(error);
        audioLog.error('Web Audio loadTracks failed:', errorMsg);

        const is403 = errorMsg.includes('403') || errorMsg.toLowerCase().includes('forbidden');
        const is401 = errorMsg.includes('401') || errorMsg.toLowerCase().includes('unauthorized');
        if (is403 || is401) {
          this.errorCallback?.({
            type: 'URL_EXPIRED',
            message: `Streaming URL expired (${is403 ? '403' : '401'})`,
            httpStatus: is403 ? 403 : 401,
            position: this.lastKnownGoodPosition,
            bookId: this.currentBookId ?? undefined,
          });
        } else {
          this.errorCallback?.({ type: 'LOAD_FAILED', message: errorMsg });
        }
        throw error;
      }
    }
  }

  /**
   * Load an audio source URL into the HTMLAudioElement.
   * Handles the canplaythrough event to ensure audio is ready before seeking.
   */
  private loadSource(url: string, seekPositionSec: number, autoPlay: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audio) {
        reject(new Error('Audio element not initialized'));
        return;
      }

      const audio = this.audio;
      let resolved = false;

      // Use a pre-flight HEAD request to detect HTTP errors (401/403)
      // that the audio element wouldn't surface clearly
      const checkUrl = async () => {
        try {
          const response = await fetch(url, { method: 'HEAD', mode: 'cors' });
          if (!response.ok) {
            if (!resolved) {
              resolved = true;
              reject(new Error(`HTTP ${response.status} ${response.statusText}`));
            }
            return false;
          }
          return true;
        } catch {
          // CORS or network error — let the audio element handle it
          // (some servers don't support HEAD requests)
          return true;
        }
      };

      const onCanPlay = () => {
        if (resolved) return;
        resolved = true;
        cleanup();

        // Seek to start position
        if (seekPositionSec > 0 && isFinite(audio.duration)) {
          audio.currentTime = Math.min(seekPositionSec, audio.duration);
        }

        if (autoPlay) {
          audio.play().then(() => {
            resolve();
          }).catch((playError) => {
            // Autoplay may be blocked by browser policy
            audioLog.warn('Autoplay blocked by browser:', getErrorMessage(playError));
            // Still resolve — audio is loaded, just not playing
            resolve();
          });
        } else {
          resolve();
        }
      };

      const onError = () => {
        if (resolved) return;
        resolved = true;
        cleanup();

        const mediaError = audio.error;
        reject(new Error(
          mediaError
            ? `MediaError code=${mediaError.code} message=${mediaError.message || 'unknown'}`
            : 'Failed to load audio'
        ));
      };

      // Timeout for slow loads
      const timeoutId = setTimeout(() => {
        if (resolved) return;

        // If audio has enough data to play, consider it loaded
        if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          onCanPlay();
          return;
        }

        resolved = true;
        cleanup();
        reject(new Error('Audio load timed out after 30 seconds'));
      }, 30000);

      const cleanup = () => {
        clearTimeout(timeoutId);
        audio.removeEventListener('canplaythrough', onCanPlay);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
      };

      audio.addEventListener('canplaythrough', onCanPlay);
      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onError);

      // Start loading — check URL first then set src
      checkUrl().then((urlOk) => {
        if (urlOk && !resolved) {
          audio.src = url;
          audio.load();
        }
      });
    });
  }

  async play(): Promise<void> {
    log('▶ Play (Web)');
    if (!this.audio) return;

    try {
      await this.audio.play();
      this.lastIsPlaying = true;

      // Update Media Session playback state
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    } catch (error) {
      audioLog.warn('Play failed:', getErrorMessage(error));
    }
  }

  async pause(): Promise<void> {
    log('⏸ Pause (Web)');
    if (!this.audio) return;

    this.audio.pause();
    this.lastIsPlaying = false;

    // Update Media Session playback state
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  }

  setPosition(positionSec: number): void {
    this.lastKnownGoodPosition = positionSec;
  }

  async seekTo(positionSec: number): Promise<void> {
    this.lastKnownGoodPosition = positionSec;

    if (!this.audio) return;

    if (this.tracks.length > 0) {
      // Multi-track: find which track contains the seek position
      let targetTrackIndex = 0;
      let positionInTrack = positionSec;

      for (let i = 0; i < this.tracks.length; i++) {
        const track = this.tracks[i];
        if (positionSec >= track.startOffset && positionSec < track.startOffset + track.duration) {
          targetTrackIndex = i;
          positionInTrack = positionSec - track.startOffset;
          break;
        }
        if (i === this.tracks.length - 1) {
          targetTrackIndex = i;
          positionInTrack = Math.max(0, Math.min(positionSec - track.startOffset, track.duration));
        }
      }

      if (targetTrackIndex !== this.currentTrackIndex) {
        // Need to switch tracks
        this.isTransitioning = true;
        const wasPlaying = this.lastIsPlaying;
        this.currentTrackIndex = targetTrackIndex;
        this.currentUrl = this.tracks[targetTrackIndex].url;

        log(`Seek across tracks → track ${targetTrackIndex + 1}/${this.tracks.length} @ ${formatDuration(positionInTrack)}`);

        try {
          this.audio.src = this.tracks[targetTrackIndex].url;
          this.audio.load();

          // Wait for enough data to seek
          await new Promise<void>((resolve) => {
            const onReady = () => {
              this.audio?.removeEventListener('canplay', onReady);
              resolve();
            };
            this.audio?.addEventListener('canplay', onReady);
            // Timeout fallback
            setTimeout(resolve, 5000);
          });

          if (isFinite(this.audio.duration)) {
            this.audio.currentTime = Math.min(positionInTrack, this.audio.duration);
          }

          if (wasPlaying) {
            await this.audio.play().catch(() => {});
          }
        } catch (error) {
          audioLog.error('Cross-track seek failed:', getErrorMessage(error));
        } finally {
          this.isTransitioning = false;
        }
      } else {
        // Same track — just seek
        if (isFinite(this.audio.duration)) {
          this.audio.currentTime = Math.min(positionInTrack, this.audio.duration);
        }
      }
    } else {
      // Single track
      if (isFinite(this.audio.duration)) {
        this.audio.currentTime = Math.min(positionSec, this.audio.duration);
      }
    }

    // Update Media Session position
    this.updateMediaSessionPositionState();
  }

  async setPlaybackRate(rate: number): Promise<void> {
    const clampedRate = Math.max(0.25, Math.min(4.0, rate));
    log(`Speed: ${clampedRate}x (Web)`);

    if (this.audio) {
      this.audio.playbackRate = clampedRate;
    }

    // Update Media Session position state with new rate
    this.updateMediaSessionPositionState();
  }

  async getPosition(): Promise<number> {
    return this.lastKnownGoodPosition;
  }

  /**
   * Get the current position directly from the audio element.
   * Works both when playing and paused — playerStore calls this on pause
   * to get the most accurate position before saving progress.
   */
  async getFreshPosition(): Promise<number> {
    if (this.audio && isFinite(this.audio.currentTime)) {
      const fresh = this.getGlobalPosition();
      if (fresh > 0) {
        this.lastKnownGoodPosition = fresh;
        return fresh;
      }
    }
    return this.lastKnownGoodPosition;
  }

  async getDuration(): Promise<number> {
    return this.totalDuration;
  }

  setScrubbing(scrubbing: boolean): void {
    this.isScrubbing = scrubbing;
    if (scrubbing) {
      this.skipNextSmartRewind = true;
    }
  }

  consumeSkipSmartRewind(): boolean {
    if (this.skipNextSmartRewind) {
      this.skipNextSmartRewind = false;
      return true;
    }
    return false;
  }

  async unloadAudio(): Promise<void> {
    this.loadId++;
    this.stopPositionPolling();

    this.currentUrl = null;
    this.isLoaded = false;
    this.tracks = [];
    this.currentTrackIndex = 0;
    this.totalDuration = 0;
    this.lastKnownGoodPosition = 0;
    this.isScrubbing = false;
    this.isTransitioning = false;
    this.currentBookId = null;
    this.currentMetadata = {};

    // Clear callbacks to prevent stale events from firing into wrong book context
    this.statusCallback = null;
    this.errorCallback = null;
    this.remoteCommandCallback = null;

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load(); // Reset the element
    }

    // Clear Media Session
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Get the underlying HTMLAudioElement — useful for audio visualization on web.
   */
  getPlayer(): HTMLAudioElement | null {
    return this.audio;
  }

  setAudioSamplingEnabled(_enabled: boolean): void {
    // Could be implemented with Web Audio API AnalyserNode in the future
  }

  addAudioSampleListener(_callback: any): (() => void) | null {
    // Could be implemented with Web Audio API AnalyserNode in the future
    return null;
  }

  async cleanup(): Promise<void> {
    await this.unloadAudio();
    this.lastIsPlaying = false;
  }
}

export const audioService = new WebAudioService();
