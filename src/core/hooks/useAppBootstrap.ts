/**
 * src/core/hooks/useAppBootstrap.ts
 * 
 * App startup hook - loads critical data, prefetches rest in background
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { prefetchService } from '@/core/services/prefetchService';
import { LibraryItem } from '@/core/types';

interface BootstrapResult {
  isReady: boolean;
  error: Error | null;
}

export function useAppBootstrap(libraryId: string | undefined): BootstrapResult {
  const queryClient = useQueryClient();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!libraryId) return;

    // Set query client for prefetch service
    prefetchService.setQueryClient(queryClient);

    const bootstrap = async () => {
      try {
        const staleTime = 10 * 60 * 1000;

        // Load only essential data first (fast)
        await Promise.all([
          queryClient.fetchQuery({
            queryKey: ['series', libraryId],
            queryFn: () => apiClient.getLibrarySeries(libraryId),
            staleTime,
          }),
          queryClient.fetchQuery({
            queryKey: ['authors', libraryId],
            queryFn: () => apiClient.getLibraryAuthors(libraryId),
            staleTime,
          }),
          queryClient.fetchQuery({
            queryKey: ['collections'],
            queryFn: () => apiClient.getCollections(),
            staleTime,
          }),
        ]);

        // Mark ready immediately - don't wait for all items
        setIsReady(true);

        // Prefetch all items in background (non-blocking)
        prefetchService.prefetchLibrary(libraryId).then((allItems) => {
          if (allItems && allItems.length > 0) {
            // Extract and cache narrators from items
            const narratorMap = new Map<string, { id: string; name: string; bookCount: number; books: LibraryItem[] }>();
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
            queryClient.setQueryData(['narrators', libraryId], Array.from(narratorMap.values()));
          }
        });

      } catch (err) {
        console.error('Bootstrap failed:', err);
        setError(err as Error);
        setIsReady(true);
      }
    };

    bootstrap();
  }, [libraryId, queryClient]);

  return { isReady, error };
}