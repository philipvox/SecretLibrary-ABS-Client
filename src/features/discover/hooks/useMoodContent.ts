/**
 * src/features/discover/hooks/useMoodContent.ts
 *
 * Hook for mood-based content filtering and recommendations.
 * Provides mood state and filtering utilities for other discover hooks.
 */

import { useMemo, useCallback, useDeferredValue } from 'react';
import { LibraryItem } from '@/core/types';
import { MoodSession, ScoredBook } from '@/features/mood-discovery/types';
import { useMoodRecommendations } from '@/features/mood-discovery/hooks/useMoodRecommendations';

interface UseMoodContentProps {
  moodSession?: MoodSession | null;
  libraryItems: LibraryItem[];
}

interface UseMoodContentResult {
  /** Whether a valid mood session is active */
  hasMoodSession: boolean;
  /** Filter items by mood score */
  filterByMood: (items: LibraryItem[], minMatchPercent?: number) => LibraryItem[];
  /** Map of item ID to mood score */
  moodScoreMap: Map<string, ScoredBook>;
  /** Top mood recommendations */
  moodRecommendations: ScoredBook[];
  /** Loading state for mood recommendations */
  isMoodLoading: boolean;
  /** Deferred mood value for smooth UI */
  deferredMood: string;
}

export function useMoodContent({
  moodSession,
  libraryItems,
}: UseMoodContentProps): UseMoodContentResult {
  // Get mood-based recommendations when session is active
  const { recommendations: moodRecommendations, isLoading: isMoodLoading } = useMoodRecommendations({
    session: moodSession,
    minMatchPercent: 20,
    limit: 200,
  });

  // Defer mood value for smoother UI during rapid changes
  const deferredMood = useDeferredValue(moodSession?.mood ?? '');

  // Create a map of mood scores for quick lookup
  const moodScoreMap = useMemo(() => {
    const map = new Map<string, ScoredBook>();
    for (const rec of moodRecommendations) {
      map.set(rec.id, rec);
    }
    return map;
  }, [moodRecommendations, libraryItems]);

  // Check if mood session is active AND not expired (24-hour sessions)
  const hasMoodSession = !!(
    moodSession &&
    moodSession.mood &&
    (!moodSession.expiresAt || Date.now() < moodSession.expiresAt)
  );

  // Filter and sort items by mood score
  const filterByMood = useCallback((
    items: LibraryItem[],
    minMatchPercent: number = 20
  ): LibraryItem[] => {
    if (!hasMoodSession) return items;

    // Filter to items that have a mood score above minimum
    const filtered = items.filter(item => {
      const score = moodScoreMap.get(item.id);
      return score && score.matchPercent >= minMatchPercent;
    });

    // Sort by mood score descending
    filtered.sort((a, b) => {
      const scoreA = moodScoreMap.get(a.id)?.matchPercent || 0;
      const scoreB = moodScoreMap.get(b.id)?.matchPercent || 0;
      return scoreB - scoreA;
    });

    return filtered;
  }, [hasMoodSession, moodScoreMap]);

  return {
    hasMoodSession,
    filterByMood,
    moodScoreMap,
    moodRecommendations,
    isMoodLoading,
    deferredMood,
  };
}
