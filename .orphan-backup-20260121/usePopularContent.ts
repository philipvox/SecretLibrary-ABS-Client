/**
 * src/features/discover/hooks/usePopularContent.ts
 *
 * Hook for popular/trending content rows.
 * Returns: New This Week, Short & Sweet, Long Listens, Not Started, Continue Series.
 */

import { useMemo } from 'react';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { MoodSession } from '@/features/mood-discovery/types';
import { ContentRow, BookSummary } from '../types';
import { ONE_WEEK_MS, SHORT_BOOK_THRESHOLD, LONG_BOOK_THRESHOLD, getMoodCategoryTitle } from './discoverUtils';

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media;
}

// Helper to get book duration
function getBookDuration(item: LibraryItem): number {
  return isBookMedia(item.media) ? item.media.duration || 0 : 0;
}

// Helper to get book metadata
function getBookMetadata(item: LibraryItem): BookMetadata | null {
  if (item.mediaType !== 'book' || !item.media?.metadata) return null;
  return item.media.metadata as BookMetadata;
}

interface UsePopularContentProps {
  libraryItems: LibraryItem[];
  inProgressItems: LibraryItem[];
  isLoaded: boolean;
  selectedGenre: string;
  filterByGenre: (items: LibraryItem[], genre: string) => LibraryItem[];
  filterByMood: (items: LibraryItem[], minMatchPercent?: number) => LibraryItem[];
  convertToBookSummary: (item: LibraryItem) => BookSummary;
  isFinished: (bookId: string) => boolean;
  isSeriesAppropriate: (item: LibraryItem) => boolean;
  hasMoodSession: boolean;
  moodSession?: MoodSession | null;
}

export function usePopularContent(props: UsePopularContentProps) {
  const { libraryItems, inProgressItems, isLoaded, selectedGenre, filterByGenre, filterByMood,
    convertToBookSummary, isFinished, isSeriesAppropriate, hasMoodSession, moodSession } = props;

  // Helper to apply common filters and convert to summaries
  const processItems = (items: LibraryItem[], moodThreshold = 30) => {
    let filtered = filterByGenre(items, selectedGenre);
    if (hasMoodSession && moodSession) filtered = filterByMood(filtered, moodThreshold);
    return filtered.length ? filtered.slice(0, 15).map(convertToBookSummary) : null;
  };

  // Helper to get title with mood awareness
  const getTitle = (base: string, fallback: string) =>
    hasMoodSession && moodSession ? getMoodCategoryTitle(base, moodSession) : fallback;

  const newThisWeekRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length) return null;
    const oneWeekAgo = Date.now() - ONE_WEEK_MS;
    const filtered = libraryItems
      .filter(item => (item.addedAt || 0) * 1000 > oneWeekAgo && !isFinished(item.id))
      .filter(isSeriesAppropriate).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const items = processItems(filtered);
    if (!items) return null;
    return { id: 'new_this_week', type: 'new_this_week', title: getTitle('New This Week', 'New This Week'),
      subtitle: 'Recently added to your library', items, totalCount: filtered.length, seeAllRoute: 'FilteredBooks',
      filterType: hasMoodSession ? 'mood_matched' : 'new_this_week',
      filterParams: { genre: selectedGenre !== 'All' ? selectedGenre : undefined },
      priority: 3, refreshPolicy: 'daily', displayMode: 'carousel' };
  }, [libraryItems, isLoaded, selectedGenre, filterByGenre, filterByMood, convertToBookSummary, hasMoodSession, moodSession, isFinished, isSeriesAppropriate]);

  const shortBooksRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length) return null;
    const filtered = libraryItems
      .filter(item => { const d = getBookDuration(item); return d > 0 && d < SHORT_BOOK_THRESHOLD; })
      .filter(item => !isFinished(item.id)).filter(isSeriesAppropriate).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const items = processItems(filtered);
    if (!items) return null;
    return { id: 'short_books', type: 'short_books', title: getTitle('Short & Sweet', 'Quick Listens'),
      subtitle: 'Finish in a day or two', items, totalCount: filtered.length, seeAllRoute: 'FilteredBooks',
      filterType: hasMoodSession ? 'mood_matched' : 'short_books',
      filterParams: { genre: selectedGenre !== 'All' ? selectedGenre : undefined },
      priority: 8, refreshPolicy: 'daily', displayMode: 'carousel' };
  }, [libraryItems, isLoaded, selectedGenre, filterByGenre, filterByMood, convertToBookSummary, hasMoodSession, moodSession, isFinished, isSeriesAppropriate]);

  const longBooksRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length) return null;
    const filtered = libraryItems
      .filter(item => getBookDuration(item) >= LONG_BOOK_THRESHOLD)
      .filter(item => !isFinished(item.id)).filter(isSeriesAppropriate)
      .sort((a, b) => getBookDuration(b) - getBookDuration(a));
    const items = processItems(filtered);
    if (!items) return null;
    return { id: 'long_listens', type: 'first_listens', title: getTitle('Long Listens', 'Epic Journeys'),
      subtitle: 'Settle in for the long haul', items, totalCount: filtered.length, seeAllRoute: 'FilteredBooks',
      filterType: hasMoodSession ? 'mood_matched' : 'long_listens',
      filterParams: { genre: selectedGenre !== 'All' ? selectedGenre : undefined },
      priority: 9, refreshPolicy: 'daily', displayMode: 'carousel' };
  }, [libraryItems, isLoaded, selectedGenre, filterByGenre, filterByMood, convertToBookSummary, hasMoodSession, moodSession, isFinished, isSeriesAppropriate]);

  const notStartedRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length) return null;
    const filtered = libraryItems.filter(item => !isFinished(item.id)).filter(isSeriesAppropriate)
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const items = processItems(filtered);
    if (!items) return null;
    return { id: 'not_started', type: 'first_listens', title: getTitle('Not Started', 'Next in Your Series'),
      subtitle: hasMoodSession ? 'Matching your mood' : 'Start your next adventure', items, totalCount: filtered.length,
      seeAllRoute: 'FilteredBooks', filterType: hasMoodSession ? 'mood_matched' : 'not_started',
      filterParams: { genre: selectedGenre !== 'All' ? selectedGenre : undefined },
      priority: 5, refreshPolicy: 'daily', displayMode: 'carousel' };
  }, [libraryItems, isLoaded, selectedGenre, filterByGenre, filterByMood, convertToBookSummary, hasMoodSession, moodSession, isFinished, isSeriesAppropriate]);

  const continueSeriesRow = useMemo((): ContentRow | null => {
    if (!isLoaded || !libraryItems.length || !inProgressItems.length) return null;
    const seriesProgress = new Map<string, number>();
    for (const item of inProgressItems) {
      const series = getBookMetadata(item)?.series?.[0];
      if (series?.name && series?.sequence) {
        const seq = parseFloat(series.sequence) || 0;
        if (!seriesProgress.has(series.name) || seq > seriesProgress.get(series.name)!) {
          seriesProgress.set(series.name, seq);
        }
      }
    }
    if (!seriesProgress.size) return null;
    let nextBooks = Array.from(seriesProgress.entries()).map(([name, maxSeq]) =>
      libraryItems.find(item => {
        const s = getBookMetadata(item)?.series?.[0];
        return s?.name === name && (parseFloat(s.sequence || '0') || 0) > maxSeq && !isFinished(item.id);
      })
    ).filter((item): item is LibraryItem => !!item);
    if (hasMoodSession && moodSession) nextBooks = filterByMood(nextBooks, 20);
    if (!nextBooks.length) return null;
    const items = nextBooks.slice(0, 15).map(convertToBookSummary);
    return { id: 'continue_series', type: 'series_continue', title: getTitle('Continue Series', 'Your Next Chapter'),
      subtitle: hasMoodSession ? 'Series matching your mood' : 'Continue where you left off', items,
      totalCount: nextBooks.length, seeAllRoute: 'FilteredBooks', filterType: 'continue_series',
      priority: 4, refreshPolicy: 'realtime', displayMode: 'carousel' };
  }, [libraryItems, inProgressItems, isLoaded, convertToBookSummary, hasMoodSession, moodSession, filterByMood, isFinished]);

  return { newThisWeekRow, shortBooksRow, longBooksRow, notStartedRow, continueSeriesRow };
}
