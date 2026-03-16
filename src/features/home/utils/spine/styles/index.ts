/**
 * src/features/home/utils/spine/styles/index.ts
 *
 * Unified style system for spine rendering.
 * Combines base styles, composition presets, and genre mapping
 * to provide a complete styling solution in ~200 lines vs ~4100 lines.
 */

import { BASE_STYLES, BaseTypographyStyle, BaseStyleName } from './baseStyles';
import { COMPOSITION_PRESETS, CompositionPreset, CompositionPresetName } from './compositionPresets';
import { GENRE_TO_STYLE, normalizeGenre } from './genreMap';

// Re-export types and constants
export { BASE_STYLES, BaseTypographyStyle, BaseStyleName } from './baseStyles';
export { COMPOSITION_PRESETS, CompositionPreset, CompositionPresetName } from './compositionPresets';
export { GENRE_TO_STYLE, getGenreMapping, normalizeGenre, GenreStyleMapping } from './genreMap';

/**
 * Resolved genre style combining typography and composition.
 */
export interface ResolvedGenreStyle {
  // Typography from base style
  title: BaseTypographyStyle['title'];
  author: BaseTypographyStyle['author'];
  // Composition options
  composition: CompositionPreset;
  // Source info for debugging
  styleName: BaseStyleName;
  compositionName: CompositionPresetName;
  matchedGenre: string;
}

/**
 * Resolve the complete style for a list of genres.
 * Tries each genre in order, returns first match.
 * Falls back to default if no match found.
 *
 * @param genres - Array of genre strings (e.g., ['Thriller', 'Mystery'])
 * @returns Complete style with typography and composition
 */
export function resolveGenreStyle(genres: string[]): ResolvedGenreStyle {
  // Try each genre in order
  for (const genre of genres) {
    const key = normalizeGenre(genre);
    const mapping = GENRE_TO_STYLE[key];

    if (mapping) {
      const baseStyle = BASE_STYLES[mapping.style];
      const composition = COMPOSITION_PRESETS[mapping.composition];

      return {
        title: baseStyle.title,
        author: baseStyle.author,
        composition,
        styleName: mapping.style,
        compositionName: mapping.composition,
        matchedGenre: genre,
      };
    }
  }

  // Fallback to default
  const defaultMapping = GENRE_TO_STYLE['default'];
  const defaultStyle = BASE_STYLES[defaultMapping.style];
  const defaultComposition = COMPOSITION_PRESETS[defaultMapping.composition];

  return {
    title: defaultStyle.title,
    author: defaultStyle.author,
    composition: defaultComposition,
    styleName: defaultMapping.style,
    compositionName: defaultMapping.composition,
    matchedGenre: 'default',
  };
}

/**
 * Check if a genre has a defined style mapping.
 */
export function hasGenreStyle(genre: string): boolean {
  const key = normalizeGenre(genre);
  return key in GENRE_TO_STYLE;
}

/**
 * Get all supported genres.
 */
export function getAllSupportedGenres(): string[] {
  return Object.keys(GENRE_TO_STYLE).filter(k => k !== 'default');
}

/**
 * Get genres that use a specific base style.
 */
export function getGenresByStyle(styleName: BaseStyleName): string[] {
  return Object.entries(GENRE_TO_STYLE)
    .filter(([_, mapping]) => mapping.style === styleName)
    .map(([genre]) => genre);
}

/**
 * Get genres that use a specific composition preset.
 */
export function getGenresByComposition(compositionName: CompositionPresetName): string[] {
  return Object.entries(GENRE_TO_STYLE)
    .filter(([_, mapping]) => mapping.composition === compositionName)
    .map(([genre]) => genre);
}
