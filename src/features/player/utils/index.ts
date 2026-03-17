/**
 * src/features/player/utils/index.ts
 *
 * Player utility exports.
 * All utilities are pure functions with no side effects.
 */

// Types
export type { AudioTrackInfo, Chapter } from './types';

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

