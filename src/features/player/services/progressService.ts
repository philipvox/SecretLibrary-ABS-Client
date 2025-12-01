/**
 * src/features/player/services/progressService.ts
 *
 * Handles local progress storage for offline playback using SQLite.
 * SQLite provides faster read/write operations compared to AsyncStorage.
 */

import { sqliteCache } from '@/core/services/sqliteCache';
import { audioLog, formatDuration } from '@/shared/utils/audioDebug';

const log = (msg: string, ...args: any[]) => audioLog.progress(msg, ...args);

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
   * Save progress locally (for offline playback) using SQLite
   */
  async saveLocalOnly(progress: LocalProgress): Promise<void> {
    log('saveLocalOnly:');
    log('  Item ID:', progress.itemId);
    log('  Position:', formatDuration(progress.currentTime), `(${progress.currentTime.toFixed(1)}s)`);
    log('  Duration:', formatDuration(progress.duration), `(${progress.duration.toFixed(1)}s)`);
    log('  Progress:', (progress.progress * 100).toFixed(1) + '%');

    try {
      await sqliteCache.setPlaybackProgress(
        progress.itemId,
        progress.currentTime,
        progress.duration,
        false // Not synced yet
      );
      log('  Saved successfully to SQLite');
    } catch (e: any) {
      audioLog.warn('Failed to save local progress:', e.message);
    }
  }

  /**
   * Get local progress for a book
   */
  async getLocalProgress(itemId: string): Promise<number> {
    log('getLocalProgress for:', itemId);

    try {
      const progress = await sqliteCache.getPlaybackProgress(itemId);
      const position = progress?.position || 0;
      log('  Found:', formatDuration(position), `(${position.toFixed(1)}s)`);
      return position;
    } catch (e: any) {
      audioLog.warn('Failed to get local progress:', e.message);
      return 0;
    }
  }

  /**
   * Get full progress data for a book
   */
  async getProgressData(itemId: string): Promise<LocalProgress | null> {
    log('getProgressData for:', itemId);

    try {
      const progress = await sqliteCache.getPlaybackProgress(itemId);
      if (progress) {
        const result = {
          itemId: progress.itemId,
          currentTime: progress.position,
          duration: progress.duration,
          progress: progress.duration > 0 ? progress.position / progress.duration : 0,
          isFinished: progress.position >= progress.duration * 0.99,
          updatedAt: progress.updatedAt,
        };
        log('  Found:');
        log('    Position:', formatDuration(result.currentTime));
        log('    Duration:', formatDuration(result.duration));
        log('    Progress:', (result.progress * 100).toFixed(1) + '%');
        log('    Is finished:', result.isFinished);
        return result;
      }
      log('  No progress found');
      return null;
    } catch (e: any) {
      audioLog.warn('Failed to get progress data:', e.message);
      return null;
    }
  }

  /**
   * Clear progress for a book
   * Note: We just set position to 0 rather than deleting
   */
  async clearProgress(itemId: string): Promise<void> {
    log('clearProgress for:', itemId);

    try {
      await sqliteCache.setPlaybackProgress(itemId, 0, 0, true);
      log('  Progress cleared');
    } catch (e: any) {
      audioLog.warn('Failed to clear progress:', e.message);
    }
  }

  /**
   * Get all unsynced progress entries (for background sync)
   */
  async getUnsyncedProgress(): Promise<LocalProgress[]> {
    log('getUnsyncedProgress');

    try {
      const unsynced = await sqliteCache.getUnsyncedProgress();
      const result = unsynced.map(p => ({
        itemId: p.itemId,
        currentTime: p.position,
        duration: p.duration,
        progress: p.duration > 0 ? p.position / p.duration : 0,
        isFinished: p.position >= p.duration * 0.99,
        updatedAt: p.updatedAt,
      }));
      log('  Found', result.length, 'unsynced entries');
      result.forEach(p => {
        log('    -', p.itemId, ':', formatDuration(p.currentTime));
      });
      return result;
    } catch (e: any) {
      audioLog.warn('Failed to get unsynced progress:', e.message);
      return [];
    }
  }

  /**
   * Mark progress as synced (after successful server sync)
   */
  async markSynced(itemId: string): Promise<void> {
    log('markSynced for:', itemId);

    try {
      await sqliteCache.markProgressSynced(itemId);
      log('  Marked as synced');
    } catch (e: any) {
      audioLog.warn('Failed to mark synced:', e.message);
    }
  }
}

export const progressService = new ProgressService();
