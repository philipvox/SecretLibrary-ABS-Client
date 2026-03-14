/**
 * src/features/browse/hooks/useLibraryMoods.ts
 *
 * Scans library items for genre/tag patterns that map to mood categories.
 * Uses scoreFeelingChip from bookDNA to determine mood matches.
 * Only returns moods with 10+ matching books.
 *
 * PERF: Deferred via InteractionManager — returns empty on first render,
 * populates after interactions settle. Scores are cached per item
 * via the feelingScoring cache (avoids re-parsing BookDNA).
 */

import { useState, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { LibraryItem } from '@/core/types';
import { scoreFeelingChip } from '@/shared/utils/bookDNA/feelingScoring';
import type { FeelingChip } from '../stores/feelingChipStore';

export interface MoodCategory {
  label: string;
  key: FeelingChip;
  count: number;
}

const ALL_MOODS: { key: FeelingChip; label: string }[] = [
  { key: 'thrilling', label: 'THRILLING' },
  { key: 'funny', label: 'FUNNY' },
  { key: 'dark', label: 'DARK' },
  { key: 'heartwarming', label: 'HEARTWARMING' },
  { key: 'escapist', label: 'ESCAPIST' },
  { key: 'thought-provoking', label: 'THOUGHT-PROVOKING' },
  { key: 'cozy', label: 'COZY' },
  { key: 'intense', label: 'INTENSE' },
];

const MIN_BOOKS_THRESHOLD = 10;

export function useLibraryMoods(items: LibraryItem[]): { moods: MoodCategory[] } {
  const [moods, setMoods] = useState<MoodCategory[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!items.length) {
      setMoods([]);
      return;
    }

    const handle = InteractionManager.runAfterInteractions(() => {
      const currentItems = itemsRef.current;
      const result: MoodCategory[] = [];

      for (const mood of ALL_MOODS) {
        let count = 0;
        for (const item of currentItems) {
          if (scoreFeelingChip(item, mood.key) >= 2) {
            count++;
          }
        }
        if (count >= MIN_BOOKS_THRESHOLD) {
          result.push({ label: mood.label, key: mood.key, count });
        }
      }

      result.sort((a, b) => b.count - a.count);
      setMoods(result);
    });

    return () => handle.cancel();
  }, [items]);

  return { moods };
}
