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

import { LibraryItem } from '@/core/types';

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
  const metadata = (item?.media?.metadata as any) || {};
  const duration = item?.media?.duration || 0;

  // Parse narrator name - remove "Narrated by" prefix and split by comma
  const rawNarratorName = metadata.narratorName || '';
  const cleanedNarratorName = rawNarratorName.replace(/^Narrated by\s*/i, '').trim();
  const narratorNames = cleanedNarratorName
    ? cleanedNarratorName.split(',').map((n: string) => n.trim()).filter(Boolean)
    : [];

  // Parse series info from seriesName (format: "Series Name #1")
  const seriesName = metadata.seriesName || null;
  let parsedSeriesName = seriesName;
  let seriesSequence: string | null = null;
  
  if (seriesName) {
    const match = seriesName.match(/^(.+?)\s*#(\d+(?:\.\d+)?)$/);
    if (match) {
      parsedSeriesName = match[1].trim();
      seriesSequence = match[2];
    }
  }

  return {
    title: metadata.title || 'Unknown Title',
    subtitle: metadata.subtitle || null,
    authorName: metadata.authorName || 'Unknown Author',
    narratorName: cleanedNarratorName || 'Unknown Narrator',
    narratorNames,
    seriesName: parsedSeriesName,
    seriesSequence,
    description: metadata.description || '',
    genres: metadata.genres || [],
    publishedYear: metadata.publishedYear || null,
    publisher: metadata.publisher || null,
    duration,
    durationFormatted: formatDuration(duration),
    language: metadata.language || null,
    isbn: metadata.isbn || null,
    asin: metadata.asin || null,
  };
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) {
    return 'Unknown';
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get author name from LibraryItem
 */
export function getAuthorName(item: LibraryItem | null | undefined): string {
  const metadata = (item?.media?.metadata as any) || {};
  return metadata.authorName || 'Unknown Author';
}

/**
 * Get narrator name from LibraryItem (without "Narrated by" prefix)
 */
export function getNarratorName(item: LibraryItem | null | undefined): string {
  const metadata = (item?.media?.metadata as any) || {};
  const raw = metadata.narratorName || '';
  return raw.replace(/^Narrated by\s*/i, '').trim() || 'Unknown Narrator';
}

/**
 * Get narrator names as array from LibraryItem
 */
export function getNarratorNames(item: LibraryItem | null | undefined): string[] {
  const narratorName = getNarratorName(item);
  if (!narratorName || narratorName === 'Unknown Narrator') return [];
  return narratorName.split(',').map((n: string) => n.trim()).filter(Boolean);
}

/**
 * Get description from LibraryItem
 */
export function getDescription(item: LibraryItem | null | undefined): string {
  const metadata = (item?.media?.metadata as any) || {};
  return metadata.description || '';
}

/**
 * Get title from LibraryItem
 */
export function getTitle(item: LibraryItem | null | undefined): string {
  const metadata = (item?.media?.metadata as any) || {};
  return metadata.title || 'Unknown Title';
}

/**
 * Get duration in seconds from LibraryItem
 */
export function getDuration(item: LibraryItem | null | undefined): number {
  return item?.media?.duration || 0;
}

/**
 * Get formatted duration from LibraryItem
 */
export function getFormattedDuration(item: LibraryItem | null | undefined): string {
  return formatDuration(getDuration(item));
}

/**
 * Get series name from LibraryItem
 */
export function getSeriesName(item: LibraryItem | null | undefined): string | null {
  const metadata = (item?.media?.metadata as any) || {};
  const seriesName = metadata.seriesName || null;
  if (!seriesName) return null;
  
  // Remove sequence number if present
  const match = seriesName.match(/^(.+?)\s*#\d+(?:\.\d+)?$/);
  return match ? match[1].trim() : seriesName;
}

/**
 * Get series with sequence (e.g., "Series Name #1")
 */
export function getSeriesWithSequence(item: LibraryItem | null | undefined): string | null {
  const metadata = (item?.media?.metadata as any) || {};
  return metadata.seriesName || null;
}

/**
 * Get published year from LibraryItem
 */
export function getPublishedYear(item: LibraryItem | null | undefined): string | null {
  const metadata = (item?.media?.metadata as any) || {};
  return metadata.publishedYear || null;
}

/**
 * Get genres from LibraryItem
 */
export function getGenres(item: LibraryItem | null | undefined): string[] {
  const metadata = (item?.media?.metadata as any) || {};
  return metadata.genres || [];
}