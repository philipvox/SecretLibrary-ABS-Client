/**
 * src/features/home/utils/spine/genre/matcher.ts
 *
 * Improved genre matching with exact matching and aliases.
 * Replaces the old substring-based priority matching.
 */

// =============================================================================
// GENRE TAXONOMY
// =============================================================================

export interface GenreDefinition {
  /** Canonical genre profile name */
  profile: string;
  /** Priority for matching (higher = checked first) */
  priority: number;
  /** Alternative names/spellings for this genre */
  aliases?: string[];
}

/**
 * Complete genre taxonomy with exact matching.
 * Each entry is lowercase for consistent matching.
 */
export const GENRE_TAXONOMY: Record<string, GenreDefinition> = {
  // =============================================================================
  // SPECULATIVE FICTION (Priority: 90-110)
  // =============================================================================
  'fantasy': { profile: 'fantasy', priority: 100 },
  'epic fantasy': { profile: 'fantasy', priority: 110 },
  'high fantasy': { profile: 'fantasy', priority: 110 },
  'urban fantasy': { profile: 'fantasy', priority: 105 },
  'dark fantasy': { profile: 'fantasy', priority: 105 },
  'cozy fantasy': { profile: 'fantasy', priority: 105 },

  'science fiction': { profile: 'science-fiction', priority: 100 },
  'sci-fi': { profile: 'science-fiction', priority: 100, aliases: ['scifi'] },
  'space opera': { profile: 'science-fiction', priority: 110 },
  'cyberpunk': { profile: 'science-fiction', priority: 105 },
  'dystopian': { profile: 'science-fiction', priority: 95 },

  'horror': { profile: 'horror', priority: 100 },
  'psychological horror': { profile: 'horror', priority: 105 },
  'gothic horror': { profile: 'horror', priority: 105 },
  'supernatural': { profile: 'horror', priority: 95 },

  // =============================================================================
  // THRILLER / MYSTERY (Priority: 80-100)
  // =============================================================================
  'thriller': { profile: 'thriller', priority: 100 },
  'suspense': { profile: 'thriller', priority: 100 },
  'psychological thriller': { profile: 'thriller', priority: 105 },
  'techno-thriller': { profile: 'thriller', priority: 105 },

  'mystery': { profile: 'mystery', priority: 100 },
  'cozy mystery': { profile: 'mystery', priority: 105 },
  'detective': { profile: 'mystery', priority: 95 },

  'crime': { profile: 'crime', priority: 100 },
  'true crime': { profile: 'crime', priority: 105 },
  'noir': { profile: 'crime', priority: 100 },
  'police procedural': { profile: 'crime', priority: 95 },

  // =============================================================================
  // ROMANCE (Priority: 70-90)
  // =============================================================================
  'romance': { profile: 'romance', priority: 100 },
  'contemporary romance': { profile: 'romance', priority: 105 },
  'historical romance': { profile: 'romance', priority: 105 },
  'paranormal romance': { profile: 'romance', priority: 105 },
  'romantic comedy': { profile: 'romance', priority: 105, aliases: ['rom-com'] },

  // =============================================================================
  // LITERARY FICTION (Priority: 60-80)
  // =============================================================================
  'literary fiction': { profile: 'literary-fiction', priority: 100 },
  'classics': { profile: 'classics', priority: 100 },
  'contemporary fiction': { profile: 'contemporary-fiction', priority: 95 },
  "women's fiction": { profile: 'contemporary-fiction', priority: 95 },
  'historical fiction': { profile: 'historical-fiction', priority: 100 },

  // =============================================================================
  // NON-FICTION - NARRATIVE (Priority: 70-90)
  // =============================================================================
  'biography': { profile: 'biography', priority: 100 },
  'autobiography': { profile: 'biography', priority: 100 },
  'memoir': { profile: 'biography', priority: 100 },

  'history': { profile: 'history', priority: 100 },
  'military history': { profile: 'history', priority: 105 },

  'journalism': { profile: 'non-fiction', priority: 90 },
  'essays': { profile: 'essays', priority: 95 },

  // =============================================================================
  // NON-FICTION - INSTRUCTIONAL (Priority: 60-80)
  // =============================================================================
  'self-help': { profile: 'self-help', priority: 100, aliases: ['self help'] },
  'business': { profile: 'business', priority: 100 },
  'entrepreneurship': { profile: 'business', priority: 95 },
  'personal finance': { profile: 'business', priority: 95 },

  'psychology': { profile: 'non-fiction', priority: 90 },
  'philosophy': { profile: 'non-fiction', priority: 90 },
  'science': { profile: 'non-fiction', priority: 90 },
  'popular science': { profile: 'non-fiction', priority: 95 },

  // =============================================================================
  // CHILDREN'S / YA (Priority: 80-100)
  // =============================================================================
  "children's": { profile: 'children-6-8', priority: 100 },
  'picture book': { profile: 'children-0-2', priority: 100 },
  'early readers': { profile: 'children-3-5', priority: 100 },
  'middle grade': { profile: 'children-9-12', priority: 100 },
  'young adult': { profile: 'young-adult', priority: 100, aliases: ['ya'] },

  // =============================================================================
  // OTHER FICTION (Priority: 50-70)
  // =============================================================================
  'adventure': { profile: 'adventure', priority: 80 },
  'western': { profile: 'western', priority: 80 },
  'humor': { profile: 'humor', priority: 80 },
  'satire': { profile: 'literary-fiction', priority: 85 },

  // =============================================================================
  // CATCH-ALL (Priority: 10-50)
  // =============================================================================
  'fiction': { profile: 'fiction', priority: 20 },
  'non-fiction': { profile: 'non-fiction', priority: 20, aliases: ['nonfiction'] },
  'adult': { profile: 'fiction', priority: 10 },
};

// =============================================================================
// NORMALIZATION
// =============================================================================

/**
 * Normalize genre string for matching.
 * - Lowercase
 * - Trim whitespace
 * - Split on '/' and take first part (for compound genres like "Sci-Fi / Fantasy")
 * - Normalize apostrophes
 * - Remove special characters
 */
export function normalizeGenre(genre: string): string {
  return genre
    .toLowerCase()
    .trim()
    .split('/')[0]                 // Take first genre if compound (e.g., "sci-fi / fantasy" → "sci-fi")
    .trim()                        // Trim again after split
    .replace(/['']/g, "'")        // Normalize apostrophes
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .replace(/[^\w\s'-]/g, '');    // Remove special chars except hyphen/apostrophe
}

// =============================================================================
// MATCHING
// =============================================================================

/**
 * Find matching genre profile with exact matching.
 *
 * Matching priority:
 * 1. Exact match
 * 2. Alias match
 * 3. Prefix match (for "Science Fiction & Fantasy" → "Science Fiction")
 * 4. Null (no match)
 *
 * @param genre - Raw genre string from book metadata
 * @returns Genre definition or null
 */
export function matchGenre(genre: string): GenreDefinition | null {
  const normalized = normalizeGenre(genre);

  // 1. Exact match
  if (GENRE_TAXONOMY[normalized]) {
    return GENRE_TAXONOMY[normalized];
  }

  // 2. Check aliases
  for (const [_key, definition] of Object.entries(GENRE_TAXONOMY)) {
    if (definition.aliases?.includes(normalized)) {
      return definition;
    }
  }

  // 3. Prefix match (for compound genres like "Science Fiction & Fantasy")
  for (const [key, definition] of Object.entries(GENRE_TAXONOMY)) {
    if (normalized.startsWith(key + ' ')) {
      return definition;
    }
  }

  return null;
}

/**
 * Find best matching genre from array of genres.
 * Returns the highest priority match.
 *
 * @param genres - Array of genre strings
 * @returns Best matching genre definition or null
 */
export function matchBestGenre(genres: string[] | undefined): GenreDefinition | null {
  if (!genres || genres.length === 0) {
    return null;
  }

  let bestMatch: GenreDefinition | null = null;

  for (const genre of genres) {
    const match = matchGenre(genre);
    if (match && (!bestMatch || match.priority > bestMatch.priority)) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

/**
 * Match combo genres (e.g., "Fantasy + Romance").
 * Returns both genre profiles if both are found.
 *
 * @param genres - Array of genre strings
 * @returns Tuple of [primary, secondary] or null
 */
export function matchComboGenres(
  genres: string[] | undefined
): [GenreDefinition, GenreDefinition] | null {
  if (!genres || genres.length < 2) {
    return null;
  }

  const first = matchGenre(genres[0]);
  const second = matchGenre(genres[1]);

  if (first && second && first.profile !== second.profile) {
    return [first, second];
  }

  return null;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get all genre profiles sorted by priority (highest first).
 */
export function getAllGenreProfiles(): GenreDefinition[] {
  return Object.values(GENRE_TAXONOMY).sort((a, b) => b.priority - a.priority);
}

/**
 * Check if two genre strings are equivalent.
 */
export function areGenresEquivalent(genre1: string, genre2: string): boolean {
  const match1 = matchGenre(genre1);
  const match2 = matchGenre(genre2);

  return match1?.profile === match2?.profile;
}
