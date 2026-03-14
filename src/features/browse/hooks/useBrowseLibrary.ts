/**
 * src/features/browse/hooks/useBrowseLibrary.ts
 *
 * Central filter hook for the browse page.
 * Reads all library items from cache, applies content filter (audience, tags, length)
 * once, and returns pre-filtered results. Browse sections receive these as props
 * instead of each independently filtering the full library.
 */

import { useMemo } from 'react';
import { useLibraryCache } from '@/core/cache';
import { useContentFilterStore, filterByAudience } from '../stores/contentFilterStore';
import type { LibraryItem } from '@/core/types';

export function useBrowseLibrary(): { filteredItems: LibraryItem[]; isLoaded: boolean } {
  const items = useLibraryCache((s) => s.items);
  const isLoaded = useLibraryCache((s) => s.isLoaded);

  const audience = useContentFilterStore((s) => s.audience);
  const selectedAges = useContentFilterStore((s) => s.selectedAges);
  const selectedRatings = useContentFilterStore((s) => s.selectedRatings);
  const selectedTags = useContentFilterStore((s) => s.selectedTags);
  const selectedGenres = useContentFilterStore((s) => s.selectedGenres);
  const lengthRange = useContentFilterStore((s) => s.lengthRange);

  const filteredItems = useMemo(() => {
    if (!isLoaded) return [];
    return filterByAudience(items, audience, selectedAges, selectedRatings, selectedTags, lengthRange, selectedGenres);
  }, [items, isLoaded, audience, selectedAges, selectedRatings, selectedTags, selectedGenres, lengthRange]);

  return { filteredItems, isLoaded };
}
