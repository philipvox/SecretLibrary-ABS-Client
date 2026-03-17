/**
 * src/features/home/utils/spine/adapter.ts
 *
 * Compatibility adapter for spine dimension calculations.
 * Provides old function signatures that internally use new system.
 */

import { generateSpineStyle } from './generator';
import { SpineConfigBuilder } from './config';
import { calculateWidth, calculateHeight } from './core/dimensions';
import { hashString, seededRandom } from './core/hashing';
import { matchBestGenre } from './genre/matcher';
import { BASE_DIMENSIONS, WIDTH_CALCULATION, TOUCH_TARGETS } from './constants';

// =============================================================================
// DIMENSIONS
// =============================================================================

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

export function getSpineDimensions(
  bookId: string,
  genres: string[] | undefined,
  duration: number | undefined,
  seriesName?: string
): { width: number; height: number; touchPadding: number } {
  const genreMatch = matchBestGenre(genres);
  const genreProfile = genreMatch?.profile;

  const width = calculateWidth(duration, seriesName);
  const height = calculateHeight(genreProfile, bookId, seriesName);
  const touchPadding = Math.max(0, Math.ceil((TOUCH_TARGETS.MIN - width) / 2));

  return { width, height, touchPadding };
}

// =============================================================================
// SERIES (used by TopPickHero via @/shared/spine)
// =============================================================================

export function getSeriesStyle(seriesName: string): any {
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
// TYPOGRAPHY (used by TopPickHero via @/shared/spine)
// =============================================================================

/**
 * Minimal typography info for non-spine consumers (TopPickHero, etc.).
 * Returns a simple object — the full template system is no longer used.
 */
export function getTypographyForGenres(
  genres: string[] | undefined,
  _bookId: string
): any {
  const g = (genres || []).map(s => s.toLowerCase());
  let fontFamily = 'Oswald-Bold';
  if (g.some(x => x.includes('fantasy'))) fontFamily = 'MacondoSwashCaps-Regular';
  else if (g.some(x => x.includes('literary') || x.includes('classic') || x.includes('romance')))
    fontFamily = 'PlayfairDisplay-Bold';

  return {
    fontFamily,
    fontWeight: 'bold',
    fontStyle: 'normal',
    titleTransform: 'uppercase',
    authorTransform: 'none',
    authorPosition: 'bottom',
    authorBox: 'none',
    letterSpacing: 0.5,
    titleLetterSpacing: 0.5,
    authorLetterSpacing: 0,
    authorOrientationBias: 'horizontal',
    contrast: 'high',
    titleWeight: 'bold',
    authorWeight: 'normal',
    authorAbbreviation: 'none',
  };
}

// =============================================================================
// COLORS (used by DiscoverMoreCard)
// =============================================================================

export function isLightColor(color: string): boolean {
  if (!color || !color.startsWith('#')) return false;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function darkenColorForDisplay(color: string): string {
  if (!color || !color.startsWith('#')) return color;
  const r = Math.floor(parseInt(color.slice(1, 3), 16) * 0.6);
  const g = Math.floor(parseInt(color.slice(3, 5), 16) * 0.6);
  const b = Math.floor(parseInt(color.slice(5, 7), 16) * 0.6);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// =============================================================================
// UTILITIES
// =============================================================================

export { hashString, seededRandom };

export const MIN_TOUCH_TARGET = TOUCH_TARGETS.MIN;
export const BASE_HEIGHT = BASE_DIMENSIONS.HEIGHT;
export const MIN_HEIGHT = BASE_DIMENSIONS.MIN_HEIGHT;
export const MAX_HEIGHT = BASE_DIMENSIONS.MAX_HEIGHT;
export const MIN_WIDTH = WIDTH_CALCULATION.MIN;
export const MAX_WIDTH = WIDTH_CALCULATION.MAX;

/**
 * Color palette for genre cards, collection thumbs, etc.
 */
export const SPINE_COLOR_PALETTE = [
  '#C49A6C', '#8B7355', '#6B4423', '#4A2C2A', '#2C1810',
  '#3D5A80', '#293241', '#5F7A61', '#4A5759', '#2E3532',
  '#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2691E',
  '#556B2F', '#6B8E23', '#808000', '#BDB76B', '#9ACD32',
];
