/**
 * src/features/library/hooks/useLibraryData.ts
 *
 * Custom hook for library data enrichment and filtering.
 * Extracts all useMemo logic from MyLibraryScreen for cleaner separation.
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useLibraryCache, getAllAuthors, getAllSeries, getAllNarrators } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { useLibrarySyncStore } from '@/shared/stores/librarySyncStore';
import { usePreferencesStore } from '@/features/recommendations/stores/preferencesStore';
import { useFinishedBookIds, useInProgressBooks } from '@/core/hooks/useUserBooks';
import { useContinueListening } from '@/shared/hooks/useContinueListening';
import { useCompletionStore } from '@/features/completion';
import { useProgressStore } from '@/core/stores/progressStore';
import { useKidModeStore } from '@/shared/stores/kidModeStore';
import { isKidFriendly } from '@/shared/utils/kidModeFilter';
import {
  TabType,
  EnrichedBook,
  SeriesGroup,
  FannedSeriesCardData,
  getMetadata,
  getProgress,
  getDuration,
  extractSeriesMetadata,
} from '../types';
import { SortOption } from '../components/SortPicker';

interface UseLibraryDataProps {
  activeTab: TabType;
  sort: SortOption;
  searchQuery: string;
}

interface UseLibraryDataResult {
  // Data
  enrichedBooks: EnrichedBook[];
  filteredBooks: EnrichedBook[];
  favoritedBooks: EnrichedBook[];
  serverInProgressBooks: EnrichedBook[];
  allLibraryBooks: EnrichedBook[];
  seriesGroups: SeriesGroup[];
  favoriteAuthorData: any[];
  favoriteSeriesData: FannedSeriesCardData[];
  favoriteNarratorData: any[];
  activeDownloads: any[];
  continueListeningItems: LibraryItem[];
  totalStorageUsed: number;

  // Flags
  isLoaded: boolean;
  isLoading: boolean;
  hasDownloading: boolean;
  hasPaused: boolean;
  hasAnyContent: boolean;

  // Functions
  isMarkedFinished: (bookId: string) => boolean;
  refetchContinueListening: () => Promise<any>;
  loadCache: (libraryId: string, force?: boolean) => Promise<void>;
  pauseDownload: (itemId: string) => void;
  resumeDownload: (itemId: string) => void;
  deleteDownload: (itemId: string) => void;
  currentLibraryId: string | null;
}

export function useLibraryData({ activeTab, sort, searchQuery }: UseLibraryDataProps): UseLibraryDataResult {
  const { items: cachedItems, isLoaded, getSeries, getItem, loadCache, currentLibraryId } = useLibraryCache();
  const { downloads, isLoading: isDownloadsLoading, pauseDownload, resumeDownload, deleteDownload } = useDownloads();

  // Favorites from stores
  const libraryIds = useMyLibraryStore((state) => state.libraryIds);
  const favoriteSeriesNames = useMyLibraryStore((state) => state.favoriteSeriesNames);
  const favoriteAuthors = usePreferencesStore((state) => state.favoriteAuthors);
  const favoriteNarrators = usePreferencesStore((state) => state.favoriteNarrators);

  // Reading history
  const finishedBookIds = useFinishedBookIds();
  const isCompleteInStore = useCompletionStore((state) => state.isComplete);
  const isMarkedFinished = useCallback((bookId: string) => {
    return finishedBookIds.has(bookId) || isCompleteInStore(bookId);
  }, [finishedBookIds, isCompleteInStore]);

  // Continue listening data from server
  const { items: continueListeningItems, isLoading: isContinueLoading, isServerLoading, refetch: refetchContinueListening } = useContinueListening();

  // Real-time progress from progressStore (reactive, instant updates)
  const progressVersion = useProgressStore((s) => s.version);
  const progressMap = useProgressStore((s) => s.progressMap);

  // SQLite progress data for accurate in-progress state
  // Use isFetching to catch all fetches (not just initial load without cache)
  const { data: sqliteInProgressBooks = [], isLoading: isProgressLoading, isFetching: isProgressFetching } = useInProgressBooks();
  const sqliteProgressMap = useMemo(() => {
    const map = new Map<string, { progress: number; lastPlayedAt?: string }>();
    for (const book of sqliteInProgressBooks) {
      map.set(book.bookId, {
        progress: book.progress,
        lastPlayedAt: book.lastPlayedAt ?? undefined,
      });
    }
    return map;
  }, [sqliteInProgressBooks]);

  // Kid Mode filter
  const kidModeEnabled = useKidModeStore((state) => state.enabled);

  // Unified lastPlayedAt resolver: progressStore (real-time) → SQLite → server
  const getLastPlayedAt = useCallback((bookId: string, item?: LibraryItem | null): number | undefined => {
    // 1. progressStore — real-time, updated instantly during playback
    const pd = progressMap.get(bookId);
    if (pd?.lastPlayedAt) return pd.lastPlayedAt;
    // 2. SQLite in-progress books — accurate but only for non-finished books
    const sqlite = sqliteProgressMap.get(bookId);
    if (sqlite?.lastPlayedAt) return new Date(sqlite.lastPlayedAt).getTime();
    // 3. Server API response — stale but always available
    return item?.userMediaProgress?.lastUpdate;
  }, [progressMap, sqliteProgressMap]);

  // Combined loading state - wait for ALL data sources before showing sorted results
  // This prevents the "flash" where books reorder as each async source completes
  // Include isFetching and isServerLoading to wait for background queries (not just initial load)
  const isDataReady = isLoaded && !isDownloadsLoading && !isProgressLoading && !isProgressFetching && !isContinueLoading && !isServerLoading;

  // STABILIZATION: Wait for data to settle before showing content
  // This adds a minimum 500ms delay on initial load to let all syncs complete
  const [hasSettled, setHasSettled] = useState(false);
  const settleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasDataReadyRef = useRef(false);

  useEffect(() => {
    if (isDataReady && !wasDataReadyRef.current) {
      // Data just became ready - start settle timer
      wasDataReadyRef.current = true;
      settleTimerRef.current = setTimeout(() => {
        setHasSettled(true);
      }, 500); // 500ms settle time
    }

    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
      }
    };
  }, [isDataReady]);

  // Trigger library sync on mount if a playlist is linked
  const libraryPlaylistId = useLibrarySyncStore(s => s.libraryPlaylistId);
  const syncTriggeredRef = useRef(false);
  useEffect(() => {
    if (libraryPlaylistId && !syncTriggeredRef.current) {
      syncTriggeredRef.current = true;
      import('@/core/services/librarySyncService').then(({ librarySyncService }) => {
        librarySyncService.fullSync();
      });
    }
  }, [libraryPlaylistId]);

  // Final loading state: data must be ready AND settled
  const isFullyReady = isDataReady && hasSettled;

  // Separate active downloads from completed
  const activeDownloads = useMemo(
    () => downloads.filter((d) => d.status === 'downloading' || d.status === 'pending' || d.status === 'paused' || d.status === 'error'),
    [downloads]
  );

  const completedDownloads = useMemo(
    () => downloads.filter((d) => d.status === 'complete'),
    [downloads]
  );

  const downloadMap = useMemo(
    () => new Map(completedDownloads.map(d => [d.itemId, d])),
    [completedDownloads]
  );

  const totalStorageUsed = useMemo(() => {
    return completedDownloads.reduce((sum, d) => sum + (d.totalBytes || 0), 0);
  }, [completedDownloads]);

  // Enrich downloads with book metadata
  const enrichedBooks = useMemo<EnrichedBook[]>(() => {
    if (!isLoaded) return [];

    return completedDownloads.map((download) => {
      const item = getItem(download.itemId);
      if (!item) {
        return {
          id: download.itemId,
          item: {} as LibraryItem,
          title: 'Unknown Title',
          author: 'Unknown Author',
          seriesName: '',
          progress: 0,
          duration: 0,
          totalBytes: download.totalBytes || 0,
        };
      }

      const metadata = getMetadata(item);
      const { cleanName: seriesName, sequence } = extractSeriesMetadata(metadata.seriesName || '');

      // Progress: progressStore (real-time) → SQLite → server
      const pdProgress = progressMap.get(download.itemId);
      const sqliteProgress = sqliteProgressMap.get(download.itemId);
      const progress = pdProgress?.progress ?? sqliteProgress?.progress ?? getProgress(item);

      return {
        id: download.itemId,
        item,
        title: metadata.title || 'Unknown Title',
        author: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
        seriesName,
        sequence,
        progress,
        duration: getDuration(item),
        totalBytes: download.totalBytes || 0,
        lastPlayedAt: getLastPlayedAt(download.itemId, item),
        addedAt: item.addedAt,
        isDownloaded: true,
      };
    });
  }, [completedDownloads, getItem, isLoaded, sqliteProgressMap, getLastPlayedAt, progressMap]);

  // Server in-progress books
  const serverInProgressBooks = useMemo<EnrichedBook[]>(() => {
    return continueListeningItems.map((item) => {
      const metadata = getMetadata(item);
      const { cleanName: seriesName, sequence } = extractSeriesMetadata(metadata.seriesName || '');
      const download = downloadMap.get(item.id);
      const pdProgress = progressMap.get(item.id);

      return {
        id: item.id,
        item,
        title: metadata.title || 'Unknown Title',
        author: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
        seriesName,
        sequence,
        progress: pdProgress?.progress ?? item.userMediaProgress?.progress ?? 0,
        duration: getDuration(item),
        totalBytes: download?.totalBytes || 0,
        lastPlayedAt: getLastPlayedAt(item.id, item),
        addedAt: item.addedAt,
        isDownloaded: !!download,
      };
    });
  }, [continueListeningItems, downloadMap, getLastPlayedAt, progressMap]);

  // Favorited books
  const favoritedBooks = useMemo((): EnrichedBook[] => {
    if (!isLoaded || !cachedItems) return [];

    const result: EnrichedBook[] = [];
    for (const bookId of libraryIds) {
      const item = getItem(bookId);
      if (!item) continue;

      const metadata = getMetadata(item);
      const { cleanName: seriesName, sequence } = extractSeriesMetadata(metadata.seriesName || '');
      const download = downloadMap.get(bookId);

      // Progress: progressStore (real-time) → SQLite → server
      const pdProgress = progressMap.get(bookId);
      const sqliteProgress = sqliteProgressMap.get(bookId);
      const progress = pdProgress?.progress ?? sqliteProgress?.progress ?? getProgress(item);

      result.push({
        id: bookId,
        item,
        title: metadata.title || 'Unknown Title',
        author: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
        seriesName,
        sequence,
        progress,
        duration: getDuration(item),
        totalBytes: download?.totalBytes || 0,
        lastPlayedAt: getLastPlayedAt(bookId, item),
        addedAt: item.addedAt,
        isDownloaded: !!download,
      });
    }
    return result;
  }, [libraryIds, cachedItems, isLoaded, downloadMap, getItem, sqliteProgressMap, getLastPlayedAt, progressMap]);

  // Marked finished books (non-downloaded)
  const markedFinishedBooks = useMemo<EnrichedBook[]>(() => {
    if (!isLoaded) return [];
    const result: EnrichedBook[] = [];
    const enrichedBookIds = new Set(enrichedBooks.map(b => b.id));

    for (const bookId of finishedBookIds) {
      if (enrichedBookIds.has(bookId)) continue;
      const item = getItem(bookId);
      if (!item) continue;

      const metadata = getMetadata(item);
      const { cleanName: seriesName, sequence } = extractSeriesMetadata(metadata.seriesName || '');

      // Progress: progressStore (real-time) → SQLite → server
      const pdProgress = progressMap.get(bookId);
      const sqliteProgress = sqliteProgressMap.get(bookId);
      const progress = pdProgress?.progress ?? sqliteProgress?.progress ?? getProgress(item);

      result.push({
        id: bookId,
        item,
        title: metadata.title || 'Unknown Title',
        author: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
        seriesName,
        sequence,
        progress,
        duration: getDuration(item),
        totalBytes: 0,
        lastPlayedAt: getLastPlayedAt(bookId, item),
        addedAt: item.addedAt,
        isDownloaded: false,
      });
    }
    return result;
  }, [isLoaded, finishedBookIds, enrichedBooks, getItem, sqliteProgressMap, getLastPlayedAt, progressMap]);

  // All library books (union with Kid Mode filter)
  // Includes downloaded + in-progress + favorited + finished (non-downloaded)
  const allLibraryBooks = useMemo<EnrichedBook[]>(() => {
    const bookMap = new Map<string, EnrichedBook>();

    // Helper: add book, preferring entry with most recent lastPlayedAt
    const addBook = (book: EnrichedBook) => {
      if (kidModeEnabled && book.item && !isKidFriendly(book.item)) return;
      const existing = bookMap.get(book.id);
      if (!existing || (book.lastPlayedAt || 0) > (existing.lastPlayedAt || 0)) {
        bookMap.set(book.id, book);
      }
    };

    for (const book of enrichedBooks) addBook(book);
    for (const book of serverInProgressBooks) addBook(book);
    for (const book of favoritedBooks) addBook(book);
    for (const book of markedFinishedBooks) addBook(book);

    // Fallback: add any book from progressStore that's missing from all 4 collections.
    // Covers the gap where a book auto-finishes (progress >= 0.95) but hasn't
    // appeared in finishedBookIds yet (React Query 60s staleTime + 2s SQLite flush).
    for (const [bookId, pd] of progressMap) {
      if (bookMap.has(bookId)) continue;
      if (pd.progress <= 0 && !pd.isInLibrary) continue;
      const item = getItem(bookId);
      if (!item) continue;
      if (kidModeEnabled && !isKidFriendly(item)) continue;

      const metadata = getMetadata(item);
      const { cleanName: seriesName, sequence } = extractSeriesMetadata(metadata.seriesName || '');
      const download = downloadMap.get(bookId);

      bookMap.set(bookId, {
        id: bookId,
        item,
        title: metadata.title || 'Unknown Title',
        author: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
        seriesName,
        sequence,
        progress: pd.progress,
        duration: pd.duration || getDuration(item),
        totalBytes: download?.totalBytes || 0,
        lastPlayedAt: pd.lastPlayedAt,
        addedAt: item.addedAt,
        isDownloaded: !!download,
      });
    }

    return Array.from(bookMap.values());
  }, [enrichedBooks, serverInProgressBooks, favoritedBooks, markedFinishedBooks, progressMap, progressVersion, kidModeEnabled, getItem, downloadMap]);

  // Get books for current tab
  const currentTabBooks = useMemo(() => {
    switch (activeTab) {
      case 'downloaded':
        return enrichedBooks;
      case 'in-progress':
        return serverInProgressBooks;
      case 'not-started':
        return enrichedBooks.filter(b => b.progress === 0 && !isMarkedFinished(b.id));
      case 'completed':
        const downloadedCompleted = enrichedBooks.filter(b => b.progress >= 0.95 || isMarkedFinished(b.id));
        return [...downloadedCompleted, ...markedFinishedBooks];
      case 'favorites':
        return favoritedBooks;
      default:
        return allLibraryBooks;
    }
  }, [activeTab, enrichedBooks, serverInProgressBooks, favoritedBooks, allLibraryBooks, isMarkedFinished, markedFinishedBooks]);

  // Apply sort - only when all data sources are ready AND settled
  const sortedBooks = useMemo(() => {
    // Return empty while loading/settling - skeleton will show instead
    if (!isFullyReady) {
      return [];
    }

    const sorted = [...currentTabBooks];
    let result: EnrichedBook[];
    switch (sort) {
      case 'recently-played':
        result = sorted.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
        break;
      case 'recently-added':
        result = sorted.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        break;
      case 'title-asc':
        result = sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        result = sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'author-asc':
        result = sorted.sort((a, b) => a.author.localeCompare(b.author));
        break;
      case 'duration-asc':
        result = sorted.sort((a, b) => a.duration - b.duration);
        break;
      case 'duration-desc':
        result = sorted.sort((a, b) => b.duration - a.duration);
        break;
      default:
        result = sorted;
    }

    return result;
  }, [currentTabBooks, sort, isFullyReady]);

  // Apply search filter
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) return sortedBooks;
    const query = searchQuery.toLowerCase().trim();
    return sortedBooks.filter(b =>
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      b.seriesName?.toLowerCase().includes(query)
    );
  }, [sortedBooks, searchQuery]);

  // Series groups for Downloaded tab
  const seriesGroups = useMemo<SeriesGroup[]>(() => {
    const seriesMap = new Map<string, EnrichedBook[]>();
    for (const book of filteredBooks) {
      if (book.seriesName) {
        const existing = seriesMap.get(book.seriesName) || [];
        existing.push(book);
        seriesMap.set(book.seriesName, existing);
      }
    }

    return Array.from(seriesMap.entries()).map(([name, books]) => {
      const seriesInfo = getSeries(name);
      return {
        name,
        books: books.sort((a, b) => (a.sequence || 999) - (b.sequence || 999)),
        totalBooks: seriesInfo?.books?.length || books.length,
        downloadedCount: books.length,
        completedCount: books.filter(b => b.progress >= 0.95).length,
        inProgressCount: books.filter(b => b.progress > 0 && b.progress < 0.95).length,
      };
    });
  }, [filteredBooks, getSeries]);

  // Favorite data with proper type filtering
  const favoriteAuthorData = useMemo(() => {
    if (!isLoaded) return [];
    const allAuthorsMap = getAllAuthors();
    return favoriteAuthors
      .map(name => allAuthorsMap.find(a => a.name === name))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  }, [favoriteAuthors, isLoaded]);

  const favoriteSeriesData = useMemo((): FannedSeriesCardData[] => {
    if (!isLoaded) return [];
    const allSeriesMap = getAllSeries();
    return favoriteSeriesNames
      .map(name => allSeriesMap.find(s => s.name === name))
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
      .map(s => ({
        name: s.name,
        books: s.books || [],
        bookCount: s.books?.length || 0,
      }));
  }, [favoriteSeriesNames, isLoaded]);

  const favoriteNarratorData = useMemo(() => {
    if (!isLoaded) return [];
    const allNarratorsMap = getAllNarrators();
    return favoriteNarrators
      .map(name => allNarratorsMap.find(n => n.name === name))
      .filter((n): n is NonNullable<typeof n> => n !== undefined);
  }, [favoriteNarrators, isLoaded]);

  // Flags
  const hasDownloading = activeDownloads.some(d => d.status === 'downloading');
  const hasPaused = activeDownloads.some(d => d.status === 'paused');
  const hasAnyContent = allLibraryBooks.length > 0 || activeDownloads.length > 0 ||
    favoriteSeriesNames.length > 0 || favoriteAuthors.length > 0 || favoriteNarrators.length > 0;

  return {
    enrichedBooks,
    filteredBooks,
    favoritedBooks,
    serverInProgressBooks,
    allLibraryBooks,
    seriesGroups,
    favoriteAuthorData,
    favoriteSeriesData,
    favoriteNarratorData,
    activeDownloads,
    continueListeningItems,
    totalStorageUsed,
    isLoaded,
    isLoading: !isDataReady,
    hasDownloading,
    hasPaused,
    hasAnyContent,
    isMarkedFinished,
    refetchContinueListening,
    loadCache,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    currentLibraryId,
  };
}
