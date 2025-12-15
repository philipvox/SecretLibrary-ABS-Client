/**
 * Public API exports for shared components
 *
 * Organization:
 * - buttons/  → Button, IconButton
 * - cards/    → Card, GlassCard
 * - inputs/   → TextInput, SearchInput
 * - feedback/ → LoadingSpinner, ErrorView, EmptyState, TabBar
 */

// =============================================================================
// BUTTONS
// =============================================================================
export { Button } from './Button';
export { IconButton } from './buttons/IconButton';

// =============================================================================
// CARDS
// =============================================================================
export { Card } from './Card';
export { GlassCard } from './cards/GlassCard';

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
export { TabBar } from './feedback/TabBar';

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
export { DownloadButton } from './DownloadButton';
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
export { SwipeableBookCard } from './SwipeableBookCard';
export type { SwipeableBookCardProps } from './SwipeableBookCard';

// =============================================================================
// PLAYER CONTROLS
// =============================================================================
export { CoverPlayButton } from './CoverPlayButton';

// =============================================================================
// PULL-TO-REFRESH
// =============================================================================
export { CassetteRefreshControl, useCassetteRefresh } from './CassetteRefreshControl';
export { CassetteRefreshView } from './CassetteRefreshView';

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
