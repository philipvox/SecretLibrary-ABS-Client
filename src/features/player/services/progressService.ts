/**
 * src/features/player/services/progressService.ts
 *
 * Service for syncing playback progress to the AudiobookShelf server.
 * Auto-saves position locally and syncs to server periodically.
 */

import { apiClient } from '@/core/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Progress data to sync
 */
interface ProgressData {
  itemId: string;
  currentTime: number;
  duration: number;
  progress: number;
  isFinished: boolean;
}

/**
 * Local storage key for progress
 */
const PROGRESS_KEY_PREFIX = 'progress_';

/**
 * Progress sync service
 */
class ProgressService {
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: number = 0;
  private pendingSync: ProgressData | null = null;

  /**
   * Start automatic progress syncing
   * Syncs to server every 5 minutes
   */
  startAutoSync(): void {
    // Don't start if already running
    if (this.syncInterval) {
      return;
    }

    // Sync every 5 minutes
    this.syncInterval = setInterval(() => {
      this.syncPendingProgress();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop automatic progress syncing
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Save progress locally and queue for server sync
   */
  async saveProgress(data: ProgressData): Promise<void> {
    try {
      // Save to local storage immediately
      await this.saveProgressLocal(data);

      // Queue for server sync
      this.pendingSync = data;

      // Sync immediately if it's been more than 30 seconds since last sync
      const now = Date.now();
      if (now - this.lastSyncTime > 30 * 1000) {
        await this.syncPendingProgress();
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }

  /**
   * Sync progress when user pauses or seeks
   * This ensures important position changes are saved immediately
   */
  async syncOnPause(data: ProgressData): Promise<void> {
    try {
      // Save locally
      await this.saveProgressLocal(data);

      // Sync to server immediately
      await this.syncToServer(data);
    } catch (error) {
      console.error('Failed to sync progress on pause:', error);
    }
  }

  /**
   * Mark book as finished
   */
  async markAsFinished(itemId: string, duration: number): Promise<void> {
    const data: ProgressData = {
      itemId,
      currentTime: duration,
      duration,
      progress: 1.0,
      isFinished: true,
    };

    try {
      await this.saveProgressLocal(data);
      await this.syncToServer(data);
    } catch (error) {
      console.error('Failed to mark as finished:', error);
      throw error;
    }
  }

  /**
   * Get locally saved progress for a book
   */
  async getLocalProgress(itemId: string): Promise<number> {
    try {
      const key = PROGRESS_KEY_PREFIX + itemId;
      const value = await AsyncStorage.getItem(key);

      if (value) {
        const data = JSON.parse(value) as ProgressData;
        return data.currentTime;
      }

      return 0;
    } catch (error) {
      console.error('Failed to get local progress:', error);
      return 0;
    }
  }

  /**
   * Clear local progress for a book
   */
  async clearLocalProgress(itemId: string): Promise<void> {
    try {
      const key = PROGRESS_KEY_PREFIX + itemId;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear local progress:', error);
    }
  }

  /**
   * Save progress to local storage
   */
  private async saveProgressLocal(data: ProgressData): Promise<void> {
    try {
      const key = PROGRESS_KEY_PREFIX + data.itemId;
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save progress locally:', error);
      throw error;
    }
  }

  /**
   * Sync pending progress to server
   */
  private async syncPendingProgress(): Promise<void> {
    if (!this.pendingSync) {
      return;
    }

    const data = this.pendingSync;
    this.pendingSync = null;

    await this.syncToServer(data);
  }

  /**
   * Sync progress to AudiobookShelf server
   */
  private async syncToServer(data: ProgressData): Promise<void> {
    try {
      await apiClient.updateProgress(data.itemId, {
        currentTime: data.currentTime,
        duration: data.duration,
        progress: data.progress,
        isFinished: data.isFinished,
      });

      this.lastSyncTime = Date.now();
    } catch (error) {
      console.error('Failed to sync progress to server:', error);
      // Don't throw - we'll retry on next sync
    }
  }
}

// Export singleton instance
export const progressService = new ProgressService();
