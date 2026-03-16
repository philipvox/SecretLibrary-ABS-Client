/**
 * src/features/reading-history-wizard/hooks/useReadingHistory.ts
 *
 * Hook that combines local reading history (SQLite user_books) with server-side progress.
 * Provides utilities to:
 * - Check if a book is finished (SQLite or server progress >= 95%)
 * - Extract patterns from reading history for recommendations
 * - Get preference boosts based on what user has listened to
 */

import { useMemo } from 'react';
import { useFinishedBooks, useFinishedBookIds } from '@/core/hooks/useUserBooks';
import { useLibraryCache } from '@/core/cache/libraryCache';
import { LibraryItem, BookMetadata } from '@/core/types';

/**
 * SINGLE SOURCE OF TRUTH: Threshold for considering a book "finished"
 * Used by SQLite auto-finish, recommendations, book detail, etc.
 * Export this constant so all features use the same threshold.
 */
export const FINISHED_THRESHOLD = 0.95;

/**
 * Get metadata from a library item safely
 */
function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

/**
 * Extract author name from item
 */
function getAuthorName(item: LibraryItem): string {
  return getMetadata(item).authorName || '';
}

/**
 * Extract series name (without sequence number) from item
 */
function getSeriesName(item: LibraryItem): string {
  const seriesName = getMetadata(item).seriesName || '';
  return seriesName.replace(/\s*#[\d.]+$/, '').trim();
}

/**
 * Extract genres from item
 */
function getGenres(item: LibraryItem): string[] {
  return getMetadata(item).genres || [];
}

export interface ReadingPreferences {
  /** Authors the user has finished books by (with count) */
  favoriteAuthors: Map<string, number>;
  /** Series the user has finished books in (with count) */
  favoriteSeries: Map<string, number>;
  /** Genres the user has finished (with count) */
  favoriteGenres: Map<string, number>;
  /** Total number of finished books */
  totalFinished: number;
}

export interface PreferenceBoost {
  /** Boost for author match (0-30) */
  authorBoost: number;
  /** Boost for series match (0-25) */
  seriesBoost: number;
  /** Boost for genre match (0-20) */
  genreBoost: number;
  /** Total boost (0-75) */
  totalBoost: number;
  /** Why this book got a boost */
  reasons: string[];
}

interface UseReadingHistoryResult {
  /** Check if a book is finished (local or server) */
  isFinished: (itemId: string) => boolean;
  /** Check if a book has been started (any progress > 0) */
  hasBeenStarted: (itemId: string) => boolean;
  /** Get all finished book IDs */
  finishedBookIds: Set<string>;
  /** Get reading preferences from history */
  preferences: ReadingPreferences;
  /** Calculate preference boost for a book */
  getPreferenceBoost: (item: LibraryItem) => PreferenceBoost;
  /** Filter items to exclude finished books */
  filterUnfinished: <T extends LibraryItem>(items: T[]) => T[];
  /** Has any reading history */
  hasHistory: boolean;
}

/**
 * Main hook for reading history integration
 */
export function useReadingHistory(): UseReadingHistoryResult {
  // Get finished books from SQLite (single source of truth)
  const { data: finishedBooksData = [] } = useFinishedBooks();
  const items = useLibraryCache((s) => s.items);
  const getItem = useLibraryCache((s) => s.getItem);

  // Build set of finished book IDs (combining SQLite + server progress)
  const finishedBookIds = useMemo(() => {
    const finished = new Set<string>();

    // Add books marked finished in SQLite
    for (const book of finishedBooksData) {
      finished.add(book.bookId);
    }

    // Add books with >= 95% server progress (not yet in SQLite)
    for (const item of items) {
      const progress = item.userMediaProgress?.progress || 0;
      if (progress >= FINISHED_THRESHOLD) {
        finished.add(item.id);
      }
    }

    return finished;
  }, [finishedBooksData, items]);

  // Check if a specific book is finished
  const isFinished = useMemo(() => {
    return (itemId: string): boolean => {
      // Check SQLite finished books first
      if (finishedBookIds.has(itemId)) return true;

      // Check server progress as fallback
      const item = getItem(itemId);
      if (item) {
        const progress = item.userMediaProgress?.progress || 0;
        return progress >= FINISHED_THRESHOLD;
      }

      return false;
    };
  }, [finishedBookIds, getItem]);

  // Check if a book has been started (any progress)
  const hasBeenStarted = useMemo(() => {
    return (itemId: string): boolean => {
      const item = getItem(itemId);
      if (item) {
        const progress = item.userMediaProgress?.progress || 0;
        return progress > 0;
      }
      return false;
    };
  }, [getItem]);

  // Build reading preferences from finished books
  const preferences = useMemo((): ReadingPreferences => {
    const favoriteAuthors = new Map<string, number>();
    const favoriteSeries = new Map<string, number>();
    const favoriteGenres = new Map<string, number>();

    for (const bookId of finishedBookIds) {
      const item = getItem(bookId);
      if (!item) continue;

      // Track author
      const author = getAuthorName(item).toLowerCase();
      if (author) {
        favoriteAuthors.set(author, (favoriteAuthors.get(author) || 0) + 1);
      }

      // Track series
      const series = getSeriesName(item).toLowerCase();
      if (series) {
        favoriteSeries.set(series, (favoriteSeries.get(series) || 0) + 1);
      }

      // Track genres
      const genres = getGenres(item);
      for (const genre of genres) {
        const lowerGenre = genre.toLowerCase();
        favoriteGenres.set(lowerGenre, (favoriteGenres.get(lowerGenre) || 0) + 1);
      }
    }

    return {
      favoriteAuthors,
      favoriteSeries,
      favoriteGenres,
      totalFinished: finishedBookIds.size,
    };
  }, [finishedBookIds, getItem]);

  // Calculate preference boost for a book
  const getPreferenceBoost = useMemo(() => {
    return (item: LibraryItem): PreferenceBoost => {
      const reasons: string[] = [];
      let authorBoost = 0;
      let seriesBoost = 0;
      let genreBoost = 0;

      // Don't boost finished books
      if (finishedBookIds.has(item.id)) {
        return { authorBoost: 0, seriesBoost: 0, genreBoost: 0, totalBoost: 0, reasons: [] };
      }

      const author = getAuthorName(item).toLowerCase();
      const series = getSeriesName(item).toLowerCase();
      const genres = getGenres(item);

      // Author boost (max 30)
      if (author && preferences.favoriteAuthors.has(author)) {
        const count = preferences.favoriteAuthors.get(author)!;
        authorBoost = Math.min(30, 15 + count * 5); // 15 base + 5 per book
        reasons.push(`You've finished ${count} book${count > 1 ? 's' : ''} by this author`);
      }

      // Series boost (max 25)
      if (series && preferences.favoriteSeries.has(series)) {
        const count = preferences.favoriteSeries.get(series)!;
        seriesBoost = Math.min(25, 10 + count * 5); // 10 base + 5 per book
        reasons.push(`You've finished ${count} book${count > 1 ? 's' : ''} in this series`);
      }

      // Genre boost (max 20 for multiple genre matches)
      let genreMatches = 0;
      for (const genre of genres) {
        const lowerGenre = genre.toLowerCase();
        if (preferences.favoriteGenres.has(lowerGenre)) {
          genreMatches += preferences.favoriteGenres.get(lowerGenre)!;
        }
      }
      if (genreMatches > 0) {
        genreBoost = Math.min(20, 5 + Math.log2(genreMatches) * 5);
        reasons.push('Matches your favorite genres');
      }

      return {
        authorBoost,
        seriesBoost,
        genreBoost,
        totalBoost: authorBoost + seriesBoost + genreBoost,
        reasons,
      };
    };
  }, [finishedBookIds, preferences]);

  // Filter items to exclude finished books
  const filterUnfinished = useMemo(() => {
    return <T extends LibraryItem>(items: T[]): T[] => {
      return items.filter((item) => !finishedBookIds.has(item.id));
    };
  }, [finishedBookIds]);

  return {
    isFinished,
    hasBeenStarted,
    finishedBookIds,
    preferences,
    getPreferenceBoost,
    filterUnfinished,
    hasHistory: finishedBookIds.size > 0,
  };
}

/**
 * Convenience hook to check if a single book is finished
 * Uses SQLite as single source of truth + server progress fallback
 */
export function useIsBookFinished(bookId: string): boolean {
  const finishedBookIds = useFinishedBookIds();
  const getItem = useLibraryCache((s) => s.getItem);

  return useMemo(() => {
    // Check SQLite first
    if (finishedBookIds.has(bookId)) return true;

    // Check server progress
    const item = getItem(bookId);
    if (item) {
      const progress = item.userMediaProgress?.progress || 0;
      return progress >= FINISHED_THRESHOLD;
    }

    return false;
  }, [finishedBookIds, bookId, getItem]);
}

/**
 * Hook to get count of finished books
 */
export function useFinishedCount(): number {
  const { finishedBookIds } = useReadingHistory();
  return finishedBookIds.size;
}
