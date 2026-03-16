/**
 * src/features/discover/hooks/discoverUtils.ts
 *
 * Shared utility functions and constants for discover hooks.
 */

import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { Mood } from '@/shared/utils/bookDNA';
import { BookSummary, libraryItemToBookSummary } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const SHORT_BOOK_THRESHOLD = 5 * 60 * 60; // 5 hours in seconds
export const LONG_BOOK_THRESHOLD = 10 * 60 * 60; // 10 hours in seconds
export const MAX_RECOMMENDATION_GROUPS = 3; // Priorities 2.0, 2.3, 2.6

// ============================================================================
// TIME-BASED HELPERS
// ============================================================================

/** Get context-aware recommendation reason based on time of day */
export function getTimeBasedReason(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Perfect for your morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Great for your afternoon';
  } else if (hour >= 17 && hour < 21) {
    return 'Perfect for your evening';
  } else {
    return 'Perfect for winding down';
  }
}

// ============================================================================
// MOOD HELPERS
// ============================================================================

/** Get a natural adjective for mood types */
export function getMoodAdjective(mood?: Mood): string {
  switch (mood) {
    case 'comfort': return 'Cozy';
    case 'thrills': return 'Thrilling';
    case 'escape': return 'Escapist';
    case 'feels': return 'Emotional';
    default: return '';
  }
}

/** Generate mood-aware category title */
export function getMoodCategoryTitle(
  baseTitle: string,
  mood?: Mood
): string {
  const moodAdjective = getMoodAdjective(mood);
  if (!moodAdjective) return baseTitle;

  switch (baseTitle) {
    case 'Not Started':
      return `${moodAdjective} Adventures Await`;
    case 'New This Week':
      return `New ${moodAdjective} Arrivals`;
    case 'Short & Sweet':
      return `Quick ${moodAdjective} Listens`;
    case 'Long Listens':
      return `Epic ${moodAdjective} Journeys`;
    default:
      return baseTitle;
  }
}

// ============================================================================
// GENRE HELPERS
// ============================================================================

/** Word-boundary genre matching to prevent over-matching */
export function genreMatches(itemGenre: string, filterGenre: string): boolean {
  const item = itemGenre.toLowerCase();

  // Exact match
  if (item === filterGenre) return true;

  // Starts with filter + space ("mystery" matches "mystery thriller")
  if (item.startsWith(filterGenre + ' ')) return true;

  // Ends with space + filter ("cozy mystery" matches "mystery")
  if (item.endsWith(' ' + filterGenre)) return true;

  // Contains space + filter + space ("epic fantasy adventure" matches "fantasy")
  if (item.includes(' ' + filterGenre + ' ')) return true;

  return false;
}

/** Filter items by genre */
export function filterItemsByGenre(items: LibraryItem[], genre: string): LibraryItem[] {
  if (genre === 'All') return items;

  const filterGenre = genre.toLowerCase();

  return items.filter(item => {
    const metadata = (item.media?.metadata as any) || {};
    const genres: string[] = metadata.genres || [];
    return genres.some(g => genreMatches(g, filterGenre));
  });
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/** Convert library item to book summary */
export function convertItemToBookSummary(
  item: LibraryItem,
  downloadedIds: Set<string>,
  progress?: number
): BookSummary {
  const coverUrl = apiClient.getItemCoverUrl(item.id);
  const isDownloaded = downloadedIds.has(item.id);
  return libraryItemToBookSummary(item, coverUrl, { isDownloaded, progress });
}
