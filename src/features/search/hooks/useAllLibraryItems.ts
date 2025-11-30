/**
 * src/features/search/hooks/useAllLibraryItems.ts
 * 
 * Uses prefetch cache when available - non-blocking
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiClient } from '@/core/api';
import { prefetchService } from '@/core/services/prefetchService';
import { LibraryItem } from '@/core/types';

interface UseAllLibraryItemsResult {
  items: LibraryItem[];
  isLoading: boolean;
  error: Error | null;
}

export function useAllLibraryItems(libraryId: string): UseAllLibraryItemsResult {
  // Check prefetch cache first (instant)
  const [cachedItems, setCachedItems] = useState<LibraryItem[]>(() => 
    prefetchService.getCachedItems()
  );

  // Poll for prefetch completion
  useEffect(() => {
    if (cachedItems.length > 0 || !libraryId) return;
    
    const checkCache = setInterval(() => {
      const cached = prefetchService.getCachedItems();
      if (cached.length > 0) {
        setCachedItems(cached);
        clearInterval(checkCache);
      }
    }, 500);

    return () => clearInterval(checkCache);
  }, [libraryId, cachedItems.length]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['allLibraryItems', libraryId],
    queryFn: async () => {
      // Check prefetch cache first
      const cached = prefetchService.getCachedItems();
      if (cached.length > 0) {
        return cached;
      }

      // Otherwise load (this is fallback)
      console.log('[useAllLibraryItems] Loading from API...');
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
    gcTime: 30 * 60 * 1000,
    enabled: !!libraryId && cachedItems.length === 0,
    initialData: cachedItems.length > 0 ? cachedItems : undefined,
  });

  // Use cached items if available, otherwise query data
  const items = cachedItems.length > 0 ? cachedItems : (data || []);

  return {
    items,
    isLoading: isLoading && items.length === 0,
    error: error as Error | null,
  };
}