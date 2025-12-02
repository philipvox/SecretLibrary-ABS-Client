/**
 * SVG Assets for AudiobookShelf App
 * 
 * Organized by usage:
 * - Navigation: Bottom tab bar buttons
 * - Player Controls: Playback control buttons
 * - Backgrounds: Card and container backgrounds
 * - Overlays: Cover image overlays
 * - Loading: Loading animation states
 */

// Navigation
export { HomeButton, HomeButtonActive, SearchButton } from './navigation';

// Player Controls
export {
  PlayButton,
  PauseButton,
  RewindButton,
  FastForwardButton,
  ChapterBackButton,
  ChapterForwardButton,
  SmallPlayButton,
  SmallPauseButton,
  HomeLargePlayButton,
} from './controls';

// Backgrounds
export { HomeCardBackground, PlayerCardBackground } from './backgrounds';

// Overlays
export { PlayerCoverOverlay } from './overlays';

// Loading States
export { LoadingDots } from './loading';

// Types
export type { SvgProps } from './types';
