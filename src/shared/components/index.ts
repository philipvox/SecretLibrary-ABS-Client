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
export { EmptyState } from './EmptyState';
export { TabBar } from './feedback/TabBar';

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================
export { Icon } from './Icon';
export { SplashScreen } from './SplashScreen';
export { FilterSortBar } from './FilterSortBar';
export type { SortOption } from './FilterSortBar';

// =============================================================================
// SKELETON LOADING
// =============================================================================
export {
  Shimmer,
  BookCardSkeleton,
  SquareCardSkeleton,
  ListItemSkeleton,
  PlayerHeaderSkeleton,
  BookDetailSkeleton,
  BookGridSkeleton,
  SquareGridSkeleton,
  ListSkeleton,
} from './Skeleton';

// =============================================================================
// GESTURE COMPONENTS
// =============================================================================
export {
  Swipeable,
  ScalePressable,
  PullToRefresh,
  DoubleTapSeek,
  GestureHandlerRootView,
} from './GestureComponents';

// =============================================================================
// ANIMATION COMPONENTS
// =============================================================================
export {
  FadeInUp,
  ScaleIn,
  StaggeredItem,
  AnimatedProgress,
  AnimatedNumber,
  AnimatedModal,
  Pulse,
  layoutAnimations,
} from './AnimatedComponents';

// =============================================================================
// LAZY LOADING
// =============================================================================
export {
  DeferRender,
  LazyWrapper,
  OnVisible,
  ProgressiveLoad,
  BatchRender,
  useIdleCallback,
  useDeferredValue,
  createLazyScreen,
  preloadComponent,
} from './LazyComponents';

// =============================================================================
// OFFLINE-FIRST
// =============================================================================
export { SyncStatusBadge } from './SyncStatusBadge';
export { DownloadButton } from './DownloadButton';