/**
 * src/features/discover/types.ts
 *
 * Type definitions for the Discover page based on UX spec
 */

import { LibraryItem } from '@/core/types';

// Row types for content carousels
export type RowType =
  | 'continue_listening'
  | 'because_you_liked'
  | 'new_this_week'
  | 'popular'
  | 'genre_recommendation'
  | 'staff_picks'
  | 'first_listens'
  | 'short_books'
  | 'narrator_follow'
  | 'series_continue'
  | 'browse_category';

// Content Row model
export interface ContentRow {
  id: string;
  type: RowType;
  title: string;
  subtitle?: string;           // e.g., "Because you liked..."
  items: BookSummary[];
  totalCount: number;          // For "See All" badge
  seeAllRoute?: string;        // Navigation target
  priority: number;            // For ordering
  refreshPolicy: 'realtime' | 'hourly' | 'daily';
}

// Book Summary for cards (lighter than full LibraryItem)
export interface BookSummary {
  id: string;
  title: string;
  author: string;
  narrator?: string;
  coverUrl: string;
  duration: number;            // seconds
  rating?: number;             // 0-5
  ratingCount?: number;
  genres: string[];
  addedDate: number;           // timestamp

  // User-specific
  progress?: number;           // 0-1, if in progress
  isDownloaded: boolean;
  queuePosition?: number;
}

// Category for browse grid
export interface Category {
  id: string;
  name: string;
  icon: string;                // Icon name
  count?: number;              // Number of titles
}

// Filter chip
export interface FilterChip {
  id: string;
  label: string;
  value: string;
  isActive: boolean;
}

// Hero recommendation
export interface HeroRecommendation {
  book: BookSummary;
  reason: string;              // "Perfect for your evening commute"
  type: 'personalized' | 'popular' | 'new' | 'staff_pick';
}

// Discover page state
export interface DiscoverState {
  rows: ContentRow[];
  hero?: HeroRecommendation;
  selectedGenre: string | null;
  isLoading: boolean;
  error: string | null;
}

// Convert LibraryItem to BookSummary
export function libraryItemToBookSummary(
  item: LibraryItem,
  coverUrl: string,
  options?: {
    isDownloaded?: boolean;
    progress?: number;
    queuePosition?: number;
  }
): BookSummary {
  const metadata = (item.media?.metadata as any) || {};
  const media = item.media as any;

  return {
    id: item.id,
    title: metadata.title || 'Untitled',
    author: metadata.authorName || metadata.authors?.[0]?.name || '',
    narrator: metadata.narratorName || metadata.narrators?.[0] || undefined,
    coverUrl,
    duration: media?.duration || 0,
    rating: metadata.rating || undefined,
    ratingCount: metadata.ratingCount || undefined,
    genres: metadata.genres || [],
    addedDate: item.addedAt || 0,
    progress: options?.progress,
    isDownloaded: options?.isDownloaded || false,
    queuePosition: options?.queuePosition,
  };
}

// Default categories
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'fiction', name: 'Fiction', icon: 'book-outline' },
  { id: 'mystery', name: 'Mystery', icon: 'search-outline' },
  { id: 'sci-fi', name: 'Sci-Fi', icon: 'planet-outline' },
  { id: 'romance', name: 'Romance', icon: 'heart-outline' },
  { id: 'business', name: 'Business', icon: 'briefcase-outline' },
  { id: 'history', name: 'History', icon: 'time-outline' },
  { id: 'self-help', name: 'Self-Help', icon: 'bulb-outline' },
  { id: 'biography', name: 'Biography', icon: 'person-outline' },
];

// Genre chips for quick filter
export const GENRE_CHIPS = [
  'All',
  'Fiction',
  'Non-Fiction',
  'Mystery',
  'Sci-Fi',
  'Romance',
  'Self-Help',
  'History',
];
