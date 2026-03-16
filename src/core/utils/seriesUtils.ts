/**
 * src/core/utils/seriesUtils.ts
 *
 * Utility functions for working with book series.
 * Used for auto-downloading next book in series.
 */

import { LibraryItem } from '@/core/types';
import { logger } from '@/shared/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface SeriesInfo {
  id: string;
  name: string;
  sequence: number | null;
}

// =============================================================================
// SERIES UTILITIES
// =============================================================================

/**
 * Extract series information from a book's metadata.
 * Returns the first (primary) series if book is in multiple series.
 */
export function getSeriesInfo(item: LibraryItem): SeriesInfo | null {
  try {
    const metadata = item.media?.metadata as any;
    if (!metadata) return null;

    // Series can be an array of { id, name, sequence }
    const series = metadata.series;
    if (!series || !Array.isArray(series) || series.length === 0) {
      return null;
    }

    const primarySeries = series[0];
    if (!primarySeries.id || !primarySeries.name) {
      return null;
    }

    // Parse sequence number
    let sequence: number | null = null;
    if (primarySeries.sequence !== undefined && primarySeries.sequence !== null) {
      const parsed = parseFloat(primarySeries.sequence);
      if (!isNaN(parsed)) {
        sequence = parsed;
      }
    }

    return {
      id: primarySeries.id,
      name: primarySeries.name,
      sequence,
    };
  } catch (err) {
    logger.warn('[seriesUtils] Error extracting series info:', err);
    return null;
  }
}

/**
 * Find the next book in a series after the given book.
 *
 * @param currentBook The book currently being listened to
 * @param allItems All library items to search through
 * @returns The next book in the series, or null if not found
 */
export function findNextInSeries(
  currentBook: LibraryItem,
  allItems: LibraryItem[]
): LibraryItem | null {
  const currentSeriesInfo = getSeriesInfo(currentBook);

  if (!currentSeriesInfo) {
    // Book is not in a series
    return null;
  }

  if (currentSeriesInfo.sequence === null) {
    // Book has no sequence number, can't determine next
    logger.debug('[seriesUtils] Current book has no sequence number');
    return null;
  }

  logger.debug(`[seriesUtils] Looking for next book in series "${currentSeriesInfo.name}" after sequence ${currentSeriesInfo.sequence}`);

  // Find all books in the same series with sequence numbers
  const seriesBooks: { item: LibraryItem; sequence: number }[] = [];

  for (const item of allItems) {
    if (item.id === currentBook.id) continue; // Skip current book

    const itemSeriesInfo = getSeriesInfo(item);
    if (!itemSeriesInfo) continue;
    if (itemSeriesInfo.id !== currentSeriesInfo.id) continue;
    if (itemSeriesInfo.sequence === null) continue;

    seriesBooks.push({
      item,
      sequence: itemSeriesInfo.sequence,
    });
  }

  if (seriesBooks.length === 0) {
    logger.debug('[seriesUtils] No other books found in series');
    return null;
  }

  // Sort by sequence number
  seriesBooks.sort((a, b) => a.sequence - b.sequence);

  // Find the book with the smallest sequence greater than current
  for (const book of seriesBooks) {
    if (book.sequence > currentSeriesInfo.sequence) {
      const title = (book.item.media?.metadata as any)?.title || 'Unknown';
      logger.debug(`[seriesUtils] Found next book: "${title}" (sequence ${book.sequence})`);
      return book.item;
    }
  }

  logger.debug('[seriesUtils] Current book is the last in series');
  return null;
}

/**
 * Get all books in a series, sorted by sequence.
 */
export function getSeriesBooks(
  seriesId: string,
  allItems: LibraryItem[]
): { item: LibraryItem; sequence: number | null }[] {
  const seriesBooks: { item: LibraryItem; sequence: number | null }[] = [];

  for (const item of allItems) {
    const itemSeriesInfo = getSeriesInfo(item);
    if (!itemSeriesInfo) continue;
    if (itemSeriesInfo.id !== seriesId) continue;

    seriesBooks.push({
      item,
      sequence: itemSeriesInfo.sequence,
    });
  }

  // Sort by sequence (nulls at end)
  seriesBooks.sort((a, b) => {
    if (a.sequence === null && b.sequence === null) return 0;
    if (a.sequence === null) return 1;
    if (b.sequence === null) return -1;
    return a.sequence - b.sequence;
  });

  return seriesBooks;
}
