/**
 * src/features/player/services/audioService.ts
 *
 * Cross-platform audio playback service.
 * Works on iOS, Android, and Web.
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

/**
 * Playback state interface
 */
export interface PlaybackState {
  isPlaying: boolean;
  isLoaded: boolean;
  position: number; // seconds
  duration: number; // seconds
  rate: number; // playback speed (0.5 - 2.0)
  isBuffering: boolean;
}

/**
 * Audio service for managing audio playback across all platforms
 */
class AudioService {
  private sound: Audio.Sound | null = null;
  private currentUrl: string | null = null;
  private statusUpdateCallback: ((state: PlaybackState) => void) | null = null;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeAudio();
  }

  /**
   * Initialize audio settings
   */
  private async initializeAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Failed to initialize audio mode:', error);
    }
  }

  /**
   * Load audio from URL
   */
  async loadAudio(url: string, startPosition: number = 0): Promise<void> {
    try {
      // Unload previous audio if exists
      if (this.sound) {
        await this.unloadAudio();
      }

      // Create and load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { 
          shouldPlay: false,
          positionMillis: startPosition * 1000,
          progressUpdateIntervalMillis: 1000,
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
      this.currentUrl = url;

      // Start status update polling as backup
      this.startStatusUpdates();
    } catch (error) {
      console.error('Failed to load audio:', error);
      throw new Error('Failed to load audio file');
    }
  }

  /**
   * Playback status update callback
   */
  private onPlaybackStatusUpdate(status: any): void {
    if (status.isLoaded) {
      const state: PlaybackState = {
        isPlaying: status.isPlaying,
        isLoaded: true,
        position: status.positionMillis / 1000,
        duration: status.durationMillis ? status.durationMillis / 1000 : 0,
        rate: status.rate,
        isBuffering: status.isBuffering,
      };

      if (this.statusUpdateCallback) {
        this.statusUpdateCallback(state);
      }
    }
  }

  /**
   * Start polling for status updates (backup for web)
   */
  private startStatusUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Poll every second as backup
    this.updateInterval = setInterval(async () => {
      if (this.sound) {
        try {
          const status = await this.sound.getStatusAsync();
          this.onPlaybackStatusUpdate(status);
        } catch (error) {
          // Ignore errors during polling
        }
      }
    }, 1000);
  }

  /**
   * Stop status updates
   */
  private stopStatusUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Play audio
   */
  async play(): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    try {
      await this.sound.playAsync();
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw error;
    }
  }

  /**
   * Pause audio
   */
  async pause(): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    try {
      await this.sound.pauseAsync();
    } catch (error) {
      console.error('Failed to pause audio:', error);
      throw error;
    }
  }

  /**
   * Stop audio and reset position
   */
  async stop(): Promise<void> {
    if (!this.sound) {
      return;
    }

    try {
      await this.sound.stopAsync();
      await this.sound.setPositionAsync(0);
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
  }

  /**
   * Seek to position in seconds
   */
  async seekTo(positionSeconds: number): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    try {
      await this.sound.setPositionAsync(positionSeconds * 1000);
    } catch (error) {
      console.error('Failed to seek:', error);
      throw error;
    }
  }

  /**
   * Skip forward by seconds
   */
  async skipForward(seconds: number = 30): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        const newPosition = Math.min(
          status.positionMillis + (seconds * 1000),
          status.durationMillis || 0
        );
        await this.sound.setPositionAsync(newPosition);
      }
    } catch (error) {
      console.error('Failed to skip forward:', error);
      throw error;
    }
  }

  /**
   * Skip backward by seconds
   */
  async skipBackward(seconds: number = 30): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        const newPosition = Math.max(status.positionMillis - (seconds * 1000), 0);
        await this.sound.setPositionAsync(newPosition);
      }
    } catch (error) {
      console.error('Failed to skip backward:', error);
      throw error;
    }
  }

  /**
   * Set playback rate (0.5x - 2.0x)
   */
  async setPlaybackRate(rate: number): Promise<void> {
    if (!this.sound) {
      throw new Error('No audio loaded');
    }

    // Clamp rate between 0.5 and 2.0
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));

    try {
      await this.sound.setRateAsync(clampedRate, true);
    } catch (error) {
      console.error('Failed to set playback rate:', error);
      throw error;
    }
  }

  /**
   * Get current playback status
   */
  async getStatus(): Promise<PlaybackState | null> {
    if (!this.sound) {
      return null;
    }

    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        return {
          isPlaying: status.isPlaying,
          isLoaded: true,
          position: status.positionMillis / 1000,
          duration: status.durationMillis ? status.durationMillis / 1000 : 0,
          rate: status.rate,
          isBuffering: status.isBuffering,
        };
      }
    } catch (error) {
      console.error('Failed to get status:', error);
    }

    return null;
  }

  /**
   * Register callback for status updates
   */
  setStatusUpdateCallback(callback: (state: PlaybackState) => void): void {
    this.statusUpdateCallback = callback;
  }

  /**
   * Unload audio and clean up
   */
  async unloadAudio(): Promise<void> {
    this.stopStatusUpdates();
    
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        console.error('Failed to unload audio:', error);
      }
      this.sound = null;
      this.currentUrl = null;
    }
  }

  /**
   * Check if audio is loaded
   */
  isLoaded(): boolean {
    return this.sound !== null;
  }

  /**
   * Get current audio URL
   */
  getCurrentUrl(): string | null {
    return this.currentUrl;
  }
}

// Export singleton instance
export const audioService = new AudioService();