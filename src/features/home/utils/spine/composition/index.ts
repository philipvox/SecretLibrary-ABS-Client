/**
 * src/features/home/utils/spine/composition/index.ts
 *
 * Composition system exports.
 *
 * MIGRATION NOTE: Profiles are now exported from the unified profiles system.
 * The generator.ts uses the new system directly.
 */

// Types
export * from './types';

// Profiles - re-export from unified profiles system
export {
  getCompositionProfile,
  GENRE_PROFILES as GENRE_COMPOSITION_PROFILES,
} from '../profiles';

// Generator
export {
  generateComposition,
  isVerticalTitle,
  isVerticalAuthor,
  getTitleRotation,
  getAuthorRotation,
} from './generator';
