/**
 * src/features/browse/hooks/useTopAuthors.ts
 *
 * Hook to get top authors sorted by book count.
 */

import { useMemo } from 'react';
import { useLibraryCache } from '@/core/cache';

export interface TopAuthor {
  name: string;
  count: number;
}

/**
 * Get top authors sorted by book count
 * Uses pre-built authors map from library cache (no iteration needed)
 */
export function useTopAuthors(limit: number = 10): TopAuthor[] {
  const authors = useLibraryCache((s) => s.authors);
  const isLoaded = useLibraryCache((s) => s.isLoaded);

  return useMemo(() => {
    if (!isLoaded || authors.size === 0) {
      return [];
    }

    // Use pre-built authors map from cache (already indexed with book counts)
    return Array.from(authors.values())
      .sort((a, b) => {
        const countDiff = b.bookCount - a.bookCount;
        if (countDiff !== 0) return countDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit)
      .map(author => ({ name: author.name, count: author.bookCount }));
  }, [authors, isLoaded, limit]);
}

/**
 * Get author's last name for display
 */
export function getAuthorLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}
