/**
 * src/features/player/utils/index.ts
 *
 * Player utility exports.
 * All utilities are pure functions with no side effects.
 */

// Types
export type { AudioTrackInfo, Chapter } from './types';

// Track navigation
export {
  findTrackForPosition,
  calculateGlobalPosition,
  isNearTrackEnd,
  getNextTrackIndex,
  getPreviousTrackIndex,
  calculateTotalDuration,
  getTrackAtIndex,
  type TrackPosition,
} from './trackNavigator';

// Progress calculations
export {
  calculateProgress,
  isBookComplete,
  formatDuration,
  formatRemaining,
  clampPosition,
  calculateSkipPosition,
  calculateProgressPercent,
  calculateTimeRemaining,
  formatTimeRemainingWithRate,
} from './progressCalculator';

// Playback rate
export {
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  DEFAULT_PLAYBACK_RATE,
  RATE_INCREMENTS,
  getPlaybackRateForBook,
  clampPlaybackRate,
  getNextPlaybackRate,
  getPreviousPlaybackRate,
  formatPlaybackRate,
  isStandardRate,
  nearestStandardRate,
  adjustPlaybackRate,
} from './playbackRateResolver';

// Chapter navigation
export {
  findChapterForPosition,
  getChapterStartPosition,
  getNextChapterIndex,
  getPreviousChapterIndex,
  getChapterProgress,
  getChapterTimeRemaining,
  getRemainingChaptersCount,
  getChapterAtIndex,
  getChapterDuration,
  findNearestChapterStart,
  type ChapterInfo,
} from './chapterNavigator';

// Smart rewind
export { calculateSmartRewindSeconds } from './smartRewindCalculator';

// Position resolution (cross-device sync)
export {
  resolvePosition,
  createLocalSource,
  createServerSource,
  type PositionSource,
  type ResolutionOptions,
  type ResolutionResult,
} from './positionResolver';

// Time formatters (for player UI)
export {
  formatTime,
  formatTimeHHMMSS,
  formatTimeVerbose,
} from './timeFormatters';

// Player theme
export {
  playerColors,
  usePlayerColors,
  type PlayerColors,
} from './playerTheme';
