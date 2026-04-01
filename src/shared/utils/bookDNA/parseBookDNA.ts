/**
 * src/shared/utils/bookDNA/parseBookDNA.ts
 *
 * Utility to parse BookDNA tags from AudiobookShelf items.
 * BookDNA tags use a `dna:` prefix with structured categories:
 *
 * Examples:
 *   dna:mood:tension:8        -> moodScores.tension = 0.8
 *   dna:mood:warmth:6         -> moodScores.warmth = 0.6
 *   dna:spectrum:dark-light:-5 -> spectrums.darkLight = -0.5
 *   dna:pacing:fast           -> pacing = 'fast'
 *   dna:trope:found-family    -> tropes = ['found-family']
 *   dna:theme:redemption      -> themes = ['redemption']
 *
 * Mood scores are dynamic — any mood name is accepted (tension, warmth,
 * propulsive, melancholy, whimsical, etc.). The 7 spectrums are fixed:
 * dark-light, serious-funny, plot-character, simple-complex,
 * action-contemplative, intimate-epic-scope, world-density.
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
    seriousFunny: number | null;        // -1 = dead serious, +1 = comedy
    plotCharacter: number | null;       // -1 = plot-driven, +1 = character-driven
    simpleComplex: number | null;       // -1 = simple/accessible, +1 = complex/dense
    actionContemplative: number | null; // -1 = action-heavy, +1 = contemplative
    intimateEpicScope: number | null;   // -1 = intimate/personal, +1 = epic scope
    worldDensity: number | null;        // -1 = sparse worldbuilding, +1 = rich worldbuilding
  };

  // Categorical arrays
  tropes: string[];
  themes: string[];
  settings: string[];

  // Audiobook-specific
  narratorStyle: 'theatrical' | 'subtle' | 'warm' | 'dry' | 'intense' | null;
  production: 'full-cast' | 'single-voice' | 'duet' | 'soundscape' | null;

  // Mood scores — dynamic map of mood name → score (0-1).
  // Any mood name is valid (tension, warmth, propulsive, melancholy, etc.)
  // Empty object means no mood data.
  moodScores: Record<string, number>;

  // Recommendation helpers
  comparableTitles: string[];
  vibe: string | null;

  // Meta information
  hasDNA: boolean;
  tagCount: number;
}

/** All spectrum keys in the BookDNA interface */
export const SPECTRUM_KEYS: (keyof BookDNA['spectrums'])[] = [
  'darkLight', 'seriousFunny', 'plotCharacter', 'simpleComplex',
  'actionContemplative', 'intimateEpicScope', 'worldDensity',
];

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
      seriousFunny: null,
      plotCharacter: null,
      simpleComplex: null,
      actionContemplative: null,
      intimateEpicScope: null,
      worldDensity: null,
    },
    tropes: [],
    themes: [],
    settings: [],
    narratorStyle: null,
    production: null,
    moodScores: {},
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

  // Helper to validate a value against allowed options, returning null if invalid
  const validate = <T extends string>(value: string | null, allowed: readonly T[]): T | null => {
    if (value === null) return null;
    return (allowed as readonly string[]).includes(value) ? (value as T) : null;
  };

  // Valid values for union-typed fields
  const VALID_LENGTH = ['short', 'medium', 'long', 'epic'] as const;
  const VALID_PACING = ['slow', 'moderate', 'fast', 'variable'] as const;
  const VALID_STRUCTURE = ['linear', 'flashback', 'multi-pov', 'frame-narrative', 'epistolary'] as const;
  const VALID_POV = ['first', 'close-third', 'omniscient', 'multi-first'] as const;
  const VALID_SERIES_POSITION = ['standalone', 'series-start', 'mid-series', 'finale'] as const;
  const VALID_PUB_ERA = ['classic', 'modern-classic', 'contemporary'] as const;
  const VALID_NARRATOR_STYLE = ['theatrical', 'subtle', 'warm', 'dry', 'intense'] as const;
  const VALID_PRODUCTION = ['full-cast', 'single-voice', 'duet', 'soundscape'] as const;

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

  // Collect ALL mood scores dynamically (dna:mood:NAME:VALUE)
  const moodScores: Record<string, number> = {};
  const moodPrefix = 'dna:mood:';
  for (const tag of dnaTags) {
    const lower = tag.toLowerCase();
    if (!lower.startsWith(moodPrefix)) continue;
    const parts = tag.split(':');
    const name = parts[2]?.toLowerCase();
    const rawValue = parseInt(parts[3], 10);
    if (!name || isNaN(rawValue)) continue;
    // Normalize from 0..10 to 0..1
    moodScores[name] = Math.max(0, Math.min(1, rawValue / 10));
  }

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
    length: validate(getSimple('length'), VALID_LENGTH),
    pacing: validate(getSimple('pacing'), VALID_PACING),
    structure: validate(getSimple('structure'), VALID_STRUCTURE),
    pov: validate(getSimple('pov'), VALID_POV),
    seriesPosition: validate(getSimple('series-position'), VALID_SERIES_POSITION),
    pubEra: validate(getSimple('pub-era'), VALID_PUB_ERA),

    spectrums: {
      darkLight: getSpectrum('dark-light'),
      seriousFunny: getSpectrum('serious-funny'),
      plotCharacter: getSpectrum('plot-character'),
      simpleComplex: getSpectrum('simple-complex'),
      actionContemplative: getSpectrum('action-contemplative'),
      intimateEpicScope: getSpectrum('intimate-epic-scope'),
      worldDensity: getSpectrum('world-density'),
    },

    tropes: getArray('trope'),
    themes: getArray('theme'),
    settings: getArray('setting'),

    narratorStyle: validate(getSimple('narrator-style'), VALID_NARRATOR_STYLE),
    production: validate(getSimple('production'), VALID_PRODUCTION),

    moodScores,

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
  return Object.keys(dna.moodScores).length > 0;
}

// ============================================================================
// MOOD MAPPING
// ============================================================================

/**
 * Maps quiz moods to arrays of actual DNA mood keys.
 * Quiz uses 4 broad categories; DNA has 40+ specific mood names.
 * Returns the max score across matching keys for the quiz mood.
 */
export const QUIZ_MOOD_TO_DNA_KEYS: Record<Mood, string[]> = {
  thrills: ['tension', 'suspenseful', 'dread', 'propulsive', 'dark'],
  comfort: ['warmth', 'hope', 'whimsical', 'funny', 'humor'],
  feels: ['emotional', 'melancholy', 'romance', 'warmth', 'hope'],
  escape: ['adventure', 'wonder', 'whimsical', 'mysterious'],
};

/**
 * Get the DNA mood score for a quiz mood selection.
 * Returns the highest score among the matching mood keys.
 *
 * @param dna - Parsed BookDNA
 * @param quizMood - User's selected mood from the quiz
 * @returns Score (0-1) or null if no matching moods
 */
export function getDNAMoodScore(dna: BookDNA, quizMood: Mood): number | null {
  const keys = QUIZ_MOOD_TO_DNA_KEYS[quizMood];
  let maxScore: number | null = null;
  for (const key of keys) {
    const score = dna.moodScores[key];
    if (score !== undefined) {
      if (maxScore === null || score > maxScore) maxScore = score;
    }
  }
  return maxScore;
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
const VALID_CW_CATEGORIES: readonly ContentWarningCategory[] = [
  'violence', 'sexual-content', 'substance-abuse', 'mental-health',
  'death', 'trauma', 'abuse', 'language',
];

export function parseContentWarnings(tags: string[] | undefined): ContentWarningCategory[] {
  if (!tags || tags.length === 0) return [];

  return tags
    .filter(t => t.toLowerCase().startsWith('dna:cw:'))
    .map(t => t.split(':')[2]?.toLowerCase())
    .filter((v): v is ContentWarningCategory =>
      !!v && (VALID_CW_CATEGORIES as readonly string[]).includes(v)
    );
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
    .filter(([_, score]) => score >= 0.5)
    .sort((a, b) => b[1] - a[1]);

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
  const moodCount = Object.keys(dna.moodScores).length;
  score += Math.min(moodCount * 5, 30);

  // Spectrums (21 points max — 7 spectrums × 3)
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
