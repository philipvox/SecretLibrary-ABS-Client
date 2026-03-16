/**
 * src/core/services/prefetchService.ts
 *
 * Background prefetch service - loads library data on app startup
 * Uses SQLite for persistent cache and expo-image for native image caching
 */

import { QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { sqliteCache } from './sqliteCache';
import { imageCacheService } from './imageCacheService';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { logger } from '@/shared/utils/logger';

class PrefetchService {
  private queryClient: QueryClient | null = null;
  private isLoading = false;
  private cachedItems: LibraryItem[] = [];
  private lastLibraryId: string = '';
  private isHydrated = false;

  setQueryClient(client: QueryClient) {
    this.queryClient = client;
  }

  /**
   * Hydrate React Query cache from SQLite (instant on startup)
   * Call this before prefetchLibrary for immediate UI display
   *
   * CRITICAL: Also hydrates spine cache to prevent flash when library renders.
   * Spine data must be ready BEFORE first render to avoid dimension recalculation.
   */
  async hydrateFromCache(libraryId: string): Promise<LibraryItem[]> {
    if (!libraryId) return [];

    try {
      // Initialize SQLite
      await sqliteCache.init();

      const startTime = Date.now();

      // CRITICAL: Hydrate spine cache FIRST (prevents library flash)
      // This loads pre-calculated spine dimensions before any UI renders
      const spineCount = await useSpineCacheStore.getState().hydrateFromSQLite(libraryId);
      if (spineCount > 0) {
        logger.debug(`[Prefetch] Pre-loaded ${spineCount} spine dimensions`);
      }

      // Load cached items from SQLite
      const cachedItems = await sqliteCache.getLibraryItems(libraryId);

      if (cachedItems.length > 0) {
        this.cachedItems = cachedItems;
        this.lastLibraryId = libraryId;
        this.isHydrated = true;

        // Hydrate React Query cache
        if (this.queryClient) {
          this.queryClient.setQueryData(['allLibraryItems', libraryId], cachedItems);
        }

        const elapsed = Date.now() - startTime;
        logger.debug(`[Prefetch] Hydrated ${cachedItems.length} items from SQLite in ${elapsed}ms`);

        // Prefetch covers for most recently added items
        this.prefetchCovers(cachedItems, 50);

        // Prefetch ALL spine images in background for instant loading
        this.prefetchAllSpines(cachedItems);
      }

      return cachedItems;
    } catch (err) {
      logger.warn('[Prefetch] Hydration failed:', err);
      return [];
    }
  }

  /**
   * Check if we have cached data for this library
   */
  async hasCachedData(libraryId: string): Promise<boolean> {
    try {
      await sqliteCache.init();
      const count = await sqliteCache.getLibraryItemCount(libraryId);
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get last sync time for incremental updates
   */
  async getLastSyncTime(libraryId: string): Promise<number | null> {
    try {
      return await sqliteCache.getLastSyncTime(libraryId);
    } catch {
      return null;
    }
  }

  async prefetchLibrary(libraryId: string): Promise<LibraryItem[]> {
    if (!libraryId || this.isLoading) return this.cachedItems;
    if (libraryId === this.lastLibraryId && this.cachedItems.length > 0 && !this.isHydrated) {
      return this.cachedItems;
    }

    this.isLoading = true;
    this.lastLibraryId = libraryId;

    try {
      logger.debug('[Prefetch] Starting background load...');
      const startTime = Date.now();

      // Initialize SQLite
      await sqliteCache.init();

      // Load all items in background
      const allItems: LibraryItem[] = [];
      let page = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await apiClient.getLibraryItems(libraryId, {
          limit,
          page,
          include: 'progress',
        });
        allItems.push(...response.results);
        hasMore = allItems.length < response.total;
        page++;
      }

      this.cachedItems = allItems;
      this.isHydrated = false; // Fresh data from server

      // Update React Query cache
      if (this.queryClient) {
        this.queryClient.setQueryData(['allLibraryItems', libraryId], allItems);
      }

      // Persist to SQLite for next startup
      await sqliteCache.setLibraryItems(libraryId, allItems);

      const elapsed = Date.now() - startTime;
      logger.debug(`[Prefetch] Loaded ${allItems.length} items in ${elapsed}ms (saved to SQLite)`);

      // Auto-cache images for new books if enabled
      if (this.cachedItems.length > 0) {
        const existingIds = new Set(this.cachedItems.map(item => item.id));
        const newItems = allItems.filter(item => !existingIds.has(item.id));
        if (newItems.length > 0) {
          imageCacheService.cacheNewBooks(newItems).catch(err => {
            logger.debug('[Prefetch] Auto-cache new books failed:', err);
          });
        }
      }

      // Prefetch cover images for 100 most recently added - expo-image handles this efficiently
      this.prefetchCovers(allItems, 100);

      // Prefetch ALL spine images in background for instant loading
      this.prefetchAllSpines(allItems);

      return allItems;

    } catch (err) {
      logger.warn('[Prefetch] Failed:', err);
      // If network fetch fails, try to return cached data
      if (this.cachedItems.length === 0) {
        const cached = await sqliteCache.getLibraryItems(libraryId);
        if (cached.length > 0) {
          logger.debug('[Prefetch] Falling back to SQLite cache');
          this.cachedItems = cached;
          return cached;
        }
      }
      return this.cachedItems;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get items sorted by most recently added to ABS
   */
  private getRecentlyAdded(items: LibraryItem[], count: number): LibraryItem[] {
    return [...items]
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
      .slice(0, count);
  }

  /**
   * Get items sorted by most recently listened (has progress, sorted by lastUpdate)
   */
  private getRecentlyListened(items: LibraryItem[], count: number): LibraryItem[] {
    return [...items]
      .filter(item => item.userMediaProgress?.lastUpdate)
      .sort((a, b) => (b.userMediaProgress?.lastUpdate || 0) - (a.userMediaProgress?.lastUpdate || 0))
      .slice(0, count);
  }

  /**
   * Get priority items for prefetching: recently listened + recently added (deduplicated)
   */
  private getPriorityItems(items: LibraryItem[], recentlyListenedCount: number, recentlyAddedCount: number): LibraryItem[] {
    const recentlyListened = this.getRecentlyListened(items, recentlyListenedCount);
    const recentlyAdded = this.getRecentlyAdded(items, recentlyAddedCount);

    // Combine and deduplicate (recently listened takes priority)
    const seenIds = new Set(recentlyListened.map(i => i.id));
    const combined = [...recentlyListened];

    for (const item of recentlyAdded) {
      if (!seenIds.has(item.id)) {
        combined.push(item);
        seenIds.add(item.id);
      }
    }

    return combined;
  }

  private async prefetchCovers(items: LibraryItem[], recentlyAddedCount: number = 100) {
    // Get priority items: 50 recently listened + N recently added (deduplicated)
    const priorityItems = this.getPriorityItems(items, 50, recentlyAddedCount);

    // Prefetch cover images using expo-image's native caching
    // Use 1024x1024 for high quality on player and detail screens
    const coverUrls = priorityItems
      .map(item => apiClient.getItemCoverUrl(item.id, { width: 1024, height: 1024 }))
      .filter((url): url is string => !!url);

    if (coverUrls.length === 0) return;

    try {
      // expo-image prefetch uses native caching (disk + memory LRU)
      await Image.prefetch(coverUrls);
      logger.debug(`[Prefetch] Cached ${coverUrls.length} covers (recently listened + recently added)`);
    } catch (err) {
      logger.warn('[Prefetch] Cover prefetch error:', err);
    }

    // Also prefetch spine images for these priority items
    await this.prefetchSpines(priorityItems);
  }

  /**
   * Prefetch spine images for priority items.
   * Spines are pre-generated PNG images served from ABS metadata folder.
   */
  private async prefetchSpines(items: LibraryItem[]) {
    const spineUrls = items
      .map(item => apiClient.getItemSpineUrl(item.id))
      .filter((url): url is string => !!url);

    if (spineUrls.length === 0) return;

    try {
      await Image.prefetch(spineUrls);
      logger.debug(`[Prefetch] Cached ${spineUrls.length} spine images`);
    } catch (err) {
      // Spine prefetch failures are non-critical - procedural fallback exists
      logger.debug('[Prefetch] Spine prefetch error (non-critical):', err);
    }
  }

  /**
   * Prefetch ALL spine THUMBNAILS for instant blur-up effect.
   *
   * Strategy: Prefetch tiny thumbnails (~230 bytes each) instead of full spines (~25KB each)
   * - 2,637 thumbnails = ~600KB total (vs ~66MB for full spines)
   * - Thumbnails load instantly from cache when user views any screen
   * - Full spine loads after, creating smooth blur-up transition
   * - No queue blocking since thumbnails are so small
   */
  async prefetchAllSpines(items: LibraryItem[]): Promise<void> {
    if (items.length === 0) return;

    // Check if server spines are enabled
    const useServerSpines = useSpineCacheStore.getState().useServerSpines;
    if (!useServerSpines) {
      logger.debug('[Prefetch] Server spines disabled, skipping spine prefetch');
      return;
    }

    const startTime = Date.now();

    // Get ALL spine THUMBNAIL URLs (tiny ~230 byte placeholders)
    const thumbnailUrls = items
      .map(item => apiClient.getItemSpineUrl(item.id, { thumb: true }))
      .filter((url): url is string => !!url);

    if (thumbnailUrls.length === 0) return;

    const totalSizeKB = Math.round(thumbnailUrls.length * 230 / 1024);
    logger.debug(`[Prefetch] Caching ${thumbnailUrls.length} spine thumbnails (~${totalSizeKB}KB total)...`);

    // Prefetch in batches to avoid overwhelming network
    const BATCH_SIZE = 100;
    let cached = 0;

    for (let i = 0; i < thumbnailUrls.length; i += BATCH_SIZE) {
      const batch = thumbnailUrls.slice(i, i + BATCH_SIZE);
      try {
        await Image.prefetch(batch);
        cached += batch.length;
      } catch {
        // Continue with next batch even if one fails
        logger.debug(`[Prefetch] Thumbnail batch ${Math.floor(i / BATCH_SIZE) + 1} partial failure`);
      }
    }

    const elapsed = Date.now() - startTime;
    logger.debug(`[Prefetch] Cached ${cached} spine thumbnails in ${elapsed}ms`);
  }

  /**
   * Prefetch covers for items most likely to be seen first.
   * Call this during app initialization for instant image display.
   * Priority: current book, recently listened, first visible items.
   */
  async prefetchCriticalCovers(items: LibraryItem[]): Promise<void> {
    // Prefetch 20 most recently added covers - these are most likely to be viewed
    // Use 1024x1024 for high quality on player and detail screens
    const recentItems = this.getRecentlyAdded(items, 20);
    const criticalUrls = recentItems
      .map(item => apiClient.getItemCoverUrl(item.id, { width: 1024, height: 1024 }))
      .filter((url): url is string => !!url);

    if (criticalUrls.length === 0) return;

    const startTime = Date.now();
    try {
      await Image.prefetch(criticalUrls);
      const elapsed = Date.now() - startTime;
      logger.debug(`[Prefetch] Critical covers ready: ${criticalUrls.length} in ${elapsed}ms`);
    } catch (err) {
      logger.warn('[Prefetch] Critical cover prefetch error:', err);
    }
  }

  getCachedItems(): LibraryItem[] {
    return this.cachedItems;
  }

  getItem(itemId: string): LibraryItem | undefined {
    return this.cachedItems.find(item => item.id === itemId);
  }

  isReady(): boolean {
    return this.cachedItems.length > 0;
  }

  clear() {
    this.cachedItems = [];
    this.lastLibraryId = '';
  }
}

export const prefetchService = new PrefetchService();