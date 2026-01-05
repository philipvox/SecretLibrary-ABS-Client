/**
 * src/features/discover/hooks/useGenreContent.ts
 *
 * Hook for genre-based content filtering.
 * Provides available genres and genre filtering utilities.
 */

import { useMemo, useCallback } from 'react';
import { getGenresByPopularity } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { GENRE_CHIPS } from '../types';
import { filterItemsByGenre } from './discoverUtils';

interface UseGenreContentProps {
  libraryItems: LibraryItem[];
  isLoaded: boolean;
}

interface UseGenreContentResult {
  /** Available genre chips for filtering */
  availableGenres: string[];
  /** Filter items by selected genre */
  filterByGenre: (items: LibraryItem[], genre: string) => LibraryItem[];
}

export function useGenreContent({
  libraryItems,
  isLoaded,
}: UseGenreContentProps): UseGenreContentResult {
  // Get all available genres from library, sorted by popularity (book count)
  const availableGenres = useMemo(() => {
    if (!isLoaded) return GENRE_CHIPS;
    // Get genres sorted by book count (most popular first)
    const genreInfos = getGenresByPopularity();
    // Take top 7 most popular genres
    const topGenres = genreInfos.slice(0, 7).map(g => g.name);
    return ['All', ...topGenres];
  }, [isLoaded, libraryItems]);

  // Genre filter function
  const filterByGenre = useCallback((items: LibraryItem[], genre: string): LibraryItem[] => {
    return filterItemsByGenre(items, genre);
  }, []);

  return {
    availableGenres,
    filterByGenre,
  };
}
