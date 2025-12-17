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
export { Icon } from './Icon';
export { FilterSortBar } from './FilterSortBar';
export type { SortOption } from './FilterSortBar';

// =============================================================================
// SKELETON LOADING
// =============================================================================
export { Shimmer } from './Skeleton';

// =============================================================================
// GESTURE COMPONENTS
// =============================================================================
export { Swipeable } from './GestureComponents';

// =============================================================================
// OFFLINE-FIRST
// =============================================================================
export { SyncStatusBadge } from './SyncStatusBadge';
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
