/**
 * src/features/home/index.ts
 *
 * Barrel exports for home feature
 */

// Screens
export { LibraryScreen } from './screens/LibraryScreen';

// Components
export { EmptySection } from './components/EmptySection';
export { InfoTiles } from './components/InfoTiles';
export { PlaybackControls } from './components/PlaybackControls';
export { CoverArtwork } from './components/CoverArtwork';
export { SectionHeader } from './components/SectionHeader';
export { SeriesCard } from './components/SeriesCard';

// Secret Library Components
export { BookSpineVertical } from './components/BookSpineVertical';
export type { BookSpineVerticalData } from './components/BookSpineVertical';
export { BookshelfView } from './components/BookshelfView';
export { BookRow } from './components/BookRow';
export { SeriesBookStack } from './components/SeriesBookStack';
export type { StackBookData, StackBookLayout } from './components/SeriesBookStack';

// Hooks
export { useHomeData } from './hooks/useHomeData';
export { useBookRowLayout, getBookRowWidth, getBookRowHeight } from './hooks/useBookRowLayout';
export type { BookLayoutInfo, UseBookRowLayoutOptions } from './hooks/useBookRowLayout';
export { useContinueListening } from '@/shared/hooks/useContinueListening';
export {
  useSpineCache,
  useSpineCacheFromItems,
  useSingleSpineData,
  useSpineCacheStatus,
  usePopulateSpineCache,
} from './hooks/useSpineCache';
export type { ScaledSpineData, UseSpineCacheOptions } from './hooks/useSpineCache';
export {
  useSeriesStackLayout,
  useSeriesStackSize,
  precacheSeriesStack,
  clearSeriesStackCache,
} from './hooks/useSeriesStackLayout';
export type { UseSeriesStackLayoutOptions } from './hooks/useSeriesStackLayout';

// Stores
export { useSpineCacheStore, selectUseColoredSpines } from './stores/spineCache';
export type { CachedSpineData, SpineCacheState } from './stores/spineCache';

// Types
export * from './types';
