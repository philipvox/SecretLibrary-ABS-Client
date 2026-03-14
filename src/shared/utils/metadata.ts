/**
 * src/shared/utils/metadata.ts
 *
 * Utility functions for extracting metadata from LibraryItem objects.
 * The AudiobookShelf API returns metadata in a specific structure that
 * differs from what some type definitions expect.
 *
 * Actual API structure:
 * - item.media.metadata.authorName (string)
 * - item.media.metadata.narratorName (string, may include "Narrated by" prefix)
 * - item.media.metadata.description (string)
 * - item.media.duration (number in seconds)
 */

import { LibraryItem, BookMetadata, BookMedia } from '@/core/types';
import { formatDuration } from './format';

/**
 * Type guard for FULL book media with audioFiles.
 *
 * WHEN TO USE:
 * - Playback operations that need audioFiles array
 * - Download operations that need file URLs
 * - Chapter access (chapters only exist on full BookMedia)
 *
 * WHEN NOT TO USE:
 * - Metadata display (title, author, narrator) - use getMetadata() instead
 * - Duration display - use getDuration() instead
 */
export function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  // Check for 'duration' (present on BookMedia) and absence of 'episodes' (PodcastMedia).
  // NOTE: Library items list API omits audioFiles/chapters, so we can't check for those.
  return media !== undefined && 'duration' in media && !('episodes' in media);
}

/**
 * Get chapters from a LibraryItem.
 * Returns empty array if item doesn't have full media data (cache items).
 */
export function getChapters(item: LibraryItem | null | undefined): BookMedia['chapters'] {
  if (!item?.media || !isBookMedia(item.media)) return [];
  return item.media.chapters || [];
}

// Extended metadata interface for narrator fields not in base type
interface ExtendedBookMetadata extends BookMetadata {
  narratorName?: string;
}

// Helper to get book metadata safely with extended fields
// Note: We directly check for metadata without requiring audioFiles,
// since library cache items may not include audioFiles to save space
function getMetadata(item: LibraryItem | null | undefined): ExtendedBookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as ExtendedBookMetadata;
}

// Helper to get book duration safely
function getBookDuration(item: LibraryItem | null | undefined): number {
  if (!item) return 0;
  return item.media?.duration || 0;
}

export interface BookMetadataExtracted {
  title: string;
  subtitle: string | null;
  authorName: string;
  narratorName: string;
  narratorNames: string[];
  seriesName: string | null;
  seriesSequence: string | null;
  description: string;
  genres: string[];
  publishedYear: string | null;
  publisher: string | null;
  duration: number;
  durationFormatted: string;
  language: string | null;
  isbn: string | null;
  asin: string | null;
}

/**
 * Extract all metadata from a LibraryItem in a normalized format
 */
export function extractBookMetadata(item: LibraryItem | null | undefined): BookMetadataExtracted {
  const metadata = getMetadata(item);
  const duration = getBookDuration(item);

  // Get author name - handle both authorName string and authors[] array
  let authorName = 'Unknown Author';
  if (metadata?.authorName) {
    authorName = metadata.authorName;
  } else if (metadata?.authors?.length && metadata.authors.length > 0) {
    authorName = metadata.authors.map((a) => a.name).join(', ');
  }

  // Get narrator name - handle both narratorName string and narrators[] array
  let narratorName = 'Unknown Narrator';
  let narratorNames: string[] = [];
  if (metadata?.narratorName) {
    narratorName = metadata.narratorName.replace(/^Narrated by\s*/i, '').trim();
    narratorNames = narratorName.split(',').map((n) => n.trim()).filter(Boolean);
  } else if (metadata?.narrators?.length && metadata.narrators.length > 0) {
    narratorNames = metadata.narrators.map((n) => typeof n === 'string' ? n : n);
    narratorName = narratorNames.join(', ');
  }

  // Parse series info from seriesName (format: "Series Name #1") or series array
  let seriesNameRaw = metadata?.seriesName || null;
  if (!seriesNameRaw && metadata?.series?.length && metadata.series.length > 0) {
    const firstSeries = metadata.series[0];
    seriesNameRaw = firstSeries.name;
    if (firstSeries.sequence) {
      seriesNameRaw = `${seriesNameRaw} #${firstSeries.sequence}`;
    }
  }

  let parsedSeriesName = seriesNameRaw;
  let seriesSequence: string | null = null;

  if (seriesNameRaw) {
    const match = seriesNameRaw.match(/^(.+?)\s*#(\d+(?:\.\d+)?)$/);
    if (match) {
      parsedSeriesName = match[1].trim();
      seriesSequence = match[2];
    }
  }

  return {
    title: metadata?.title || 'Unknown Title',
    subtitle: metadata?.subtitle || null,
    authorName,
    narratorName: narratorName || 'Unknown Narrator',
    narratorNames,
    seriesName: parsedSeriesName,
    seriesSequence,
    description: metadata?.description || '',
    genres: metadata?.genres || [],
    publishedYear: metadata?.publishedYear || null,
    publisher: metadata?.publisher || null,
    duration,
    durationFormatted: formatDuration(duration),
    language: metadata?.language || null,
    isbn: metadata?.isbn || null,
    asin: metadata?.asin || null,
  };
}

/**
 * Get author name from LibraryItem
 * Handles both authorName string and authors[] array formats
 */
export function getAuthorName(item: LibraryItem | null | undefined): string {
  const metadata = getMetadata(item);
  // Try authorName first, then authors array
  if (metadata?.authorName) return metadata.authorName;
  if (metadata?.authors?.length && metadata.authors.length > 0) {
    return metadata.authors.map((a) => a.name).join(', ');
  }
  return 'Unknown Author';
}

/**
 * Get narrator name from LibraryItem (without "Narrated by" prefix)
 * Handles both narratorName string and narrators[] array formats
 * Also handles narrator objects with { name: string } shape
 */
export function getNarratorName(item: LibraryItem | null | undefined): string {
  const metadata = getMetadata(item);
  // Try narratorName first
  if (metadata?.narratorName) {
    return metadata.narratorName.replace(/^Narrated by\s*/i, '').trim();
  }
  // Then try narrators array
  if (metadata?.narrators?.length && metadata.narrators.length > 0) {
    // Handle both string[] and { name: string }[] formats
    const names = metadata.narrators.map((n: string | { name?: string }) => {
      if (typeof n === 'string') return n;
      if (typeof n === 'object' && n !== null && 'name' in n) return n.name;
      return '';
    }).filter(Boolean);
    return names.join(', ');
  }
  return 'Unknown Narrator';
}

/**
 * Get narrator names as array from LibraryItem
 * Handles both narratorName string and narrators[] array formats
 * Also handles narrator objects with { name: string } shape
 */
export function getNarratorNames(item: LibraryItem | null | undefined): string[] {
  const metadata = getMetadata(item);

  // Try narrators array first (cleaner data)
  if (metadata?.narrators?.length && metadata.narrators.length > 0) {
    // Handle both string[] and { name: string }[] formats
    return metadata.narrators.map((n: string | { name?: string }) => {
      if (typeof n === 'string') return n;
      if (typeof n === 'object' && n !== null && 'name' in n) return n.name || '';
      return '';
    }).filter(Boolean) as string[];
  }

  // Fall back to narratorName string
  const narratorName = getNarratorName(item);
  if (!narratorName || narratorName === 'Unknown Narrator') return [];
  return narratorName.split(',').map((n) => n.trim()).filter(Boolean);
}

/**
 * Get description from LibraryItem
 */
export function getDescription(item: LibraryItem | null | undefined): string {
  const metadata = getMetadata(item);
  return metadata?.description || '';
}

/**
 * Get title from LibraryItem
 */
export function getTitle(item: LibraryItem | null | undefined): string {
  const metadata = getMetadata(item);
  return metadata?.title || 'Unknown Title';
}

/**
 * Get duration in seconds from LibraryItem
 */
export function getDuration(item: LibraryItem | null | undefined): number {
  return getBookDuration(item);
}

/**
 * Get formatted duration from LibraryItem
 */
export function getFormattedDuration(item: LibraryItem | null | undefined): string {
  return formatDuration(getDuration(item));
}

/**
 * Get series name from LibraryItem
 * Handles both seriesName string and series[] array formats
 */
export function getSeriesName(item: LibraryItem | null | undefined): string | null {
  const metadata = getMetadata(item);

  // Try seriesName first
  let seriesName = metadata?.seriesName || null;

  // Then try series array
  if (!seriesName && metadata?.series?.length && metadata.series.length > 0) {
    const firstSeries = metadata.series[0];
    seriesName = firstSeries.name || null;
  }

  if (!seriesName) return null;

  // Remove sequence number if present
  const match = seriesName.match(/^(.+?)\s*#\d+(?:\.\d+)?$/);
  return match ? match[1].trim() : seriesName;
}

/**
 * Get series with sequence (e.g., "Series Name #1")
 * Handles both seriesName string and series[] array formats
 */
export function getSeriesWithSequence(item: LibraryItem | null | undefined): string | null {
  const metadata = getMetadata(item);

  // Try seriesName first
  if (metadata?.seriesName) return metadata.seriesName;

  // Then try series array
  if (metadata?.series?.length && metadata.series.length > 0) {
    const firstSeries = metadata.series[0];
    const name = firstSeries.name;
    if (firstSeries.sequence) {
      return `${name} #${firstSeries.sequence}`;
    }
    return name || null;
  }

  return null;
}

/**
 * Get published year from LibraryItem
 */
export function getPublishedYear(item: LibraryItem | null | undefined): string | null {
  const metadata = getMetadata(item);
  return metadata?.publishedYear || null;
}

/**
 * Get genres from LibraryItem
 */
export function getGenres(item: LibraryItem | null | undefined): string[] {
  const metadata = getMetadata(item);
  return metadata?.genres || [];
}

/**
 * Get tags from LibraryItem.
 * Tags are stored on item.media.tags (not metadata.tags).
 */
export function getTags(item: LibraryItem | null | undefined): string[] {
  if (!item?.media) return [];
  // Tags are stored directly on media, not in metadata
  return (item.media as any).tags || [];
}

/**
 * Alias for extractBookMetadata - get all book metadata in a normalized format
 *
 * This is the recommended function for getting book metadata.
 * It handles all the `as any` casting internally and returns
 * a typed BookMetadataExtracted object.
 *
 * @example
 * const meta = getBookMetadata(book);
 * console.log(meta.title, meta.authorName, meta.duration);
 */
export const getBookMetadata = extractBookMetadata;