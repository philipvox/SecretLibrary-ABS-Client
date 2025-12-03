/**
 * src/features/home/hooks/useHomeData.ts
 *
 * Aggregates all data needed for the home screen
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { queryKeys } from '@/core/queryClient';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import {
  UseHomeDataReturn,
  PlaybackProgress,
  SeriesWithBooks,
  PlaylistDisplay,
} from '../types';

/**
 * Main hook for home screen data
 * Combines current playback, recent books, series, and playlists
 */
export function useHomeData(): UseHomeDataReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get player state for current book
  const {
    currentBook: playerCurrentBook,
    position,
    duration,
    isPlaying,
  } = usePlayerStore();

  // Fetch items in progress
  const {
    data: inProgressItems = [],
    isLoading: isLoadingProgress,
    refetch: refetchProgress,
  } = useQuery({
    queryKey: queryKeys.user.inProgress(),
    queryFn: async () => {
      const items = await apiClient.getItemsInProgress();
      // Sort by most recently updated
      return items.sort((a, b) => {
        const aTime = (a as any).progressLastUpdate || (a as any).userMediaProgress?.lastUpdate || 0;
        const bTime = (b as any).progressLastUpdate || (b as any).userMediaProgress?.lastUpdate || 0;
        return bTime - aTime;
      });
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch playlists
  const {
    data: playlists = [],
    isLoading: isLoadingPlaylists,
    refetch: refetchPlaylists,
  } = useQuery({
    queryKey: ['playlists'],
    queryFn: async () => {
      try {
        return await apiClient.getPlaylists();
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Current book is either from player or first in-progress item
  const currentBook = useMemo(() => {
    if (playerCurrentBook) return playerCurrentBook;
    return inProgressItems[0] || null;
  }, [playerCurrentBook, inProgressItems]);

  // Current progress
  const currentProgress: PlaybackProgress | null = useMemo(() => {
    if (!currentBook) return null;

    // If we have player state, use that
    if (playerCurrentBook && playerCurrentBook.id === currentBook.id) {
      return {
        currentTime: position,
        duration: duration,
        progress: duration > 0 ? position / duration : 0,
        isFinished: false,
        lastUpdate: Date.now(),
      };
    }

    // Otherwise use stored progress
    const userProgress = (currentBook as any).userMediaProgress;
    if (userProgress) {
      return {
        currentTime: userProgress.currentTime || 0,
        duration: userProgress.duration || (currentBook.media as any)?.duration || 0,
        progress: userProgress.progress || 0,
        isFinished: userProgress.isFinished || false,
        lastUpdate: userProgress.lastUpdate || 0,
      };
    }

    return null;
  }, [currentBook, playerCurrentBook, position, duration]);

  // Recent books (exclude current book)
  const recentBooks = useMemo(() => {
    if (!currentBook) return inProgressItems;
    return inProgressItems.filter((item) => item.id !== currentBook.id);
  }, [inProgressItems, currentBook]);

  // Extract series from books (simplified - in production would fetch from API)
  const userSeries: SeriesWithBooks[] = useMemo(() => {
    const seriesMap = new Map<string, SeriesWithBooks>();

    inProgressItems.forEach((item) => {
      const seriesInfo = (item.media?.metadata as any)?.series;
      if (!seriesInfo?.length) return;

      const firstSeries = seriesInfo[0];
      const seriesId = typeof firstSeries === 'object' ? firstSeries.id : firstSeries;
      const seriesName = typeof firstSeries === 'object' ? firstSeries.name : firstSeries;

      if (!seriesId || !seriesName) return;

      if (!seriesMap.has(seriesId)) {
        seriesMap.set(seriesId, {
          id: seriesId,
          name: seriesName,
          books: [],
          totalBooks: 0,
          booksCompleted: 0,
          booksInProgress: 1,
          isFavorite: false,
        });
      }

      const series = seriesMap.get(seriesId)!;
      if (series.books.length < 4) {
        series.books.push(item);
      }
      series.totalBooks++;
    });

    return Array.from(seriesMap.values()).slice(0, 10);
  }, [inProgressItems]);

  // Convert playlists to display format
  const userPlaylists: PlaylistDisplay[] = useMemo(() => {
    return playlists.slice(0, 10).map((playlist) => ({
      ...playlist,
      totalDuration: playlist.items.reduce((acc, item) => {
        const libraryItem = item.libraryItem;
        const itemDuration = libraryItem?.media
          ? (libraryItem.media as any).duration || 0
          : 0;
        return acc + itemDuration;
      }, 0),
      isFavorite: false,
    }));
  }, [playlists]);

  // Combined loading state
  const isLoading = isLoadingProgress || isLoadingPlaylists;

  // Refresh function
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchProgress(), refetchPlaylists()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchProgress, refetchPlaylists]);

  return {
    currentBook,
    currentProgress,
    recentBooks,
    userSeries,
    userPlaylists,
    isLoading,
    isRefreshing,
    refresh,
  };
}
