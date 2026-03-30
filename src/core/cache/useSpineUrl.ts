/**
 * src/core/cache/useSpineUrl.ts
 *
 * Hook to get spine image URLs with automatic cache busting when library is refreshed.
 *
 * Priority:
 * 0. Per-book spine override (user-selected from spine picker)
 * 1. Community spines (if enabled and book is in community manifest)
 * 2. Custom spine server (if configured and book is in server manifest)
 * 3. Main ABS server (if server spines enabled and book is in server manifest)
 *
 * Community spines use the communityBookId (not local UUID) in the URL,
 * since the community server doesn't know about individual ABS instance UUIDs.
 */

import { useMemo } from 'react';
import { apiClient } from '@/core/api';
import { useLibraryCache } from './libraryCache';
import { useSpineCacheStore } from '@/shared/spine';

const COMMUNITY_SPINE_URL = 'https://spines.mysecretlibrary.com';

/**
 * Get a spine image URL with cache busting based on library refresh timestamp.
 * Uses manifest checks (same pattern as server spines) to pick the right source.
 * For community spines, translates local itemId to communityBookId.
 */
export function useSpineUrl(
  itemId: string | undefined,
  options?: { width?: number; height?: number; thumb?: boolean }
): string | null {
  const lastRefreshed = useLibraryCache((state) => state.lastRefreshed);
  const spineServerUrl = useSpineCacheStore((state) => state.spineServerUrl);
  const useCommunitySpines = useSpineCacheStore((state) => state.useCommunitySpines);
  const useServerSpines = useSpineCacheStore((state) => state.useServerSpines);
  const spineOverrides = useSpineCacheStore((state) => state.spineOverrides);
  const booksWithCommunitySpines = useLibraryCache((state) => state.booksWithCommunitySpines);
  const booksWithServerSpines = useLibraryCache((state) => state.booksWithServerSpines);

  return useMemo(() => {
    if (!itemId) return null;

    // Per-book override: user selected a specific spine
    const override = spineOverrides[itemId];
    if (override) return override;

    // Community spines: use communityBookId in the URL (not local UUID)
    // No cache buster — community spines are immutable, expo-image caches on disk
    if (useCommunitySpines && booksWithCommunitySpines.has(itemId)) {
      const communityBookId = useSpineCacheStore.getState().communityBookMap[itemId];
      if (communityBookId) {
        return apiClient.getItemSpineUrl(communityBookId, {
          ...options,
          customBaseUrl: COMMUNITY_SPINE_URL,
        });
      }
    }

    // Server spines: use local itemId (server knows our UUIDs)
    if (useServerSpines && booksWithServerSpines.has(itemId)) {
      const baseUrl = apiClient.getItemSpineUrl(itemId, {
        ...options,
        customBaseUrl: spineServerUrl || undefined,
      });
      if (lastRefreshed) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}t=${lastRefreshed}`;
      }
      return baseUrl;
    }

    return null;
  }, [itemId, lastRefreshed, spineServerUrl, useCommunitySpines, useServerSpines, spineOverrides, booksWithCommunitySpines, booksWithServerSpines, options?.width, options?.height, options?.thumb]);
}

/**
 * Get a community spine URL for a book (used for fallback when server spine not available)
 */
export function getCommunitySpineUrl(itemId: string): string {
  const communityBookId = useSpineCacheStore.getState().communityBookMap[itemId];
  const id = communityBookId || itemId;
  return `${COMMUNITY_SPINE_URL}/api/items/${id}/spine`;
}

/**
 * Non-hook version for use outside of React components (e.g., prefetching)
 */
export function getSpineUrl(
  itemId: string,
  options?: { width?: number; height?: number }
): string {
  const { lastRefreshed, booksWithCommunitySpines, booksWithServerSpines } = useLibraryCache.getState();
  const { spineServerUrl, useCommunitySpines, useServerSpines, communityBookMap, spineOverrides } = useSpineCacheStore.getState();

  // Per-book override
  const override = spineOverrides[itemId];
  if (override) return override;

  // Community spines: use communityBookId
  // No cache buster — community spines are immutable, expo-image caches on disk
  if (useCommunitySpines && booksWithCommunitySpines.has(itemId)) {
    const communityBookId = communityBookMap[itemId];
    if (communityBookId) {
      return apiClient.getItemSpineUrl(communityBookId, {
        ...options,
        customBaseUrl: COMMUNITY_SPINE_URL,
      });
    }
  }

  // Server spines: use local itemId
  if (useServerSpines && booksWithServerSpines.has(itemId)) {
    const baseUrl = apiClient.getItemSpineUrl(itemId, {
      ...options,
      customBaseUrl: spineServerUrl || undefined,
    });
    if (lastRefreshed) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}t=${lastRefreshed}`;
    }
    return baseUrl;
  }

  // Fallback: use main ABS server
  const baseUrl = apiClient.getItemSpineUrl(itemId, options);
  if (lastRefreshed) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}t=${lastRefreshed}`;
  }
  return baseUrl;
}
