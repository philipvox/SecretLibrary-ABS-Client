/**
 * Public API exports for shared components
 *
 * Organization:
 * - buttons/  → Button, IconButton
 * - inputs/   → TextInput, SearchInput
 * - feedback/ → LoadingSpinner, ErrorView, EmptyState
 */

// =============================================================================
// BUTTONS
// =============================================================================
export { Button } from './Button';
export { IconButton } from './buttons/IconButton';

// =============================================================================
// INPUTS
// =============================================================================
export { TextInput } from './inputs/TextInput';
export { SearchInput } from './inputs/SearchInput';

// =============================================================================
// FEEDBACK & STATES
// =============================================================================
export { LoadingSpinner } from './LoadingSpinner';
export { ErrorView } from './ErrorView';
export type { ErrorType } from './ErrorView';
export { EmptyState } from './EmptyState';
export type { EmptyStateIcon } from './EmptyState';

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================
export { Icon, ICON_SIZES } from './Icon';
export type { IconSize } from './Icon';
export { FilterSortBar } from './FilterSortBar';
export type { SortOption } from './FilterSortBar';

// =============================================================================
// SKELETON LOADING
// =============================================================================
export {
  Shimmer,
  SkeletonBox,
  SkeletonCircle,
  SkeletonText,
  BookCardSkeleton,
  ContinueListeningCardSkeleton,
  ListRowSkeleton,
  SectionSkeleton,
  HomeHeroSkeleton,
  BookDetailSkeleton,
  AuthorRowSkeleton,
  SearchResultsSkeleton,
} from './Skeleton';

// =============================================================================
// OFFLINE-FIRST
// =============================================================================
export { CircularDownloadButton } from './CircularDownloadButton';

// =============================================================================
// INTERACTIVE BUTTONS
// =============================================================================
export { HeartButton, HeartIcon } from './HeartButton';
export type { HeartButtonProps } from './HeartButton';
export { SeriesHeartButton } from './SeriesHeartButton';
export type { SeriesHeartButtonProps } from './SeriesHeartButton';

// =============================================================================
// BOOK CARDS
// =============================================================================
export { BookCard, BookCardWithState } from './BookCard';
export type { BookCardProps, BookCardActionType, BookCardContext } from './BookCard';

// =============================================================================
// PLAYER CONTROLS
// =============================================================================
export { CoverPlayButton } from './CoverPlayButton';

// =============================================================================
// NAVIGATION
// =============================================================================
export { AlphabetScrubber } from './AlphabetScrubber';

// =============================================================================
// PROGRESS INDICATORS
// =============================================================================
export { ProgressDots } from './ProgressDots';
export { SeriesProgressBadge } from './SeriesProgressBadge';
export { ThumbnailProgressBar } from './ThumbnailProgressBar';

// =============================================================================
// STACKED COVERS
// =============================================================================
export { StackedCovers } from './StackedCovers';

// =============================================================================
// SERIES CARDS
// =============================================================================
export { SeriesCard } from './SeriesCard';
export type {
  SeriesCardProps,
  SeriesData,
  SeriesBook,
  EnhancedSeriesData,
  BookStatus,
} from './SeriesCard';

// =============================================================================
// ENTITY CARDS (Author/Narrator)
// =============================================================================
export { EntityCard } from './EntityCard';
export type { EntityCardProps, EntityType } from './EntityCard';

// =============================================================================
// NETWORK STATUS
// =============================================================================
export { NetworkStatusBar, useNetworkStatus } from './NetworkStatusBar';

// =============================================================================
// SNACKBAR / TOAST
// =============================================================================
export { Snackbar, useSnackbar } from './Snackbar';
export type { SnackbarProps } from './Snackbar';

// =============================================================================
// CONTEXT MENUS
// =============================================================================
export { BookContextMenu } from './BookContextMenu';

// =============================================================================
// GLOBAL TOAST
// =============================================================================
export { ToastContainer } from './ToastContainer';

// =============================================================================
// PIN INPUT
// =============================================================================
export { PinInput } from './PinInput';
export type { PinInputProps } from './PinInput';
