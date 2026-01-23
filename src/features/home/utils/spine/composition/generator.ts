/**
 * src/features/home/utils/spine/composition/generator.ts
 *
 * Generates deterministic spine compositions from genre profiles.
 * Each book gets a unique layout based on its ID hash, with smart constraints.
 */

import { hashString, pickFromHash, hashToPercent } from '../core/hashing';
import { getCompositionProfile, getGenreProfile } from '../profiles';
import {
  SpineComposition,
  CompositionTitleOrientation,
  CompositionAuthorOrientation,
} from './types';

// =============================================================================
// COMPOSITION GENERATION
// =============================================================================

export interface CompositionContext {
  bookId: string;
  title: string;
  author: string;
  genreProfile: string;
  spineWidth?: number;      // Actual spine width in pixels
  seriesName?: string;      // For series consistency
}

/**
 * Generate complete spine composition for a book.
 *
 * Uses deterministic hashing to pick from genre's valid options,
 * with smart constraints based on title/author length and spine width.
 *
 * @param context - Book context with title, author, dimensions
 * @returns Complete composition configuration
 */
export function generateComposition(
  bookId: string,
  genreProfile: string = 'default',
  title?: string,
  author?: string,
  spineWidth?: number
): SpineComposition {
  const profile = getCompositionProfile(genreProfile);
  const hash = hashString(bookId);

  // Pick title options from profile arrays
  // Use different offsets for each property to ensure variety
  let titleOrientation = pickFromHash(profile.titleOrientations, hash, 0);
  const titleScale = pickFromHash(profile.titleScales, hash, 1);
  const titleWeight = pickFromHash(profile.titleWeights, hash, 2);
  const titleCase = pickFromHash(profile.titleCases, hash, 3);

  // Pick author options
  let authorOrientation = pickFromHash(profile.authorOrientations, hash, 6);
  const authorTreatment = pickFromHash(profile.authorTreatments, hash, 7);
  const authorScale = pickFromHash(profile.authorScales, hash, 8);

  // Pick layout options
  const density = pickFromHash(profile.densities, hash, 10);
  const alignment = pickFromHash(profile.alignments, hash, 11);

  // Pick decoration options
  const lineStyle = pickFromHash(profile.lineStyles, hash, 12);
  const decorativeElement = pickFromHash(profile.decorativeElements, hash, 13);

  // ═══════════════════════════════════════════════════════════════════════════
  // SMART TITLE ORIENTATION CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Rules:
  // 1. Small spines (< 60px): ALWAYS vertical - no exceptions
  // 2. Medium spines (60-90px): ALWAYS vertical - no exceptions
  // 3. Large spines (> 90px): Horizontal ONLY if single word ≤ 8 chars
  // 4. Stacked orientations only for very short titles (≤ 8 chars)

  if (title) {
    const canUseHorizontal = canTitleBeHorizontal(title, spineWidth);

    if (__DEV__) {
      console.log(`[Composition] "${title}" (${title.length} chars, width: ${spineWidth || 'unknown'}) - Picked: ${titleOrientation}, CanBeHorizontal: ${canUseHorizontal}`);
    }

    // If horizontal was picked but not allowed, force vertical
    if (titleOrientation === 'horizontal' && !canUseHorizontal) {
      titleOrientation = 'vertical-up';
      if (__DEV__) {
        console.log(`[Composition] ✋ BLOCKED horizontal for "${title}" - forcing vertical-up`);
      }
    }

    // If stacked was picked but title too long, convert to regular vertical
    if (titleOrientation === 'stacked-letters' || titleOrientation === 'stacked-words') {
      const isTooLongForStacking = title.trim().length > 8;
      if (isTooLongForStacking) {
        const oldOrientation = titleOrientation;
        titleOrientation = 'vertical-up';
        if (__DEV__) {
          console.log(`[Composition] 🔄 Converted ${oldOrientation} → vertical-up for "${title}" (too long for stacking)`);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SMART AUTHOR ORIENTATION CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Resolve relative author orientations first
  authorOrientation = resolveAuthorOrientation(
    authorOrientation,
    titleOrientation
  );

  // Check if long author name on thin spine
  if (author && spineWidth) {
    const authorTooLong = isAuthorTooLongForHorizontal(author, spineWidth);

    if (authorTooLong && authorOrientation === 'horizontal') {
      // Override: Force vertical for long names on thin spines
      authorOrientation = 'vertical-up';
    }
  }

  // Calculate letter spacing based on genre personality
  let letterSpacing = 0.02; // Default 2%
  if (profile.prefersExperimental) {
    letterSpacing += 0.02; // +2% for experimental
  }
  if (profile.prefersMinimal) {
    letterSpacing += 0.01; // +1% for minimal
  }
  if (profile.prefersBold) {
    letterSpacing += 0.01; // +1% for bold (needs breathing room)
  }

  // Weight mapping
  const authorWeight = titleWeight;

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHOR POSITION FROM GENRE PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  // Get author position from genre typography profile
  const genreTypography = getGenreProfile(genreProfile);
  const baseAuthorPosition = genreTypography.typography.layout.authorPosition;

  // Add some variation: 70% use genre default, 30% use opposite
  const shouldFlipPosition = hashToPercent(`${bookId}-author-pos`) < 30;
  const authorPosition = shouldFlipPosition
    ? (baseAuthorPosition === 'top' ? 'bottom' : 'top')
    : baseAuthorPosition;

  return {
    title: {
      orientation: titleOrientation,
      scale: titleScale,
      weight: titleWeight,
      case: titleCase,
      letterSpacing,
    },
    author: {
      orientation: authorOrientation,
      treatment: authorTreatment,
      scale: authorScale,
      weight: authorWeight,
    },
    layout: {
      density,
      alignment,
      authorPosition,
    },
    decoration: {
      lineStyle,
      element: decorativeElement,
    },
  };
}

// =============================================================================
// SMART CONSTRAINT LOGIC
// =============================================================================

// Spine width breakpoints
const SPINE_WIDTH_SMALL = 60;   // < 60px: narrow spines
const SPINE_WIDTH_LARGE = 90;   // > 90px: wide spines

/**
 * Determine if a title CAN be displayed horizontally.
 *
 * STRICT RULES:
 * 1. Small spines (< 60px): NEVER horizontal - always vertical
 * 2. Medium spines (60-90px): NEVER horizontal - always vertical
 * 3. Large spines (> 90px): Horizontal ONLY if:
 *    - Single word (no spaces)
 *    - Word is ≤ 8 characters (e.g., "VOYAGER" = 7 chars is OK)
 * 4. If spine width is unknown, default to vertical (safe choice)
 *
 * Examples:
 * - "VOYAGER" on 120px spine → horizontal OK (7 chars, single word)
 * - "THE GOOD MOTHER" on 100px spine → NO (3 words)
 * - "OATHBRINGER" on 100px spine → NO (11 chars, too long)
 * - "SHE" on 100px spine → horizontal OK (3 chars, single word)
 * - Anything on < 90px spine → NO
 *
 * @param title - Book title
 * @param spineWidth - Spine width in pixels (optional)
 * @returns true if title can be horizontal, false if must be vertical
 */
function canTitleBeHorizontal(title: string, spineWidth?: number): boolean {
  const cleaned = title.trim();
  const words = cleaned.split(/\s+/);

  // Rule 1: If spine width unknown, default to vertical (safe choice)
  if (spineWidth === undefined) {
    return false;
  }

  // Rule 2: Small and medium spines (< 90px) → NEVER horizontal
  if (spineWidth < SPINE_WIDTH_LARGE) {
    return false;
  }

  // Rule 3: Large spines (≥ 90px) → Only horizontal if single short word
  // Must be single word
  if (words.length !== 1) {
    return false;
  }

  // Single word must be ≤ 8 characters
  const singleWord = words[0];
  if (singleWord.length > 8) {
    return false;
  }

  // All checks passed - horizontal is allowed
  return true;
}

/**
 * Check if author name is too long for horizontal layout.
 *
 * STRICT RULES (matching title constraints):
 * 1. Small spines (< 60px): Author ALWAYS too long for horizontal
 * 2. Medium spines (60-90px): Author ALWAYS too long for horizontal
 * 3. Large spines (≥ 90px): Horizontal OK if name ≤ 15 characters
 *
 * @param author - Author name
 * @param spineWidth - Spine width in pixels
 * @returns true if name is too long for horizontal
 */
function isAuthorTooLongForHorizontal(author: string, spineWidth: number): boolean {
  const authorLength = author.trim().length;

  // Small and medium spines: Always too long (force vertical)
  if (spineWidth < SPINE_WIDTH_LARGE) {
    return true;
  }

  // Large spines: Allow horizontal if name is reasonably short
  // Max 15 chars for horizontal author on wide spine
  if (authorLength > 15) {
    return true;
  }

  return false;
}

// =============================================================================
// ORIENTATION RESOLUTION
// =============================================================================

/**
 * Resolve relative author orientations (match-title, oppose-title).
 *
 * @param authorOrientation - Author orientation (may be relative)
 * @param titleOrientation - Title orientation (absolute)
 * @returns Absolute author orientation
 */
function resolveAuthorOrientation(
  authorOrientation: CompositionAuthorOrientation,
  titleOrientation: CompositionTitleOrientation
): CompositionAuthorOrientation {
  // If author orientation is absolute, return as-is
  if (
    authorOrientation === 'horizontal' ||
    authorOrientation === 'vertical-up' ||
    authorOrientation === 'vertical-down'
  ) {
    return authorOrientation;
  }

  // Resolve 'match-title'
  if (authorOrientation === 'match-title') {
    switch (titleOrientation) {
      case 'horizontal':
      case 'stacked-words':
      case 'stacked-letters':
        return 'horizontal';
      case 'vertical-up':
        return 'vertical-up';
      case 'vertical-down':
        return 'vertical-down';
    }
  }

  // Resolve 'oppose-title' (opposite rotation)
  if (authorOrientation === 'oppose-title') {
    switch (titleOrientation) {
      case 'vertical-up':
        return 'vertical-down';
      case 'vertical-down':
        return 'vertical-up';
      case 'horizontal':
      case 'stacked-words':
      case 'stacked-letters':
        // Horizontal titles get vertical author for contrast
        return 'vertical-up';
    }
  }

  // Fallback
  return 'horizontal';
}

// =============================================================================
// AUTHOR POSITION LOGIC
// =============================================================================

/**
 * Determine author position (top or bottom) based on genre profile.
 * This should be extracted from the typography profile's authorPosition.
 *
 * For now, this is handled by the typography system in genre profiles.
 * The composition system focuses on orientation/treatment.
 */

// =============================================================================
// COMPOSITION UTILITIES
// =============================================================================

/**
 * Check if a composition uses vertical title orientation.
 */
export function isVerticalTitle(composition: SpineComposition): boolean {
  return (
    composition.title.orientation === 'vertical-up' ||
    composition.title.orientation === 'vertical-down' ||
    composition.title.orientation === 'stacked-letters'
  );
}

/**
 * Check if a composition uses vertical author orientation.
 */
export function isVerticalAuthor(composition: SpineComposition): boolean {
  return (
    composition.author.orientation === 'vertical-up' ||
    composition.author.orientation === 'vertical-down'
  );
}

/**
 * Get rotation angle for title orientation.
 * Returns degrees (0, 90, -90).
 */
export function getTitleRotation(orientation: CompositionTitleOrientation): number {
  switch (orientation) {
    case 'vertical-up':
      return -90; // Rotate CCW
    case 'vertical-down':
      return 90; // Rotate CW
    case 'horizontal':
    case 'stacked-words':
    case 'stacked-letters':
    default:
      return 0;
  }
}

/**
 * Get rotation angle for author orientation.
 */
export function getAuthorRotation(orientation: CompositionAuthorOrientation): number {
  switch (orientation) {
    case 'vertical-up':
      return -90;
    case 'vertical-down':
      return 90;
    case 'horizontal':
    default:
      return 0;
  }
}
