/**
 * Public API exports for shared components
 */

export { Button } from './Button';
export { Card } from './Card';
export { Icon } from './Icon';
export { LoadingSpinner } from './LoadingSpinner';
export { ErrorView } from './ErrorView';
export { EmptyState } from './EmptyState';
export { SplashScreen } from './SplashScreen';
export { FilterSortBar } from './FilterSortBar';
export type { SortOption } from './FilterSortBar';

// Skeleton loading components
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

// Gesture-optimized components
export {
  Swipeable,
  ScalePressable,
  PullToRefresh,
  DoubleTapSeek,
  GestureHandlerRootView,
} from './GestureComponents';

// Animation components
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

// Lazy loading components
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