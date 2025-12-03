/**
 * src/features/home/types.ts
 *
 * TypeScript interfaces for the Home screen feature
 */

import { LibraryItem, Playlist } from '@/core/types';

// =============================================================================
// PLAYBACK PROGRESS
// =============================================================================

/**
 * User's progress on a library item
 */
export interface PlaybackProgress {
  /** Current position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Progress as 0-1 */
  progress: number;
  /** Whether the item is finished */
  isFinished: boolean;
  /** Unix timestamp of last update */
  lastUpdate: number;
}

// =============================================================================
// SERIES
// =============================================================================

/**
 * Series with associated books for display
 */
export interface SeriesWithBooks {
  id: string;
  name: string;
  /** First 4 books for cover stack display */
  books: LibraryItem[];
  totalBooks: number;
  booksCompleted: number;
  booksInProgress: number;
  isFavorite: boolean;
}

// =============================================================================
// PLAYLIST (Extended)
// =============================================================================

/**
 * Extended playlist with computed display properties
 */
export interface PlaylistDisplay extends Playlist {
  /** Total duration in seconds */
  totalDuration: number;
  isFavorite: boolean;
}

// =============================================================================
// HOOK RETURN TYPES
// =============================================================================

/**
 * Return type for useHomeData hook
 */
export interface UseHomeDataReturn {
  // Now playing
  currentBook: LibraryItem | null;
  currentProgress: PlaybackProgress | null;

  // Carousels
  recentBooks: LibraryItem[];
  userSeries: SeriesWithBooks[];
  userPlaylists: PlaylistDisplay[];

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;

  // Actions
  refresh: () => Promise<void>;
}

/**
 * Return type for useRecentBooks hook
 */
export interface UseRecentBooksReturn {
  books: LibraryItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Options for useRecentBooks hook
 */
export interface UseRecentBooksOptions {
  limit?: number;
  includeFinished?: boolean;
  /** Exclude this book ID (usually the "now playing" book) */
  excludeId?: string;
}

/**
 * Return type for useUserSeries hook
 */
export interface UseUserSeriesReturn {
  series: SeriesWithBooks[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Return type for useUserPlaylists hook
 */
export interface UseUserPlaylistsReturn {
  playlists: PlaylistDisplay[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

/**
 * Props for NowPlayingCard component
 */
export interface NowPlayingCardProps {
  book: LibraryItem;
  progress: PlaybackProgress | null;
  isPlaying: boolean;
  playbackSpeed: number;
  /** Minutes remaining, null if off */
  sleepTimer: number | null;
  onPress: () => void;
  onPlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
}

/**
 * Props for MiniControls component
 */
export interface MiniControlsProps {
  isPlaying: boolean;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onPlayPause: () => void;
}

/**
 * Props for SectionHeader component
 */
export interface SectionHeaderProps {
  title: string;
  onViewAll?: () => void;
  showViewAll?: boolean;
}

/**
 * Props for HorizontalCarousel component
 */
export interface HorizontalCarouselProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  itemWidth: number;
  gap?: number;
  contentPadding?: number;
  showsScrollIndicator?: boolean;
  snapToItem?: boolean;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
}

/**
 * Props for BookCard component
 */
export interface BookCardProps {
  book: LibraryItem;
  onPress: () => void;
  onLongPress?: () => void;
  isFavorite?: boolean;
  showProgress?: boolean;
  /** Progress 0-1 */
  progress?: number;
}

/**
 * Props for SeriesCard component
 */
export interface SeriesCardProps {
  series: SeriesWithBooks;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * Props for PlaylistCard component
 */
export interface PlaylistCardProps {
  playlist: PlaylistDisplay;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * Props for HeartBadge component
 */
export interface HeartBadgeProps {
  isFavorite: boolean;
  size?: number;
  onPress?: () => void;
  style?: any;
}

/**
 * Props for CoverStack component (series covers)
 */
export interface CoverStackProps {
  covers: string[];
  size?: number;
  overlap?: number;
}

/**
 * Props for CoverGrid component (playlist covers)
 */
export interface CoverGridProps {
  covers: string[];
  size?: number;
  gap?: number;
}

/**
 * Props for EmptyState component
 */
export interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// =============================================================================
// NAVIGATION
// =============================================================================

/**
 * Navigation param list for home-related screens
 */
export type HomeStackParamList = {
  Home: undefined;
  Player: undefined;
  SeriesDetail: { id: string; name?: string };
  PlaylistDetail: { id: string };
  LibraryItems: { filter?: 'in-progress' | 'downloaded' | 'all' };
  Playlists: undefined;
};
