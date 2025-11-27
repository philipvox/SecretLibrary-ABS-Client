/**
 * src/features/search/hooks/useAllLibraryItems.ts
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

interface UseAllLibraryItemsResult {
  items: LibraryItem[];
  isLoading: boolean;
  error: Error | null;
}

export function useAllLibraryItems(libraryId: string): UseAllLibraryItemsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['allLibraryItems', libraryId],
    queryFn: async () => {
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
      return allItems;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!libraryId,
  });

  return {
    items: data || [],
    isLoading,
    error: error as Error | null,
  };
}