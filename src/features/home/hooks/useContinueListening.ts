/**
 * src/features/home/hooks/useContinueListening.ts
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

interface ItemsInProgressResponse {
  libraryItems: (LibraryItem & { 
    progressLastUpdate?: number;
    userMediaProgress?: {
      progress: number;
      currentTime: number;
      duration: number;
      isFinished: boolean;
      lastUpdate: number;
    };
  })[];
}

export function useContinueListening() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['itemsInProgress'],
    queryFn: async () => {
      const response = await apiClient.get<ItemsInProgressResponse>('/api/me/items-in-progress');
      console.log('[ContinueListening] Raw count:', response?.libraryItems?.length);
      return response?.libraryItems || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // The items ARE the library items - they come with progressLastUpdate at top level
  // and may have userMediaProgress attached
  const items = (data || [])
    .filter(item => {
      // Has progress data
      const progress = item.userMediaProgress?.progress;
      const hasProgress = progress !== undefined && progress > 0 && progress < 1;
      
      // Or has progressLastUpdate (means it's in progress)
      const hasProgressUpdate = !!item.progressLastUpdate;
      
      console.log('[ContinueListening] Item:', item.media?.metadata?.title, 'progress:', progress, 'lastUpdate:', item.progressLastUpdate);
      
      return hasProgress || hasProgressUpdate;
    })
    .sort((a, b) => {
      const aTime = a.progressLastUpdate || a.userMediaProgress?.lastUpdate || 0;
      const bTime = b.progressLastUpdate || b.userMediaProgress?.lastUpdate || 0;
      return bTime - aTime;
    });

  console.log('[ContinueListening] Final items:', items.length);

  return {
    items,
    isLoading,
    error,
    refetch,
  };
}