/**
 * src/features/home/utils/spine/core/dimensions.ts
 *
 * Core dimension calculations for book spines.
 * Width = duration-based (linear scaling)
 * Height = genre-based with variation
 */

import { BASE_DIMENSIONS, WIDTH_CALCULATION, TOUCH_TARGETS, SPINE_SCALES, SpineContext } from '../constants';
import { hashString, seededRandom } from './hashing';

// =============================================================================
// TYPES
// =============================================================================

/** Base dimensions before scaling */
export interface BaseDimensions {
  width: number;
  height: number;
}

/** Scaled dimensions for specific context */
export interface ScaledDimensions extends BaseDimensions {
  context: SpineContext;
  scaleFactor: number;
  touchPadding: number;
}

/** Complete spine dimensions with all metadata */
export interface CompleteDimensions {
  base: BaseDimensions;
  scaled: ScaledDimensions;
  aspectRatio: number;
}

// =============================================================================
// WIDTH CALCULATION (Duration-based with Series Consistency)
// =============================================================================

/**
 * Calculate spine width from audiobook duration using EASE-OUT curve.
 *
 * Uses a quadratic ease-out curve for better visual differentiation:
 * - Steeper growth in the common 1-15 hour range (most audiobooks)
 * - Gradual flattening for longer books (20-50 hours)
 *
 * SERIES CONSISTENCY: When a series name is provided, the width is blended
 * with a series-specific target width to reduce variation between books
 * in the same series. This creates a more unified "collection" look.
 *
 * Example widths (without series):
 * - 1 hour: 44px (minimum)
 * - 5 hours: ~89px (typical novel)
 * - 10 hours: ~129px (long novel)
 * - 15 hours: ~163px
 * - 20 hours: ~195px
 * - 30 hours: ~242px
 * - 40 hours: ~270px
 * - 50 hours: 280px (maximum)
 *
 * @param duration - Duration in seconds (undefined = median fallback)
 * @param seriesName - Optional series name for width consistency
 * @returns Width in pixels
 */
export function calculateWidth(
  duration: number | undefined,
  seriesName?: string
): number {
  // Calculate base width from duration
  let baseWidth: number;

  // Fallback for unknown duration
  if (duration === undefined || duration === null || duration <= 0) {
    baseWidth = WIDTH_CALCULATION.MEDIAN;
  } else {
    const hours = duration / 3600;

    // Clamp to min/max
    if (hours <= WIDTH_CALCULATION.MIN_DURATION_HOURS) {
      baseWidth = WIDTH_CALCULATION.MIN;
    } else if (hours >= WIDTH_CALCULATION.MAX_DURATION_HOURS) {
      baseWidth = WIDTH_CALCULATION.MAX;
    } else {
      // Ease-out quadratic curve: rapid growth early, gradual flattening later
      // Formula: easedRatio = 1 - (1 - ratio)^2
      // This gives more visual differentiation in the 1-15 hour range
      const ratio = (hours - WIDTH_CALCULATION.MIN_DURATION_HOURS) /
        (WIDTH_CALCULATION.MAX_DURATION_HOURS - WIDTH_CALCULATION.MIN_DURATION_HOURS);
      const easedRatio = 1 - Math.pow(1 - ratio, 2);

      baseWidth = WIDTH_CALCULATION.MIN +
        (WIDTH_CALCULATION.MAX - WIDTH_CALCULATION.MIN) * easedRatio;
    }
  }

  // SERIES CONSISTENCY: Blend individual width with series target
  // This reduces variation between books in the same series
  if (seriesName) {
    const normalizedSeries = normalizeSeriesName(seriesName);
    const seriesHash = hashString(normalizedSeries);

    // Generate series-specific target width (80-180px range covers most audiobooks)
    // Each series gets a consistent target based on its name hash
    const seriesTargetWidth = 80 + (seriesHash % 100);

    // Blend: 55% duration-based + 45% series target
    // This preserves duration hints while creating visual consistency
    baseWidth = baseWidth * 0.55 + seriesTargetWidth * 0.45;
  }

  return Math.round(baseWidth);
}

// =============================================================================
// HEIGHT CALCULATION (Genre + Variation)
// =============================================================================

/**
 * Normalize series name for consistent hashing.
 * Removes sequence numbers so all books in series hash to same value.
 *
 * Examples:
 * - "The Expanse #1" → "the expanse"
 * - "Stormlight Archive #3.5" → "stormlight archive"
 * - "The Lord of the Rings" → "lord of the rings"
 */
function normalizeSeriesName(seriesName: string): string {
  return seriesName
    .toLowerCase()
    .trim()
    .replace(/\s*#[\d.]+$/, '')       // Remove trailing #N or #N.N
    .replace(/^(the|a|an)\s+/i, '')   // Remove leading articles
    .replace(/['']/g, "'")            // Normalize apostrophes
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();
}

/**
 * Genre-specific height profiles.
 * Each genre has a base height that reflects its typical spine height.
 */
export const GENRE_HEIGHT_PROFILES = {
  // Tall, epic genres
  'fantasy': 500,
  'epic-fantasy': 520,
  'historical-fiction': 480,
  'classics': 500,

  // Medium-tall genres
  'science-fiction': 470,
  'thriller': 430,
  'mystery': 420,
  'biography': 470,
  'history': 490,

  // Medium genres
  'romance': 390,
  'contemporary-fiction': 410,
  'literary-fiction': 480,
  'non-fiction': 430,

  // Short genres
  'poetry': 360,
  'short-stories': 400,
  'essays': 410,
  'humor': 370,

  // Children's (age-banded)
  'children-0-2': 280,
  'children-3-5': 310,
  'children-6-8': 350,
  'children-9-12': 390,
  'young-adult': 440,
} as const;

/**
 * Calculate spine height based on genre with deterministic variation.
 *
 * SERIES LOCKING: Books in the same series share the same height for visual consistency.
 * This is achieved by hashing seriesName instead of bookId when series is present.
 *
 * @param genreProfile - Genre profile name (normalized)
 * @param bookId - Book ID for deterministic variation
 * @param seriesName - Optional series name for height locking
 * @returns Height in pixels
 */
export function calculateHeight(
  genreProfile: string | undefined,
  bookId: string,
  seriesName?: string
): number {
  // SERIES LOCKING: Use normalized series name for hash if available
  // This ensures all books in same series get same height
  // Normalization removes sequence numbers: "Expanse #1" and "Expanse #2" → "expanse"
  const hashKey = seriesName ? normalizeSeriesName(seriesName) : (bookId || 'default');
  const hash = hashString(hashKey);

  // Get base height from genre profile
  let baseHeight = BASE_DIMENSIONS.HEIGHT;
  if (genreProfile && genreProfile in GENRE_HEIGHT_PROFILES) {
    baseHeight = GENRE_HEIGHT_PROFILES[genreProfile as keyof typeof GENRE_HEIGHT_PROFILES];
  }

  // Add deterministic variation (±12% of base height)
  const variationRange = Math.floor(baseHeight * 0.12);
  const variation = seededRandom(hash, -variationRange, variationRange);

  const finalHeight = baseHeight + variation;

  // Clamp to valid range
  return Math.max(
    BASE_DIMENSIONS.MIN_HEIGHT,
    Math.min(BASE_DIMENSIONS.MAX_HEIGHT, finalHeight)
  );
}

// =============================================================================
// TOUCH PADDING
// =============================================================================

/**
 * Calculate horizontal padding needed to meet minimum touch target.
 * Required by Apple HIG and Material Design (44dp minimum).
 *
 * @param spineWidth - Current spine width
 * @returns Padding needed on each side (0 if already wide enough)
 */
export function calculateTouchPadding(spineWidth: number): number {
  const deficit = TOUCH_TARGETS.MIN - spineWidth;
  return Math.max(0, Math.ceil(deficit / 2));
}

// =============================================================================
// SCALING
// =============================================================================

/**
 * Scale base dimensions for specific display context.
 *
 * @param base - Base dimensions
 * @param context - Display context (shelf, stack, card, detail)
 * @returns Scaled dimensions with touch padding
 */
export function scaleDimensions(
  base: BaseDimensions,
  context: SpineContext
): ScaledDimensions {
  const scaleFactor = SPINE_SCALES[context];

  const scaledWidth = Math.round(base.width * scaleFactor);
  const scaledHeight = Math.round(base.height * scaleFactor);

  return {
    width: scaledWidth,
    height: scaledHeight,
    context,
    scaleFactor,
    touchPadding: calculateTouchPadding(scaledWidth),
  };
}

// =============================================================================
// COMPLETE DIMENSIONS
// =============================================================================

/**
 * Calculate complete spine dimensions with base + scaled values.
 *
 * @param duration - Audiobook duration in seconds
 * @param genreProfile - Genre profile for height
 * @param bookId - Book ID for variation
 * @param context - Display context
 * @param seriesName - Optional series name for height locking
 * @returns Complete dimensions with metadata
 */
export function calculateCompleteDimensions(
  duration: number | undefined,
  genreProfile: string | undefined,
  bookId: string,
  context: SpineContext,
  seriesName?: string
): CompleteDimensions {
  const base: BaseDimensions = {
    width: calculateWidth(duration, seriesName),
    height: calculateHeight(genreProfile, bookId, seriesName),
  };

  const scaled = scaleDimensions(base, context);

  return {
    base,
    scaled,
    aspectRatio: base.height / base.width,
  };
}

// =============================================================================
// BOUNDING-BOX FIT
// =============================================================================

/**
 * Scale dimensions to fit within a bounding box while preserving aspect ratio.
 * Uses a single scaleFactor applied to both width and height, so aspect ratio
 * is always preserved. Used by both server and procedural spine paths.
 *
 * @param canonicalWidth - Unscaled width (e.g. from calculateWidth or server)
 * @param canonicalHeight - Unscaled height (e.g. from calculateHeight or server)
 * @param maxWidth - Maximum allowed width
 * @param maxHeight - Maximum allowed height
 * @returns Fitted width/height and the scaleFactor used
 */
export function fitToBoundingBox(
  canonicalWidth: number,
  canonicalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number; scaleFactor: number } {
  const widthScale = maxWidth / canonicalWidth;
  const heightScale = maxHeight / canonicalHeight;
  const scaleFactor = Math.min(widthScale, heightScale);
  return {
    width: Math.round(canonicalWidth * scaleFactor),
    height: Math.round(canonicalHeight * scaleFactor),
    scaleFactor,
  };
}

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Check if spine is "thin" and needs special handling.
 */
export function isThinSpine(width: number): boolean {
  return width < TOUCH_TARGETS.MIN_THICKNESS;
}

/**
 * Check if spine is "thick" (long audiobook).
 */
export function isThickSpine(width: number): boolean {
  return width > 150;
}

/**
 * Get human-readable duration description from width.
 */
export function widthToDuration(width: number): string {
  if (width <= 30) return 'Under 3 hours';
  if (width <= 60) return '3-10 hours';
  if (width <= 100) return '10-20 hours';
  if (width <= 150) return '20-35 hours';
  return 'Over 35 hours';
}

// =============================================================================
// DURATION-BASED SCALE FACTOR
// =============================================================================

// Range: 0.70 (0 hours) to 1.15 (30 hours), then linear ramp to 1.40 (60+ hours)
const DURATION_SCALE_MIN = 0.70;
const DURATION_SCALE_MAX = 1.15;
const DURATION_MAX_HOURS = 30;
export const DURATION_SCALE_LONG_MAX = 1.40;
const DURATION_LONG_CAP_HOURS = 60;

/**
 * Calculate a continuous scale factor based on book duration.
 * Uses ease-out curve (square root) for smooth, natural distribution.
 * Books over 30 hours continue scaling linearly up to 1.40 at 60+ hours.
 *
 * @param durationSeconds - Book duration in seconds
 * @returns Scale multiplier (0.70 to 1.40)
 */
export function getDurationScale(durationSeconds: number): number {
  const hours = Math.max(0, durationSeconds / 3600);

  if (hours <= DURATION_MAX_HOURS) {
    const t = Math.sqrt(hours / DURATION_MAX_HOURS);
    return DURATION_SCALE_MIN + (DURATION_SCALE_MAX - DURATION_SCALE_MIN) * t;
  }

  const extraHours = Math.min(hours, DURATION_LONG_CAP_HOURS) - DURATION_MAX_HOURS;
  const extraRange = DURATION_LONG_CAP_HOURS - DURATION_MAX_HOURS;
  return DURATION_SCALE_MAX + (DURATION_SCALE_LONG_MAX - DURATION_SCALE_MAX) * (extraHours / extraRange);
}
