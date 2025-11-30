/**
 * src/features/series/hooks/useLibrarySeries.ts
 *
 * Hook to fetch series directly from AudiobookShelf API.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { Series } from '@/core/types';

interface UseLibrarySeriesResult {
  series: Series[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch series from AudiobookShelf API
 */
export function useLibrarySeries(libraryId: string): UseLibrarySeriesResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['library', libraryId, 'series'],
    queryFn: () => apiClient.getLibrarySeries(libraryId),
    staleTime: 5 * 60 * 1000,
    enabled: !!libraryId,
  });

  return {
    series: data || [],
    isLoading,
    error: error as Error | null,
    refetch,
  };
}