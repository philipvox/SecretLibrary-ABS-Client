/**
 * src/features/player/services/audioService.ts
 *
 * Audio playback service using Expo AV.
 * Handles loading, playing, pausing, seeking, and playback rate control.
 * Supports background audio playback.
 */

import { Audio, AVPlaybackStatus } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';

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
 * Audio service for managing audio playback
 */
class AudioService {
  private sound: Sound | null = null;
  private currentUrl: string | null = null;
  private statusUpdateCallback: ((state: PlaybackState) => void) | null = null;

  constructor() {
    this.initializeAudio();
  }

  /**
   * Initialize audio settings for background playback
   */
  private async initializeAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true, // Enable background audio
        playsInSilentModeIOS: true, // Play even when phone is on silent
        shouldDuckAndroid: true, // Lower other audio when playing
        playThroughEarpieceAndroid: false,
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
      // Unload previous sound if exists
      if (this.sound) {
        await this.unloadAudio();
      }

      // Create and load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        {
          shouldPlay: false,
          positionMillis: startPosition * 1000,
          rate: 1.0,
          progressUpdateIntervalMillis: 1000, // Update position every second
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
      this.currentUrl = url;
    } catch (error) {
      console.error('Failed to load audio:', error);
      throw new Error('Failed to load audio file');
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
      const positionMillis = positionSeconds * 1000;
      await this.sound.setPositionAsync(positionMillis);
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
          status.positionMillis + seconds * 1000,
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
        const newPosition = Math.max(status.positionMillis - seconds * 1000, 0);
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
      await this.sound.setRateAsync(clampedRate, true); // shouldCorrectPitch = true
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
      return this.parseStatus(status);
    } catch (error) {
      console.error('Failed to get status:', error);
      return null;
    }
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
   * Handle playback status updates from Expo AV
   */
  private onPlaybackStatusUpdate(status: AVPlaybackStatus): void {
    const parsedStatus = this.parseStatus(status);
    if (parsedStatus && this.statusUpdateCallback) {
      this.statusUpdateCallback(parsedStatus);
    }
  }

  /**
   * Parse Expo AV status into our PlaybackState format
   */
  private parseStatus(status: AVPlaybackStatus): PlaybackState | null {
    if (!status.isLoaded) {
      return {
        isPlaying: false,
        isLoaded: false,
        position: 0,
        duration: 0,
        rate: 1.0,
        isBuffering: false,
      };
    }

    return {
      isPlaying: status.isPlaying,
      isLoaded: true,
      position: (status.positionMillis || 0) / 1000,
      duration: (status.durationMillis || 0) / 1000,
      rate: status.rate || 1.0,
      isBuffering: status.isBuffering,
    };
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
