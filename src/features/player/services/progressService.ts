/**
 * src/features/player/services/progressService.ts
 * 
 * Handles local progress storage for offline playback
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_KEY_PREFIX = 'book_progress_';

interface LocalProgress {
  itemId: string;
  currentTime: number;
  duration: number;
  progress: number;
  isFinished: boolean;
  updatedAt?: number;
}

class ProgressService {
  /**
   * Save progress locally (for offline playback)
   */
  async saveLocalOnly(progress: LocalProgress): Promise<void> {
    try {
      const key = `${PROGRESS_KEY_PREFIX}${progress.itemId}`;
      const data = {
        ...progress,
        updatedAt: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[ProgressService] Failed to save local progress:', e);
    }
  }

  /**
   * Get local progress for a book
   */
  async getLocalProgress(itemId: string): Promise<number> {
    try {
      const key = `${PROGRESS_KEY_PREFIX}${itemId}`;
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const progress: LocalProgress = JSON.parse(data);
        return progress.currentTime || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get full progress data for a book
   */
  async getProgressData(itemId: string): Promise<LocalProgress | null> {
    try {
      const key = `${PROGRESS_KEY_PREFIX}${itemId}`;
      const data = await AsyncStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Clear progress for a book
   */
  async clearProgress(itemId: string): Promise<void> {
    try {
      const key = `${PROGRESS_KEY_PREFIX}${itemId}`;
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  /**
   * Get all local progress entries
   */
  async getAllProgress(): Promise<LocalProgress[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const progressKeys = keys.filter(k => k.startsWith(PROGRESS_KEY_PREFIX));
      
      if (progressKeys.length === 0) return [];
      
      const entries = await AsyncStorage.multiGet(progressKeys);
      const progress: LocalProgress[] = [];
      
      for (const [_, value] of entries) {
        if (value) {
          try {
            progress.push(JSON.parse(value));
          } catch {
            // Skip invalid entries
          }
        }
      }
      
      return progress.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch {
      return [];
    }
  }
}

export const progressService = new ProgressService();