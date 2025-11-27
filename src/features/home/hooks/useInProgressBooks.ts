/**
 * src/features/home/hooks/useInProgressBooks.ts
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

export function useInProgressBooks() {
  return useQuery({
    queryKey: ['in-progress-books'],
    queryFn: async (): Promise<LibraryItem[]> => {
      const items = await apiClient.getItemsInProgress();
      
      // Sort by most recently updated progress
      items.sort((a, b) => {
        const aTime = a.userMediaProgress?.lastUpdate || 0;
        const bTime = b.userMediaProgress?.lastUpdate || 0;
        return bTime - aTime;
      });

      return items.slice(0, 10);
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });
}