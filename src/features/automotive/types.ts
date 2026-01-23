/**
 * src/features/automotive/types.ts
 *
 * Type definitions for CarPlay and Android Auto integration.
 */

/**
 * Automotive connection state
 */
export type AutomotiveConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected';

/**
 * Platform type
 */
export type AutomotivePlatform = 'carplay' | 'android-auto' | 'none';

/**
 * Browse item for library lists
 */
export interface BrowseItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  isPlayable: boolean;
  isBrowsable: boolean;
  progress?: number;  // 0-1 for continue listening
  durationMs?: number; // Duration in milliseconds for Android Auto
  /** For browsable items, the children to show when expanded */
  children?: BrowseItem[];
  /** Number of items (for folder display, e.g. "12 books") */
  itemCount?: number;
  /** Series sequence number for ordering */
  sequence?: number;
}

/**
 * Browse section (category)
 */
export interface BrowseSection {
  id: string;
  title: string;
  items: BrowseItem[];
  /** If true, this section contains browsable folders, not playable items */
  isBrowsableSection?: boolean;
}

/**
 * Now Playing state for automotive displays
 */
export interface AutomotiveNowPlaying {
  title: string;
  subtitle: string;
  artworkUrl?: string;
  duration: number;
  position: number;
  isPlaying: boolean;
  playbackRate: number;
  chapterTitle?: string;
  chapterIndex?: number;
  totalChapters?: number;
}

/**
 * Automotive action
 */
export type AutomotiveAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'skipForward' }
  | { type: 'skipBackward' }
  | { type: 'nextChapter' }
  | { type: 'prevChapter' }
  | { type: 'seekTo'; position: number }
  | { type: 'setSpeed'; speed: number }
  | { type: 'playItem'; itemId: string }
  | { type: 'browse'; sectionId: string };

/**
 * Automotive event handler
 */
export type AutomotiveActionHandler = (action: AutomotiveAction) => void;

/**
 * Automotive callbacks
 */
export interface AutomotiveCallbacks {
  onAction: AutomotiveActionHandler;
  onConnect: (platform: AutomotivePlatform) => void;
  onDisconnect: () => void;
}

/**
 * Configuration for automotive integration
 */
export interface AutomotiveConfig {
  /** App name shown in CarPlay/Android Auto */
  appName: string;
  /** Whether to enable CarPlay (requires entitlement) */
  enableCarPlay: boolean;
  /** Whether to enable Android Auto */
  enableAndroidAuto: boolean;
  /** Maximum items per browse list */
  maxListItems: number;
  /** Whether to show playback speed button */
  showSpeedControl: boolean;
  /** Whether to show sleep timer button */
  showSleepTimer: boolean;
  /** Skip interval in seconds */
  skipInterval: number;
}

export const DEFAULT_AUTOMOTIVE_CONFIG: AutomotiveConfig = {
  appName: 'Audiobookshelf',
  enableCarPlay: true,   // Native config now in place
  enableAndroidAuto: true, // Native config now in place
  maxListItems: 50,      // Increased for better browsing experience
  showSpeedControl: true,
  showSleepTimer: false,
  skipInterval: 30,
};
