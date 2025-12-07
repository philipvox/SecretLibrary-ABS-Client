/**
 * src/features/book-detail/hooks/useBookDetails.ts
 *
 * Hook to fetch full book details including chapters and progress.
 * Uses library cache for instant display, fetches fresh data in background.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { queryKeys } from '@/core/queryClient';
import { useLibraryCache } from '@/core/cache';
import { LibraryItem } from '@/core/types';

interface UseBookDetailsResult {
  book: LibraryItem | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch full book details including progress
 * Uses cached data instantly, fetches fresh in background
 *
 * @param bookId - Book ID to fetch details for
 */
export function useBookDetails(bookId: string): UseBookDetailsResult {
  // Get cached book data for instant display
  const { getItem } = useLibraryCache();
  const cachedBook = getItem(bookId);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.book.detail(bookId),
    // Include expanded=1 to get full author/series/narrator info
    queryFn: () => apiClient.getItem(bookId, 'progress,expanded'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!bookId,
    // Use cached data as placeholder - show instantly, update when API responds
    placeholderData: cachedBook,
  });

  return {
    // Return API data if available, otherwise cached data
    book: data || cachedBook,
    // Only show loading if we have no data at all
    isLoading: isLoading && !cachedBook,
    error: error as Error | null,
    refetch,
  };
}
