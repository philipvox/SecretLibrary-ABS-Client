/**
 * src/features/home/utils/spine/profiles/index.ts
 *
 * Unified spine profile system - single source of truth for genre profiles.
 * Exports all 41 genre profiles and utility functions for profile access.
 */

// Export types
export * from './types';

// Import all genre profiles
import { ADVENTURE } from './genres/adventure';
import { ANTHOLOGY } from './genres/anthology';
import { ART_DESIGN } from './genres/art-design';
import { BIOGRAPHY } from './genres/biography';
import { BUSINESS } from './genres/business';
import { CHILDREN } from './genres/children';
import { CLASSICS } from './genres/classics';
import { CONTEMPORARY_FICTION } from './genres/contemporary-fiction';
import { COOKING } from './genres/cooking';
import { COZY_MYSTERY } from './genres/cozy-mystery';
import { DEFAULT } from './genres/default';
import { DYSTOPIAN } from './genres/dystopian';
import { EPIC_FANTASY } from './genres/epic-fantasy';
import { ESPIONAGE } from './genres/espionage';
import { FANTASY } from './genres/fantasy';
import { HEALTH } from './genres/health';
import { HISTORICAL_FICTION } from './genres/historical-fiction';
import { HISTORY } from './genres/history';
import { HORROR } from './genres/horror';
import { HUMOR } from './genres/humor';
import { LITERARY_FICTION } from './genres/literary-fiction';
import { LITRPG } from './genres/litrpg';
import { MILITARY } from './genres/military';
import { MUSIC_ARTS } from './genres/music-arts';
import { MYSTERY } from './genres/mystery';
import { NON_FICTION } from './genres/non-fiction';
import { PARANORMAL_ROMANCE } from './genres/paranormal-romance';
import { PHILOSOPHY } from './genres/philosophy';
import { POETRY } from './genres/poetry';
import { ROMANCE } from './genres/romance';
import { SCIENCE } from './genres/science';
import { SCIENCE_FICTION } from './genres/science-fiction';
import { SELF_HELP } from './genres/self-help';
import { SPORTS } from './genres/sports';
import { TECHNOLOGY } from './genres/technology';
import { THRILLER } from './genres/thriller';
import { TRAVEL } from './genres/travel';
import { TRUE_CRIME } from './genres/true-crime';
import { URBAN_FANTASY } from './genres/urban-fantasy';
import { WESTERN } from './genres/western';
import { YOUNG_ADULT } from './genres/young-adult';

import { GenreProfile } from './types';

// =============================================================================
// PROFILE EXPORTS
// =============================================================================

/** All genre profiles */
export const GENRE_PROFILES: GenreProfile[] = [
  ADVENTURE,
  ANTHOLOGY,
  ART_DESIGN,
  BIOGRAPHY,
  BUSINESS,
  CHILDREN,
  CLASSICS,
  CONTEMPORARY_FICTION,
  COOKING,
  COZY_MYSTERY,
  DEFAULT,
  DYSTOPIAN,
  EPIC_FANTASY,
  ESPIONAGE,
  FANTASY,
  HEALTH,
  HISTORICAL_FICTION,
  HISTORY,
  HORROR,
  HUMOR,
  LITERARY_FICTION,
  LITRPG,
  MILITARY,
  MUSIC_ARTS,
  MYSTERY,
  NON_FICTION,
  PARANORMAL_ROMANCE,
  PHILOSOPHY,
  POETRY,
  ROMANCE,
  SCIENCE,
  SCIENCE_FICTION,
  SELF_HELP,
  SPORTS,
  TECHNOLOGY,
  THRILLER,
  TRAVEL,
  TRUE_CRIME,
  URBAN_FANTASY,
  WESTERN,
  YOUNG_ADULT,
];

/** Profiles indexed by ID for quick lookup */
export const PROFILES_BY_ID: Record<string, GenreProfile> = Object.fromEntries(
  GENRE_PROFILES.map(p => [p.id, p])
);

// Re-export individual profiles for direct import if needed
export {
  ADVENTURE,
  ANTHOLOGY,
  ART_DESIGN,
  BIOGRAPHY,
  BUSINESS,
  CHILDREN,
  CLASSICS,
  CONTEMPORARY_FICTION,
  COOKING,
  COZY_MYSTERY,
  DEFAULT,
  DYSTOPIAN,
  EPIC_FANTASY,
  ESPIONAGE,
  FANTASY,
  HEALTH,
  HISTORICAL_FICTION,
  HISTORY,
  HORROR,
  HUMOR,
  LITERARY_FICTION,
  LITRPG,
  MILITARY,
  MUSIC_ARTS,
  MYSTERY,
  NON_FICTION,
  PARANORMAL_ROMANCE,
  PHILOSOPHY,
  POETRY,
  ROMANCE,
  SCIENCE,
  SCIENCE_FICTION,
  SELF_HELP,
  SPORTS,
  TECHNOLOGY,
  THRILLER,
  TRAVEL,
  TRUE_CRIME,
  URBAN_FANTASY,
  WESTERN,
  YOUNG_ADULT,
};

// =============================================================================
// PROFILE ACCESS FUNCTIONS
// =============================================================================

/**
 * Get profile by ID.
 * Returns the default profile if not found.
 */
export function getProfile(id: string): GenreProfile {
  return PROFILES_BY_ID[id] || DEFAULT;
}

/**
 * Get profile by ID, returning undefined if not found.
 */
export function getProfileOrNull(id: string): GenreProfile | undefined {
  return PROFILES_BY_ID[id];
}

/**
 * Get profiles that handle a specific genre.
 * Checks both usedFor and preferredFor arrays.
 */
export function getProfilesForGenre(genre: string): GenreProfile[] {
  const normalizedGenre = genre.toLowerCase().trim();
  return GENRE_PROFILES.filter(p =>
    p.usedFor.includes(normalizedGenre) ||
    p.preferredFor?.includes(normalizedGenre)
  );
}

/**
 * Get the best profile for a genre.
 * Prefers profiles where the genre is in preferredFor, then usedFor.
 * Falls back to default if no match found.
 */
export function getBestProfileForGenre(genre: string): GenreProfile {
  const normalizedGenre = genre.toLowerCase().trim();

  // First try exact ID match
  const byId = PROFILES_BY_ID[normalizedGenre];
  if (byId) return byId;

  // Try preferredFor match
  const preferred = GENRE_PROFILES.find(p =>
    p.preferredFor?.includes(normalizedGenre)
  );
  if (preferred) return preferred;

  // Try usedFor match
  const usable = GENRE_PROFILES.find(p =>
    p.usedFor.includes(normalizedGenre)
  );
  if (usable) return usable;

  // Fallback to default
  return DEFAULT;
}

/**
 * Get all profile IDs.
 */
export function getAllProfileIds(): string[] {
  return GENRE_PROFILES.map(p => p.id);
}

// =============================================================================
// COMPOSITION OPTIONS ACCESS
// =============================================================================

/**
 * Get composition options for a profile.
 * Convenience function for accessing the options property.
 */
export function getCompositionOptions(profileId: string) {
  const profile = getProfile(profileId);
  return profile.options;
}

/**
 * Get personality flags for a profile.
 */
export function getPersonalityFlags(profileId: string) {
  const profile = getProfile(profileId);
  return profile.personality;
}

// =============================================================================
// BACKWARDS COMPATIBILITY LAYER
// =============================================================================

// Import old typography types for compatibility
import {
  SpineTypography,
  GenreTypographyProfile,
  FontWeight as OldFontWeight,
  TextTransform,
} from '../typography/types';

/**
 * Convert new profile format to old SpineTypography format.
 * For backwards compatibility during migration.
 */
function convertToSpineTypography(profile: GenreProfile): SpineTypography {
  // Map new weight format to old
  const weightMap: Record<string, OldFontWeight> = {
    '300': 'light',
    '400': 'regular',
    '500': 'medium',
    '600': 'bold',
    '700': 'bold',
    '800': 'black',
    '900': 'black',
  };

  // Map new case to old transform
  const caseToTransform: Record<string, TextTransform> = {
    'uppercase': 'uppercase',
    'lowercase': 'lowercase',
    'capitalize': 'capitalize',
  };

  // Determine personality based on flags
  let personality: SpineTypography['personality'] = 'classic';
  if (profile.personality.prefersBold && !profile.personality.prefersMinimal) {
    personality = 'bold';
  } else if (profile.personality.prefersMinimal) {
    personality = 'modern';
  } else if (profile.personality.prefersExperimental) {
    personality = 'stark';
  } else if (profile.personality.prefersClassic) {
    personality = 'refined';
  }

  return {
    title: {
      fontFamily: profile.title.fontFamily as any,
      weight: weightMap[profile.title.weight] || 'medium',
      style: 'normal',
      transform: caseToTransform[profile.title.case] || 'capitalize',
      letterSpacing: profile.title.letterSpacing || 0.02,
    },
    author: {
      fontFamily: profile.author.fontFamily as any,
      weight: weightMap[profile.author.weight] || 'regular',
      style: 'normal',
      transform: caseToTransform[profile.author.case] || 'capitalize',
      letterSpacing: profile.author.letterSpacing || 0.01,
      abbreviation: 'auto',
    },
    layout: {
      authorPosition: profile.author.placement,
      authorOrientationBias: profile.author.orientation === 'horizontal' ? 'horizontal'
        : profile.author.orientation.includes('vertical') ? 'vertical' : 'neutral',
      authorBox: profile.author.treatment === 'boxed',
    },
    personality,
  };
}

/**
 * Get genre profile in OLD format (GenreTypographyProfile).
 * For backwards compatibility with generator.ts and composition/generator.ts.
 *
 * @deprecated Use getProfile() for new code
 */
export function getGenreProfile(profileId: string): GenreTypographyProfile {
  const profile = getProfile(profileId);
  return {
    name: profile.id,
    displayName: profile.name,
    typography: convertToSpineTypography(profile),
    priority: profile.preferredFor?.includes(profile.id) ? 10 : 5,
  };
}

/**
 * Get composition profile in old format.
 * For backwards compatibility with composition/generator.ts.
 *
 * @deprecated Use getCompositionOptions() for new code
 */
export function getCompositionProfile(profileId: string): GenreProfile['options'] & {
  prefersExperimental: boolean;
  prefersMinimal: boolean;
  prefersBold: boolean;
  prefersClassic: boolean;
} {
  const profile = getProfile(profileId);
  return {
    ...profile.options,
    prefersExperimental: profile.personality.prefersExperimental,
    prefersMinimal: profile.personality.prefersMinimal,
    prefersBold: profile.personality.prefersBold,
    prefersClassic: profile.personality.prefersClassic,
  };
}
