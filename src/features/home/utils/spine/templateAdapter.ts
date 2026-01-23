/**
 * src/features/home/utils/spine/templateAdapter.ts
 *
 * Adapter layer between unified profiles and BookSpineVertical rendering.
 * Converts profile configurations into the format expected by the existing rendering system.
 *
 * MIGRATION NOTE: This adapter now uses the unified profiles system in ./profiles/
 * instead of the old ./templates/spineTemplates.ts. The API remains backwards-compatible.
 */

import {
  getProfile,
  getBestProfileForGenre,
  GENRE_PROFILES,
} from './profiles';

import {
  GenreProfile,
  applySpineSizeOverrides,
  selectFontForBook,
  hashString,
  FontWeight,
} from './profiles/types';

// =============================================================================
// TYPE CONVERSIONS
// =============================================================================

/**
 * Convert profile orientation to simplified composition orientation format.
 */
function convertTitleOrientation(profileOrientation: string): string {
  switch (profileOrientation) {
    case 'vertical-up':
    case 'vertical-down':
      return 'vertical';
    case 'horizontal':
      return 'horizontal';
    case 'stacked-letters':
      return 'stacked-letters';
    case 'stacked-words':
      return 'stacked-words';
    case 'vertical-two-row':
      return 'vertical-two-row';
    default:
      return 'vertical'; // Safe fallback
  }
}

/**
 * Convert author orientation (similar to title)
 */
function convertAuthorOrientation(profileOrientation: string): string {
  switch (profileOrientation) {
    case 'vertical-up':
    case 'vertical-down':
      return 'vertical';
    case 'horizontal':
    case 'horizontal-below-title':
      return 'horizontal';
    case 'stacked-letters':
      return 'stacked-letters';
    case 'stacked-words':
      return 'stacked-words';
    case 'vertical-two-row':
      return 'vertical-two-row';
    default:
      return 'horizontal'; // Authors default to horizontal
  }
}

/**
 * Convert profile text case to composition format
 */
function convertTextCase(profileCase: string): string {
  switch (profileCase) {
    case 'uppercase':
      return 'uppercase';
    case 'lowercase':
      return 'lowercase';
    case 'capitalize':
      return 'mixed'; // Profile's capitalize maps to composition's mixed
    default:
      return 'mixed';
  }
}

/**
 * Convert weight string to descriptive value
 */
function convertWeightToNumber(weight: string): string {
  switch (weight) {
    case '300': return 'light';
    case '400': return 'regular';
    case '500': return 'medium';
    case '600': return 'semibold';
    case '700': return 'bold';
    case '800': return 'bold';
    case '900': return 'black';
    default: return 'regular';
  }
}

// =============================================================================
// PROFILE MATCHING
// =============================================================================

/**
 * Match book genres to best profile.
 * Tries each genre in order, returns first match.
 * Falls back to default profile if no match found.
 */
export function matchBookToTemplate(genres: string[]): GenreProfile {
  if (!genres || genres.length === 0) {
    return getProfile('default');
  }

  // Try each genre, looking for preferred matches first
  for (const genre of genres) {
    const normalizedGenre = genre.toLowerCase().trim();
    const profile = GENRE_PROFILES.find(p =>
      p.preferredFor?.includes(normalizedGenre)
    );
    if (profile) return profile;
  }

  // Try again for usedFor matches
  for (const genre of genres) {
    const normalizedGenre = genre.toLowerCase().trim();
    const profile = GENRE_PROFILES.find(p =>
      p.usedFor.includes(normalizedGenre)
    );
    if (profile) return profile;
  }

  // Use helper function as final fallback
  return getBestProfileForGenre(genres[0]?.toLowerCase() || 'fiction');
}

// =============================================================================
// PROFILE APPLICATION
// =============================================================================

export interface AppliedTemplateConfig {
  // Title configuration
  title: {
    orientation: string;
    fontSize: number;
    fontFamily: string;
    weight: FontWeight;
    case: string;
    letterSpacing: number;
    lineHeight?: number;
    lineHeightScale?: number;
    maxLines?: number;
    wordsPerLine?: number;
    textSplitPercent?: number;
    placement: string;
    align: string;
    heightPercent: number;
    paddingHorizontal: number;
    paddingVertical: number;
  };

  // Author configuration
  author: {
    orientation: string;
    fontSize: number;
    fontFamily: string;
    weight: FontWeight;
    case: string;
    letterSpacing: number;
    lineHeight?: number;
    lineHeightScale?: number;
    textSplitPercent?: number;
    placement: string;
    align: string;
    heightPercent: number;
    treatment: string;
    paddingHorizontal: number;
    paddingVertical: number;
  };

  // Decoration
  decoration: {
    element: string;
    lineStyle: string;
  };

  // Metadata
  templateId: string;
  templateName: string;
}

/**
 * Apply profile configuration for a given spine width.
 * Retrieves profile, applies size-based overrides, and converts to rendering format.
 *
 * @param genres - Book genres for profile matching
 * @param spineWidth - Width of the spine for size-based config
 * @param bookTitle - Book title for deterministic font selection (if fontFamilies defined)
 */
export function applyTemplateConfig(
  genres: string[],
  spineWidth: number,
  bookTitle: string = ''
): AppliedTemplateConfig {
  // Match profile
  const profile = matchBookToTemplate(genres);

  // Get size-appropriate configs by applying overrides
  const titleConfig = applySpineSizeOverrides(profile.title, spineWidth);
  const authorConfig = applySpineSizeOverrides(profile.author, spineWidth);

  // Select fonts (if fontFamilies is defined, picks one based on book title hash)
  const titleFont = selectFontForBook(
    titleConfig.fontFamily,
    titleConfig.fontFamilies,
    bookTitle
  );
  const authorFont = selectFontForBook(
    authorConfig.fontFamily,
    authorConfig.fontFamilies,
    bookTitle
  );

  // Convert to rendering format
  return {
    title: {
      orientation: convertTitleOrientation(titleConfig.orientation),
      fontSize: titleConfig.fontSize,
      fontFamily: titleFont,
      weight: convertWeightToNumber(titleConfig.weight),
      case: convertTextCase(titleConfig.case),
      letterSpacing: titleConfig.letterSpacing || 0,
      lineHeight: titleConfig.lineHeight,
      lineHeightScale: titleConfig.lineHeightScale,
      maxLines: titleConfig.maxLines,
      wordsPerLine: titleConfig.wordsPerLine,
      textSplitPercent: titleConfig.textSplitPercent,
      placement: titleConfig.placement,
      align: titleConfig.align || 'center',
      heightPercent: titleConfig.heightPercent,
      paddingHorizontal: titleConfig.paddingHorizontal || 8,
      paddingVertical: titleConfig.paddingVertical || 8,
    },
    author: {
      orientation: convertAuthorOrientation(authorConfig.orientation),
      fontSize: authorConfig.fontSize,
      fontFamily: authorFont,
      weight: convertWeightToNumber(authorConfig.weight),
      case: convertTextCase(authorConfig.case),
      letterSpacing: authorConfig.letterSpacing || 0,
      lineHeight: authorConfig.lineHeight,
      lineHeightScale: authorConfig.lineHeightScale,
      textSplitPercent: authorConfig.textSplitPercent,
      placement: authorConfig.placement,
      align: authorConfig.align || 'center',
      heightPercent: authorConfig.heightPercent,
      treatment: authorConfig.treatment || 'plain',
      paddingHorizontal: authorConfig.paddingHorizontal || 8,
      paddingVertical: authorConfig.paddingVertical || 6,
    },
    decoration: profile.decoration,
    templateId: profile.id,
    templateName: profile.name,
  };
}

/**
 * Check if a book should use template-driven rendering.
 * Returns true if the book has genres that match our profile system.
 */
export function shouldUseTemplates(genres: string[]): boolean {
  if (!genres || genres.length === 0) return false;

  // Try to find a matching profile
  const hasMatch = genres.some(genre => {
    const normalizedGenre = genre.toLowerCase().trim();
    return GENRE_PROFILES.some(p =>
      p.usedFor.includes(normalizedGenre) ||
      p.preferredFor?.includes(normalizedGenre)
    );
  });

  return hasMatch;
}

/**
 * Get template info for debugging
 */
export function getTemplateInfo(genres: string[], spineWidth: number): string {
  const profile = matchBookToTemplate(genres);
  const titleConfig = applySpineSizeOverrides(profile.title, spineWidth);

  let sizeCategory = 'medium';
  if (spineWidth < 60) sizeCategory = 'small';
  else if (spineWidth > 90) sizeCategory = 'large';

  return `${profile.name} (${sizeCategory}, ${titleConfig.orientation})`;
}

// =============================================================================
// BACKWARDS COMPATIBILITY EXPORTS
// =============================================================================

// Re-export for backwards compatibility with code expecting old template types
export type SpineTemplate = GenreProfile;
export const SPINE_TEMPLATES = GENRE_PROFILES;

/**
 * @deprecated Use getProfile or getBestProfileForGenre instead
 */
export function getBestTemplateForGenre(genre: string): GenreProfile {
  return getBestProfileForGenre(genre);
}

/**
 * @deprecated Use applySpineSizeOverrides from profiles/types instead
 */
export function getConfigForSize<T extends { sizes?: Record<string, Partial<T>> }>(
  config: T,
  spineWidth: number
): T {
  return applySpineSizeOverrides(config as any, spineWidth);
}
