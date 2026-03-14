/**
 * src/features/recommendations/utils/scoreWeights.ts
 *
 * Comprehensive scoring weights for the Enhanced Recommendation System v2.0.
 * Centralizes all scoring configuration for consistency across:
 * - Standard recommendations (slot-based)
 * - Mood-based recommendations
 * - Comparable books engine
 * - History-based affinity scoring
 */

// ============================================================================
// SLOT CONFIGURATION
// Total slots: 20 (expanded from 15)
// ============================================================================

export const SLOT_CONFIG = {
  /** Books similar to recently finished - "Because you loved X" */
  comparable: 4,
  /** High author/narrator affinity - familiar comfort */
  comfort: 5,
  /** Matching genres, new-to-you authors */
  genre_exploration: 4,
  /** Loved narrators, unfamiliar authors */
  narrator_gateway: 2,
  /** Same series continuation */
  series_continuation: 2,
  /** Complete wildcards for discovery */
  wild_card: 3,
} as const;

export type SlotType = keyof typeof SLOT_CONFIG;

export const TOTAL_SLOTS = Object.values(SLOT_CONFIG).reduce((a, b) => a + b, 0);

// ============================================================================
// AFFINITY WEIGHTS
// How much each affinity signal contributes to scoring
// ============================================================================

export const AFFINITY_WEIGHTS = {
  /** Author affinity (from reading history) */
  author: {
    /** Base weight when author is known */
    base: 50,
    /** Per-book bonus (capped) */
    perBook: 10,
    /** Maximum bonus from multiple books */
    maxBonus: 50,
  },

  /** Narrator affinity */
  narrator: {
    base: 30,
    perBook: 8,
    maxBonus: 40,
  },

  /** Genre affinity */
  genre: {
    /** Weight per matching genre */
    perMatch: 5,
    /** Maximum from genre matching */
    maxBonus: 30,
  },

  /** Series affinity (user likes books in series) */
  series: {
    /** Bonus for series the user has started */
    started: 40,
    /** Bonus for continuing a series */
    continuation: 60,
  },
} as const;

// ============================================================================
// MOOD SCORING WEIGHTS
// Weights for mood-based recommendation scoring
// ============================================================================

export const MOOD_WEIGHTS = {
  /** Weight for primary mood match */
  moodMatch: 45,
  /** Bonus for secondary mood match (from themes/tropes) */
  secondaryMoodMatch: 25,
  /** Weight for pace match */
  paceMatch: 15,
  /** Weight for weight (tone) match */
  weightMatch: 15,
  /** Weight for world setting match */
  worldMatch: 20,
  /** Weight for length match */
  lengthMatch: 10,
  /** Bonus from theme matching */
  themeMatch: 15,
  /** Bonus from trope matching */
  tropeMatch: 15,
  /** Bonus from flavor (sub-mood) matching */
  flavorMatch: 20,
} as const;

// ============================================================================
// DNA SCORING WEIGHTS
// BookDNA provides more accurate scoring than genre inference
// ============================================================================

export const DNA_WEIGHTS = {
  /** Weight for DNA mood score match (0-1 score * weight) */
  moodScore: 55,
  /** Weight for DNA spectrum alignment */
  spectrumMatch: 18,
  /** Bonus for matching DNA pacing */
  pacingMatch: 15,
  /** Bonus for matching DNA narrator style */
  narratorBonus: 10,
  /** Bonus for matching DNA vibe tag */
  vibeMatch: 12,
  /** Confidence multiplier for books with DNA vs without */
  dnaConfidenceBoost: 1.2,
  /** Minimum DNA tags for high-confidence scoring */
  highConfidenceThreshold: 10,
} as const;

// ============================================================================
// COMPARABLE BOOKS WEIGHTS
// "Because You Loved X" similarity scoring
// ============================================================================

export const COMPARABLE_WEIGHTS = {
  /** Same author as loved book */
  sameAuthor: 35,
  /** Same series as loved book */
  sameSeries: 45,
  /** Same narrator as loved book */
  sameNarrator: 20,
  /** Matching genre (per genre) */
  matchingGenre: 8,
  /** Matching tag (per tag) */
  matchingTag: 6,
  /** Matching trope from BookDNA */
  matchingTrope: 10,
  /** Matching theme from BookDNA */
  matchingTheme: 10,
  /** Matching vibe from BookDNA */
  matchingVibe: 15,
  /** Book listed in dna:comparable tag */
  explicitComparable: 50,
  /** Maximum total similarity score */
  maxScore: 100,
} as const;

// ============================================================================
// COMPARABLE WEIGHTS — "BECAUSE YOU LISTENED" CONTEXT
// DNA-first scoring: mood/spectrum/trope/theme lead, identity de-emphasized.
// Base weights sum to 100. Pacing bonus (up to 5) can exceed 100 before cap.
// ============================================================================

export const COMPARABLE_WEIGHTS_BYL = {
  /** DNA mood similarity between source and candidate (0-1 scaled) */
  dnaMoodSimilarity: 30,
  /** DNA spectrum similarity (0-1 scaled) */
  dnaSpectrumSimilarity: 20,
  /** Matching trope from BookDNA (per trope) */
  matchingTrope: 5,
  /** Maximum trope contribution */
  maxTropes: 15,
  /** Matching theme (per theme) */
  matchingTheme: 5,
  /** Maximum theme contribution */
  maxThemes: 10,
  /** Matching genre (per genre) */
  matchingGenre: 2,
  /** Maximum genre contribution */
  maxGenres: 12,
  /** Matching tag (per tag) */
  matchingTag: 1,
  /** Maximum tag contribution */
  maxTags: 8,
  /** Same narrator (de-emphasized for mood-first recs) */
  sameNarrator: 3,
  /** Same author (de-emphasized — author match should not dominate mood recs) */
  sameAuthor: 2,
  /** Same series (handled separately, not scored in this path) */
  sameSeries: 0,
  /** Pacing match bonus (exact or adjacent values) */
  pacingMatch: 5,
  /** Book listed in dna:comparable tag */
  explicitComparable: 50,
  /** Maximum total score */
  maxScore: 100,
} as const;

// ============================================================================
// TEMPORAL DECAY
// Reduces weight of older reading history
// ============================================================================

export const TEMPORAL_DECAY = {
  /** Full weight for books finished within this many months */
  fullWeightMonths: 6,
  /** Reduced weight period (between full and stale) */
  reducedWeightMonths: 18,
  /** Weight multiplier for recent books (within fullWeightMonths) */
  recentMultiplier: 1.0,
  /** Weight multiplier for older books (fullWeight to reducedWeight) */
  olderMultiplier: 0.7,
  /** Weight multiplier for stale books (beyond reducedWeight) */
  staleMultiplier: 0.4,
} as const;

/**
 * Calculate temporal decay multiplier based on finished date.
 */
export function getTemporalDecay(finishedAt: Date | number): number {
  const finishedDate = typeof finishedAt === 'number' ? new Date(finishedAt) : finishedAt;
  const now = new Date();
  const monthsAgo = (now.getTime() - finishedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (monthsAgo <= TEMPORAL_DECAY.fullWeightMonths) {
    return TEMPORAL_DECAY.recentMultiplier;
  }
  if (monthsAgo <= TEMPORAL_DECAY.reducedWeightMonths) {
    return TEMPORAL_DECAY.olderMultiplier;
  }
  return TEMPORAL_DECAY.staleMultiplier;
}

// ============================================================================
// MISMATCH PENALTIES
// Wrong tone/pace hurts more than soft matches help
// ============================================================================

export const MISMATCH_PENALTIES = {
  /** Heavy book when user wants light (0.5 = 50% of score) */
  heavyForLight: 0.5,
  /** Light book when user wants heavy */
  lightForHeavy: 0.7,
  /** Fast-paced when user wants slow burn */
  fastForSlow: 0.6,
  /** Slow burn when user wants fast */
  slowForFast: 0.65,
  /** Wrong world setting (fantasy when user wants contemporary) */
  wrongWorld: 0.75,
  /** Children's book when user excluded them */
  childrensExcluded: 0.0,
} as const;

// ============================================================================
// ABANDONMENT PENALTIES
// Penalize authors/series the user has abandoned
// ============================================================================

export const ABANDONMENT_PENALTIES = {
  /** Penalty for books abandoned < 90 days ago */
  recentPenalty: 0.3,
  /** Penalty for books abandoned 90–365 days ago */
  olderPenalty: 0.15,
  /** Penalty for books abandoned > 365 days ago (near-zero — old abandons shouldn't poison the well) */
  stalePenalty: 0.05,
  /** Per-abandoned-book penalty for series */
  perAbandonedSeries: 0.25,
  /** Maximum penalty — cap total reduction so same author can still score, just lower */
  maxPenalty: 0.7,
  /** Threshold: progress % below which = abandoned */
  abandonedProgressThreshold: 0.30,
  /** Threshold: days since last play to consider abandoned */
  abandonedDaysThreshold: 90,
} as const;

// ============================================================================
// PUBLICATION ERA WEIGHTS
// User preferences for publication era
// ============================================================================

export const ERA_WEIGHTS = {
  /** Bonus for matching preferred era */
  preferredEraBonus: 15,
  /** Penalty for non-preferred era (when preference is set) */
  nonPreferredPenalty: 0.85,
  /** Default era distribution (when no preference) */
  defaultDistribution: {
    classic: 0.15,
    'modern-classic': 0.25,
    contemporary: 0.35,
    recent: 0.25,
  },
} as const;

// ============================================================================
// LENGTH PREFERENCES
// How length matching affects scoring
// ============================================================================

export const LENGTH_WEIGHTS = {
  /** Bonus for exact length match */
  exactMatch: 15,
  /** Bonus for close length (within tolerance) */
  closeMatch: 8,
  /** Tolerance in hours for "close" match */
  closeTolerance: 2,
} as const;

// ============================================================================
// DIVERSITY REQUIREMENTS
// Ensure variety in recommendations
// ============================================================================

export const DIVERSITY = {
  /** Maximum books from same author in results */
  maxSameAuthor: 2,
  /** Maximum books from same series in results */
  maxSameSeries: 2,
  /** Maximum books from same narrator in results */
  maxSameNarrator: 3,
  /** Minimum different genres in results */
  minDifferentGenres: 3,
  /** Shuffle randomness factor for wild cards */
  wildCardShuffleFactor: 0.3,
} as const;

// ============================================================================
// CONFIDENCE THRESHOLDS
// Metadata richness requirements for confidence levels
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  /** Minimum metadata signals for high confidence */
  high: 6,
  /** Minimum metadata signals for medium confidence */
  medium: 3,
  /** Below this is low confidence */
  low: 0,
} as const;

/**
 * Calculate metadata richness score.
 */
export function calculateMetadataRichness(data: {
  tagCount: number;
  genreCount: number;
  hasDescription: boolean;
  hasNarrator: boolean;
  hasPublisher: boolean;
  hasDNA: boolean;
}): number {
  let score = data.tagCount + data.genreCount;
  if (data.hasDescription) score += 2;
  if (data.hasNarrator) score += 1;
  if (data.hasPublisher) score += 1;
  if (data.hasDNA) score += 3;
  return score;
}

/**
 * Get confidence level from richness score.
 */
export function getConfidenceLevel(richness: number): 'high' | 'medium' | 'low' {
  if (richness >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (richness >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}
