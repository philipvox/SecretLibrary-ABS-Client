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
   */
  async hydrateFromCache(libraryId: string): Promise<LibraryItem[]> {
    if (!libraryId) return [];

    try {
      // Initialize SQLite
      await sqliteCache.init();

      const startTime = Date.now();

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
        console.log(`[Prefetch] Hydrated ${cachedItems.length} items from SQLite in ${elapsed}ms`);

        // Prefetch covers for cached items
        this.prefetchCovers(cachedItems.slice(0, 50));
      }

      return cachedItems;
    } catch (err) {
      console.warn('[Prefetch] Hydration failed:', err);
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
      console.log('[Prefetch] Starting background load...');
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
      console.log(`[Prefetch] Loaded ${allItems.length} items in ${elapsed}ms (saved to SQLite)`);

      // Prefetch cover images (first 100) - expo-image handles this efficiently
      this.prefetchCovers(allItems.slice(0, 100));

      return allItems;

    } catch (err) {
      console.warn('[Prefetch] Failed:', err);
      // If network fetch fails, try to return cached data
      if (this.cachedItems.length === 0) {
        const cached = await sqliteCache.getLibraryItems(libraryId);
        if (cached.length > 0) {
          console.log('[Prefetch] Falling back to SQLite cache');
          this.cachedItems = cached;
          return cached;
        }
      }
      return this.cachedItems;
    } finally {
      this.isLoading = false;
    }
  }

  private async prefetchCovers(items: LibraryItem[]) {
    // Prefetch cover images using expo-image's native caching
    const coverUrls = items
      .map(item => apiClient.getItemCoverUrl(item.id))
      .filter((url): url is string => !!url);

    if (coverUrls.length === 0) return;

    try {
      // expo-image prefetch uses native caching (disk + memory LRU)
      await Image.prefetch(coverUrls);
      console.log(`[Prefetch] Cached ${coverUrls.length} cover images`);
    } catch (err) {
      console.warn('[Prefetch] Cover prefetch error:', err);
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