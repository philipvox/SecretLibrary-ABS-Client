/**
 * src/features/discover/hooks/usePersonalizedContent.ts
 *
 * Hook for personalized content based on user preferences and reading history.
 * Returns recommendation rows and serendipity (try something different) row.
 */

import { useMemo } from 'react';
import { LibraryItem } from '@/core/types';
import { useRecommendations } from '@/features/recommendations/hooks/useRecommendations';
import { ContentRow, BookSummary, SourceAttribution } from '../types';
import { MAX_RECOMMENDATION_GROUPS } from './discoverUtils';

interface UsePersonalizedContentProps {
  libraryItems: LibraryItem[];
  isLoaded: boolean;
  convertToBookSummary: (item: LibraryItem) => BookSummary;
  isFinished: (bookId: string) => boolean;
  isSeriesAppropriate: (item: LibraryItem) => boolean;
  hasHistory: boolean;
}

export function usePersonalizedContent({
  libraryItems, isLoaded, convertToBookSummary, isFinished, isSeriesAppropriate, hasHistory,
}: UsePersonalizedContentProps) {
  const { groupedRecommendations, hasPreferences } = useRecommendations(libraryItems, 30);

  // Personalized recommendations rows
  const recommendationRows = useMemo((): ContentRow[] => {
    if (!isLoaded || !groupedRecommendations.length) return [];
    return groupedRecommendations.slice(0, MAX_RECOMMENDATION_GROUPS).map((group, index) => {
      let title = group.title;
      let sourceAttribution: SourceAttribution | undefined;
      if (group.sourceAttribution) {
        const { itemTitle, type, itemId } = group.sourceAttribution;
        const titleMap: Record<string, string> = {
          finished: `Because you finished ${itemTitle}`, listening: `More like ${itemTitle}`,
          genre: `Because you love ${itemTitle}`, author: `More by ${itemTitle}`,
          narrator: `Narrated by ${itemTitle}`,
        };
        title = titleMap[type] || title;
        sourceAttribution = { itemId: type === 'finished' || type === 'listening' ? itemId : '', itemTitle, type };
      }
      return {
        id: `recommendation_${index}`, type: 'recommended' as const, title, subtitle: undefined,
        items: group.items.slice(0, 15).map(convertToBookSummary), totalCount: group.items.length,
        seeAllRoute: 'FilteredBooks', filterType: 'recommended' as const,
        priority: 2 + index * 0.3, refreshPolicy: 'daily' as const,
        displayMode: index === 0 ? 'featured' : 'carousel', sourceAttribution,
      };
    });
  }, [isLoaded, groupedRecommendations, convertToBookSummary]);

  // Serendipity Row - "Try Something Different"
  const serendipityRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length || !hasHistory) return null;
    // Get user's usual genres
    const usualGenres = new Set<string>();
    libraryItems.forEach(item => {
      const progress = (item as any).userMediaProgress?.progress || 0;
      if (progress > 0.1 || (item as any).userMediaProgress?.isFinished || progress >= 0.95) {
        ((item.media?.metadata as any)?.genres || []).forEach((g: string) => usualGenres.add(g.toLowerCase()));
      }
    });
    // Find books in unexplored genres
    let serendipityItems = libraryItems.filter(item => {
      const progress = (item as any).userMediaProgress?.progress || 0;
      if (progress > 0 || isFinished(item.id)) return false;
      const genres: string[] = (item.media?.metadata as any)?.genres || [];
      return genres.length > 0 && !genres.some(g => usualGenres.has(g.toLowerCase()));
    }).filter(isSeriesAppropriate);
    // Sort by medium-length preference, then shuffle
    serendipityItems.sort((a, b) => Math.abs(((a.media as any)?.duration || 0) - 12 * 3600) -
      Math.abs(((b.media as any)?.duration || 0) - 12 * 3600));
    const shuffled = serendipityItems.slice(0, 20);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const finalItems = shuffled.slice(0, 4);
    if (finalItems.length < 2) return null;
    return {
      id: 'serendipity', type: 'recommended' as const, title: 'Try Something Different',
      subtitle: 'Venture outside your usual genres',
      items: finalItems.map(item => ({ ...convertToBookSummary(item), isSerendipity: true })),
      totalCount: serendipityItems.length, seeAllRoute: 'FilteredBooks', filterType: 'recommended' as const,
      priority: 6, refreshPolicy: 'daily' as const, isSerendipity: true, displayMode: 'carousel',
      sourceAttribution: { itemId: '', itemTitle: 'Serendipity', type: 'serendipity' },
    };
  }, [libraryItems, isLoaded, convertToBookSummary, isFinished, isSeriesAppropriate, hasHistory]);

  return { recommendationRows, serendipityRow, hasPreferences };
}
