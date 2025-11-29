/**
 * src/features/player/services/audioService.ts
 * 
 * Audio playback service using expo-audio
 * Optimized for fast streaming playback
 */

import { 
  AudioPlayer, 
  createAudioPlayer, 
  setAudioModeAsync,
} from 'expo-audio';

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  duration: number;
  isBuffering: boolean;
}

type StatusCallback = (status: PlaybackState) => void;

class AudioService {
  private player: AudioPlayer | null = null;
  private statusCallback: StatusCallback | null = null;
  private statusSubscription: { remove: () => void } | null = null;
  private isLoaded = false;
  private currentUrl: string | null = null;
  private pendingPlaybackRate = 1.0;

  constructor() {
    this.configureAudioMode();
  }

  private async configureAudioMode(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
        interruptionModeAndroid: 'doNotMix',
      });
    } catch (error) {
      console.error('[AudioService] Failed to configure audio mode:', error);
    }
  }

  getPlayer(): AudioPlayer | null {
    return this.player;
  }

  async loadAudio(url: string, startPosition: number = 0): Promise<void> {
    console.log('[AudioService] Loading:', url.substring(0, 80) + '...');

    try {
      await this.unloadAudio();

      this.player = createAudioPlayer({ uri: url });
      this.currentUrl = url;
      this.isLoaded = true;

      // Set up status listener
      this.statusSubscription = this.player.addListener('playbackStatusUpdate', (status) => {
        if (this.statusCallback) {
          this.statusCallback({
            isPlaying: status.playing,
            position: status.currentTime,
            duration: status.duration,
            isBuffering: status.isBuffering,
          });
        }
      });

      // Apply playback rate
      if (this.pendingPlaybackRate !== 1.0) {
        try {
          this.player.setPlaybackRate(this.pendingPlaybackRate);
        } catch {}
      }

      // Seek if needed
      if (startPosition > 0) {
        this.player.seekTo(startPosition);
      }

      console.log('[AudioService] Ready to play');
    } catch (error) {
      console.error('[AudioService] Load failed:', error);
      this.isLoaded = false;
      throw error;
    }
  }

  setStatusUpdateCallback(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  async play(): Promise<void> {
    if (!this.player || !this.isLoaded) {
      throw new Error('No audio loaded');
    }
    this.player.play();
  }

  async pause(): Promise<void> {
    this.player?.pause();
  }

  async seekTo(positionSeconds: number): Promise<void> {
    this.player?.seekTo(positionSeconds);
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this.pendingPlaybackRate = rate;
    if (this.player && this.isLoaded) {
      this.player.setPlaybackRate(rate);
    }
  }

  async getPosition(): Promise<number> {
    return this.player?.currentTime ?? 0;
  }

  async getDuration(): Promise<number> {
    return this.player?.duration ?? 0;
  }

  getIsLoaded(): boolean {
    return this.isLoaded && this.player !== null;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  async unloadAudio(): Promise<void> {
    if (this.statusSubscription) {
      this.statusSubscription.remove();
      this.statusSubscription = null;
    }
    if (this.player) {
      try {
        this.player.pause();
        this.player.release();
      } catch {}
      this.player = null;
    }
    this.isLoaded = false;
    this.currentUrl = null;
  }
}

export const audioService = new AudioService();