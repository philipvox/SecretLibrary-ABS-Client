/**
 * src/core/services/imageCacheService.ts
 *
 * Service for caching all library book covers and spine images.
 * Provides bulk caching with progress tracking for first-login experience.
 */

import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('ImageCache');

// Storage keys
const CACHE_PROGRESS_KEY = 'image_cache_progress';
const HAS_SEEN_CACHE_PROMPT_KEY = 'hasSeenImageCachePrompt';
const AUTO_CACHE_ENABLED_KEY = 'imageCacheAutoEnabled';

// Approximate sizes based on observed library
const COVER_AVG_SIZE = 80 * 1024;  // ~80KB per cover (1024x1024 JPEG)
const SPINE_AVG_SIZE = 25 * 1024;  // ~25KB per spine (WebP)
const BATCH_SIZE = 50;  // Process in batches for responsiveness

// =============================================================================
// TYPES
// =============================================================================

export interface CacheStatus {
  totalBooks: number;
  cachedCovers: number;
  cachedSpines: number;
  totalSizeBytes: number;
  isComplete: boolean;
  lastUpdated: number | null;
}

export interface CacheProgress {
  current: number;
  total: number;
  phase: 'covers' | 'spines';
  bytesDownloaded: number;
  percentComplete: number;
}

interface StoredCacheProgress {
  lastCachedIndex: number;
  phase: 'covers' | 'spines' | 'complete';
  startedAt: string;
  bookIds: string[];
  cachedCovers: number;
  cachedSpines: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Average audiobook size for comparison (~200MB)
const AVG_AUDIOBOOK_SIZE_MB = 200;

/**
 * Estimate total cache size based on book count
 */
export function estimateCacheSize(bookCount: number): {
  totalBytes: number;
  formatted: string;
  audiobookEquivalent: string;
} {
  const totalBytes = bookCount * (COVER_AVG_SIZE + SPINE_AVG_SIZE);
  const mb = totalBytes / (1024 * 1024);
  const audiobookCount = mb / AVG_AUDIOBOOK_SIZE_MB;

  // Format audiobook equivalent with "audiobook(s)" suffix
  let audiobookEquivalent: string;
  if (audiobookCount < 1) {
    audiobookEquivalent = '< 1 audiobook';
  } else if (audiobookCount < 1.5) {
    audiobookEquivalent = '~1 audiobook';
  } else if (audiobookCount < 2.5) {
    audiobookEquivalent = '~1-2 audiobooks';
  } else {
    audiobookEquivalent = `~${Math.round(audiobookCount)} audiobooks`;
  }

  return {
    totalBytes,
    formatted: `~${Math.round(mb)} MB`,
    audiobookEquivalent,
  };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ImageCacheService {
  private isCaching = false;
  private shouldCancel = false;

  /**
   * Check if user has seen the cache prompt
   */
  async hasSeenCachePrompt(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(HAS_SEEN_CACHE_PROMPT_KEY);
      log.debug(`hasSeenCachePrompt: ${value}`);
      return value === 'true';
    } catch (err) {
      log.warn('hasSeenCachePrompt error:', err);
      return false;
    }
  }

  /**
   * Mark that user has seen the cache prompt
   */
  async setHasSeenCachePrompt(): Promise<void> {
    try {
      await AsyncStorage.setItem(HAS_SEEN_CACHE_PROMPT_KEY, 'true');
    } catch (err) {
      log.warn('Failed to save cache prompt seen state:', err);
    }
  }

  /**
   * Reset cache prompt seen flag (for developer settings)
   */
  async resetCachePromptSeen(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HAS_SEEN_CACHE_PROMPT_KEY);
      log.debug('Cache prompt seen flag reset');
    } catch (err) {
      log.warn('Failed to reset cache prompt seen flag:', err);
    }
  }

  /**
   * Check if auto-cache for new books is enabled
   */
  async isAutoCacheEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(AUTO_CACHE_ENABLED_KEY);
      return value === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Set auto-cache enabled state
   */
  async setAutoCacheEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTO_CACHE_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch (err) {
      log.warn('Failed to save auto-cache state:', err);
    }
  }

  /**
   * Get stored progress for resuming interrupted cache
   */
  private async getStoredProgress(): Promise<StoredCacheProgress | null> {
    try {
      const value = await AsyncStorage.getItem(CACHE_PROGRESS_KEY);
      if (value) {
        return JSON.parse(value);
      }
    } catch (err) {
      log.warn('Failed to load cache progress:', err);
    }
    return null;
  }

  /**
   * Save progress for resuming later
   */
  private async saveProgress(progress: StoredCacheProgress): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_PROGRESS_KEY, JSON.stringify(progress));
    } catch (err) {
      log.warn('Failed to save cache progress:', err);
    }
  }

  /**
   * Clear stored progress
   */
  private async clearProgress(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_PROGRESS_KEY);
    } catch (err) {
      log.warn('Failed to clear cache progress:', err);
    }
  }

  /**
   * Check if caching is currently in progress
   */
  isCachingInProgress(): boolean {
    return this.isCaching;
  }

  /**
   * Cancel ongoing caching operation
   */
  cancelCaching(): void {
    this.shouldCancel = true;
  }

  /**
   * Cache all library images with progress callback
   * Supports resuming interrupted operations
   */
  async cacheAllImages(
    items: LibraryItem[],
    onProgress?: (progress: CacheProgress) => void
  ): Promise<CacheStatus> {
    if (this.isCaching) {
      log.warn('Cache operation already in progress');
      throw new Error('Cache operation already in progress');
    }

    this.isCaching = true;
    this.shouldCancel = false;

    const startTime = Date.now();
    const bookIds = items.map(item => item.id);
    let cachedCovers = 0;
    let cachedSpines = 0;
    let bytesDownloaded = 0;
    let startIndex = 0;
    let phase: 'covers' | 'spines' = 'covers';

    // Check for resumable progress
    const storedProgress = await this.getStoredProgress();
    if (storedProgress) {
      // Verify book IDs match (library hasn't changed)
      const _storedIdsSet = new Set(storedProgress.bookIds);
      const currentIdsSet = new Set(bookIds);
      const sameLibrary = storedProgress.bookIds.length === bookIds.length &&
        storedProgress.bookIds.every(id => currentIdsSet.has(id));

      if (sameLibrary && storedProgress.phase !== 'complete') {
        log.debug(`Resuming cache from index ${storedProgress.lastCachedIndex}, phase: ${storedProgress.phase}`);
        startIndex = storedProgress.lastCachedIndex;
        phase = storedProgress.phase;
        cachedCovers = storedProgress.cachedCovers;
        cachedSpines = storedProgress.cachedSpines;
        bytesDownloaded = (cachedCovers * COVER_AVG_SIZE) + (cachedSpines * SPINE_AVG_SIZE);
      } else {
        // Library changed, start fresh
        await this.clearProgress();
      }
    }

    const totalItems = items.length;
    const reportProgress = () => {
      if (onProgress) {
        const current = phase === 'covers' ? cachedCovers : (totalItems + cachedSpines);
        const total = totalItems * 2; // covers + spines
        onProgress({
          current,
          total,
          phase,
          bytesDownloaded,
          percentComplete: Math.round((current / total) * 100),
        });
      }
    };

    try {
      // Phase 1: Cache covers (higher priority)
      if (phase === 'covers') {
        log.debug(`Caching ${totalItems - startIndex} covers...`);
        for (let i = startIndex; i < totalItems; i += BATCH_SIZE) {
          if (this.shouldCancel) {
            log.debug('Cache operation cancelled by user');
            break;
          }

          const batch = items.slice(i, Math.min(i + BATCH_SIZE, totalItems));
          const coverUrls = batch
            .map(item => apiClient.getItemCoverUrl(item.id, { width: 1024, height: 1024 }))
            .filter((url): url is string => !!url);

          try {
            await Image.prefetch(coverUrls);
            cachedCovers += batch.length;
            bytesDownloaded += batch.length * COVER_AVG_SIZE;
            reportProgress();
          } catch {
            // Continue even if batch fails - some images may not exist
            log.debug(`Cover batch ${Math.floor(i / BATCH_SIZE) + 1} partial failure`);
            cachedCovers += batch.length; // Count as attempted
          }

          // Save progress every batch for resume capability
          await this.saveProgress({
            lastCachedIndex: Math.min(i + BATCH_SIZE, totalItems),
            phase: 'covers',
            startedAt: storedProgress?.startedAt || new Date().toISOString(),
            bookIds,
            cachedCovers,
            cachedSpines,
          });
        }

        // Move to spines phase
        if (!this.shouldCancel) {
          phase = 'spines';
          startIndex = 0;
        }
      }

      // Phase 2: Cache spines
      if (phase === 'spines' && !this.shouldCancel) {
        log.debug(`Caching ${totalItems - startIndex} spines...`);
        for (let i = startIndex; i < totalItems; i += BATCH_SIZE) {
          if (this.shouldCancel) {
            log.debug('Cache operation cancelled by user');
            break;
          }

          const batch = items.slice(i, Math.min(i + BATCH_SIZE, totalItems));
          const spineUrls = batch
            .map(item => apiClient.getItemSpineUrl(item.id))
            .filter((url): url is string => !!url);

          try {
            await Image.prefetch(spineUrls);
            cachedSpines += batch.length;
            bytesDownloaded += batch.length * SPINE_AVG_SIZE;
            reportProgress();
          } catch {
            // Spine failures are non-critical - procedural fallback exists
            log.debug(`Spine batch ${Math.floor(i / BATCH_SIZE) + 1} partial failure`);
            cachedSpines += batch.length; // Count as attempted
          }

          // Save progress
          await this.saveProgress({
            lastCachedIndex: Math.min(i + BATCH_SIZE, totalItems),
            phase: 'spines',
            startedAt: storedProgress?.startedAt || new Date().toISOString(),
            bookIds,
            cachedCovers,
            cachedSpines,
          });
        }
      }

      // Mark as complete if not cancelled
      if (!this.shouldCancel) {
        await this.saveProgress({
          lastCachedIndex: totalItems,
          phase: 'complete',
          startedAt: storedProgress?.startedAt || new Date().toISOString(),
          bookIds,
          cachedCovers,
          cachedSpines,
        });
      }

      const elapsed = Date.now() - startTime;
      log.debug(`Cache complete: ${cachedCovers} covers, ${cachedSpines} spines in ${elapsed}ms`);

      return {
        totalBooks: totalItems,
        cachedCovers,
        cachedSpines,
        totalSizeBytes: bytesDownloaded,
        isComplete: !this.shouldCancel && cachedCovers >= totalItems && cachedSpines >= totalItems,
        lastUpdated: Date.now(),
      };
    } finally {
      this.isCaching = false;
      this.shouldCancel = false;
    }
  }

  /**
   * Cache images for newly added books (for auto-cache feature)
   */
  async cacheNewBooks(items: LibraryItem[]): Promise<void> {
    if (items.length === 0) return;

    const isEnabled = await this.isAutoCacheEnabled();
    if (!isEnabled) return;

    log.debug(`Auto-caching ${items.length} new books...`);

    // Cache covers and spines without progress callback (background operation)
    const coverUrls = items
      .map(item => apiClient.getItemCoverUrl(item.id, { width: 1024, height: 1024 }))
      .filter((url): url is string => !!url);

    const spineUrls = items
      .map(item => apiClient.getItemSpineUrl(item.id))
      .filter((url): url is string => !!url);

    try {
      await Promise.all([
        coverUrls.length > 0 ? Image.prefetch(coverUrls) : Promise.resolve(),
        spineUrls.length > 0 ? Image.prefetch(spineUrls) : Promise.resolve(),
      ]);
      log.debug(`Auto-cached ${items.length} new books`);
    } catch (err) {
      log.debug('Auto-cache partial failure:', err);
    }
  }

  /**
   * Get current cache status
   */
  async getCacheStatus(librarySize: number): Promise<CacheStatus> {
    const storedProgress = await this.getStoredProgress();

    if (!storedProgress) {
      return {
        totalBooks: librarySize,
        cachedCovers: 0,
        cachedSpines: 0,
        totalSizeBytes: 0,
        isComplete: false,
        lastUpdated: null,
      };
    }

    const bytesDownloaded =
      (storedProgress.cachedCovers * COVER_AVG_SIZE) +
      (storedProgress.cachedSpines * SPINE_AVG_SIZE);

    return {
      totalBooks: librarySize,
      cachedCovers: storedProgress.cachedCovers,
      cachedSpines: storedProgress.cachedSpines,
      totalSizeBytes: bytesDownloaded,
      isComplete: storedProgress.phase === 'complete',
      lastUpdated: storedProgress.startedAt ? new Date(storedProgress.startedAt).getTime() : null,
    };
  }

  /**
   * Get formatted cache status string for UI display
   */
  async getFormattedCacheStatus(librarySize: number): Promise<string> {
    const status = await this.getCacheStatus(librarySize);

    if (!status.lastUpdated) {
      return 'Not cached';
    }

    const totalCached = status.cachedCovers + status.cachedSpines;
    const totalPossible = status.totalBooks * 2;
    const sizeFormatted = formatBytes(status.totalSizeBytes);

    if (status.isComplete) {
      return `${totalCached.toLocaleString()} images cached (${sizeFormatted})`;
    }

    return `${totalCached.toLocaleString()} / ${totalPossible.toLocaleString()} cached (${sizeFormatted})`;
  }

  /**
   * Clear all cached images
   */
  async clearImageCache(): Promise<void> {
    log.debug('Clearing image cache...');

    try {
      // Clear expo-image caches
      await Promise.all([
        Image.clearMemoryCache(),
        Image.clearDiskCache(),
      ]);

      // Clear stored progress
      await this.clearProgress();

      log.debug('Image cache cleared');
    } catch (err) {
      log.warn('Failed to clear image cache:', err);
      throw err;
    }
  }

  /**
   * Reset cache state without clearing actual cached images
   * Useful for forcing a re-cache
   */
  async resetCacheProgress(): Promise<void> {
    await this.clearProgress();
  }
}

// Export singleton instance
export const imageCacheService = new ImageCacheService();

// Export types
export type { StoredCacheProgress };
