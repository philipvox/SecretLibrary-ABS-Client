/**
 * src/features/discover/hooks/useDiscoverData.ts
 *
 * Facade hook that composes all discover data hooks.
 * This is the main entry point for the BrowseScreen.
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useLibraryCache } from '@/core/cache';
import { useContinueListening } from '@/shared/hooks/useContinueListening';
import { apiClient } from '@/core/api';
import { downloadManager } from '@/core/services/downloadManager';
import { LibraryItem } from '@/core/types';
import { useReadingHistory } from '@/features/reading-history-wizard';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import { useKidModeStore } from '@/shared/stores/kidModeStore';
import { filterForKidMode } from '@/shared/utils/kidModeFilter';
import { MoodSession } from '@/features/mood-discovery/types';
import { ContentRow, libraryItemToBookSummary } from '../types';
import { useMoodContent } from './useMoodContent';
import { useGenreContent } from './useGenreContent';
import { useFeaturedContent } from './useFeaturedContent';
import { usePopularContent } from './usePopularContent';
import { usePersonalizedContent } from './usePersonalizedContent';

export function useDiscoverData(selectedGenre = 'All', moodSession?: MoodSession | null) {
  const { items: rawItems, isLoaded, isLoading, refreshCache } = useLibraryCache();
  const kidModeEnabled = useKidModeStore(s => s.enabled);
  const libraryItems = useMemo(() => filterForKidMode(rawItems, kidModeEnabled), [rawItems, kidModeEnabled]);
  const { items: inProgressItems, isLoading: isLoadingProgress, refetch: refetchProgress } = useContinueListening();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const { isFinished, hasBeenStarted, hasHistory } = useReadingHistory();

  const isSeriesAppropriate = useMemo(() => {
    if (!libraryItems.length) return () => true;
    return createSeriesFilter({ allItems: libraryItems, isFinished, hasStarted: hasBeenStarted });
  }, [libraryItems, isFinished, hasBeenStarted]);

  useEffect(() => {
    const unsub = downloadManager.subscribe(tasks => {
      setDownloadedIds(new Set(tasks.filter(t => t.status === 'complete').map(t => t.itemId)));
    });
    return unsub;
  }, []);

  const convertToBookSummary = useCallback((item: LibraryItem) => {
    return libraryItemToBookSummary(item, apiClient.getItemCoverUrl(item.id), { isDownloaded: downloadedIds.has(item.id) });
  }, [downloadedIds]);

  // Compose focused hooks
  const { hasMoodSession, filterByMood, moodRecommendations, isMoodLoading } = useMoodContent({ moodSession, libraryItems });
  const { availableGenres, filterByGenre } = useGenreContent({ libraryItems, isLoaded });
  const { recommendationRows, serendipityRow, hasPreferences } = usePersonalizedContent({
    libraryItems, isLoaded, convertToBookSummary, isFinished, isSeriesAppropriate, hasHistory });
  const { newThisWeekRow, shortBooksRow, longBooksRow, notStartedRow, continueSeriesRow } = usePopularContent({
    libraryItems, inProgressItems, isLoaded, selectedGenre, filterByGenre, filterByMood,
    convertToBookSummary, isFinished, isSeriesAppropriate, hasMoodSession, moodSession });
  const { hero } = useFeaturedContent({
    libraryItems, isLoaded, isFinished, convertToBookSummary, hasMoodSession, moodSession, moodRecommendations,
    groupedRecommendations: recommendationRows.map(r => ({
      title: r.title, items: libraryItems.filter(i => r.items.some(s => s.id === i.id)),
      sourceAttribution: r.sourceAttribution ? { itemId: r.sourceAttribution.itemId, itemTitle: r.sourceAttribution.itemTitle, type: r.sourceAttribution.type } : undefined,
    })),
  });

  const rows = useMemo((): ContentRow[] => {
    const all = [...recommendationRows, newThisWeekRow, continueSeriesRow, notStartedRow, serendipityRow, shortBooksRow, longBooksRow]
      .filter((r): r is ContentRow => !!r);
    return all.sort((a, b) => a.priority - b.priority);
  }, [recommendationRows, newThisWeekRow, continueSeriesRow, notStartedRow, serendipityRow, shortBooksRow, longBooksRow]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try { await Promise.all([refreshCache(), refetchProgress()]); }
    finally { setIsRefreshing(false); }
  }, [refreshCache, refetchProgress]);

  return {
    rows, hero, availableGenres,
    isLoading: isLoading || isLoadingProgress || (hasMoodSession && isMoodLoading),
    isRefreshing, refresh, hasMoodSession, hasPreferences,
  };
}
