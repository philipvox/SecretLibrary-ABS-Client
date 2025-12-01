/**
 * src/features/player/services/audioService.ts
 *
 * Audio playback using react-native-track-player
 */

import TrackPlayer, {
  State,
  Capability,
  AppKilledPlaybackBehavior,
  RepeatMode,
} from 'react-native-track-player';

import {
  audioLog,
  createTimer,
  logSection,
  validateUrl,
  getStateName,
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
  private isSetup = false;
  private statusCallback: StatusCallback | null = null;
  private currentUrl: string | null = null;
  private isLoaded = false;
  private progressInterval: NodeJS.Timeout | null = null;
  private setupPromise: Promise<void> | null = null;
  private setupAttempts = 0;
  private loadId = 0; // Track load requests to cancel stale ones
  private tracks: AudioTrackInfo[] = []; // All tracks for multi-file books
  private totalDuration = 0; // Total duration across all tracks

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

    this.setupAttempts++;
    const attempt = this.setupAttempts;
    const timing = createTimer('TrackPlayer.setup');

    try {
      logSection(`TRACKPLAYER SETUP (attempt ${attempt})`);

      timing('Start');
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
        // Optimized buffering for audiobooks (longer content)
        minBuffer: 60,           // 60 sec minimum buffer
        maxBuffer: 300,          // 5 min max buffer
        playBuffer: 10,          // Start playback after 10 sec buffer
        backBuffer: 60,          // Keep 60 sec behind current position
        waitForBuffer: true,     // Wait for buffer before playing
      });
      timing('setupPlayer done');

      log('Buffer config: minBuffer=60s, maxBuffer=300s, playBuffer=10s, backBuffer=60s');

      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SeekTo,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SeekTo,
        ],
        forwardJumpInterval: 30,
        backwardJumpInterval: 30,
        progressUpdateEventInterval: 1,
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        },
      });
      timing('updateOptions done');

      await TrackPlayer.setRepeatMode(RepeatMode.Off);
      timing('setRepeatMode done');

      this.isSetup = true;
      log('TrackPlayer ready');
    } catch (error: any) {
      if (error.message?.includes('already been initialized')) {
        this.isSetup = true;
        log('TrackPlayer already initialized (reusing)');
      } else {
        audioLog.error('Setup failed:', error.message);
        audioLog.error('Stack:', error.stack);
        // Clear the promise so ensureSetup can retry
        this.setupPromise = null;
        throw error;
      }
    }
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

  /**
   * Calculate global position across all tracks
   */
  private async getGlobalPosition(): Promise<{ position: number; duration: number }> {
    const trackIndex = await TrackPlayer.getActiveTrackIndex();
    const progress = await TrackPlayer.getProgress();

    // For multi-track: add track's startOffset to get global position
    if (this.tracks.length > 0 && trackIndex !== undefined && trackIndex < this.tracks.length) {
      const globalPosition = this.tracks[trackIndex].startOffset + progress.position;
      return { position: globalPosition, duration: this.totalDuration };
    }

    // Single track or no track info
    return { position: progress.position, duration: progress.duration || this.totalDuration };
  }

  private lastLoggedState: number | null = null;
  private lastLoggedPosition: number = 0;

  private startProgressUpdates(): void {
    this.stopProgressUpdates();

    this.progressInterval = setInterval(async () => {
      if (!this.isLoaded) return;

      try {
        const { position, duration } = await this.getGlobalPosition();
        const playbackState = await TrackPlayer.getPlaybackState();
        const queue = await TrackPlayer.getQueue();
        const trackIndex = await TrackPlayer.getActiveTrackIndex();

        const isPlaying = playbackState.state === State.Playing;
        const isBuffering = playbackState.state === State.Buffering || playbackState.state === State.Loading;

        // Log state changes
        if (this.lastLoggedState !== playbackState.state) {
          audioLog.state(
            getStateName(this.lastLoggedState ?? 0),
            getStateName(playbackState.state),
            `track ${trackIndex}/${queue.length}`
          );
          this.lastLoggedState = playbackState.state;
        }

        // Log position every 30 seconds
        if (Math.floor(position) % 30 === 0 && Math.abs(position - this.lastLoggedPosition) >= 1 && isPlaying) {
          audioLog.progress(`${formatDuration(position)} / ${formatDuration(duration)} (buffered: ${formatDuration((await TrackPlayer.getProgress()).buffered)})`);
          this.lastLoggedPosition = position;
        }

        // Only report didJustFinish when the LAST track in queue ends
        const isLastTrack = trackIndex === undefined || trackIndex >= queue.length - 1;
        const didJustFinish = playbackState.state === State.Ended && isLastTrack;

        if (didJustFinish) {
          log('didJustFinish triggered - State.Ended on last track');
          log(`  trackIndex: ${trackIndex}, queue length: ${queue.length}`);
          log(`  position: ${position.toFixed(1)}s, duration: ${duration.toFixed(1)}s`);
        }

        this.statusCallback?.({
          isPlaying,
          position,
          duration,
          isBuffering,
          didJustFinish,
        });
      } catch (e: any) {
        // Log errors that might indicate issues
        if (e.message && !e.message.includes('not initialized')) {
          audioLog.error('Progress update error:', e.message);
        }
      }
    }, 500);
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
    autoPlay: boolean = true
  ): Promise<void> {
    const thisLoadId = ++this.loadId;
    const timing = createTimer('loadAudio');

    logSection('LOAD AUDIO (single track)');
    log('URL:', url.substring(0, 100) + (url.length > 100 ? '...' : ''));
    log('Start position:', startPositionSec.toFixed(1) + 's');
    log('AutoPlay:', autoPlay);
    log('Metadata:', JSON.stringify(metadata));

    // Validate URL
    if (!validateUrl(url, 'loadAudio')) {
      audioLog.error('Invalid URL provided to loadAudio');
      throw new Error('Invalid audio URL');
    }

    // Ensure setup is done first (will retry if previous setup failed)
    timing('Ensuring setup');
    await this.ensureSetup();
    timing('Setup ready');

    // Check if cancelled
    if (this.loadId !== thisLoadId) {
      log('Cancelled - newer load started');
      return;
    }

    try {
      timing('Resetting');
      await TrackPlayer.reset();

      if (this.loadId !== thisLoadId) {
        log('Cancelled after reset');
        return;
      }
      timing('Reset done');

      timing('Adding track');
      await TrackPlayer.add({
        id: 'current-track',
        url: url,
        title: metadata?.title || 'Audiobook',
        artist: metadata?.artist || 'Author',
        artwork: metadata?.artwork,
      });

      if (this.loadId !== thisLoadId) {
        log('Cancelled after add');
        return;
      }
      timing('Track added');

      this.currentUrl = url;
      this.isLoaded = true;
      // Reset for single track mode
      this.tracks = [];
      this.totalDuration = 0;

      if (startPositionSec > 0) {
        log(`Seeking to ${formatDuration(startPositionSec)}`);
        timing('Seeking');
        await TrackPlayer.seekTo(startPositionSec);
        timing('Seek done');
      }

      if (this.loadId !== thisLoadId) {
        log('Cancelled after seek');
        return;
      }

      if (autoPlay) {
        timing('Starting playback');
        await TrackPlayer.play();
        timing('Playback started');
      } else {
        log('Ready (paused, not auto-playing)');
      }
      timing('Load complete');
    } catch (error: any) {
      if (this.loadId === thisLoadId) {
        audioLog.error('Load failed:', error.message);
        audioLog.error('Stack:', error.stack);
        this.isLoaded = false;
        throw error;
      }
    }
  }

  /**
   * Load multiple audio tracks (for multi-file audiobooks)
   * Adds all tracks to the queue and seeks to the correct position
   */
  async loadTracks(
    tracks: AudioTrackInfo[],
    startPositionSec: number = 0,
    metadata?: { title?: string; artist?: string; artwork?: string },
    autoPlay: boolean = true
  ): Promise<void> {
    const thisLoadId = ++this.loadId;
    const timing = createTimer('loadTracks');

    logSection('LOAD AUDIO (multi-track)');
    log(`Track count: ${tracks.length}`);
    log(`Start position: ${formatDuration(startPositionSec)} (${startPositionSec.toFixed(1)}s)`);
    log('AutoPlay:', autoPlay);

    // Log track details
    tracks.forEach((track, i) => {
      log(`  Track ${i}: offset=${formatDuration(track.startOffset)}, duration=${formatDuration(track.duration)}`);
    });

    await this.ensureSetup();
    if (this.loadId !== thisLoadId) return;

    try {
      timing('Resetting');
      await TrackPlayer.reset();
      if (this.loadId !== thisLoadId) return;
      timing('Reset done');

      // Store track info for position calculations
      this.tracks = tracks;
      this.totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);
      log(`Total duration: ${formatDuration(this.totalDuration)}`);

      // Add all tracks to queue
      timing('Adding tracks to queue');
      const queueTracks = tracks.map((track, index) => ({
        id: `track-${index}`,
        url: track.url,
        title: track.title || metadata?.title || 'Audiobook',
        artist: metadata?.artist || 'Author',
        artwork: metadata?.artwork,
        duration: track.duration,
      }));

      await TrackPlayer.add(queueTracks);
      if (this.loadId !== thisLoadId) return;
      timing('All tracks added');
      log(`Queue now has ${queueTracks.length} tracks`);

      this.currentUrl = tracks[0]?.url || null;
      this.isLoaded = true;

      // Seek to correct track and position
      if (startPositionSec > 0) {
        log(`Seeking to global position ${formatDuration(startPositionSec)}`);
        timing('Seeking');
        await this.seekToGlobal(startPositionSec);
        timing('Seek done');
      }
      if (this.loadId !== thisLoadId) return;

      if (autoPlay) {
        timing('Starting playback');
        await TrackPlayer.play();
        timing('Playback started');
      } else {
        log('Ready (paused, not auto-playing)');
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
    if (this.tracks.length === 0) {
      // Single track mode - just seek directly
      await TrackPlayer.seekTo(globalPositionSec);
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

    log(`⏩ Global seek ${globalPositionSec.toFixed(1)}s → track ${targetTrackIndex}, pos ${positionInTrack.toFixed(1)}s`);

    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    if (currentIndex !== targetTrackIndex) {
      await TrackPlayer.skip(targetTrackIndex);
    }
    await TrackPlayer.seekTo(positionInTrack);
  }

  async play(): Promise<void> {
    log('▶ Play');
    await TrackPlayer.play();
  }

  async pause(): Promise<void> {
    log('⏸ Pause');
    await TrackPlayer.pause();
  }

  async seekTo(positionSec: number): Promise<void> {
    // Use global seek if we have multiple tracks
    if (this.tracks.length > 0) {
      await this.seekToGlobal(positionSec);
    } else {
      log(`⏩ Seek to ${positionSec.toFixed(1)}s`);
      await TrackPlayer.seekTo(positionSec);
    }
  }

  async setPlaybackRate(rate: number): Promise<void> {
    log(`Speed: ${rate}x`);
    await TrackPlayer.setRate(rate);
  }

  async getPosition(): Promise<number> {
    const { position } = await this.getGlobalPosition();
    return position;
  }

  async getDuration(): Promise<number> {
    if (this.totalDuration > 0) return this.totalDuration;
    const progress = await TrackPlayer.getProgress();
    return progress.duration;
  }

  async unloadAudio(): Promise<void> {
    this.loadId++; // Cancel any pending loads
    this.stopProgressUpdates();
    await TrackPlayer.reset();
    this.currentUrl = null;
    this.isLoaded = false;
    this.tracks = [];
    this.totalDuration = 0;
  }
}

export const audioService = new AudioService();
