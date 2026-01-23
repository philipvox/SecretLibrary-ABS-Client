/**
 * src/features/home/utils/spine/generator.ts
 *
 * Main spine generation API.
 * Orchestrates all subsystems to generate complete spine styling.
 */

import { SpineConfig } from './config';
import { CompleteDimensions, calculateCompleteDimensions } from './core/dimensions';
import { matchBestGenre, matchComboGenres } from './genre/matcher';
import { getGenreProfile } from './profiles';
import { SpineTypography } from './typography/types';
import { hashToBool } from './core/hashing';

// =============================================================================
// COMPLETE SPINE STYLE
// =============================================================================

/**
 * Complete spine styling information.
 * Everything needed to render a book spine.
 */
export interface CompleteSpineStyle {
  /** Spine dimensions (base + scaled) */
  dimensions: CompleteDimensions;
  /** Typography configuration */
  typography: SpineTypography;
  /** Colors */
  colors: {
    background: string;
    text: string;
    fromCover: boolean; // True if extracted from cover
  };
  /** Visual state */
  state: {
    progress: number;
    isDownloaded: boolean;
  };
  /** Metadata for debugging */
  _meta: {
    genreProfile: string;
    isCombo: boolean;
    bookId: string;
  };
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate complete spine styling from configuration.
 * This is the main entry point for spine generation.
 *
 * @param config - Complete spine configuration
 * @returns Complete spine style ready for rendering
 */
export function generateSpineStyle(config: SpineConfig): CompleteSpineStyle {
  // 1. Match genre
  const genreMatch = matchBestGenre(config.metadata.genres);
  const genreProfileName = genreMatch?.profile || 'default';

  // 2. Get dimensions (with series locking)
  const dimensions = calculateCompleteDimensions(
    config.metadata.duration,
    genreProfileName,
    config.book.id,
    config.display.context,
    config.metadata.seriesName  // Pass seriesName for height locking
  );

  // 3. Get typography
  const baseTypography = getGenreProfile(genreProfileName).typography;
  const typography = applyTypographyVariations(baseTypography, config);

  // 4. Get colors (with fallback)
  const colors = config.overrides?.colors || {
    background: '#F5F5F5',
    text: '#000000',
    fromCover: false,
  };

  return {
    dimensions,
    typography,
    colors,
    state: {
      progress: config.display.progress,
      isDownloaded: config.display.isDownloaded,
    },
    _meta: {
      genreProfile: genreProfileName,
      isCombo: matchComboGenres(config.metadata.genres) !== null,
      bookId: config.book.id,
    },
  };
}

// =============================================================================
// TYPOGRAPHY VARIATIONS
// =============================================================================

/**
 * Apply deterministic variations to base typography.
 * Adds visual variety while maintaining genre consistency.
 */
function applyTypographyVariations(
  base: SpineTypography,
  config: SpineConfig
): SpineTypography {
  const typography = { ...base };

  // Apply variations based on book ID hash
  const bookId = config.book.id;

  // 1. Author orientation variation (40% get vertical)
  if (typography.layout.authorOrientationBias === 'neutral') {
    if (hashToBool(bookId + '-vertical', 40)) {
      typography.layout.authorOrientationBias = 'vertical';
    } else if (hashToBool(bookId + '-horizontal', 20)) {
      typography.layout.authorOrientationBias = 'horizontal';
    }
  }

  // 2. Author box variation (25% get box)
  if (!typography.layout.authorBox && hashToBool(bookId + '-box', 25)) {
    typography.layout.authorBox = true;
  }

  return typography;
}

// =============================================================================
// BATCH GENERATION
// =============================================================================

/**
 * Generate spine styles for multiple books.
 * More efficient than generating one at a time.
 *
 * @param configs - Array of spine configurations
 * @returns Array of spine styles
 */
export function generateSpineStylesBatch(
  configs: SpineConfig[]
): CompleteSpineStyle[] {
  return configs.map(generateSpineStyle);
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Check if spine style should use light text (dark background).
 */
export function usesLightText(style: CompleteSpineStyle): boolean {
  // Simple luminance check
  const bg = style.colors.background;
  if (bg.startsWith('#')) {
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }
  return false;
}

/**
 * Get readable description of spine dimensions.
 */
export function describeDimensions(style: CompleteSpineStyle): string {
  const { base } = style.dimensions;
  const aspectRatio = (base.height / base.width).toFixed(1);
  return `${base.width}×${base.height}px (${aspectRatio}:1)`;
}
