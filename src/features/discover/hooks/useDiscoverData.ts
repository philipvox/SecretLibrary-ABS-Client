/**
 * src/features/discover/hooks/useDiscoverData.ts
 *
 * Hook to fetch and organize discover page data:
 * - Continue Listening (from API)
 * - New This Week (recently added)
 * - Popular (most played - approximated by most downloaded)
 * - Genre-based recommendations
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useLibraryCache, getAllGenres } from '@/core/cache';
import { useContinueListening } from '@/features/home/hooks/useContinueListening';
import { apiClient } from '@/core/api';
import { downloadManager, DownloadTask } from '@/core/services/downloadManager';
import {
  ContentRow,
  BookSummary,
  HeroRecommendation,
  libraryItemToBookSummary,
  GENRE_CHIPS,
} from '../types';
import { LibraryItem } from '@/core/types';

// Time constants
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SHORT_BOOK_THRESHOLD = 5 * 60 * 60; // 5 hours in seconds

// Context-aware recommendation reasons
function getTimeBasedReason(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Perfect for your morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Great for your afternoon';
  } else if (hour >= 17 && hour < 21) {
    return 'Perfect for your evening';
  } else {
    return 'Perfect for winding down';
  }
}

export function useDiscoverData(selectedGenre: string = 'All') {
  const { items: libraryItems, isLoaded, isLoading, refreshCache } = useLibraryCache();
  const { items: inProgressItems, isLoading: isLoadingProgress, refetch: refetchProgress } = useContinueListening();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  // Subscribe to download status changes
  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((tasks) => {
      const completed = new Set<string>();
      for (const task of tasks) {
        if (task.status === 'complete') {
          completed.add(task.itemId);
        }
      }
      setDownloadedIds(completed);
    });

    return () => unsubscribe();
  }, []);

  // Get all available genres from library
  const availableGenres = useMemo(() => {
    if (!isLoaded) return GENRE_CHIPS;
    const genres = getAllGenres();
    // Combine with default chips, prioritizing existing
    const genreSet = new Set(['All', ...genres.slice(0, 7)]);
    return Array.from(genreSet);
  }, [isLoaded]);

  // Convert library items to book summaries
  const convertToBookSummary = useCallback((item: LibraryItem, progress?: number): BookSummary => {
    const coverUrl = apiClient.getItemCoverUrl(item.id);
    const isDownloaded = downloadedIds.has(item.id);
    return libraryItemToBookSummary(item, coverUrl, { isDownloaded, progress });
  }, [downloadedIds]);

  // Filter by genre if selected
  const filterByGenre = useCallback((items: LibraryItem[], genre: string): LibraryItem[] => {
    if (genre === 'All') return items;
    return items.filter(item => {
      const metadata = (item.media?.metadata as any) || {};
      const genres: string[] = metadata.genres || [];
      return genres.some(g => g.toLowerCase().includes(genre.toLowerCase()));
    });
  }, []);

  // Continue Listening row
  const continueListeningRow = useMemo((): ContentRow | null => {
    if (!inProgressItems || inProgressItems.length === 0) return null;

    const items = inProgressItems.slice(0, 15).map(item => {
      const progress = (item as any).userMediaProgress?.progress || 0;
      return convertToBookSummary(item, progress);
    });

    return {
      id: 'continue_listening',
      type: 'continue_listening',
      title: 'Continue Listening',
      items,
      totalCount: inProgressItems.length,
      seeAllRoute: 'LibraryTab',
      priority: 1,
      refreshPolicy: 'realtime',
    };
  }, [inProgressItems, convertToBookSummary]);

  // New This Week row
  const newThisWeekRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length) return null;

    const oneWeekAgo = Date.now() - ONE_WEEK_MS;
    let newItems = libraryItems
      .filter(item => (item.addedAt || 0) * 1000 > oneWeekAgo)
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    // Apply genre filter
    newItems = filterByGenre(newItems, selectedGenre);

    if (newItems.length === 0) return null;

    const items = newItems.slice(0, 15).map(item => convertToBookSummary(item));

    return {
      id: 'new_this_week',
      type: 'new_this_week',
      title: 'New This Week',
      items,
      totalCount: newItems.length,
      priority: 3,
      refreshPolicy: 'daily',
    };
  }, [libraryItems, isLoaded, selectedGenre, filterByGenre, convertToBookSummary]);

  // Popular row (approximated by longest books - assuming quality content)
  const popularRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length) return null;

    let sortedItems = [...libraryItems].sort((a, b) => {
      // Sort by duration (longer = more invested content)
      const durationA = (a.media as any)?.duration || 0;
      const durationB = (b.media as any)?.duration || 0;
      return durationB - durationA;
    });

    // Apply genre filter
    sortedItems = filterByGenre(sortedItems, selectedGenre);

    if (sortedItems.length === 0) return null;

    const items = sortedItems.slice(0, 15).map(item => convertToBookSummary(item));

    return {
      id: 'popular',
      type: 'popular',
      title: 'Popular Right Now',
      items,
      totalCount: sortedItems.length,
      priority: 4,
      refreshPolicy: 'daily',
    };
  }, [libraryItems, isLoaded, selectedGenre, filterByGenre, convertToBookSummary]);

  // Short & Sweet row (books under 5 hours)
  const shortBooksRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length) return null;

    let shortItems = libraryItems
      .filter(item => {
        const duration = (item.media as any)?.duration || 0;
        return duration > 0 && duration < SHORT_BOOK_THRESHOLD;
      })
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    // Apply genre filter
    shortItems = filterByGenre(shortItems, selectedGenre);

    if (shortItems.length === 0) return null;

    const items = shortItems.slice(0, 15).map(item => convertToBookSummary(item));

    return {
      id: 'short_books',
      type: 'short_books',
      title: 'Short & Sweet',
      subtitle: 'Under 5 hours',
      items,
      totalCount: shortItems.length,
      priority: 8,
      refreshPolicy: 'daily',
    };
  }, [libraryItems, isLoaded, selectedGenre, filterByGenre, convertToBookSummary]);

  // Recently Added row (all recent)
  const recentlyAddedRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length) return null;

    let sortedItems = [...libraryItems].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    // Apply genre filter
    sortedItems = filterByGenre(sortedItems, selectedGenre);

    if (sortedItems.length === 0) return null;

    const items = sortedItems.slice(0, 15).map(item => convertToBookSummary(item));

    return {
      id: 'recently_added',
      type: 'new_this_week',
      title: 'Recently Added',
      items,
      totalCount: sortedItems.length,
      priority: 5,
      refreshPolicy: 'hourly',
    };
  }, [libraryItems, isLoaded, selectedGenre, filterByGenre, convertToBookSummary]);

  // Hero recommendation
  const hero = useMemo((): HeroRecommendation | null => {
    if (!isLoaded || !libraryItems.length) return null;

    // Priority: in-progress > new > popular
    let heroBook: LibraryItem | null = null;
    let heroType: HeroRecommendation['type'] = 'popular';
    let reason = getTimeBasedReason();

    // Try to use most recent in-progress
    if (inProgressItems && inProgressItems.length > 0) {
      heroBook = inProgressItems[0];
      heroType = 'personalized';
      reason = 'Continue where you left off';
    }
    // Otherwise use newest book
    else if (libraryItems.length > 0) {
      const sorted = [...libraryItems].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      heroBook = sorted[0];
      heroType = 'new';
      reason = 'Just added to your library';
    }

    if (!heroBook) return null;

    return {
      book: convertToBookSummary(heroBook),
      reason,
      type: heroType,
    };
  }, [libraryItems, inProgressItems, isLoaded, convertToBookSummary]);

  // Organize rows by priority
  const rows = useMemo((): ContentRow[] => {
    const allRows = [
      continueListeningRow,
      newThisWeekRow,
      popularRow,
      recentlyAddedRow,
      shortBooksRow,
    ].filter((row): row is ContentRow => row !== null);

    // Sort by priority
    return allRows.sort((a, b) => a.priority - b.priority);
  }, [continueListeningRow, newThisWeekRow, popularRow, recentlyAddedRow, shortBooksRow]);

  // Refresh handler
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshCache(),
        refetchProgress(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCache, refetchProgress]);

  return {
    rows,
    hero,
    availableGenres,
    isLoading: isLoading || isLoadingProgress,
    isRefreshing,
    refresh,
  };
}
