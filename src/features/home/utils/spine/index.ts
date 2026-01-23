/**
 * src/features/home/utils/spine/index.ts
 *
 * Public API for the spine styling system.
 * This is the only file that should be imported by external code.
 */

// =============================================================================
// CORE API
// =============================================================================

export {
  // Main generation
  generateSpineStyle,
  generateSpineStylesBatch,
  type CompleteSpineStyle,

  // Utilities
  usesLightText,
  describeDimensions,
} from './generator';

export {
  // Configuration
  type SpineConfig,
  SpineConfigBuilder,
  configFromLibraryItem,
  createTestConfig,
} from './config';

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

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export {
  type SpineTypography,
  type FontFamily,
  type FontWeight,
  type FontStyle,
  type TextTransform,
  type AuthorPosition,
  type Orientation,
  type OrientationBias,
  type GenreTypographyProfile,
} from './typography/types';

export {
  // Backwards-compatible exports (use for migration)
  getGenreProfile,
  getProfile,
  getCompositionProfile,
  GENRE_PROFILES,
  PROFILES_BY_ID,
} from './profiles';

// =============================================================================
// MIGRATION HELPERS
// =============================================================================

/**
 * Legacy compatibility layer.
 * Provides old function signatures for gradual migration.
 */
export const legacy = {
  /**
   * @deprecated Use generateSpineStyle instead
   */
  calculateBookDimensions(params: {
    id: string;
    genres: string[];
    tags?: string[];
    duration: number | undefined;
    seriesName?: string;
  }): { width: number; height: number } {
    const { generateSpineStyle } = require('./generator');
    const { SpineConfigBuilder } = require('./config');

    const config = new SpineConfigBuilder(params.id)
      .withGenres(params.genres)
      .withTags(params.tags || [])
      .withDuration(params.duration)
      .withSeriesName(params.seriesName)
      .withContext('shelf')
      .build();

    const style = generateSpineStyle(config);
    return {
      width: style.dimensions.scaled.width,
      height: style.dimensions.scaled.height,
    };
  },

  /**
   * @deprecated Use matchBestGenre instead
   */
  detectGenreCategory(genres: string[]): string | null {
    const { matchBestGenre } = require('./genre/matcher');
    const match = matchBestGenre(genres);
    return match?.profile || null;
  },
};
