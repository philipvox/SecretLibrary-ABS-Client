/**
 * src/features/home/utils/spine/adapter.ts
 *
 * Compatibility adapter for old API.
 * Provides old function signatures that internally use new system.
 * Allows drop-in replacement without changing all call sites.
 */

import { generateSpineStyle } from './generator';
import { SpineConfigBuilder } from './config';
import { calculateWidth, calculateHeight, GENRE_HEIGHT_PROFILES } from './core/dimensions';
import { hashString, seededRandom, hashToPick } from './core/hashing';
import { matchBestGenre } from './genre/matcher';
import { getGenreProfile } from './profiles';
import { BASE_DIMENSIONS, WIDTH_CALCULATION, TOUCH_TARGETS } from './constants';
import { useNewSpineSystem } from './featureFlags';
import { generateComposition, SpineComposition } from './composition';

// Import old system for fallback
import * as oldSystem from '../spineCalculations';

// =============================================================================
// OLD API - DIMENSIONS
// =============================================================================

/**
 * @deprecated Use generateSpineStyle instead
 * Legacy: calculateBookDimensions({ id, genres, tags, duration, seriesName })
 */
export function calculateBookDimensions(params: {
  id: string;
  genres: string[];
  tags?: string[];
  duration: number | undefined;
  seriesName?: string;
}): {
  baseWidth: number;
  baseHeight: number;
  width: number;
  height: number;
  touchPadding: number;
  hash: number;
} {
  if (!useNewSpineSystem()) {
    return oldSystem.calculateBookDimensions(params);
  }

  const config = new SpineConfigBuilder(params.id)
    .withGenres(params.genres)
    .withTags(params.tags || [])
    .withDuration(params.duration)
    .withSeriesName(params.seriesName)
    .withContext('shelf')
    .build();

  const style = generateSpineStyle(config);
  const { base, scaled } = style.dimensions;

  return {
    baseWidth: base.width,
    baseHeight: base.height,
    width: scaled.width,
    height: scaled.height,
    touchPadding: scaled.touchPadding,
    hash: hashString(params.id),
  };
}

/**
 * @deprecated Use calculateCompleteDimensions instead
 * Legacy: getSpineDimensions(bookId, genres, duration, seriesName)
 */
export function getSpineDimensions(
  bookId: string,
  genres: string[] | undefined,
  duration: number | undefined,
  seriesName?: string
): { width: number; height: number; touchPadding: number } {
  if (!useNewSpineSystem()) {
    return oldSystem.getSpineDimensions(bookId, genres, duration, seriesName);
  }

  const genreMatch = matchBestGenre(genres);
  const genreProfile = genreMatch?.profile;

  const width = calculateWidth(duration);
  const height = calculateHeight(genreProfile, bookId, seriesName);  // Pass seriesName for height locking
  const touchPadding = Math.max(0, Math.ceil((TOUCH_TARGETS.MIN - width) / 2));

  return { width, height, touchPadding };
}

// =============================================================================
// OLD API - TYPOGRAPHY
// =============================================================================

/**
 * Get typography (fonts, transforms, weights) for genres.
 * ALWAYS uses the OLD template system for fonts because:
 * - Old system has 42+ templates with diverse fonts
 * - New system only has 3 genre profiles so far
 *
 * The new system handles composition/layout, old system handles fonts.
 */
export function getTypographyForGenres(
  genres: string[] | undefined,
  bookId: string
): any {
  // Always use old system for typography - it has full genre coverage
  // The old system's getTypographyForGenres has:
  // - Combo genre matching (Fantasy + Thriller)
  // - 42+ templates with diverse fonts
  // - Deterministic font selection via book hash
  return oldSystem.getTypographyForGenres(genres, bookId);
}

/**
 * @deprecated Use matchBestGenre instead
 * Legacy: detectGenreCategory(genres)
 */
export function detectGenreCategory(genres: string[] | undefined): string | null {
  if (!useNewSpineSystem()) {
    return oldSystem.detectGenreCategory?.(genres) || null;
  }

  const match = matchBestGenre(genres);
  return match?.profile || null;
}

// =============================================================================
// OLD API - SERIES
// =============================================================================

/**
 * @deprecated Series styles now managed internally
 * Legacy: getSeriesStyle(seriesName)
 */
export function getSeriesStyle(seriesName: string): any {
  if (!useNewSpineSystem()) {
    return oldSystem.getSeriesStyle(seriesName);
  }

  // For now, return compatible format
  const hash = hashString(seriesName);
  const height = BASE_DIMENSIONS.HEIGHT + seededRandom(hash, -30, 50);

  return {
    normalizedName: seriesName.toLowerCase(),
    typography: getTypographyForGenres(['Fiction'], seriesName),
    height: Math.max(BASE_DIMENSIONS.MIN_HEIGHT, Math.min(BASE_DIMENSIONS.MAX_HEIGHT, height)),
    iconIndex: hash % 12,
    locked: true,
  };
}

// =============================================================================
// OLD API - COLORS
// =============================================================================

/**
 * @deprecated Use useSpineColors hook instead
 * Legacy: getSpineColorForGenres(genres, bookId)
 */
export function getSpineColorForGenres(
  genres: string[] | undefined,
  bookId: string
): { background: string; text: string } {
  if (!useNewSpineSystem()) {
    return oldSystem.getSpineColorForGenres?.(genres, bookId) || {
      background: '#F5F5F5',
      text: '#000000',
    };
  }

  // Return default - colors should be loaded via useSpineColors hook
  return {
    background: '#F5F5F5',
    text: '#000000',
  };
}

/**
 * @deprecated Use color utilities from new system
 */
export function isLightColor(color: string): boolean {
  if (!useNewSpineSystem()) {
    return oldSystem.isLightColor(color);
  }

  if (!color || !color.startsWith('#')) return false;

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * @deprecated Use color utilities from new system
 */
export function darkenColorForDisplay(color: string): string {
  if (!useNewSpineSystem()) {
    return oldSystem.darkenColorForDisplay(color);
  }

  if (!color || !color.startsWith('#')) return color;

  const r = Math.floor(parseInt(color.slice(1, 3), 16) * 0.6);
  const g = Math.floor(parseInt(color.slice(3, 5), 16) * 0.6);
  const b = Math.floor(parseInt(color.slice(5, 7), 16) * 0.6);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// =============================================================================
// OLD API - UTILITIES
// =============================================================================

/**
 * Export hashing utilities (already using new system internally)
 */
export { hashString, seededRandom };

/**
 * Export constants for compatibility
 */
export const MIN_TOUCH_TARGET = TOUCH_TARGETS.MIN;
export const BASE_HEIGHT = BASE_DIMENSIONS.HEIGHT;
export const MIN_HEIGHT = BASE_DIMENSIONS.MIN_HEIGHT;
export const MAX_HEIGHT = BASE_DIMENSIONS.MAX_HEIGHT;
export const MIN_WIDTH = WIDTH_CALCULATION.MIN;
export const MAX_WIDTH = WIDTH_CALCULATION.MAX;

/**
 * Export SPINE_COLOR_PALETTE for compatibility
 * (Used by genre cards and collection thumbs)
 */
export const SPINE_COLOR_PALETTE = [
  '#C49A6C', '#8B7355', '#6B4423', '#4A2C2A', '#2C1810',
  '#3D5A80', '#293241', '#5F7A61', '#4A5759', '#2E3532',
  '#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2691E',
  '#556B2F', '#6B8E23', '#808000', '#BDB76B', '#9ACD32',
];

/**
 * Export FONT_CHAR_RATIOS for compatibility
 * (Used by layoutSolver and authorLayoutStrategy)
 */
export const FONT_CHAR_RATIOS = {
  'BebasNeue-Regular': { uppercase: 0.55, lowercase: 0.5, tight: 0.48 },
  'Oswald-Regular': { uppercase: 0.5, lowercase: 0.45, tight: 0.42 },
  'Oswald-Bold': { uppercase: 0.52, lowercase: 0.47, tight: 0.44 },
  'Lora-Regular': { uppercase: 0.58, lowercase: 0.5, tight: 0.46 },
  'Lora-Bold': { uppercase: 0.6, lowercase: 0.52, tight: 0.48 },
  'PlayfairDisplay-Regular': { uppercase: 0.6, lowercase: 0.52, tight: 0.48 },
  'PlayfairDisplay-Bold': { uppercase: 0.62, lowercase: 0.54, tight: 0.5 },
  'default': { uppercase: 0.55, lowercase: 0.5, tight: 0.45 },
};

// =============================================================================
// OLD API - COMPOSITION
// =============================================================================

/**
 * @deprecated Use generateComposition from composition module
 * Legacy: generateSpineComposition(bookId, title, author, genres, series, spineWidth)
 */
export function generateSpineComposition(
  bookId: string,
  title: string,
  author: string,
  genres: string[],
  series?: { name: string; number: number },
  spineWidth?: number
): any {
  if (__DEV__) {
    console.log(`[Adapter] generateSpineComposition called for "${title}" (width: ${spineWidth || 'unknown'})`);
  }

  if (!useNewSpineSystem()) {
    if (__DEV__) {
      console.log(`[Adapter] Using OLD system for "${title}"`);
    }
    return oldSystem.generateSpineComposition(bookId, title, author, genres, series);
  }

  if (__DEV__) {
    console.log(`[Adapter] Using NEW system for "${title}" with width ${spineWidth || 'unknown'}`);
  }

  // Use new composition generator with smart constraints
  const genreMatch = matchBestGenre(genres);
  const genreProfile = genreMatch?.profile || 'default';
  const composition = generateComposition(
    bookId,
    genreProfile,
    title,      // Pass title for smart rotation logic
    author,     // Pass author for thin spine logic
    spineWidth  // Pass width for layout constraints
  );

  // Return in old format for compatibility - add text properties
  return {
    ...composition,
    title: {
      ...composition.title,
      text: title,  // Add the actual title text
    },
    author: {
      ...composition.author,
      text: author,  // Add the actual author text
    },
  };
}

/**
 * Export SpineComposition type for compatibility
 */
export type { SpineComposition };

// =============================================================================
// MIGRATION LOGGING
// =============================================================================

if (__DEV__) {
  // Log when adapter functions are called
  const originalCalc = calculateBookDimensions;
  (calculateBookDimensions as any) = function(...args: any[]) {
    console.log('[Adapter] calculateBookDimensions called (using', useNewSpineSystem() ? 'NEW' : 'OLD', 'system)');
    return originalCalc.apply(this, args);
  };
}
