/**
 * src/features/home/hooks/useHomeData.ts
 *
 * Aggregates all data needed for the home screen
 * - Live updates when books are added/removed from library (no flicker)
 * - Pull-to-refresh support
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { queryKeys } from '@/core/queryClient';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { useMyLibraryStore } from '@/features/library/stores/myLibraryStore';
import { useLibraryCache } from '@/core/cache';
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
  } = usePlayerStore();

  // Get library IDs and favorite series from store (reactive)
  const libraryIds = useMyLibraryStore((state) => state.libraryIds);
  const favoriteSeriesNames = useMyLibraryStore((state) => state.favoriteSeriesNames);

  // Get series data from library cache
  const { getSeries, isLoaded: isCacheLoaded } = useLibraryCache();

  // Local cache of book data - persists across re-renders to avoid flicker
  const bookCacheRef = useRef<Map<string, LibraryItem>>(new Map());
  const [libraryBooks, setLibraryBooks] = useState<LibraryItem[]>([]);

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

  // Pre-populate cache from in-progress items and player's current book
  // This ensures books are instantly available when added to library
  useEffect(() => {
    const cache = bookCacheRef.current;

    // Cache in-progress items
    inProgressItems.forEach(item => {
      if (!cache.has(item.id)) {
        cache.set(item.id, item);
      }
    });

    // Cache current player book
    if (playerCurrentBook && !cache.has(playerCurrentBook.id)) {
      cache.set(playerCurrentBook.id, playerCurrentBook);
    }
  }, [inProgressItems, playerCurrentBook]);

  // Sync library books with libraryIds - uses cache for instant updates
  useEffect(() => {
    const syncLibraryBooks = async () => {
      if (libraryIds.length === 0) {
        setLibraryBooks([]);
        return;
      }

      const cache = bookCacheRef.current;
      const books: LibraryItem[] = [];
      const idsToFetch: string[] = [];

      // First, use cached books and identify which ones we need to fetch
      for (const id of libraryIds) {
        const cached = cache.get(id);
        if (cached) {
          books.push(cached);
        } else {
          idsToFetch.push(id);
        }
      }

      // Update immediately with cached books (no flicker)
      if (books.length > 0) {
        // Maintain order based on libraryIds
        const orderedBooks = libraryIds
          .map(id => cache.get(id))
          .filter((book): book is LibraryItem => book !== undefined);
        setLibraryBooks(orderedBooks);
      }

      // Fetch missing books in background
      if (idsToFetch.length > 0) {
        const fetchPromises = idsToFetch.map(async (id) => {
          try {
            const book = await apiClient.getItem(id);
            cache.set(id, book);
            return book;
          } catch {
            return null;
          }
        });

        await Promise.all(fetchPromises);

        // Update with all books now that fetching is complete
        const allBooks = libraryIds
          .map(id => cache.get(id))
          .filter((book): book is LibraryItem => book !== undefined);
        setLibraryBooks(allBooks);
      }

      // Clean up cache - remove books no longer in library
      for (const id of cache.keys()) {
        if (!libraryIds.includes(id)) {
          cache.delete(id);
        }
      }
    };

    syncLibraryBooks();
  }, [libraryIds]);

  // Function to refresh library books (for pull-to-refresh)
  const refetchLibrary = useCallback(async () => {
    if (libraryIds.length === 0) return;

    const cache = bookCacheRef.current;
    const fetchPromises = libraryIds.map(async (id) => {
      try {
        const book = await apiClient.getItem(id);
        cache.set(id, book);
        return book;
      } catch {
        return cache.get(id) || null;
      }
    });

    await Promise.all(fetchPromises);

    const allBooks = libraryIds
      .map(id => cache.get(id))
      .filter((book): book is LibraryItem => book !== undefined);
    setLibraryBooks(allBooks);
  }, [libraryIds]);

  // Current book - prefer player's loaded book to avoid UI flicker
  // The player always has the authoritative "current" book when audio is loaded
  const currentBook = useMemo(() => {
    // If player has a book loaded (playing or paused), always show it
    if (playerCurrentBook) {
      return playerCurrentBook;
    }

    // Fallback: show most recent from server
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

  // Recently listened - now playing at top, then last few books with progress
  const recentlyListened = useMemo(() => {
    // Start with books other than current
    const others = currentBook
      ? inProgressItems.filter((item) => item.id !== currentBook.id)
      : inProgressItems;

    // If there's a current book, put it first, then add 2 more
    if (currentBook) {
      return [currentBook, ...others.slice(0, 2)];
    }

    // No current book, just return top 3
    return others.slice(0, 3);
  }, [inProgressItems, currentBook]);

  // Your Books - from library store (live updates when adding/removing)
  // Exclude current book from the list
  const recentBooks = useMemo(() => {
    if (!currentBook) return libraryBooks;
    return libraryBooks.filter((item) => item.id !== currentBook.id);
  }, [libraryBooks, currentBook]);

  // Extract series from favorite series + in-progress books
  const userSeries: SeriesWithBooks[] = useMemo(() => {
    const seriesMap = new Map<string, SeriesWithBooks>();

    // First, add favorite series from library cache
    if (isCacheLoaded) {
      favoriteSeriesNames.forEach((seriesName) => {
        const cachedSeries = getSeries(seriesName);
        if (cachedSeries && !seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, {
            id: seriesName, // Use name as ID for consistency
            name: cachedSeries.name,
            books: cachedSeries.books.slice(0, 4),
            totalBooks: cachedSeries.bookCount,
            booksCompleted: 0,
            booksInProgress: 0,
            isFavorite: true,
          });
        }
      });
    }

    // Then add series from in-progress items
    inProgressItems.forEach((item) => {
      const seriesInfo = (item.media?.metadata as any)?.series;
      if (!seriesInfo?.length) return;

      const firstSeries = seriesInfo[0];
      const seriesId = typeof firstSeries === 'object' ? firstSeries.id : firstSeries;
      const seriesName = typeof firstSeries === 'object' ? firstSeries.name : firstSeries;

      if (!seriesId || !seriesName) return;

      // Skip if already added as favorite
      if (seriesMap.has(seriesName)) {
        const series = seriesMap.get(seriesName)!;
        if (series.books.length < 4 && !series.books.find(b => b.id === item.id)) {
          series.books.push(item);
        }
        series.booksInProgress++;
        return;
      }

      seriesMap.set(seriesName, {
        id: seriesId,
        name: seriesName,
        books: [item],
        totalBooks: 1,
        booksCompleted: 0,
        booksInProgress: 1,
        isFavorite: favoriteSeriesNames.includes(seriesName),
      });
    });

    // Sort favorites first
    const seriesArray = Array.from(seriesMap.values());
    seriesArray.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });

    return seriesArray.slice(0, 10);
  }, [inProgressItems, favoriteSeriesNames, isCacheLoaded, getSeries]);

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

  // Combined loading state (library books load instantly from cache, no loading state needed)
  const isLoading = isLoadingProgress || isLoadingPlaylists;

  // Refresh function - refetches all data
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchProgress(),
        refetchPlaylists(),
        refetchLibrary(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchProgress, refetchPlaylists, refetchLibrary]);

  return {
    currentBook,
    currentProgress,
    recentlyListened,
    recentBooks,
    userSeries,
    userPlaylists,
    isLoading,
    isRefreshing,
    refresh,
  };
}
