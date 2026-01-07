/**
 * src/core/cache/useCoverUrl.ts
 *
 * Hook to get cover URLs with automatic cache busting when library is refreshed.
 * Uses lastRefreshed timestamp from libraryCache to force image refresh.
 */

import { useMemo } from 'react';
import { apiClient } from '@/core/api';
import { useLibraryCache } from './libraryCache';

/**
 * Get a cover URL with cache busting based on library refresh timestamp
 * @param itemId - The library item ID
 * @param options - Optional width/height for optimized cover sizes
 * @returns Cover URL with cache-busting query parameter when library was refreshed
 */
export function useCoverUrl(itemId: string, options?: { width?: number; height?: number }): string {
  const lastRefreshed = useLibraryCache((state) => state.lastRefreshed);

  return useMemo(() => {
    // Guard against empty or invalid itemId
    if (!itemId) return '';

    const baseUrl = apiClient.getItemCoverUrl(itemId, options);
    // If library was refreshed, append timestamp to bust cache
    if (lastRefreshed) {
      // Preserve existing query params when adding timestamp
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}t=${lastRefreshed}`;
    }
    return baseUrl;
  }, [itemId, lastRefreshed, options?.width, options?.height]);
}

/**
 * Non-hook version for use outside of React components
 * @param itemId - The library item ID
 * @param options - Optional width/height for optimized cover sizes
 * @returns Cover URL with cache-busting query parameter when library was refreshed
 */
export function getCoverUrl(itemId: string, options?: { width?: number; height?: number }): string {
  const { lastRefreshed } = useLibraryCache.getState();
  const baseUrl = apiClient.getItemCoverUrl(itemId, options);
  if (lastRefreshed) {
    // Preserve existing query params when adding timestamp
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}t=${lastRefreshed}`;
  }
  return baseUrl;
}
