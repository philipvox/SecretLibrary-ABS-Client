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

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  duration: number;
  isBuffering: boolean;
  didJustFinish: boolean;
}

type StatusCallback = (status: PlaybackState) => void;

const DEBUG = __DEV__;
const log = (...args: any[]) => DEBUG && console.log('[Audio]', ...args);

class AudioService {
  private isSetup = false;
  private statusCallback: StatusCallback | null = null;
  private currentUrl: string | null = null;
  private isLoaded = false;
  private progressInterval: NodeJS.Timeout | null = null;
  private setupPromise: Promise<void> | null = null;
  private loadId = 0; // Track load requests to cancel stale ones

  constructor() {
    // Pre-warm on construction
    this.setupPromise = this.setup();
  }

  async setup(): Promise<void> {
    if (this.isSetup) return;

    try {
      log('Setting up TrackPlayer...');
      
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
      });

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

      await TrackPlayer.setRepeatMode(RepeatMode.Off);

      this.isSetup = true;
      log('✓ TrackPlayer ready');
    } catch (error: any) {
      if (error.message?.includes('already been initialized')) {
        this.isSetup = true;
        log('TrackPlayer already initialized');
      } else {
        console.error('[Audio] Setup failed:', error);
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

  private startProgressUpdates(): void {
    this.stopProgressUpdates();
    
    this.progressInterval = setInterval(async () => {
      if (!this.isLoaded) return;
      
      try {
        const progress = await TrackPlayer.getProgress();
        const playbackState = await TrackPlayer.getPlaybackState();

        const isPlaying = playbackState.state === State.Playing;
        const isBuffering = playbackState.state === State.Buffering || playbackState.state === State.Loading;
        const didJustFinish = playbackState.state === State.Ended;

        this.statusCallback?.({
          isPlaying,
          position: progress.position,
          duration: progress.duration,
          isBuffering,
          didJustFinish,
        });
      } catch (e) {
        // Ignore errors
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
    metadata?: { title?: string; artist?: string; artwork?: string }
  ): Promise<void> {
    const thisLoadId = ++this.loadId;
    const t0 = Date.now();
    const t = (label: string) => log(`⏱ [${Date.now() - t0}ms] ${label}`);
    
    log(`Loading: ${url.substring(0, 80)}...`);

    // Ensure setup is done first
    if (this.setupPromise) {
      t('Waiting for setup...');
      await this.setupPromise;
      t('Setup done');
    }

    // Check if cancelled
    if (this.loadId !== thisLoadId) {
      t('Cancelled - newer load started');
      return;
    }

    try {
      t('Resetting...');
      await TrackPlayer.reset();
      
      if (this.loadId !== thisLoadId) {
        t('Cancelled after reset');
        return;
      }
      t('Reset done');

      t('Adding track...');
      await TrackPlayer.add({
        id: 'current-track',
        url: url,
        title: metadata?.title || 'Audiobook',
        artist: metadata?.artist || 'Author',
        artwork: metadata?.artwork,
      });
      
      if (this.loadId !== thisLoadId) {
        t('Cancelled after add');
        return;
      }
      t('Track added');

      this.currentUrl = url;
      this.isLoaded = true;

      if (startPositionSec > 0) {
        t(`Seeking to ${startPositionSec}s`);
        await TrackPlayer.seekTo(startPositionSec);
      }
      
      if (this.loadId !== thisLoadId) {
        t('Cancelled after seek');
        return;
      }

      t('Playing...');
      await TrackPlayer.play();
      t('Done');
    } catch (error) {
      if (this.loadId === thisLoadId) {
        console.error('[Audio] Load failed:', error);
        this.isLoaded = false;
      }
    }
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
    log(`⏩ Seek to ${positionSec.toFixed(1)}s`);
    await TrackPlayer.seekTo(positionSec);
  }

  async setPlaybackRate(rate: number): Promise<void> {
    log(`Speed: ${rate}x`);
    await TrackPlayer.setRate(rate);
  }

  async getPosition(): Promise<number> {
    const progress = await TrackPlayer.getProgress();
    return progress.position;
  }

  async getDuration(): Promise<number> {
    const progress = await TrackPlayer.getProgress();
    return progress.duration;
  }

  async unloadAudio(): Promise<void> {
    this.loadId++; // Cancel any pending loads
    this.stopProgressUpdates();
    await TrackPlayer.reset();
    this.currentUrl = null;
    this.isLoaded = false;
  }
}

export const audioService = new AudioService();