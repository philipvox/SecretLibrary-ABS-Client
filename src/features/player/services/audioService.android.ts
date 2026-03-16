/**
 * src/features/player/services/audioService.android.ts
 *
 * Android-specific audio service using ExoPlayer via native module.
 * Replaces expo-av, expo-media-control, and audio-noisy-module on Android.
 * ExoPlayer handles audio focus, headphone unplug, and notification natively.
 *
 * The public interface is identical to the iOS/expo-av implementation
 * so playerStore.ts sees no difference.
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import {
  audioLog,
  createTimer,
  logSection,
  formatDuration,
  validateUrl,
} from '@/shared/utils/audioDebug';
import { getErrorMessage } from '@/shared/utils/errorUtils';

// Re-export shared types
export interface PlaybackState {
  isPlaying: boolean;
  position: number;       // Global position across all tracks
  duration: number;       // Total duration of all tracks
  isBuffering: boolean;
  didJustFinish: boolean; // True when last track in queue ends
  isStuck?: boolean;      // True when playback appears stuck
}

export interface AudioTrackInfo {
  url: string;
  title: string;
  startOffset: number;    // Global start position of this track
  duration: number;
}

export type AudioErrorType = 'URL_EXPIRED' | 'NETWORK_ERROR' | 'LOAD_FAILED';

export interface AudioError {
  type: AudioErrorType;
  message: string;
  httpStatus?: number;
  position?: number;
  bookId?: string;
}

type StatusCallback = (status: PlaybackState) => void;
type ErrorCallback = (error: AudioError) => void;
type RemoteCommandCallback = (command: 'nextChapter' | 'prevChapter' | 'skipForward' | 'skipBackward' | 'seek', position?: number) => void;

const log = (...args: unknown[]) => audioLog.audio(args.map(String).join(' '));

const ExoPlayerModule = NativeModules.ExoPlayerModule;
const exoPlayerEmitter = ExoPlayerModule ? new NativeEventEmitter(ExoPlayerModule) : null;

class AndroidAudioService {
  private statusCallback: StatusCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private remoteCommandCallback: RemoteCommandCallback | null = null;
  private currentBookId: string | null = null;
  private currentUrl: string | null = null;
  private isLoaded = false;
  private isSetup = false;
  private setupPromise: Promise<void> | null = null;
  private loadId = 0;

  // Track state (mirrors native side for sync reads)
  private tracks: AudioTrackInfo[] = [];
  private currentTrackIndex = 0;
  private totalDuration = 0;
  private lastKnownGoodPosition = 0;
  private lastIsPlaying = false;

  // Scrubbing state (kept in JS since it's UI-driven)
  private isScrubbing = false;
  private skipNextSmartRewind = false;

  // Event subscriptions
  private playbackStateSubscription: any = null;
  private trackChangeSubscription: any = null;
  private errorSubscription: any = null;
  private bookEndSubscription: any = null;
  private remoteCommandSubscription: any = null;

  constructor() {
    this.setupPromise = this.setup();
  }

  async ensureSetup(): Promise<void> {
    if (this.isSetup) return;
    if (this.setupPromise) {
      try {
        await this.setupPromise;
        return;
      } catch (error) {
        audioLog.warn('Previous setup failed, retrying...');
      }
    }
    this.setupPromise = this.setup();
    await this.setupPromise;
  }

  private async setup(): Promise<void> {
    if (this.isSetup) return;

    const timing = createTimer('exoplayer.setup');
    try {
      logSection('EXOPLAYER SETUP (Android)');
      timing('Start');

      if (!ExoPlayerModule) {
        audioLog.warn('ExoPlayerModule not available — skipping setup (Expo Go?)');
        return;
      }

      // Initialize the native ExoPlayer service
      await ExoPlayerModule.initialize();
      timing('Native service initialized');

      // Set up event listeners from native
      this.setupEventListeners();
      timing('Event listeners attached');

      this.isSetup = true;
      log('ExoPlayer ready (Android)');
    } catch (error) {
      audioLog.error('ExoPlayer setup failed:', getErrorMessage(error));
      this.setupPromise = null;
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Remove old listeners if any
    this.removeEventListeners();

    if (!exoPlayerEmitter) {
      audioLog.warn('ExoPlayerModule not available — skipping event listeners (Expo Go?)');
      return;
    }

    // Playback state updates (position, isPlaying, etc.) — emitted at 100ms intervals
    this.playbackStateSubscription = exoPlayerEmitter.addListener(
      'ExoPlayerPlaybackState',
      (state: {
        isPlaying: boolean;
        position: number;
        duration: number;
        isBuffering: boolean;
        didJustFinish: boolean;
        isStuck: boolean;
      }) => {
        // Track isPlaying for sync reads
        this.lastIsPlaying = state.isPlaying;

        // Skip position updates during scrubbing (same as iOS path)
        if (!this.isScrubbing) {
          this.lastKnownGoodPosition = state.position;
        }
        this.totalDuration = state.duration;

        this.statusCallback?.({
          isPlaying: state.isPlaying,
          position: this.isScrubbing ? this.lastKnownGoodPosition : state.position,
          duration: state.duration,
          isBuffering: state.isBuffering,
          didJustFinish: state.didJustFinish,
          isStuck: state.isStuck || undefined,
        });
      }
    );

    // Track transitions
    this.trackChangeSubscription = exoPlayerEmitter.addListener(
      'ExoPlayerTrackChange',
      (data: { trackIndex: number; totalTracks: number; title?: string; startOffset?: number }) => {
        this.currentTrackIndex = data.trackIndex;
        // Keep currentUrl aligned with native track transitions
        if (data.trackIndex < this.tracks.length) {
          this.currentUrl = this.tracks[data.trackIndex].url;
        }
        log(`Track changed → ${data.trackIndex + 1}/${data.totalTracks}: ${data.title}`);
      }
    );

    // Errors
    this.errorSubscription = exoPlayerEmitter.addListener(
      'ExoPlayerError',
      (data: { type: string; message: string; errorCode: number; position: number }) => {
        audioLog.error(`ExoPlayer error: ${data.type} — ${data.message}`);

        if (data.type === 'URL_EXPIRED') {
          this.errorCallback?.({
            type: 'URL_EXPIRED',
            message: data.message,
            httpStatus: 403,
            position: data.position,
            bookId: this.currentBookId ?? undefined,
          });
        } else {
          this.errorCallback?.({
            type: 'LOAD_FAILED',
            message: data.message,
            position: data.position,
            bookId: this.currentBookId ?? undefined,
          });
        }
      }
    );

    // Book end
    this.bookEndSubscription = exoPlayerEmitter.addListener(
      'ExoPlayerBookEnd',
      () => {
        log('Book end event received from native');
      }
    );

    // Remote commands (from notification/lock screen/Android Auto)
    this.remoteCommandSubscription = exoPlayerEmitter.addListener(
      'ExoPlayerRemoteCommand',
      (data: { command: string; param?: string }) => {
        log(`Remote command: ${data.command}`);
        switch (data.command) {
          case 'nextChapter':
          case 'prevChapter':
          case 'skipForward':
          case 'skipBackward':
            this.remoteCommandCallback?.(data.command as any);
            break;
          case 'seek':
            if (data.param) {
              this.remoteCommandCallback?.('seek', parseFloat(data.param));
            }
            break;
          case 'playFromMediaId':
            // Forward to Android Auto handler via the existing automotive bridge
            // This is handled by automotiveService.ts which listens separately
            break;
          case 'playFromSearch':
            break;
        }
      }
    );
  }

  private removeEventListeners(): void {
    this.playbackStateSubscription?.remove();
    this.trackChangeSubscription?.remove();
    this.errorSubscription?.remove();
    this.bookEndSubscription?.remove();
    this.remoteCommandSubscription?.remove();
    this.playbackStateSubscription = null;
    this.trackChangeSubscription = null;
    this.errorSubscription = null;
    this.bookEndSubscription = null;
    this.remoteCommandSubscription = null;
  }

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
    return this.isScrubbing;
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
    logSection('LOAD AUDIO (ExoPlayer single track)');
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

    // Load as single-track playlist
    const trackInfo = [{
      url,
      title: metadata?.title || 'Audio',
      startOffset: 0,
      duration: knownDuration || 0,
    }];

    try {
      await ExoPlayerModule.loadTracks(
        trackInfo,
        0,
        startPositionSec * 1000, // ms
        autoPlay
      );

      if (this.loadId !== thisLoadId) return;

      this.currentUrl = url;
      this.isLoaded = true;

      // Update native metadata for notification/lock screen
      ExoPlayerModule.setMetadata(
        metadata?.title || 'Unknown Title',
        metadata?.artist || 'Unknown Author',
        metadata?.artwork || null,
        null  // no chapter title for single track
      );

      log('Single track loaded via ExoPlayer');
    } catch (error) {
      if (this.loadId === thisLoadId) {
        this.isLoaded = false;
        const errorMsg = getErrorMessage(error);
        audioLog.error('ExoPlayer load failed:', errorMsg);

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
    logSection('LOAD AUDIO (ExoPlayer multi-track)');

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
      // Send tracks to native ExoPlayer
      const nativeTracks = tracks.map(t => ({
        url: t.url,
        title: t.title,
        startOffset: t.startOffset,
        duration: t.duration,
      }));

      await ExoPlayerModule.loadTracks(
        nativeTracks,
        targetTrackIndex,
        positionInTrack * 1000, // ms
        autoPlay
      );

      if (this.loadId !== thisLoadId) return;

      this.currentUrl = tracks[targetTrackIndex].url;
      this.isLoaded = true;

      // Update native metadata
      ExoPlayerModule.setMetadata(
        metadata?.title || 'Unknown Title',
        metadata?.artist || 'Unknown Author',
        metadata?.artwork || null,
        null
      );

      log(`${tracks.length} tracks loaded via ExoPlayer, starting at track ${targetTrackIndex}`);
    } catch (error) {
      if (this.loadId === thisLoadId) {
        this.isLoaded = false;
        const errorMsg = getErrorMessage(error);
        audioLog.error('ExoPlayer loadTracks failed:', errorMsg);

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

  async play(): Promise<void> {
    log('▶ Play (ExoPlayer)');
    ExoPlayerModule.play();
  }

  async pause(): Promise<void> {
    log('⏸ Pause (ExoPlayer)');
    ExoPlayerModule.pause();
  }

  setPosition(positionSec: number): void {
    this.lastKnownGoodPosition = positionSec;
  }

  async seekTo(positionSec: number): Promise<void> {
    this.lastKnownGoodPosition = positionSec;
    ExoPlayerModule.seekTo(positionSec);
  }

  async setPlaybackRate(rate: number): Promise<void> {
    const clampedRate = Math.max(0.25, Math.min(4.0, rate));
    log(`Speed: ${clampedRate}x (ExoPlayer)`);
    ExoPlayerModule.setRate(clampedRate);
  }

  async getPosition(): Promise<number> {
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
    this.currentUrl = null;
    this.isLoaded = false;
    this.tracks = [];
    this.currentTrackIndex = 0;
    this.totalDuration = 0;
    this.lastKnownGoodPosition = 0;
    this.isScrubbing = false;

    try {
      await ExoPlayerModule.cleanup();
    } catch (e) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Get the underlying player instance — not applicable for ExoPlayer (native).
   * Audio sampling is not supported on Android ExoPlayer path.
   */
  getPlayer(): any {
    return null;
  }

  setAudioSamplingEnabled(_enabled: boolean): void {
    // Not supported on Android ExoPlayer path
  }

  addAudioSampleListener(_callback: any): (() => void) | null {
    // Not supported on Android ExoPlayer path
    return null;
  }

  async cleanup(): Promise<void> {
    // Do NOT removeEventListeners — the native service stays alive and we need
    // to keep receiving events for the next book load.
    // Do NOT reset isSetup/setupPromise — the native service stays alive.
    await this.unloadAudio();
    this.lastIsPlaying = false;
  }
}

export const audioService = new AndroidAudioService();
