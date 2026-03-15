/**
 * src/features/browse/hooks/useMeaningToRead.ts
 *
 * "You've been meaning to read this" — two categories:
 *   1. Books the user STARTED but abandoned (some progress, not played in 30+ days)
 *   2. Books in the user's library that they've NEVER started (added 30+ days ago)
 *
 * Only considers books in the user's library (is_in_library=1 or has progress),
 * not the full server catalog.
 *
 * Uses useMemo for synchronous computation (no InteractionManager delay).
 */

import { useMemo } from 'react';
import { useProgressStore, ProgressData } from '@/core/stores/progressStore';
import { LibraryItem } from '@/core/types';

const STALE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 15;

export function useMeaningToRead(items: LibraryItem[]): LibraryItem[] {
  const progressMap = useProgressStore((s) => s.progressMap);

  return useMemo(() => {
    if (!items.length || progressMap.size === 0) return [];

    const now = Date.now();
    const staleCutoff = now - STALE_DAYS * MS_PER_DAY;

    // Build a lookup for items by ID
    const itemMap = new Map<string, LibraryItem>();
    for (const item of items) {
      if (item.mediaType === 'book') {
        itemMap.set(item.id, item);
      }
    }

    const candidates: { item: LibraryItem; sortKey: number; isAbandoned: boolean }[] = [];

    progressMap.forEach((prog: ProgressData, bookId: string) => {
      const item = itemMap.get(bookId);
      if (!item) return; // Not in current filtered items
      if (prog.isFinished) return; // Already finished

      // Category 1: Started but abandoned
      // Has progress (>1%), not played in 30+ days
      if (prog.progress > 0.01 && prog.progress < 0.95) {
        const lastPlayed = prog.lastPlayedAt || 0;
        if (lastPlayed > 0 && lastPlayed < staleCutoff) {
          candidates.push({
            item,
            sortKey: lastPlayed, // Sort by last played (oldest first)
            isAbandoned: true,
          });
          return;
        }
      }

      // Category 2: In library but never started
      // isInLibrary=true, no meaningful progress, added 30+ days ago
      if (prog.isInLibrary && prog.progress <= 0.01) {
        const addedAt = prog.addedToLibraryAt || 0;
        if (addedAt > 0 && addedAt < staleCutoff) {
          candidates.push({
            item,
            sortKey: addedAt, // Sort by added date (oldest first)
            isAbandoned: false,
          });
          return;
        }
      }
    });

    // Sort: abandoned books first (they had intent), then unstarted, both oldest first
    candidates.sort((a, b) => {
      if (a.isAbandoned !== b.isAbandoned) return a.isAbandoned ? -1 : 1;
      return a.sortKey - b.sortKey;
    });

    return candidates.slice(0, MAX_RESULTS).map((c) => c.item);
  }, [items, progressMap]);
}
