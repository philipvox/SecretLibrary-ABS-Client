/**
 * src/core/hooks/useAppBootstrap.ts
 *
 * App startup hook - cache-first architecture for instant UI
 * 1. Hydrate from SQLite cache (instant)
 * 2. Fetch fresh data from network (background)
 * 3. Update cache with new data
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { queryKeys } from '@/core/queryClient';
import { prefetchService } from '@/core/services/prefetchService';
import { sqliteCache } from '@/core/services/sqliteCache';
import { LibraryItem } from '@/core/types';
import { logger } from '@/shared/utils/logger';

interface BootstrapResult {
  isReady: boolean;
  isHydrated: boolean;
  error: Error | null;
}

export function useAppBootstrap(libraryId: string | undefined): BootstrapResult {
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!libraryId) return;

    // Set query client for prefetch service
    prefetchService.setQueryClient(queryClient);

    const bootstrap = async () => {
      try {
        logger.debug('[Bootstrap] Starting...');
        const startTime = Date.now();

        // ====================================================================
        // PHASE 1: Hydrate from SQLite cache (instant UI)
        // ====================================================================
        const cachedItems = await prefetchService.hydrateFromCache(libraryId);

        if (cachedItems.length > 0) {
          // We have cached data - show UI immediately!
          setIsHydrated(true);
          setIsReady(true);
          logger.debug(`[Bootstrap] Hydrated from cache in ${Date.now() - startTime}ms`);
        }

        // ====================================================================
        // PHASE 2: Fetch fresh data from network (background)
        // ====================================================================
        const staleTime = 30 * 60 * 1000; // 30 minutes

        // Fetch essential data from network
        const [seriesData, authorsData, collectionsData] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: queryKeys.series.list(libraryId),
            queryFn: () => apiClient.getLibrarySeries(libraryId),
            staleTime,
          }),
          queryClient.fetchQuery({
            queryKey: queryKeys.authors.list(libraryId),
            queryFn: () => apiClient.getLibraryAuthors(libraryId),
            staleTime,
          }),
          queryClient.fetchQuery({
            queryKey: queryKeys.collections.all,
            queryFn: () => apiClient.getCollections(),
            staleTime,
          }),
        ]);

        // Cache series, authors, and collections to SQLite
        if (seriesData) {
          await sqliteCache.setSeries(libraryId, seriesData);
        }
        if (authorsData) {
          await sqliteCache.setAuthors(libraryId, authorsData);
        }
        if (collectionsData) {
          await sqliteCache.setCollections(collectionsData);
        }

        // Mark ready if not already (first run with no cache)
        if (!isReady) {
          setIsReady(true);
        }

        // ====================================================================
        // PHASE 3: Prefetch all items in background (non-blocking)
        // ====================================================================
        prefetchService.prefetchLibrary(libraryId).then(async (allItems) => {
          if (allItems && allItems.length > 0) {
            // Extract and cache narrators from items
            const narratorMap = new Map<
              string,
              { id: string; name: string; bookCount: number; books: LibraryItem[] }
            >();

            allItems.forEach((item) => {
              const narrators = (item.media?.metadata as any)?.narrators || [];
              narrators.forEach((name: string) => {
                if (!name || typeof name !== 'string') return;
                const trimmed = name.trim();
                if (!trimmed) return;
                const id = trimmed.toLowerCase().replace(/\s+/g, '-');
                const existing = narratorMap.get(id);
                if (existing) {
                  existing.bookCount++;
                  existing.books.push(item);
                } else {
                  narratorMap.set(id, { id, name: trimmed, bookCount: 1, books: [item] });
                }
              });
            });

            const narratorsArray = Array.from(narratorMap.values());
            queryClient.setQueryData(queryKeys.narrators.list(libraryId), narratorsArray);

            // Cache narrators to SQLite
            await sqliteCache.setNarrators(
              libraryId,
              narratorsArray.map((n) => ({ id: n.id, name: n.name, bookCount: n.bookCount }))
            );
          }
        });

        logger.debug(`[Bootstrap] Complete in ${Date.now() - startTime}ms`);
      } catch (err) {
        logger.error('[Bootstrap] Failed:', err);
        setError(err as Error);

        // Even on error, try to show cached data if available
        if (!isReady) {
          const cachedItems = await prefetchService.hydrateFromCache(libraryId);
          if (cachedItems.length > 0) {
            setIsHydrated(true);
          }
          setIsReady(true);
        }
      }
    };

    bootstrap();
  }, [libraryId, queryClient]);

  return { isReady, isHydrated, error };
}