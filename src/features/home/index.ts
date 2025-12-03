/**
 * src/features/home/index.ts
 *
 * Barrel exports for home feature
 */

// Screens
export { HomeScreen, HOME_CONFIG } from './screens/HomeScreen';

// Components
export { NowPlayingCard } from './components/NowPlayingCard';
export { MiniControls } from './components/MiniControls';
export { SectionHeader } from './components/SectionHeader';
export { HorizontalCarousel } from './components/HorizontalCarousel';
export { BookCard } from './components/BookCard';
export { SeriesCard } from './components/SeriesCard';
export { PlaylistCard } from './components/PlaylistCard';
export { CoverStack } from './components/CoverStack';
export { CoverGrid } from './components/CoverGrid';
export { HeartBadge } from './components/HeartBadge';

// Legacy components (deprecated)
export { HomeCard } from './components/HomeCard';
export { LibraryListCard } from './components/LibraryListCard';
export { CardActions } from './components/CardActions';
export { GlassPanel } from './components/GlassPanel';

// Hooks
export { useHomeData } from './hooks/useHomeData';
export { useContinueListening } from './hooks/useContinueListening';

// Types
export * from './types';

// Constants
export * from './constants';
