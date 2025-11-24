/**
 * src/features/narrator/services/narratorAdapter.ts
 * 
 * Adapter for extracting narrator information from library items.
 * Uses the narratorName field from API metadata.
 */

import { LibraryItem } from '@/core/types';
import { getNarratorNames } from '@/shared/utils/metadata';

export interface NarratorInfo {
  id: string;
  name: string;
  bookCount: number;
  books: LibraryItem[];
}

/**
 * Extract unique narrators from library items
 */
export function extractNarrators(items: LibraryItem[]): NarratorInfo[] {
  const narratorMap = new Map<string, NarratorInfo>();

  items.forEach((item) => {
    const narratorNames = getNarratorNames(item);

    narratorNames.forEach((name: string) => {
      if (!name || typeof name !== 'string') return;
      const trimmed = name.trim();
      if (!trimmed) return;

      const id = trimmed.toLowerCase().replace(/\s+/g, '-');
      const existing = narratorMap.get(id);

      if (existing) {
        existing.bookCount++;
        existing.books.push(item);
      } else {
        narratorMap.set(id, {
          id,
          name: trimmed,
          bookCount: 1,
          books: [item],
        });
      }
    });
  });

  return Array.from(narratorMap.values());
}

/**
 * Sort narrators by name or book count
 */
export function sortNarrators(
  narrators: NarratorInfo[],
  sortBy: 'name' | 'bookCount' = 'name'
): NarratorInfo[] {
  return [...narrators].sort((a, b) => {
    if (sortBy === 'bookCount') return b.bookCount - a.bookCount;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Filter narrators by search query
 */
export function filterNarrators(
  narrators: NarratorInfo[],
  query: string
): NarratorInfo[] {
  if (!query.trim()) return narrators;
  const lower = query.toLowerCase();
  return narrators.filter((n) => n.name.toLowerCase().includes(lower));
}