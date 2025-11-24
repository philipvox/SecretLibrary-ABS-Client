/**
 * src/features/series/services/seriesAdapter.ts
 * 
 * Adapter for transforming series data from API.
 * Uses metadata utility for consistent data extraction.
 */

import { LibraryItem } from '@/core/types';
import { getDuration } from '@/shared/utils/metadata';

export interface SeriesInfo {
  id: string;
  name: string;
  description?: string;
  bookCount: number;
  totalDuration: number;
  coverUrl?: string;
  books: LibraryItem[];
}

/**
 * Transform API series data to SeriesInfo
 */
export function transformSeries(series: any): SeriesInfo {
  const books = series.books || [];
  
  // Calculate total duration from all books in series
  const totalDuration = books.reduce((sum: number, book: LibraryItem) => {
    return sum + getDuration(book);
  }, 0);

  // Use first book's ID for cover URL
  const firstBookId = books[0]?.id;

  return {
    id: series.id,
    name: series.name,
    description: series.description,
    bookCount: books.length || series.numBooks || 0,
    totalDuration,
    coverUrl: firstBookId,
    books,
  };
}

/**
 * Transform array of series from API
 */
export function transformSeriesList(seriesList: any[]): SeriesInfo[] {
  return seriesList.map(transformSeries);
}

/**
 * Sort series by name or book count
 */
export function sortSeries(
  series: SeriesInfo[],
  sortBy: 'name' | 'bookCount' = 'name'
): SeriesInfo[] {
  return [...series].sort((a, b) => {
    if (sortBy === 'bookCount') return b.bookCount - a.bookCount;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Filter series by search query
 */
export function filterSeries(
  series: SeriesInfo[],
  query: string
): SeriesInfo[] {
  if (!query.trim()) return series;
  const lower = query.toLowerCase();
  return series.filter((s) => s.name.toLowerCase().includes(lower));
}