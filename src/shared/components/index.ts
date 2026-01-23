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
// LOADING (Single source of truth)
// =============================================================================
export { Loading, FullScreenLoading, InlineLoading, ButtonLoading, CandleLoading } from './Loading';
export type { LoadingProps, LoadingMode } from './Loading';

// Legacy loading components (deprecated - use Loading instead)
export { LoadingSpinner } from './LoadingSpinner';
export { SkullLoadingSpinner } from './SkullLoadingSpinner';

// Custom pull-to-refresh with skull animation
export { SkullRefreshControl } from './SkullRefreshControl';
export type { SkullRefreshControlProps } from './SkullRefreshControl';

// Screen loading overlay (initial load)
export { ScreenLoadingOverlay } from './ScreenLoadingOverlay';

// Global loading overlay (triggered from buttons before navigation)
export { GlobalLoadingOverlay } from './GlobalLoadingOverlay';

// =============================================================================
// FEEDBACK & STATES
// =============================================================================
export { ErrorView } from './ErrorView';
export type { ErrorType } from './ErrorView';
export { EmptyState } from './EmptyState';
export type { EmptyStateIcon } from './EmptyState';

// =============================================================================
// TEXT
// =============================================================================
export { HyphenatedText } from './HyphenatedText';

// =============================================================================
// ICONS (Single source of truth)
// =============================================================================
export { Icon, ICON_SIZES } from './Icon';
export type { IconSize } from './Icon';

// App Icons - custom SVG icons with consistent style
export {
  // Re-exports
  IconSizes,
  AppIcons,
  IconButton as AppIconButton,
  // Navigation
  BackIcon,
  CloseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  // System
  SearchIcon,
  SettingsIcon,
  MenuIcon,
  MoreVerticalIcon,
  MoreHorizontalIcon,
  // Actions
  PlusIcon,
  CheckIcon,
  HeartIcon as HeartIconSvg,
  DownloadIcon,
  ShareIcon,
  // Player
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  MoonIcon,
  // Entity
  UserIcon,
  MicIcon,
  BellIcon,
  BellOffIcon,
  // Content
  LibraryIcon,
  BookIcon,
  BookOpenIcon,
  ClockIcon,
  GridIcon,
  TagIcon,
  SmileIcon,
  ListIcon,
} from './AppIcons';
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
export { AddToLibraryButton, LibraryIcon as AddToLibraryIcon } from './AddToLibraryButton';
export type { AddToLibraryButtonProps } from './AddToLibraryButton';

// =============================================================================
// BOOK CARDS
// =============================================================================
export { BookCard, BookCardWithState } from './BookCard';
export type { BookCardProps, BookCardActionType, BookCardContext } from './BookCard';

// =============================================================================
// PLAYER CONTROLS
// =============================================================================
export { CoverPlayButton } from './CoverPlayButton';
export { PlayPauseButton } from './PlayPauseButton';
export type { PlayPauseButtonProps, PlayPauseButtonSize, PlayPauseButtonVariant } from './PlayPauseButton';

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

// =============================================================================
// TOP NAVIGATION
// =============================================================================
export {
  TopNav,
  SearchIcon as TopNavSearchIcon,
  CloseIcon as TopNavCloseIcon,
  BackIcon as TopNavBackIcon,
  SettingsIcon as TopNavSettingsIcon,
  DownloadIcon as TopNavDownloadIcon,
  ShareIcon as TopNavShareIcon,
} from './TopNav';
export type { TopNavProps, TopNavPill, TopNavCircleButton, TopNavVariant, TopNavSearchConfig } from './TopNav';

// =============================================================================
// SYNC STATUS
// =============================================================================
export { SyncStatusBanner } from './SyncStatusBanner';

// =============================================================================
// COLLAPSIBLE SECTIONS
// =============================================================================
export { CollapsibleSection } from './CollapsibleSection';
export type { CollapsibleSectionProps } from './CollapsibleSection';
