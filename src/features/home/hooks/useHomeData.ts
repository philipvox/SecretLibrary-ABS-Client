/**
 * src/features/home/hooks/useHomeData.ts
 *
 * Aggregates all data needed for the home screen
 * - Live updates when books are added/removed from library (no flicker)
 * - Pull-to-refresh support
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { apiClient } from '@/core/api';
import { queryKeys } from '@/core/queryClient';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { useLibraryCache } from '@/core/cache';
import { useDownloads } from '@/core/hooks/useDownloads';
import { preWarmTickCache, ChapterInput } from '@/features/player/services/tickCache';
import {
  UseHomeDataReturn,
  PlaybackProgress,
  SeriesWithBooks,
  PlaylistDisplay,
  HeroBookData,
  HeroBookState,
  EnhancedSeriesData,
  BookStatus,
  HomeViewMode,
} from '../types';
import { useKidModeStore } from '@/shared/stores/kidModeStore';
import { filterForKidMode } from '@/shared/utils/kidModeFilter';
import { calculateTimeRemaining, isBookComplete } from '@/features/player/utils/progressCalculator';
import { findChapterForPosition } from '@/features/player/utils/chapterNavigator';
import { getNarratorName, getTitle } from '@/shared/utils/metadata';
import { Chapter } from '@/features/player/utils/types';
import { useContinueListening } from '@/shared/hooks/useContinueListening';

// Type guard for FULL book media with audioFiles (needed for chapters)
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'audioFiles' in media && Array.isArray(media.audioFiles);
}

// Helper to get book duration safely
// Note: Does NOT require audioFiles - works with cache items that only have duration
function getBookDuration(item: LibraryItem | null | undefined): number {
  return item?.media?.duration || 0;
}

// Helper to get book metadata safely
// Note: Does NOT require audioFiles - works with cache items that only have metadata
function getBookMetadata(item: LibraryItem | null | undefined): BookMetadata | null {
  if (!item?.media?.metadata) return null;
  // This app only handles books, so metadata is always BookMetadata
  if (item.mediaType !== 'book') return null;
  return item.media.metadata as BookMetadata;
}

/**
 * Main hook for home screen data
 * Combines current playback, recent books, series, and playlists
 */
export function useHomeData(): UseHomeDataReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // View mode state - 'discover' (add to library) is default, 'lastPlayed' shows recently played
  const [viewMode, setViewMode] = useState<HomeViewMode>('discover');

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'discover' ? 'lastPlayed' : 'discover'));
  }, []);

  // Get player state for current book - PERF: only subscribe to currentBook, not position
  // Position updates 10x/second during playback and would cause constant re-renders
  // Home screen doesn't need real-time position - stored progress is sufficient
  const playerCurrentBook = usePlayerStore((s) => s.currentBook);

  // Get library IDs and favorite series from store (reactive)
  const libraryIds = useMyLibraryStore((state) => state.libraryIds);
  const favoriteSeriesNames = useMyLibraryStore((state) => state.favoriteSeriesNames);

  // Kid Mode filter state
  const kidModeEnabled = useKidModeStore((state) => state.enabled);

  // Get series data and all items from library cache - PERF: use selector to avoid re-renders
  const { getSeries, getItem, isLoaded: isCacheLoaded, items: allLibraryItems } = useLibraryCache(
    useShallow((state) => ({
      getSeries: state.getSeries,
      getItem: state.getItem,
      isLoaded: state.isLoaded,
      items: state.items,
    }))
  );

  // Get downloaded books
  const { downloads } = useDownloads();
  const completedDownloads = useMemo(
    () => downloads.filter((d) => d.status === 'complete'),
    [downloads]
  );

  // Get books from local library (includes both in-progress AND explicitly added)
  // This is the source of truth for "Continue Listening" and shows instant updates
  const { items: continueListeningItems } = useContinueListening();

  // Local cache of book data - persists across re-renders to avoid flicker
  const bookCacheRef = useRef<Map<string, LibraryItem>>(new Map());

  // Initialize library books from continueListeningItems to prevent empty flash
  // (v0.7.64 fix: continueListeningItems are available synchronously from local SQLite)
  const [libraryBooks, setLibraryBooks] = useState<LibraryItem[]>(() => {
    // Use continueListeningItems if available and libraryIds match
    // This provides instant content on first render instead of empty state
    return [];
  });

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
        const aTime = a.mediaProgress?.lastUpdate || a.userMediaProgress?.lastUpdate || 0;
        const bTime = b.mediaProgress?.lastUpdate || b.userMediaProgress?.lastUpdate || 0;
        return bTime - aTime;
      });
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    // Keep showing previous data while refetching for instant display
    placeholderData: (previousData) => previousData,
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
    // Keep showing previous data while refetching for instant display
    placeholderData: (previousData) => previousData,
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
  // OPTIMIZED: Single state update to prevent flash/reflow (v0.7.64 fix)
  useEffect(() => {
    const syncLibraryBooks = async () => {
      if (libraryIds.length === 0) {
        setLibraryBooks([]);
        return;
      }

      const cache = bookCacheRef.current;
      const idsToFetch: string[] = [];

      // Identify which books need fetching
      for (const id of libraryIds) {
        if (!cache.has(id)) {
          idsToFetch.push(id);
        }
      }

      // If ALL books are cached, update immediately (no fetch needed)
      if (idsToFetch.length === 0) {
        const orderedBooks = libraryIds
          .map(id => cache.get(id))
          .filter((book): book is LibraryItem => book !== undefined);
        setLibraryBooks(orderedBooks);
      } else {
        // Some books need fetching - wait for all data before single update
        // This eliminates the second render that caused flash/reflow
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

        // Single state update with all books (cached + freshly fetched)
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

  // Pre-warm tick cache for current book (non-blocking)
  useEffect(() => {
    if (!currentBook) return;

    const bookChapters = isBookMedia(currentBook.media) ? currentBook.media.chapters : [];
    const bookDuration = getBookDuration(currentBook);

    if (bookDuration > 0 && bookChapters.length > 0) {
      const chapterInputs: ChapterInput[] = bookChapters.map((ch, i) => ({
        start: ch.start || 0,
        end: ch.end || bookChapters[i + 1]?.start || bookDuration,
        displayTitle: ch.title,
      }));

      // Pre-warm in background (non-blocking, non-persisting)
      preWarmTickCache(currentBook.id, bookDuration, chapterInputs);
    }
  }, [currentBook?.id]); // Only re-run when book changes

  // Current progress - uses stored progress (not real-time position to avoid re-renders)
  const currentProgress: PlaybackProgress | null = useMemo(() => {
    if (!currentBook) return null;

    // Use stored progress (mediaProgress from getItemsInProgress, or legacy userMediaProgress)
    const userProgress = currentBook.mediaProgress || currentBook.userMediaProgress;
    if (userProgress) {
      return {
        currentTime: userProgress.currentTime || 0,
        duration: userProgress.duration || getBookDuration(currentBook),
        progress: userProgress.progress || 0,
        isFinished: userProgress.isFinished || false,
        lastUpdate: userProgress.lastUpdate || 0,
      };
    }

    return null;
  }, [currentBook]);

  // Recently listened - includes BOTH in-progress AND library-added books
  // Uses continueListeningItems from progressStore (local) as primary source for instant updates
  // Also merges server inProgressItems for any books not yet in local storage
  const recentlyListened = useMemo(() => {
    // Build a map of all books (local library items take priority)
    const bookMap = new Map<string, LibraryItem>();

    // Add local library items first (most up-to-date, instant updates)
    continueListeningItems.forEach(item => {
      bookMap.set(item.id, item);
    });

    // Merge server items that aren't in local storage yet
    inProgressItems.forEach(item => {
      if (!bookMap.has(item.id)) {
        bookMap.set(item.id, item);
      }
    });

    // Convert to array and apply Kid Mode filter
    const allBooks = Array.from(bookMap.values());
    const filtered = filterForKidMode(allBooks, kidModeEnabled);

    // If a book is currently playing, ensure it's at the top of the list
    // This provides instant feedback when starting playback, without waiting for API refresh
    if (playerCurrentBook) {
      const isAlreadyFirst = filtered.length > 0 && filtered[0].id === playerCurrentBook.id;
      if (!isAlreadyFirst) {
        // Remove current book from list if it exists elsewhere, then prepend it
        const withoutCurrent = filtered.filter(item => item.id !== playerCurrentBook.id);
        return [playerCurrentBook, ...withoutCurrent].slice(0, 20);
      }
    }

    return filtered.slice(0, 20);
  }, [continueListeningItems, inProgressItems, kidModeEnabled, playerCurrentBook]);

  // Your Books - from library store (live updates when adding/removing)
  // Exclude current book from the list, apply Kid Mode filter
  const recentBooks = useMemo(() => {
    let books = libraryBooks;
    if (currentBook) {
      books = books.filter((item) => item.id !== currentBook.id);
    }
    return filterForKidMode(books, kidModeEnabled);
  }, [libraryBooks, currentBook, kidModeEnabled]);

  // Extract series from downloaded books + in-progress books + favorites
  const userSeries: SeriesWithBooks[] = useMemo(() => {
    const seriesMap = new Map<string, SeriesWithBooks>();

    // Helper to extract series name from metadata
    const extractSeriesName = (item: LibraryItem): string | null => {
      const metadata = getBookMetadata(item);
      if (!metadata) return null;

      // Try seriesName first (e.g., "Series Name #1")
      if (metadata.seriesName) {
        const match = metadata.seriesName.match(/^(.+?)\s*#[\d.]+$/);
        return match ? match[1].trim() : metadata.seriesName;
      }
      // Try series array
      const seriesInfo = metadata.series;
      if (seriesInfo?.length) {
        const firstSeries = seriesInfo[0];
        return typeof firstSeries === 'object' ? firstSeries.name : firstSeries;
      }
      return null;
    };

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

    // Add series from downloaded books
    completedDownloads.forEach((download) => {
      const item = getItem(download.itemId);
      if (!item) return;

      const seriesName = extractSeriesName(item);
      if (!seriesName) return;

      if (seriesMap.has(seriesName)) {
        const series = seriesMap.get(seriesName)!;
        if (series.books.length < 4 && !series.books.find(b => b.id === item.id)) {
          series.books.push(item);
        }
        return;
      }

      // Try to get full series info from cache
      const cachedSeries = isCacheLoaded ? getSeries(seriesName) : null;

      seriesMap.set(seriesName, {
        id: seriesName,
        name: seriesName,
        books: cachedSeries ? cachedSeries.books.slice(0, 4) : [item],
        totalBooks: cachedSeries?.bookCount || 1,
        booksCompleted: 0,
        booksInProgress: 0,
        isFavorite: favoriteSeriesNames.includes(seriesName),
      });
    });

    // Then add series from in-progress items
    inProgressItems.forEach((item) => {
      // Extract series name from multiple possible sources
      const seriesName = extractSeriesName(item);
      if (!seriesName) return;

      // Skip if already added
      if (seriesMap.has(seriesName)) {
        const series = seriesMap.get(seriesName)!;
        if (series.books.length < 4 && !series.books.find(b => b.id === item.id)) {
          series.books.push(item);
        }
        series.booksInProgress++;
        return;
      }

      // Try to get full series info from cache
      const cachedSeries = isCacheLoaded ? getSeries(seriesName) : null;

      seriesMap.set(seriesName, {
        id: seriesName,
        name: seriesName,
        books: cachedSeries ? cachedSeries.books.slice(0, 4) : [item],
        totalBooks: cachedSeries?.bookCount || 1,
        booksCompleted: 0,
        booksInProgress: 1,
        isFavorite: favoriteSeriesNames.includes(seriesName),
      });
    });

    // Sort favorites first, then by whether they have downloaded books
    const seriesArray = Array.from(seriesMap.values());
    seriesArray.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });

    return seriesArray.slice(0, 10);
  }, [inProgressItems, completedDownloads, favoriteSeriesNames, isCacheLoaded, getSeries, getItem]);

  // Convert playlists to display format
  const userPlaylists: PlaylistDisplay[] = useMemo(() => {
    return playlists.slice(0, 10).map((playlist) => ({
      ...playlist,
      totalDuration: playlist.items.reduce((acc, item) => {
        const libraryItem = item.libraryItem;
        const itemDuration = libraryItem ? getBookDuration(libraryItem) : 0;
        return acc + itemDuration;
      }, 0),
      isFavorite: false,
    }));
  }, [playlists]);

  // =============================================================================
  // HOMEPAGE REDESIGN - Hero Card & Progress Data
  // =============================================================================

  /**
   * Hero Book - Primary resume target with enhanced chapter info
   * Prefers player's current book (if playing), otherwise most recent from server
   * PERF: Uses stored progress, not real-time position (avoids 10Hz re-renders)
   */
  const heroBook: HeroBookData | null = useMemo(() => {
    // Prefer player's current book when loaded (instant update on book switch)
    // Fall back to server's most recent if no book is loaded in player
    const book = playerCurrentBook || recentlyListened[0];
    if (!book) return null;
    // mediaProgress is attached by getItemsInProgress(), userMediaProgress is legacy
    const userProgress = book.mediaProgress || book.userMediaProgress;
    const bookDuration = getBookDuration(book);

    // Use stored progress (not real-time position to avoid re-renders)
    const progress = userProgress?.progress || 0;
    const currentPosition = userProgress?.currentTime || 0;

    // Calculate chapter info using existing utility
    const bookChapters = isBookMedia(book.media) ? book.media.chapters : [];
    const chapters: Chapter[] = bookChapters.map((ch, idx) => ({
      id: ch.id || idx,
      start: ch.start || 0,
      end: ch.end || bookDuration,
      title: ch.title || '',
    }));

    const totalChapters = chapters.length;
    let currentChapter = 1;

    if (chapters.length > 0) {
      const chapterInfo = findChapterForPosition(chapters, currentPosition);
      currentChapter = chapterInfo ? chapterInfo.index + 1 : 1;
    }

    // Calculate time remaining using existing utility
    const timeRemainingSeconds = calculateTimeRemaining(currentPosition, bookDuration);

    // Get narrator using existing utility
    const narratorName = getNarratorName(book);

    // Determine visual state based on progress
    let state: HeroBookState = 'in-progress';
    if (progress >= 0.95) {
      state = 'final-chapter';
    } else if (progress >= 0.75) {
      state = 'almost-done';
    }

    // Check if just finished (using existing utility)
    if (isBookComplete(currentPosition, bookDuration)) {
      state = 'just-finished';
    }

    return {
      book,
      progress,
      currentChapter,
      totalChapters,
      timeRemainingSeconds,
      narratorName,
      state,
    };
  }, [recentlyListened, playerCurrentBook]);

  /**
   * Continue Listening Grid - Other in-progress books excluding hero book
   * Filters by hero book ID to handle player vs server data mismatch
   */
  const continueListeningGrid: LibraryItem[] = useMemo(() => {
    // Get the hero book ID (player's current book takes priority)
    const heroBookId = playerCurrentBook?.id || recentlyListened[0]?.id;
    if (!heroBookId) return recentlyListened.slice(0, 6);

    // Filter out the hero book by ID and take up to 6
    return recentlyListened
      .filter((book) => book.id !== heroBookId)
      .slice(0, 6);
  }, [recentlyListened, playerCurrentBook]);

  /**
   * Series In Progress - Enhanced series data with per-book completion status
   * Derived from Continue Listening books, ordered by most recently listened
   */
  const seriesInProgress: EnhancedSeriesData[] = useMemo(() => {
    // Build a map of series -> most recent lastUpdate timestamp from in-progress books
    // Use both raw series name and cleaned name (without book number) for matching
    const seriesLastListened = new Map<string, number>();

    // Helper to extract clean series name (strips "#1" suffix)
    const cleanSeriesName = (name: string): string => {
      const match = name.match(/^(.+?)\s*#[\d.]+$/);
      return match ? match[1].trim() : name;
    };

    inProgressItems.forEach((item) => {
      const metadata = getBookMetadata(item);

      // Try multiple sources for series name
      let seriesNames: string[] = [];

      // From seriesName field (e.g., "Series Name #1")
      if (metadata?.seriesName) {
        seriesNames.push(metadata.seriesName);
        seriesNames.push(cleanSeriesName(metadata.seriesName));
      }

      // From series array
      const seriesInfo = metadata?.series;
      if (seriesInfo?.length && seriesInfo.length > 0) {
        const firstSeries = seriesInfo[0];
        const rawName = typeof firstSeries === 'object' ? firstSeries.name : firstSeries;
        if (rawName) {
          seriesNames.push(rawName);
          seriesNames.push(cleanSeriesName(rawName));
        }
      }

      // Add all variations to the map
      const lastUpdate = item.mediaProgress?.lastUpdate || item.userMediaProgress?.lastUpdate || 0;
      seriesNames.forEach((name) => {
        if (name) {
          const existing = seriesLastListened.get(name) || 0;
          if (lastUpdate > existing) {
            seriesLastListened.set(name, lastUpdate);
          }
        }
      });
    });

    return userSeries
      .filter((series) => seriesLastListened.has(series.name) || series.booksInProgress > 0)
      .map((series): EnhancedSeriesData & { lastListened: number } => {
        // Calculate per-book status
        const bookStatuses: BookStatus[] = series.books.map((book) => {
          const bookProgress = book.mediaProgress?.progress || book.userMediaProgress?.progress || 0;
          if (bookProgress >= 0.95) return 'done';
          if (bookProgress > 0) return 'current';
          return 'not-started';
        });

        // Find current book (first in-progress)
        const currentBookIndex = bookStatuses.findIndex((s) => s === 'current');
        const currentBook = currentBookIndex >= 0 ? series.books[currentBookIndex] : series.books[0];

        // Calculate series progress
        let totalDuration = 0;
        let listenedDuration = 0;
        series.books.forEach((book) => {
          const bookDur = getBookDuration(book);
          const bookProgress = book.mediaProgress?.progress || book.userMediaProgress?.progress || 0;
          totalDuration += bookDur;
          listenedDuration += bookDur * bookProgress;
        });
        const seriesProgressPercent = totalDuration > 0 ? (listenedDuration / totalDuration) * 100 : 0;

        // Calculate time remaining for series
        let seriesTimeRemainingSeconds = 0;
        series.books.forEach((book) => {
          const bookDur = getBookDuration(book);
          const bookProgress = book.mediaProgress?.progress || book.userMediaProgress?.progress || 0;
          seriesTimeRemainingSeconds += bookDur * (1 - bookProgress);
        });

        return {
          ...series,
          bookStatuses,
          seriesProgressPercent,
          seriesTimeRemainingSeconds,
          currentBookTitle: getTitle(currentBook),
          currentBookIndex: currentBookIndex >= 0 ? currentBookIndex : 0,
          lastListened: seriesLastListened.get(series.name) || 0,
        };
      })
      // Sort by most recently listened (descending)
      .sort((a, b) => b.lastListened - a.lastListened)
      .slice(0, 5); // Limit to 5 series
  }, [userSeries, inProgressItems]);

  /**
   * Recently Added - Books with 0% progress for discovery
   * Sorted by when they were added to the library
   */
  const recentlyAdded: LibraryItem[] = useMemo(() => {
    // Get books with no progress (not started)
    const notStarted = libraryBooks.filter((book) => {
      const progress = book.mediaProgress?.progress || book.userMediaProgress?.progress || 0;
      return progress === 0;
    });

    // Sort by addedAt (most recent first)
    const sorted = notStarted.sort((a, b) => {
      const aAdded = a.addedAt || 0;
      const bAdded = b.addedAt || 0;
      return bAdded - aAdded;
    });

    // Apply Kid Mode filter and limit
    return filterForKidMode(sorted, kidModeEnabled).slice(0, 20);
  }, [libraryBooks, kidModeEnabled]);

  /**
   * Discover Books - Books not yet in user's listening history
   * Shows all library items that aren't in the user's progress list
   * Sorted by most recently added to the server
   */
  const discoverBooks: LibraryItem[] = useMemo(() => {
    if (!isCacheLoaded || allLibraryItems.length === 0) return [];

    // Get IDs of books user has ANY progress on (from inProgressItems)
    const inProgressIds = new Set(inProgressItems.map((item) => item.id));

    // Also exclude books in the user's explicit library
    const userLibraryIds = new Set(libraryIds);

    // Filter to books not in progress and not in library
    const notStarted = allLibraryItems.filter((item) => {
      // Exclude if user has progress on this book
      if (inProgressIds.has(item.id)) return false;
      // Exclude if book is in user's library
      if (userLibraryIds.has(item.id)) return false;
      return true;
    });

    // Sort by addedAt (most recent first)
    const sorted = notStarted.sort((a, b) => {
      const aAdded = a.addedAt || 0;
      const bAdded = b.addedAt || 0;
      return bAdded - aAdded;
    });

    // Apply Kid Mode filter and limit
    return filterForKidMode(sorted, kidModeEnabled).slice(0, 30);
  }, [allLibraryItems, inProgressItems, libraryIds, isCacheLoaded, kidModeEnabled]);

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
    // Homepage Redesign
    heroBook,
    continueListeningGrid,
    seriesInProgress,
    recentlyAdded,
    // View Mode
    viewMode,
    toggleViewMode,
    discoverBooks,
    // State
    isLoading,
    isRefreshing,
    refresh,
  };
}
