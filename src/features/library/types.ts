/**
 * src/features/library/types.ts
 *
 * Shared types for the Library feature.
 */

import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { type LucideIcon } from 'lucide-react-native';

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media;
}

// ============================================================================
// TAB TYPES
// ============================================================================

/** Available tab identifiers */
export type TabType = 'all' | 'downloaded' | 'in-progress' | 'not-started' | 'completed' | 'favorites';

/** Tab configuration */
export interface TabConfig {
  id: TabType;
  label: string;
  Icon: LucideIcon;
}

/** Tab labels for display */
export const TAB_LABELS: Record<TabType, string> = {
  'all': 'All',
  'downloaded': 'Downloaded',
  'in-progress': 'In Progress',
  'not-started': 'Not Started',
  'completed': 'Finished',
  'favorites': 'Favorites',
};

/** Ordered tabs for display */
export const TAB_ORDER: TabType[] = ['all', 'downloaded', 'in-progress', 'completed', 'favorites'];

// ============================================================================
// BOOK TYPES
// ============================================================================

/** Enriched book with metadata for display */
export interface EnrichedBook {
  id: string;
  item: LibraryItem;
  title: string;
  author: string;
  seriesName: string;
  sequence?: number;
  progress: number;
  duration: number;
  totalBytes: number;
  lastPlayedAt?: number;
  addedAt?: number;
  isDownloaded?: boolean;
}

/** Series group with aggregated data */
export interface SeriesGroup {
  name: string;
  books: EnrichedBook[];
  totalBooks: number;
  downloadedCount: number;
  completedCount: number;
  inProgressCount: number;
}

/** Fanned series card data */
export interface FannedSeriesCardData {
  name: string;
  books: { id: string }[];
  bookCount?: number;
}

// ============================================================================
// PROPS TYPES
// ============================================================================

/** Common props for all tab components */
export interface LibraryTabProps {
  onBookPress: (bookId: string) => void;
  onSeriesPress: (seriesName: string) => void;
  onAuthorPress?: (authorName: string) => void;
  onNarratorPress?: (narratorName: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  searchQuery?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Extract metadata safely from LibraryItem */
export function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

/** Get progress from item */
export function getProgress(item: LibraryItem): number {
  return item.userMediaProgress?.progress || 0;
}

/** Get duration from item */
export function getDuration(item: LibraryItem): number {
  if (!isBookMedia(item.media)) return 0;
  return item.media.duration || 0;
}

/** Format time remaining */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/** Format duration */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Extract series metadata from series name string */
export function extractSeriesMetadata(seriesName: string): { cleanName: string; sequence?: number } {
  if (!seriesName) return { cleanName: '' };
  const match = seriesName.match(/^(.+?)\s*#([\d.]+)$/);
  if (match) {
    return {
      cleanName: match[1].trim(),
      sequence: parseFloat(match[2]),
    };
  }
  return { cleanName: seriesName };
}

/** Format timestamp as relative time (e.g., "2 hours ago") */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return months === 1 ? '1 month ago' : `${months} months ago`;
  if (weeks > 0) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`;
  if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes > 0) return minutes === 1 ? '1 min ago' : `${minutes} min ago`;
  return 'Just now';
}
