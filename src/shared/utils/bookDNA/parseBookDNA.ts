/**
 * src/shared/utils/bookDNA/parseBookDNA.ts
 *
 * Utility to parse BookDNA tags from AudiobookShelf items.
 * BookDNA tags use a `dna:` prefix with structured categories:
 *
 * Examples:
 *   dna:mood:thrills:8      -> moodScores.thrills = 0.8
 *   dna:spectrum:dark-light:-5 -> spectrums.darkLight = -0.5
 *   dna:pacing:fast         -> pacing = 'fast'
 *   dna:trope:found-family  -> tropes = ['found-family']
 *   dna:theme:redemption    -> themes = ['redemption']
 *
 * Books WITH BookDNA get accurate, multi-dimensional scoring.
 * Books WITHOUT BookDNA fall back to genre/tag inference (lower confidence).
 */

/** Mood types for quiz-to-DNA mapping */
export type Mood = 'comfort' | 'thrills' | 'escape' | 'feels';

// ============================================================================
// BOOK DNA INTERFACE
// ============================================================================

export interface BookDNA {
  // Structural attributes
  length: 'short' | 'medium' | 'long' | 'epic' | null;
  pacing: 'slow' | 'moderate' | 'fast' | 'variable' | null;
  structure: 'linear' | 'flashback' | 'multi-pov' | 'frame-narrative' | 'epistolary' | null;
  pov: 'first' | 'close-third' | 'omniscient' | 'multi-first' | null;
  seriesPosition: 'standalone' | 'series-start' | 'mid-series' | 'finale' | null;
  pubEra: 'classic' | 'modern-classic' | 'contemporary' | null;

  // Spectrums (-1 to 1, where 0 is neutral)
  spectrums: {
    darkLight: number | null;           // -1 = very dark, +1 = very light
    seriousHumorous: number | null;     // -1 = dead serious, +1 = comedy
    denseAccessible: number | null;     // -1 = dense prose, +1 = easy read
    plotCharacter: number | null;       // -1 = plot-driven, +1 = character-driven
    bleakHopeful: number | null;        // -1 = bleak ending, +1 = hopeful ending
    familiarChallenging: number | null; // -1 = familiar tropes, +1 = subversive
  };

  // Categorical arrays
  tropes: string[];
  themes: string[];
  settings: string[];

  // Audiobook-specific
  narratorStyle: 'theatrical' | 'subtle' | 'warm' | 'dry' | 'intense' | null;
  production: 'full-cast' | 'single-voice' | 'duet' | 'soundscape' | null;

  // Mood scores (0 to 1, where 0 = none, 1 = primary mood)
  moodScores: {
    thrills: number | null;
    drama: number | null;
    laughs: number | null;
    wonder: number | null;
    heart: number | null;
    ideas: number | null;
  };

  // Recommendation helpers
  comparableTitles: string[];
  vibe: string | null;

  // Meta information
  hasDNA: boolean;
  tagCount: number;
}

// ============================================================================
// PARSER FUNCTIONS
// ============================================================================

/**
 * Parse BookDNA from an array of tags.
 * Only processes tags with the `dna:` prefix.
 *
 * @param tags - All tags from item.media.tags
 * @returns Parsed BookDNA structure
 */
export function parseBookDNA(tags: string[] | undefined): BookDNA {
  const emptyDNA: BookDNA = {
    length: null,
    pacing: null,
    structure: null,
    pov: null,
    seriesPosition: null,
    pubEra: null,
    spectrums: {
      darkLight: null,
      seriousHumorous: null,
      denseAccessible: null,
      plotCharacter: null,
      bleakHopeful: null,
      familiarChallenging: null,
    },
    tropes: [],
    themes: [],
    settings: [],
    narratorStyle: null,
    production: null,
    moodScores: {
      thrills: null,
      drama: null,
      laughs: null,
      wonder: null,
      heart: null,
      ideas: null,
    },
    comparableTitles: [],
    vibe: null,
    hasDNA: false,
    tagCount: 0,
  };

  if (!tags || tags.length === 0) {
    return emptyDNA;
  }

  // Filter to only DNA tags
  const dnaTags = tags.filter(t => t.toLowerCase().startsWith('dna:'));

  if (dnaTags.length === 0) {
    return emptyDNA;
  }

  // Helper to get a simple value from a category
  const getSimple = (category: string): string | null => {
    const tag = dnaTags.find(t =>
      t.toLowerCase().startsWith(`dna:${category}:`)
    );
    if (!tag) return null;
    const parts = tag.split(':');
    return parts[2]?.toLowerCase() || null;
  };

  // Helper to get a spectrum value (-10 to 10 in tag, normalized to -1 to 1)
  const getSpectrum = (name: string): number | null => {
    const tag = dnaTags.find(t =>
      t.toLowerCase().startsWith(`dna:spectrum:${name}:`)
    );
    if (!tag) return null;
    const parts = tag.split(':');
    const value = parseInt(parts[3], 10);
    if (isNaN(value)) return null;
    // Normalize from -10..10 to -1..1
    return Math.max(-1, Math.min(1, value / 10));
  };

  // Helper to get a mood score (0 to 10 in tag, normalized to 0 to 1)
  const getMood = (name: string): number | null => {
    const tag = dnaTags.find(t =>
      t.toLowerCase().startsWith(`dna:mood:${name}:`)
    );
    if (!tag) return null;
    const parts = tag.split(':');
    const value = parseInt(parts[3], 10);
    if (isNaN(value)) return null;
    // Normalize from 0..10 to 0..1
    return Math.max(0, Math.min(1, value / 10));
  };

  // Helper to get all values from a category (for arrays like tropes, themes)
  const getArray = (category: string): string[] => {
    return dnaTags
      .filter(t => t.toLowerCase().startsWith(`dna:${category}:`))
      .map(t => {
        const parts = t.split(':');
        return parts[2]?.toLowerCase() || '';
      })
      .filter(Boolean);
  };

  return {
    length: getSimple('length') as BookDNA['length'],
    pacing: getSimple('pacing') as BookDNA['pacing'],
    structure: getSimple('structure') as BookDNA['structure'],
    pov: getSimple('pov') as BookDNA['pov'],
    seriesPosition: getSimple('series-position') as BookDNA['seriesPosition'],
    pubEra: getSimple('pub-era') as BookDNA['pubEra'],

    spectrums: {
      darkLight: getSpectrum('dark-light'),
      seriousHumorous: getSpectrum('serious-humorous'),
      denseAccessible: getSpectrum('dense-accessible'),
      plotCharacter: getSpectrum('plot-character'),
      bleakHopeful: getSpectrum('bleak-hopeful'),
      familiarChallenging: getSpectrum('familiar-challenging'),
    },

    tropes: getArray('trope'),
    themes: getArray('theme'),
    settings: getArray('setting'),

    narratorStyle: getSimple('narrator-style') as BookDNA['narratorStyle'],
    production: getSimple('production') as BookDNA['production'],

    moodScores: {
      thrills: getMood('thrills'),
      drama: getMood('drama'),
      laughs: getMood('laughs'),
      wonder: getMood('wonder'),
      heart: getMood('heart'),
      ideas: getMood('ideas'),
    },

    comparableTitles: getArray('comparable'),
    vibe: getSimple('vibe'),

    hasDNA: true,
    tagCount: dnaTags.length,
  };
}

// ============================================================================
// DNA QUALITY ASSESSMENT
// ============================================================================

/**
 * Minimum DNA tags required for "high quality" DNA scoring.
 * Books with fewer tags get reduced confidence.
 */
export const DNA_QUALITY_THRESHOLDS = {
  /** Minimum for any DNA-based scoring */
  MINIMUM: 3,
  /** Good coverage - medium confidence */
  GOOD: 8,
  /** Excellent coverage - high confidence */
  EXCELLENT: 15,
} as const;

/**
 * Check if a book has sufficient DNA for accurate scoring.
 *
 * @param dna - Parsed BookDNA
 * @returns Quality level: 'excellent' | 'good' | 'minimal' | 'none'
 */
export function getDNAQuality(dna: BookDNA): 'excellent' | 'good' | 'minimal' | 'none' {
  if (!dna.hasDNA) return 'none';
  if (dna.tagCount >= DNA_QUALITY_THRESHOLDS.EXCELLENT) return 'excellent';
  if (dna.tagCount >= DNA_QUALITY_THRESHOLDS.GOOD) return 'good';
  if (dna.tagCount >= DNA_QUALITY_THRESHOLDS.MINIMUM) return 'minimal';
  return 'none';
}

/**
 * Check if DNA has mood scores (the most important for mood matching).
 */
export function hasMoodScores(dna: BookDNA): boolean {
  const scores = dna.moodScores;
  return (
    scores.thrills !== null ||
    scores.drama !== null ||
    scores.laughs !== null ||
    scores.wonder !== null ||
    scores.heart !== null ||
    scores.ideas !== null
  );
}

// ============================================================================
// MOOD MAPPING
// ============================================================================

/**
 * Maps quiz moods to BookDNA mood score keys.
 * Quiz uses different names than BookDNA for UX reasons.
 * Note: Mood type has 4 values (comfort, thrills, escape, feels).
 * BookDNA has 6 mood scores (thrills, drama, laughs, wonder, heart, ideas).
 */
export const QUIZ_MOOD_TO_DNA_MOOD: Record<Mood, keyof BookDNA['moodScores']> = {
  thrills: 'thrills',
  comfort: 'heart',    // "comfort" maps to "heart" in DNA
  feels: 'drama',      // "feels" maps to "drama" in DNA
  escape: 'wonder',    // "escape" maps to "wonder" in DNA
};

/**
 * Get the DNA mood score for a quiz mood selection.
 *
 * @param dna - Parsed BookDNA
 * @param quizMood - User's selected mood from the quiz
 * @returns Score (0-1) or null if not available
 */
export function getDNAMoodScore(dna: BookDNA, quizMood: Mood): number | null {
  const dnaKey = QUIZ_MOOD_TO_DNA_MOOD[quizMood];
  return dna.moodScores[dnaKey];
}

// ============================================================================
// VOCABULARY MAPPING
// Maps alternative terms to canonical DNA values for flexible tag parsing
// ============================================================================

/**
 * Vocabulary mapping for pacing terms.
 * Allows "slow-burn", "leisurely", etc. to map to canonical "slow".
 */
export const PACING_VOCABULARY: Record<string, BookDNA['pacing']> = {
  // Slow variations
  'slow': 'slow',
  'slow-burn': 'slow',
  'leisurely': 'slow',
  'atmospheric': 'slow',
  'meditative': 'slow',
  'contemplative': 'slow',
  'literary': 'slow',

  // Moderate variations
  'moderate': 'moderate',
  'steady': 'moderate',
  'balanced': 'moderate',
  'well-paced': 'moderate',

  // Fast variations
  'fast': 'fast',
  'fast-paced': 'fast',
  'page-turner': 'fast',
  'propulsive': 'fast',
  'gripping': 'fast',
  'action-packed': 'fast',
  'thriller': 'fast',

  // Variable
  'variable': 'variable',
  'mixed': 'variable',
  'dynamic': 'variable',
};

/**
 * Vocabulary mapping for weight/tone terms.
 */
export const WEIGHT_VOCABULARY: Record<string, 'light' | 'balanced' | 'heavy'> = {
  // Light
  'light': 'light',
  'cozy': 'light',
  'fun': 'light',
  'feel-good': 'light',
  'uplifting': 'light',
  'lighthearted': 'light',
  'beach-read': 'light',

  // Balanced
  'balanced': 'balanced',
  'moderate': 'balanced',
  'mixed-tone': 'balanced',

  // Heavy
  'heavy': 'heavy',
  'dark': 'heavy',
  'intense': 'heavy',
  'gritty': 'heavy',
  'brutal': 'heavy',
  'devastating': 'heavy',
  'raw': 'heavy',
  'unflinching': 'heavy',
  'challenging': 'heavy',
};

/**
 * Vocabulary mapping for vibe terms.
 */
export const VIBE_VOCABULARY: Record<string, string> = {
  // Cozy variations
  'cozy': 'cozy',
  'hygge': 'cozy',
  'comfort-read': 'cozy',
  'heartwarming': 'cozy',

  // Atmospheric
  'atmospheric': 'atmospheric',
  'moody': 'atmospheric',
  'immersive': 'atmospheric',

  // Suspenseful
  'suspenseful': 'suspenseful',
  'tense': 'suspenseful',
  'edge-of-seat': 'suspenseful',

  // Whimsical
  'whimsical': 'whimsical',
  'magical': 'whimsical',
  'enchanting': 'whimsical',

  // Emotional
  'emotional': 'emotional',
  'moving': 'emotional',
  'poignant': 'emotional',
  'touching': 'emotional',

  // Dark
  'dark': 'dark',
  'gothic': 'dark',
  'noir': 'dark',

  // Funny
  'funny': 'funny',
  'hilarious': 'funny',
  'witty': 'funny',
  'satirical': 'funny',

  // Thought-provoking
  'thought-provoking': 'thought-provoking',
  'philosophical': 'thought-provoking',
  'cerebral': 'thought-provoking',
};

// ============================================================================
// TROPE NORMALIZATION
// Maps trope variations to canonical forms
// ============================================================================

export const TROPE_VOCABULARY: Record<string, string> = {
  // Found family variations
  'found-family': 'found-family',
  'found family': 'found-family',
  'found_family': 'found-family',
  'chosen-family': 'found-family',

  // Enemies to lovers variations
  'enemies-to-lovers': 'enemies-to-lovers',
  'enemies to lovers': 'enemies-to-lovers',
  'enemies_to_lovers': 'enemies-to-lovers',

  // Friends to lovers
  'friends-to-lovers': 'friends-to-lovers',
  'friends to lovers': 'friends-to-lovers',
  'best-friends-to-lovers': 'friends-to-lovers',

  // Slow burn
  'slow-burn': 'slow-burn',
  'slow burn': 'slow-burn',
  'slowburn': 'slow-burn',

  // Chosen one
  'chosen-one': 'chosen-one',
  'chosen one': 'chosen-one',
  'the-chosen-one': 'chosen-one',

  // Redemption arc
  'redemption-arc': 'redemption-arc',
  'redemption arc': 'redemption-arc',
  'redemption': 'redemption-arc',

  // Unreliable narrator
  'unreliable-narrator': 'unreliable-narrator',
  'unreliable narrator': 'unreliable-narrator',

  // Fish out of water
  'fish-out-of-water': 'fish-out-of-water',
  'fish out of water': 'fish-out-of-water',

  // Second chance
  'second-chance': 'second-chance',
  'second chance': 'second-chance',
  'second-chance-romance': 'second-chance',
};

/**
 * Normalize a trope name to its canonical form.
 */
export function normalizeTrope(trope: string): string {
  const lower = trope.toLowerCase().trim();
  return TROPE_VOCABULARY[lower] || lower.replace(/\s+/g, '-');
}

// ============================================================================
// THEME NORMALIZATION
// ============================================================================

export const THEME_VOCABULARY: Record<string, string> = {
  // Identity variations
  'identity': 'identity',
  'self-discovery': 'identity',
  'finding-yourself': 'identity',

  // Grief variations
  'grief': 'grief',
  'loss': 'grief',
  'mourning': 'grief',
  'bereavement': 'grief',

  // Family variations
  'family': 'family',
  'family-drama': 'family',
  'family-dynamics': 'family',
  'dysfunctional-family': 'family',

  // Love variations
  'love': 'love',
  'romance': 'love',
  'first-love': 'love',

  // Coming of age
  'coming-of-age': 'coming-of-age',
  'growing-up': 'coming-of-age',
  'bildungsroman': 'coming-of-age',

  // Survival
  'survival': 'survival',
  'survival-story': 'survival',

  // Power
  'power': 'power',
  'power-dynamics': 'power',
  'corruption': 'power',

  // Morality
  'morality': 'morality',
  'ethics': 'morality',
  'moral-ambiguity': 'morality',
};

/**
 * Normalize a theme name to its canonical form.
 */
export function normalizeTheme(theme: string): string {
  const lower = theme.toLowerCase().trim();
  return THEME_VOCABULARY[lower] || lower.replace(/\s+/g, '-');
}

// ============================================================================
// CONTENT WARNINGS
// ============================================================================

/**
 * Content warning categories.
 */
export type ContentWarningCategory =
  | 'violence'
  | 'sexual-content'
  | 'substance-abuse'
  | 'mental-health'
  | 'death'
  | 'trauma'
  | 'abuse'
  | 'language';

/**
 * Parse content warnings from DNA tags.
 * Format: dna:cw:violence, dna:cw:sexual-content, etc.
 */
export function parseContentWarnings(tags: string[] | undefined): ContentWarningCategory[] {
  if (!tags || tags.length === 0) return [];

  return tags
    .filter(t => t.toLowerCase().startsWith('dna:cw:'))
    .map(t => t.split(':')[2]?.toLowerCase() as ContentWarningCategory)
    .filter(Boolean);
}

// ============================================================================
// AGE GROUP HANDLING
// ============================================================================

export type AgeGroup = 'children' | 'middle-grade' | 'young-adult' | 'adult';

/**
 * Get age group from DNA tags or infer from other metadata.
 * Format: dna:age:children, dna:age:young-adult, etc.
 */
export function getAgeGroup(tags: string[] | undefined): AgeGroup | null {
  if (!tags || tags.length === 0) return null;

  const ageTag = tags.find(t => t.toLowerCase().startsWith('dna:age:'));
  if (!ageTag) return null;

  const age = ageTag.split(':')[2]?.toLowerCase();

  switch (age) {
    case 'children':
    case 'kids':
    case 'juvenile':
      return 'children';
    case 'middle-grade':
    case 'mg':
      return 'middle-grade';
    case 'young-adult':
    case 'ya':
    case 'teen':
      return 'young-adult';
    case 'adult':
    case 'mature':
      return 'adult';
    default:
      return null;
  }
}

/**
 * Check if a book is children's/juvenile content.
 */
export function isChildrensBook(tags: string[] | undefined): boolean {
  const age = getAgeGroup(tags);
  return age === 'children' || age === 'middle-grade';
}

// ============================================================================
// DNA SUMMARY
// ============================================================================

/**
 * Get a human-readable summary of a book's DNA.
 */
export function getDNASummary(dna: BookDNA): string[] {
  const summary: string[] = [];

  // Primary mood
  const moodScores = Object.entries(dna.moodScores)
    .filter(([_, score]) => score !== null && score >= 0.5)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0));

  if (moodScores.length > 0) {
    const primaryMood = moodScores[0][0];
    summary.push(`Primary mood: ${primaryMood}`);
  }

  // Pacing
  if (dna.pacing) {
    summary.push(`Pacing: ${dna.pacing}`);
  }

  // Vibe
  if (dna.vibe) {
    summary.push(`Vibe: ${dna.vibe}`);
  }

  // Key spectrums
  if (dna.spectrums.darkLight !== null) {
    const tone = dna.spectrums.darkLight > 0.3 ? 'Light' :
                 dna.spectrums.darkLight < -0.3 ? 'Dark' : 'Balanced';
    summary.push(`Tone: ${tone}`);
  }

  // Top tropes
  if (dna.tropes.length > 0) {
    summary.push(`Tropes: ${dna.tropes.slice(0, 3).join(', ')}`);
  }

  // Top themes
  if (dna.themes.length > 0) {
    summary.push(`Themes: ${dna.themes.slice(0, 3).join(', ')}`);
  }

  return summary;
}

// ============================================================================
// COMPARABLE TITLE PARSING
// ============================================================================

/**
 * Parse comparable titles more robustly.
 * Handles various formats:
 * - dna:comparable:harry-potter
 * - dna:comparable:Harry Potter
 * - dna:like:the-name-of-the-wind
 */
export function parseComparableTitles(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];

  const prefixes = ['dna:comparable:', 'dna:like:', 'dna:similar-to:'];

  return tags
    .filter(t => {
      const lower = t.toLowerCase();
      return prefixes.some(p => lower.startsWith(p));
    })
    .map(t => {
      const parts = t.split(':');
      // Get everything after the second colon (in case title has colons)
      return parts.slice(2).join(':').trim().toLowerCase();
    })
    .filter(Boolean);
}

// ============================================================================
// DNA COMPLETENESS
// ============================================================================

/**
 * Calculate how complete a book's DNA is (0-100%).
 */
export function calculateDNACompleteness(dna: BookDNA): number {
  if (!dna.hasDNA) return 0;

  let score = 0;
  const maxScore = 100;

  // Mood scores (30 points max)
  const moodCount = Object.values(dna.moodScores).filter(v => v !== null).length;
  score += Math.min(moodCount * 5, 30);

  // Spectrums (18 points max)
  const spectrumCount = Object.values(dna.spectrums).filter(v => v !== null).length;
  score += spectrumCount * 3;

  // Structural attributes (20 points max)
  if (dna.pacing) score += 5;
  if (dna.length) score += 3;
  if (dna.structure) score += 3;
  if (dna.pov) score += 3;
  if (dna.pubEra) score += 3;
  if (dna.seriesPosition) score += 3;

  // Categorical (20 points max)
  score += Math.min(dna.tropes.length * 2, 8);
  score += Math.min(dna.themes.length * 2, 8);
  score += Math.min(dna.settings.length, 4);

  // Audiobook specific (6 points max)
  if (dna.narratorStyle) score += 3;
  if (dna.production) score += 3;

  // Vibe (3 points)
  if (dna.vibe) score += 3;

  // Comparables (3 points)
  if (dna.comparableTitles.length > 0) score += 3;

  return Math.min(Math.round((score / maxScore) * 100), 100);
}
