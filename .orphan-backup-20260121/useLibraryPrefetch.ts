import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { queryKeys } from '@/core/queryClient';
import { LibraryItem } from '@/core/types';

export function useLibraryPrefetch(libraryId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!libraryId) return;

    const prefetchAll = async () => {
      // Prefetch all library items (used by narrators + search)
      queryClient.prefetchQuery({
        queryKey: queryKeys.library.allItems(libraryId),
        queryFn: async () => {
          const allItems: LibraryItem[] = [];
          let page = 0;
          const limit = 100;
          let hasMore = true;

          while (hasMore) {
            const response = await apiClient.getLibraryItems(libraryId, { limit, page });
            allItems.push(...response.results);
            hasMore = allItems.length < response.total;
            page++;
          }
          return allItems;
        },
        staleTime: 10 * 60 * 1000,
      });

      // Prefetch series
      queryClient.prefetchQuery({
        queryKey: queryKeys.series.list(libraryId),
        queryFn: () => apiClient.getLibrarySeries(libraryId),
        staleTime: 10 * 60 * 1000,
      });

      // Prefetch authors
      queryClient.prefetchQuery({
        queryKey: queryKeys.authors.list(libraryId),
        queryFn: () => apiClient.getLibraryAuthors(libraryId),
        staleTime: 10 * 60 * 1000,
      });

      // Prefetch collections
      queryClient.prefetchQuery({
        queryKey: queryKeys.collections.all,
        queryFn: () => apiClient.getCollections(),
        staleTime: 10 * 60 * 1000,
      });
    };

    prefetchAll();
  }, [libraryId, queryClient]);
}