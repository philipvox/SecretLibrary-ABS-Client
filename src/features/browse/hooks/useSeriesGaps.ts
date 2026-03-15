/**
 * src/features/browse/hooks/useSeriesGaps.ts
 *
 * Detects series with missing books in the user's library.
 * Compares library series book count vs sequence-inferred total.
 * Returns series sorted by completion % desc (closest to complete first).
 *
 * NOTE: No InteractionManager — this is above-the-fold (first section in FOR YOU).
 */

import { useMemo } from 'react';
import { useLibraryCache } from '@/core/cache';

export interface SeriesGap {
  seriesName: string;
  have: number;
  total: number;
  missing: number;
}

export function useSeriesGaps(): { gaps: SeriesGap[] } {
  const seriesMap = useLibraryCache((s) => s.series);

  const gaps = useMemo(() => {
    if (!seriesMap || seriesMap.size === 0) return [];

    const result: SeriesGap[] = [];

    seriesMap.forEach((seriesInfo) => {
      if (seriesInfo.bookCount < 2) return;

      const sequenceNumbers: number[] = [];
      let maxSequence = 0;

      for (const book of seriesInfo.books) {
        const metadata = (book.media as any)?.metadata;
        const series = metadata?.series;
        if (series) {
          for (const s of series) {
            if (s.name === seriesInfo.name && s.sequence) {
              const seq = parseFloat(s.sequence);
              if (!isNaN(seq) && seq > 0) {
                sequenceNumbers.push(seq);
                if (seq > maxSequence) maxSequence = seq;
              }
            }
          }
        }
      }

      // Detect gaps: max sequence number higher than how many we have
      if (sequenceNumbers.length >= 2 && maxSequence > sequenceNumbers.length) {
        const total = Math.ceil(maxSequence);
        const have = seriesInfo.bookCount;
        const missing = total - have;

        if (missing > 0) {
          result.push({ seriesName: seriesInfo.name, have, total, missing });
        }
      }
    });

    result.sort((a, b) => (b.have / b.total) - (a.have / a.total));
    return result.slice(0, 2);
  }, [seriesMap]);

  return { gaps };
}
