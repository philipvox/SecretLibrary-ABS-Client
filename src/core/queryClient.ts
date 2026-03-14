/**
 * src/core/queryClient.ts
 *
 * Centralized React Query configuration with query keys factory.
 *
 * This file provides:
 * - A configured QueryClient instance
 * - A query keys factory for consistent key generation
 * - Type-safe query key patterns
 *
 * Usage:
 *   import { queryClient, queryKeys } from '@/core/queryClient';
 *
 *   // In hooks:
 *   useQuery({ queryKey: queryKeys.library.items('lib-123'), ... })
 *
 *   // For invalidation:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.library.all })
 */

import { QueryClient } from '@tanstack/react-query';

// =============================================================================
// QUERY CLIENT CONFIGURATION
// =============================================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Keep unused data in cache for 30 minutes
      gcTime: 30 * 60 * 1000,

      // Retry failed requests 2 times
      retry: 2,

      // Don't refetch on window focus (mobile app)
      refetchOnWindowFocus: false,

      // Don't refetch on reconnect automatically
      refetchOnReconnect: false,

      // Trust cached data on mount
      refetchOnMount: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// =============================================================================
// QUERY KEYS FACTORY
// =============================================================================

/**
 * Query keys factory for consistent key generation across the app.
 *
 * Pattern: [domain, scope?, identifier?, params?]
 *
 * Examples:
 *   queryKeys.library.all                    → ['library']
 *   queryKeys.library.items('lib-123')       → ['library', 'lib-123', 'items']
 *   queryKeys.library.item('item-456')       → ['library', 'item', 'item-456']
 *   queryKeys.user.progress('item-456')      → ['user', 'progress', 'item-456']
 */
export const queryKeys = {
  // ---------------------------------------------------------------------------
  // Library
  // ---------------------------------------------------------------------------
  library: {
    all: ['library'] as const,
    lists: () => [...queryKeys.library.all, 'list'] as const,
    list: (libraryId: string, filters?: { limit?: number; sort?: string; filter?: string }) =>
      [...queryKeys.library.lists(), libraryId, filters] as const,
    items: (libraryId: string) => [...queryKeys.library.all, libraryId, 'items'] as const,
    itemsFiltered: (libraryId: string, filters: { limit?: number; sort?: string; filter?: string }) =>
      [...queryKeys.library.items(libraryId), filters] as const,
    item: (itemId: string) => [...queryKeys.library.all, 'item', itemId] as const,
    continueListening: () => [...queryKeys.library.all, 'continueListening'] as const,
    allItems: (libraryId: string) => [...queryKeys.library.all, 'allItems', libraryId] as const,
  },

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------
  collections: {
    all: ['collections'] as const,
    lists: () => [...queryKeys.collections.all, 'list'] as const,
    detail: (collectionId: string) => [...queryKeys.collections.all, collectionId] as const,
    items: (collectionId: string) => [...queryKeys.collections.all, collectionId, 'items'] as const,
  },

  // ---------------------------------------------------------------------------
  // Series
  // ---------------------------------------------------------------------------
  series: {
    all: ['series'] as const,
    lists: () => [...queryKeys.series.all, 'list'] as const,
    list: (libraryId: string) => [...queryKeys.series.lists(), libraryId] as const,
    detail: (seriesId: string) => [...queryKeys.series.all, seriesId] as const,
    items: (seriesId: string) => [...queryKeys.series.all, seriesId, 'items'] as const,
  },

  // ---------------------------------------------------------------------------
  // Authors
  // ---------------------------------------------------------------------------
  authors: {
    all: ['authors'] as const,
    lists: () => [...queryKeys.authors.all, 'list'] as const,
    list: (libraryId: string) => [...queryKeys.authors.lists(), libraryId] as const,
    detail: (authorId: string) => [...queryKeys.authors.all, authorId] as const,
    books: (authorId: string) => [...queryKeys.authors.all, authorId, 'books'] as const,
  },

  // ---------------------------------------------------------------------------
  // Narrators
  // ---------------------------------------------------------------------------
  narrators: {
    all: ['narrators'] as const,
    lists: () => [...queryKeys.narrators.all, 'list'] as const,
    list: (libraryId: string) => [...queryKeys.narrators.lists(), libraryId] as const,
    detail: (narratorId: string) => [...queryKeys.narrators.all, narratorId] as const,
    books: (narratorId: string) => [...queryKeys.narrators.all, narratorId, 'books'] as const,
  },

  // ---------------------------------------------------------------------------
  // User
  // ---------------------------------------------------------------------------
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,

    // Progress
    progress: (itemId: string) => [...queryKeys.user.all, 'progress', itemId] as const,
    progressAll: () => [...queryKeys.user.all, 'progress'] as const,

    // Favorites
    favorites: () => [...queryKeys.user.all, 'favorites'] as const,
    isFavorite: (itemId: string) => [...queryKeys.user.all, 'favorites', itemId] as const,

    // Continue Listening & History
    inProgress: () => [...queryKeys.user.all, 'inProgress'] as const,
    continueListening: () => [...queryKeys.user.all, 'continueListening'] as const,
    history: () => [...queryKeys.user.all, 'history'] as const,
    listening: () => [...queryKeys.user.all, 'listening'] as const,

    // Stats
    libraryStats: () => [...queryKeys.user.all, 'libraryStats'] as const,
  },

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------
  search: {
    all: ['search'] as const,
    results: (query: string, libraryId?: string) =>
      [...queryKeys.search.all, query, libraryId].filter(Boolean) as string[],
  },

  // ---------------------------------------------------------------------------
  // Books (detailed item info)
  // ---------------------------------------------------------------------------
  book: {
    all: ['book'] as const,
    detail: (bookId: string) => [...queryKeys.book.all, bookId] as const,
    progress: (bookId: string) => [...queryKeys.book.all, bookId, 'progress'] as const,
  },

  // ---------------------------------------------------------------------------
  // Playback Sessions
  // ---------------------------------------------------------------------------
  playback: {
    all: ['playback'] as const,
    session: (sessionId: string) => [...queryKeys.playback.all, 'session', sessionId] as const,
    history: () => [...queryKeys.playback.all, 'history'] as const,
  },

  // ---------------------------------------------------------------------------
  // Libraries (server-level)
  // ---------------------------------------------------------------------------
  libraries: {
    all: ['libraries'] as const,
    detail: (libraryId: string) => [...queryKeys.libraries.all, libraryId] as const,
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Invalidate all queries for a given entity.
 * Useful after mutations that affect multiple views.
 *
 * @example
 *   invalidateEntity('library');  // Invalidates all library queries
 *   invalidateEntity('user');     // Invalidates all user queries
 */
export function invalidateEntity(entity: keyof typeof queryKeys) {
  return queryClient.invalidateQueries({ queryKey: queryKeys[entity].all });
}

/**
 * Prefetch a query to populate the cache.
 * Useful for anticipating user navigation.
 *
 * @example
 *   prefetchQuery(queryKeys.book.detail('abc'), () => apiClient.getItem('abc'));
 */
export async function prefetchQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  staleTime = 5 * 60 * 1000
) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime,
  });
}

/**
 * Get cached data without triggering a refetch.
 *
 * @example
 *   const cachedItem = getCachedData(queryKeys.book.detail('abc'));
 */
export function getCachedData<T>(queryKey: readonly unknown[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Prefetch all main tab data in parallel.
 * Call this after authentication to warm the cache for instant tab switching.
 * This runs in the background - don't await unless you need to block on it.
 */
export async function prefetchMainTabData(): Promise<void> {
  // Import apiClient lazily to avoid circular deps
  const { apiClient } = await import('./api');
  // Import library cache store directly
  const { useLibraryCache } = await import('./cache/libraryCache');

  try {
    // First, fetch libraries to get the library ID
    // This must complete before we can refresh the library cache
    const libraries = await apiClient.getLibraries();
    const defaultLibraryId = libraries?.[0]?.id;

    // Cache the libraries result
    queryClient.setQueryData(queryKeys.libraries.all, libraries);

    if (!defaultLibraryId) {
      if (__DEV__) {
        console.warn('[PREFETCH] No library ID found, skipping cache load');
      }
      return;
    }

    // Now prefetch remaining data in parallel
    const prefetches = [
      // Items in progress (for home screen)
      queryClient.prefetchQuery({
        queryKey: queryKeys.user.inProgress(),
        queryFn: () => apiClient.getItemsInProgress(),
        staleTime: 2 * 60 * 1000, // 2 minutes
      }),

      // Playlists
      queryClient.prefetchQuery({
        queryKey: ['playlists'],
        queryFn: () => apiClient.getPlaylists(),
        staleTime: 5 * 60 * 1000, // 5 minutes
      }),

      // Collections (for Browse Collections tab)
      queryClient.prefetchQuery({
        queryKey: queryKeys.collections.all,
        queryFn: () => apiClient.getCollections(),
        staleTime: 10 * 60 * 1000, // 10 minutes
      }),

      // Library cache load (loads all items, series, authors)
      // Uses SQLite cache if valid (<30 days), only fetches from server if expired
      useLibraryCache.getState().loadCache(defaultLibraryId),
    ];

    await Promise.allSettled(prefetches);
  } catch (err) {
    if (__DEV__) {
      console.error('[PREFETCH] Prefetch failed:', err);
    }
  }
}

/**
 * Set cached data directly.
 * Useful for optimistic updates.
 *
 * @example
 *   setCachedData(queryKeys.book.detail('abc'), updatedBook);
 */
export function setCachedData<T>(queryKey: readonly unknown[], data: T) {
  return queryClient.setQueryData(queryKey, data);
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type QueryKeys = typeof queryKeys;
export type LibraryQueryKeys = typeof queryKeys.library;
export type UserQueryKeys = typeof queryKeys.user;
