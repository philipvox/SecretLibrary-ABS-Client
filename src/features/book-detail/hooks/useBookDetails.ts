/**
 * src/features/book-detail/hooks/useBookDetails.ts
 *
 * Hook to fetch full book details including chapters and progress.
 * Uses React Query for caching and automatic updates.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

interface UseBookDetailsResult {
  book: LibraryItem | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch full book details including progress
 * 
 * @param bookId - Book ID to fetch details for
 */
export function useBookDetails(bookId: string): UseBookDetailsResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => apiClient.getItem(bookId, 'progress'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!bookId, // Only fetch if bookId exists
  });

  return {
    book: data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
