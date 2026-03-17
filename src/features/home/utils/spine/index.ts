/**
 * src/features/home/utils/spine/index.ts
 *
 * Public API for the spine dimension/hashing system.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export {
  BASE_DIMENSIONS,
  WIDTH_CALCULATION,
  SPINE_LAYOUT,
  TOUCH_TARGETS,
  SPINE_SCALES,
  SPINE_COLORS,
  ANIMATION,
  type SpineContext,
} from './constants';

// =============================================================================
// DIMENSIONS
// =============================================================================

export {
  calculateWidth,
  calculateHeight,
  calculateTouchPadding,
  scaleDimensions,
  calculateCompleteDimensions,
  isThinSpine,
  isThickSpine,
  widthToDuration,
  fitToBoundingBox,
  getDurationScale,
  DURATION_SCALE_LONG_MAX,
  type BaseDimensions,
  type ScaledDimensions,
  type CompleteDimensions,
} from './core/dimensions';

// =============================================================================
// HASHING UTILITIES
// =============================================================================

export {
  hashString,
  seededRandom,
  hashToPercent,
  hashToBool,
  hashToPick,
} from './core/hashing';

// =============================================================================
// GENRE MATCHING
// =============================================================================

export {
  matchGenre,
  matchBestGenre,
  matchComboGenres,
  normalizeGenre,
  areGenresEquivalent,
  getAllGenreProfiles,
  type GenreDefinition,
} from './genre/matcher';
