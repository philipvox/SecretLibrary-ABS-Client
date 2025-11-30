/**
 * src/core/services/prefetchService.ts
 * 
 * Background prefetch service - loads library data on app startup
 */

import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

class PrefetchService {
  private queryClient: QueryClient | null = null;
  private isLoading = false;
  private cachedItems: LibraryItem[] = [];
  private lastLibraryId: string = '';

  setQueryClient(client: QueryClient) {
    this.queryClient = client;
  }

  async prefetchLibrary(libraryId: string): Promise<LibraryItem[]> {
    if (!libraryId || this.isLoading) return this.cachedItems;
    if (libraryId === this.lastLibraryId && this.cachedItems.length > 0) return this.cachedItems;

    this.isLoading = true;
    this.lastLibraryId = libraryId;

    try {
      console.log('[Prefetch] Starting background load...');
      const startTime = Date.now();

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

      // Update React Query cache
      if (this.queryClient) {
        this.queryClient.setQueryData(['allLibraryItems', libraryId], allItems);
      }

      const elapsed = Date.now() - startTime;
      console.log(`[Prefetch] Loaded ${allItems.length} items in ${elapsed}ms`);

      // Prefetch cover images (first 50)
      this.prefetchCovers(allItems.slice(0, 50));

      return allItems;

    } catch (err) {
      console.warn('[Prefetch] Failed:', err);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  private prefetchCovers(items: LibraryItem[]) {
    // Prefetch cover images using Image.prefetch
    items.forEach(item => {
      const coverUrl = apiClient.getItemCoverUrl(item.id);
      if (coverUrl) {
        // Use fetch to warm the cache
        fetch(coverUrl, { method: 'HEAD' }).catch(() => {});
      }
    });
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