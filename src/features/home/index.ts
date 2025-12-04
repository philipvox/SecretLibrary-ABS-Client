/**
 * src/features/home/index.ts
 *
 * Barrel exports for home feature
 */

// Screens
export { HomeScreen, HOME_CONFIG } from './screens/HomeScreen';

// Components
export { NowPlayingCard } from './components/NowPlayingCard';
export { InfoTiles } from './components/InfoTiles';
export { PlaybackControls } from './components/PlaybackControls';
export { GlassButton } from './components/GlassButton';
export { CoverArtwork } from './components/CoverArtwork';
export { HomeBackground } from './components/HomeBackground';
export { MiniControls } from './components/MiniControls';
export { SectionHeader } from './components/SectionHeader';
export { HorizontalCarousel } from './components/HorizontalCarousel';
export { BookCard } from './components/BookCard';
export { SeriesCard } from './components/SeriesCard';
export { PlaylistCard } from './components/PlaylistCard';
export { CoverStack } from './components/CoverStack';
export { CoverGrid } from './components/CoverGrid';
export { HeartBadge } from './components/HeartBadge';

// Icons
export * from './components/icons';

// Hooks
export { useHomeData } from './hooks/useHomeData';
export { useContinueListening } from './hooks/useContinueListening';

// Types
export * from './types';

// Constants
export * from './constants';
// Note: homeDesign.ts exports are imported directly where needed to avoid conflicts
