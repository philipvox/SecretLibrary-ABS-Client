/**
 * src/features/browse/hooks/useDynamicFilters.ts
 *
 * Scans library items to extract unique tags and genres with book counts.
 * Tags exclude system tags (dna:*, age-*, rated-*, for-kids, not-for-kids).
 * Genres use the pre-indexed genresWithBooks map from library cache.
 */

import { useMemo } from 'react';
import { useLibraryCache } from '@/core/cache';

export interface FilterOption {
  name: string;
  key: string;
  count: number;
}

// System tags that should not appear as user-facing filters
const SYSTEM_TAG_PREFIXES = ['dna:', 'age-', 'rated-'];
const SYSTEM_TAGS = new Set(['for-kids', 'not-for-kids']);

function isSystemTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  if (SYSTEM_TAGS.has(lower)) return true;
  return SYSTEM_TAG_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function useDynamicFilters(): {
  genres: FilterOption[];
  tags: FilterOption[];
} {
  const items = useLibraryCache((s) => s.items);
  const genresWithBooks = useLibraryCache((s) => s.genresWithBooks);

  return useMemo(() => {
    // --- Genres from pre-indexed map ---
    const genres: FilterOption[] = [];
    if (genresWithBooks) {
      genresWithBooks.forEach((info, _key) => {
        if (info.bookCount > 0) {
          genres.push({
            name: info.name,
            key: info.name.toLowerCase(),
            count: info.bookCount,
          });
        }
      });
    }
    // Alphabetical — users know genre names (NN/g: sort alphabetically when users know the values)
    genres.sort((a, b) => a.name.localeCompare(b.name));

    // --- Tags from item.media.tags ---
    const tagCounts = new Map<string, { display: string; count: number }>();
    for (const item of items) {
      if (item.mediaType !== 'book') continue;
      const bookTags: string[] = (item.media as any)?.tags || [];
      for (const tag of bookTags) {
        if (isSystemTag(tag)) continue;
        const key = tag.toLowerCase();
        const existing = tagCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          tagCounts.set(key, { display: tag, count: 1 });
        }
      }
    }

    const tags: FilterOption[] = [];
    tagCounts.forEach((info, key) => {
      tags.push({ name: info.display, key, count: info.count });
    });
    // By frequency — users discover tags, most popular first (NN/g: sort by frequency for unfamiliar values)
    tags.sort((a, b) => b.count - a.count);

    return { genres, tags };
  }, [items, genresWithBooks]);
}
