/**
 * src/features/mood-discovery/utils/parseBookDNA.ts
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

import { Mood } from '../types';

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
 */
export const QUIZ_MOOD_TO_DNA_MOOD: Record<Mood, keyof BookDNA['moodScores']> = {
  thrills: 'thrills',
  laughs: 'laughs',
  comfort: 'heart',    // "comfort" maps to "heart" in DNA
  feels: 'drama',      // "feels" maps to "drama" in DNA
  escape: 'wonder',    // "escape" maps to "wonder" in DNA
  thinking: 'ideas',   // "thinking" maps to "ideas" in DNA
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
