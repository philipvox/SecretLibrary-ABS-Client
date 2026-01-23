/**
 * src/features/discover/hooks/useFeaturedContent.ts
 *
 * Hook for featured/hero content on the discover page.
 * Returns the main hero recommendation.
 */

import { useMemo } from 'react';
import { LibraryItem } from '@/core/types';
import { MoodSession, ScoredBook } from '@/features/mood-discovery/types';
import { HeroRecommendation, BookSummary } from '../types';
import { getTimeBasedReason, getMoodHeroReason } from './discoverUtils';

interface RecommendationGroup {
  title: string;
  items: LibraryItem[];
  sourceAttribution?: {
    itemId: string;
    itemTitle: string;
    type: string;
  };
}

interface UseFeaturedContentProps {
  libraryItems: LibraryItem[];
  isLoaded: boolean;
  isFinished: (bookId: string) => boolean;
  convertToBookSummary: (item: LibraryItem) => BookSummary;
  groupedRecommendations: RecommendationGroup[];
  hasMoodSession: boolean;
  moodSession?: MoodSession | null;
  moodRecommendations: ScoredBook[];
}

interface UseFeaturedContentResult {
  /** Hero recommendation for top of page */
  hero: HeroRecommendation | null;
}

export function useFeaturedContent({
  libraryItems,
  isLoaded,
  isFinished,
  convertToBookSummary,
  groupedRecommendations,
  hasMoodSession,
  moodSession,
  moodRecommendations,
}: UseFeaturedContentProps): UseFeaturedContentResult {
  // Hero recommendation (show top unlistened recommendation)
  const hero = useMemo((): HeroRecommendation | null => {
    if (!isLoaded || !libraryItems.length) return null;

    // Get unfinished books
    const unfinishedBooks = libraryItems.filter(item => !isFinished(item.id));
    if (unfinishedBooks.length === 0) return null;

    let heroBook: LibraryItem | null = null;
    let heroType: HeroRecommendation['type'] = 'personalized';
    let reason = getTimeBasedReason();

    // When mood session is active, use top mood recommendation
    if (hasMoodSession && moodSession && moodRecommendations.length > 0) {
      const topMoodMatch = moodRecommendations[0];
      heroBook = libraryItems.find(item => item.id === topMoodMatch.id) || null;
      if (heroBook) {
        heroType = 'personalized';
        reason = getMoodHeroReason(moodSession);
      }
    }

    // Fall back to regular recommendations if no mood hero
    if (!heroBook) {
      // Try to use top recommendation (if available)
      if (groupedRecommendations.length > 0 && groupedRecommendations[0].items.length > 0) {
        heroBook = groupedRecommendations[0].items[0];
        reason = 'Recommended for you';
      }
      // Otherwise use newest unfinished book
      else {
        const sorted = [...unfinishedBooks].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        heroBook = sorted[0];
        heroType = 'new';
        reason = 'New to your library';
      }
    }

    if (!heroBook) return null;

    return {
      book: convertToBookSummary(heroBook),
      reason,
      type: heroType,
    };
  }, [
    libraryItems,
    isLoaded,
    convertToBookSummary,
    groupedRecommendations,
    hasMoodSession,
    moodSession,
    moodRecommendations,
    isFinished,
  ]);

  return { hero };
}
