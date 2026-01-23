/**
 * src/features/mood-discovery/hooks/useMoodRecommendations.ts
 *
 * Hook to score and rank library books based on mood session preferences.
 * Uses orthogonal dimensions: Mood, Pace, Weight, World.
 */

import { useMemo, useDeferredValue, useEffect, useRef, useState, useCallback } from 'react';
import { useLibraryCache } from '@/core/cache/libraryCache';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { logger } from '@/shared/utils/logger';

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media;
}
import {
  MoodSession,
  MoodScore,
  ScoredBook,
  MatchConfidence,
  Mood,
  Pace,
  Weight,
  World,
  DNAFilterMode,
  MOOD_GENRE_MAP,
  WORLD_GENRE_MAP,
  PACE_INDICATORS,
  WEIGHT_INDICATORS,
  LENGTH_OPTIONS,
} from '../types';
import { calculateTagMoodScore, tagScoreToPercentage, getItemTags } from '../utils/tagScoring';
import {
  parseBookDNA,
  BookDNA,
  getDNAQuality,
  hasMoodScores,
  getDNAMoodScore,
  QUIZ_MOOD_TO_DNA_MOOD,
} from '../utils/parseBookDNA';
import { useActiveSession } from '../stores/moodSessionStore';
import { useReadingHistory, PreferenceBoost } from '@/features/reading-history-wizard';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import {
  useMoodScoringCacheStore,
  getSessionCacheKey,
} from '../stores/moodScoringCacheStore';
// Legacy exports for backwards compatibility
import {
  clearMoodRecommendationsCache,
  hasCachedMoodRecommendations,
} from '../utils/moodRecommendationsCache';

// Re-export for backwards compatibility
export { clearMoodRecommendationsCache, hasCachedMoodRecommendations };

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

const SCORE_WEIGHTS = {
  /** Weight for primary mood match */
  moodMatch: 40,
  /** Bonus for secondary mood match (from themes/tropes) */
  secondaryMoodMatch: 20,
  /** Weight for pace match */
  paceMatch: 15,
  /** Weight for weight match */
  weightMatch: 15,
  /** Weight for world match */
  worldMatch: 20,
  /** Weight for length match */
  lengthMatch: 10,
  /** Bonus from theme matching */
  themeMatch: 15,
  /** Bonus from trope matching */
  tropeMatch: 15,
};

// ============================================================================
// DNA SCORING WEIGHTS
// DNA scores are more accurate than genre inference, so they get higher weight
// ============================================================================

const DNA_WEIGHTS = {
  /** Weight for DNA mood score match (0-1 score * weight) */
  moodScore: 50,
  /** Weight for DNA spectrum alignment */
  spectrumMatch: 15,
  /** Bonus for matching DNA pacing */
  pacingMatch: 12,
  /** Bonus for matching DNA narrator style */
  narratorBonus: 8,
  /** Confidence multiplier for books with DNA vs without */
  dnaConfidenceBoost: 1.15,
} as const;

/**
 * Maps quiz moods to preferred spectrum values.
 * Used when a book has DNA spectrum data.
 */
const MOOD_TO_SPECTRUM_PREFERENCE: Record<Mood, { key: keyof BookDNA['spectrums']; preferred: number }> = {
  thrills: { key: 'seriousHumorous', preferred: -0.3 },    // slightly serious
  laughs: { key: 'seriousHumorous', preferred: 0.7 },      // humorous
  comfort: { key: 'bleakHopeful', preferred: 0.6 },        // hopeful
  feels: { key: 'bleakHopeful', preferred: -0.2 },         // slight melancholy ok
  escape: { key: 'familiarChallenging', preferred: -0.3 }, // familiar/comfort
  thinking: { key: 'denseAccessible', preferred: -0.4 },   // denser reads
};

/**
 * Maps quiz paces to DNA pacing values.
 */
const PACE_TO_DNA_PACING: Record<Exclude<Pace, 'any'>, BookDNA['pacing'][]> = {
  slow: ['slow', 'moderate'],
  steady: ['moderate', 'variable'],
  fast: ['fast', 'variable'],
};

/**
 * Maps moods to preferred narrator styles.
 */
const MOOD_TO_NARRATOR_STYLE: Record<Mood, BookDNA['narratorStyle'][]> = {
  thrills: ['intense', 'theatrical'],
  laughs: ['theatrical', 'warm'],
  comfort: ['warm', 'subtle'],
  feels: ['warm', 'subtle', 'theatrical'],
  escape: ['theatrical', 'warm'],
  thinking: ['subtle', 'dry'],
};

// ============================================================================
// HARD MISMATCH PENALTIES (Tier 1.1)
// Wrong tone should hurt more than soft matches help
// ============================================================================

const MISMATCH_PENALTIES = {
  /** Heavy book when user wants light = significant penalty */
  heavyForLight: 0.5,
  /** Light book when user wants heavy = moderate penalty */
  lightForHeavy: 0.75,
  /** Fast-paced when user wants slow burn = moderate penalty */
  fastForSlow: 0.65,
  /** Slow burn when user wants fast = moderate penalty */
  slowForFast: 0.7,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get metadata from a library item safely
 */
function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

/**
 * Get duration in hours from a library item
 */
function getDurationHours(item: LibraryItem): number {
  if (!isBookMedia(item.media)) return 0;
  return (item.media.duration || 0) / 3600;
}

// NOTE: Old parseThemesFromDescription and parseTropesFromDescription functions
// have been replaced with tag-based scoring via calculateTagMoodScore().
// Tags come from item.media.tags instead of parsing description text.

// ============================================================================
// METADATA RICHNESS (Tier 2.3)
// ============================================================================

/**
 * Calculate metadata richness score from pre-fetched data.
 * Used to determine confidence in the recommendation.
 * PERF: Takes pre-computed values to avoid redundant lookups.
 */
function calculateMetadataRichnessFromData(
  metadata: BookMetadata | Record<string, never>,
  tags: string[]
): number {
  const tagCount = tags.length;
  const genreCount = (metadata.genres || []).length;
  const hasDescription = ((metadata as BookMetadata).description?.length || 0) > 100;
  const hasNarrator = !!(metadata as BookMetadata).narratorName;
  const hasPublisher = !!(metadata as BookMetadata).publisher;

  // Richness formula: sum of available metadata signals
  return tagCount + genreCount + (hasDescription ? 2 : 0) + (hasNarrator ? 1 : 0) + (hasPublisher ? 1 : 0);
}

/**
 * Determine confidence level based on metadata richness (Tier 2.3)
 */
function getConfidenceFromRichness(richness: number): MatchConfidence {
  if (richness > 5) return 'high';
  if (richness > 2) return 'medium';
  return 'low';
}

/**
 * Check if genres contain any keywords
 */
function containsKeyword(genres: string[], keywords: string[] | undefined): boolean {
  if (!keywords || keywords.length === 0) return false;
  const lowerGenres = genres.map((g) => g.toLowerCase());
  return keywords.some((keyword) =>
    lowerGenres.some(
      (genre) =>
        genre.includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(genre)
    )
  );
}

/**
 * Check if description/text contains any keywords
 */
function textContainsKeyword(text: string, keywords: string[] | undefined): boolean {
  if (!keywords || keywords.length === 0) return false;
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Check if a book matches the mood via genres
 */
function matchesMood(bookGenres: string[], mood: Mood): boolean {
  const moodKeywords = MOOD_GENRE_MAP[mood];
  return containsKeyword(bookGenres, moodKeywords);
}

/**
 * Check if a book matches the pace via genres/description
 */
function matchesPace(bookGenres: string[], description: string, pace: Pace): boolean {
  if (pace === 'any') return true;

  const paceKeywords = PACE_INDICATORS[pace];
  return containsKeyword(bookGenres, paceKeywords) ||
    textContainsKeyword(description, paceKeywords);
}

/**
 * Check if a book matches the weight via genres/description
 */
function matchesWeight(bookGenres: string[], description: string, weight: Weight): boolean {
  if (weight === 'any') return true;

  const weightKeywords = WEIGHT_INDICATORS[weight];
  return containsKeyword(bookGenres, weightKeywords) ||
    textContainsKeyword(description, weightKeywords);
}

/**
 * Check if a book matches the world setting via genres
 */
function matchesWorld(bookGenres: string[], world: World): boolean {
  if (world === 'any') return true;

  const worldKeywords = WORLD_GENRE_MAP[world];
  return containsKeyword(bookGenres, worldKeywords);
}

// ============================================================================
// MISMATCH DETECTION (Tier 1.1)
// ============================================================================

/**
 * Check if a book has a conflicting weight (heavy when user wants light, etc.)
 */
function detectWeightMismatch(
  bookGenres: string[],
  description: string,
  userWeight: Weight
): { hasMismatch: boolean; penalty: number } {
  if (userWeight === 'any' || userWeight === 'balanced') {
    return { hasMismatch: false, penalty: 1 };
  }

  // Check for opposite weight indicators
  if (userWeight === 'light') {
    // User wants light, check if book is heavy
    const heavyKeywords = WEIGHT_INDICATORS.heavy;
    if (containsKeyword(bookGenres, heavyKeywords) || textContainsKeyword(description, heavyKeywords)) {
      return { hasMismatch: true, penalty: MISMATCH_PENALTIES.heavyForLight };
    }
  } else if (userWeight === 'heavy') {
    // User wants heavy, check if book is light/cozy
    const lightKeywords = WEIGHT_INDICATORS.light;
    if (containsKeyword(bookGenres, lightKeywords) || textContainsKeyword(description, lightKeywords)) {
      return { hasMismatch: true, penalty: MISMATCH_PENALTIES.lightForHeavy };
    }
  }

  return { hasMismatch: false, penalty: 1 };
}

/**
 * Check if a book has a conflicting pace (fast when user wants slow, etc.)
 */
function detectPaceMismatch(
  bookGenres: string[],
  description: string,
  userPace: Pace
): { hasMismatch: boolean; penalty: number } {
  if (userPace === 'any' || userPace === 'steady') {
    return { hasMismatch: false, penalty: 1 };
  }

  // Check for opposite pace indicators
  if (userPace === 'slow') {
    // User wants slow burn, check if book is fast-paced
    const fastKeywords = PACE_INDICATORS.fast;
    if (containsKeyword(bookGenres, fastKeywords) || textContainsKeyword(description, fastKeywords)) {
      return { hasMismatch: true, penalty: MISMATCH_PENALTIES.fastForSlow };
    }
  } else if (userPace === 'fast') {
    // User wants fast-paced, check if book is slow
    const slowKeywords = PACE_INDICATORS.slow;
    if (containsKeyword(bookGenres, slowKeywords) || textContainsKeyword(description, slowKeywords)) {
      return { hasMismatch: true, penalty: MISMATCH_PENALTIES.slowForFast };
    }
  }

  return { hasMismatch: false, penalty: 1 };
}

/**
 * Check if duration matches the length preference
 */
function matchesLength(
  durationHours: number,
  lengthPref: MoodSession['length']
): { matches: boolean; score: number } {
  if (lengthPref === 'any') {
    return { matches: true, score: 0 };
  }

  const config = LENGTH_OPTIONS.find((o) => o.id === lengthPref);
  if (!config) {
    return { matches: true, score: 0 };
  }

  const min = config.minHours ?? 0;
  const max = config.maxHours ?? Infinity;

  if (durationHours >= min && durationHours <= max) {
    return { matches: true, score: SCORE_WEIGHTS.lengthMatch };
  }

  // Partial credit if close
  if (config.minHours && durationHours >= min - 2 && durationHours < min) {
    return { matches: false, score: SCORE_WEIGHTS.lengthMatch / 2 };
  }
  if (config.maxHours && durationHours > max && durationHours <= max + 2) {
    return { matches: false, score: SCORE_WEIGHTS.lengthMatch / 2 };
  }

  return { matches: false, score: 0 };
}

// NOTE: Old scoreThemes and scoreTropes functions have been replaced
// with calculateTagMoodScore() from ../utils/tagScoring.ts

// ============================================================================
// DNA-BASED SCORING
// ============================================================================

/**
 * Result of DNA-based scoring
 */
interface DNAScoreResult {
  /** Total DNA score contribution */
  score: number;
  /** Whether DNA established a primary mood match */
  isPrimaryMoodMatch: boolean;
  /** Reasons why this book matched (for UI) */
  matchReasons: string[];
  /** Score breakdown */
  breakdown: {
    moodScore: number;
    spectrumScore: number;
    pacingScore: number;
    narratorScore: number;
  };
}

/**
 * Calculate mood match score from BookDNA tags.
 * This provides more accurate scoring than genre inference.
 */
function calculateDNAScore(dna: BookDNA, session: MoodSession): DNAScoreResult {
  const emptyResult: DNAScoreResult = {
    score: 0,
    isPrimaryMoodMatch: false,
    matchReasons: [],
    breakdown: { moodScore: 0, spectrumScore: 0, pacingScore: 0, narratorScore: 0 },
  };

  if (!dna.hasDNA) {
    return emptyResult;
  }

  const matchReasons: string[] = [];
  let moodScore = 0;
  let spectrumScore = 0;
  let pacingScore = 0;
  let narratorScore = 0;
  let isPrimaryMoodMatch = false;

  // 1. DNA Mood Score (most important)
  const dnaMoodScore = getDNAMoodScore(dna, session.mood);
  if (dnaMoodScore !== null) {
    // Score is 0-1, multiply by weight
    moodScore = dnaMoodScore * DNA_WEIGHTS.moodScore;
    if (dnaMoodScore >= 0.7) {
      isPrimaryMoodMatch = true;
      matchReasons.push(`High ${session.mood}`);
    } else if (dnaMoodScore >= 0.5) {
      matchReasons.push(`Moderate ${session.mood}`);
    }
  }

  // 2. Spectrum alignment
  const spectrumPref = MOOD_TO_SPECTRUM_PREFERENCE[session.mood];
  const spectrumValue = dna.spectrums[spectrumPref.key];
  if (spectrumValue !== null) {
    // Score based on how close to preferred value
    const distance = Math.abs(spectrumValue - spectrumPref.preferred);
    const alignment = Math.max(0, 1 - distance);
    spectrumScore = alignment * DNA_WEIGHTS.spectrumMatch;
    if (alignment >= 0.7) {
      // Add reason based on spectrum type
      const spectrumLabels: Record<string, string> = {
        darkLight: spectrumValue > 0 ? 'Light tone' : 'Dark tone',
        seriousHumorous: spectrumValue > 0 ? 'Humorous' : 'Serious',
        bleakHopeful: spectrumValue > 0 ? 'Hopeful ending' : 'Bittersweet',
        denseAccessible: spectrumValue > 0 ? 'Easy read' : 'Dense prose',
      };
      if (spectrumLabels[spectrumPref.key]) {
        matchReasons.push(spectrumLabels[spectrumPref.key]);
      }
    }
  }

  // 3. Pacing match (if user specified pace)
  if (session.pace && session.pace !== 'any' && dna.pacing) {
    const preferredPacings = PACE_TO_DNA_PACING[session.pace];
    if (preferredPacings.includes(dna.pacing)) {
      pacingScore = DNA_WEIGHTS.pacingMatch;
      const pacingLabels: Record<string, string> = {
        slow: 'Slow burn',
        moderate: 'Steady pace',
        fast: 'Fast-paced',
        variable: 'Dynamic pacing',
      };
      matchReasons.push(pacingLabels[dna.pacing] || dna.pacing);
    }
  }

  // 4. Narrator style bonus
  if (dna.narratorStyle) {
    const preferredStyles = MOOD_TO_NARRATOR_STYLE[session.mood];
    if (preferredStyles.includes(dna.narratorStyle)) {
      narratorScore = DNA_WEIGHTS.narratorBonus;
      matchReasons.push(`${dna.narratorStyle.charAt(0).toUpperCase() + dna.narratorStyle.slice(1)} narration`);
    }
  }

  const totalScore = moodScore + spectrumScore + pacingScore + narratorScore;

  return {
    score: totalScore,
    isPrimaryMoodMatch,
    matchReasons,
    breakdown: { moodScore, spectrumScore, pacingScore, narratorScore },
  };
}

// ============================================================================
// SEED BOOK SIMILARITY SCORING
// ============================================================================

/**
 * Scoring weights for seed book similarity
 */
const SEED_WEIGHTS = {
  /** Same author (big boost) */
  sameAuthor: 25,
  /** Same series (big boost) */
  sameSeries: 30,
  /** Matching genres */
  matchingGenre: 8,
  /** Matching tags */
  matchingTag: 5,
  /** Max boost from seed similarity */
  maxBoost: 40,
} as const;

/**
 * Pre-computed seed book data for similarity scoring
 */
interface SeedBookData {
  id: string;
  author: string | null;
  series: string | null;
  genres: Set<string>;
  tags: Set<string>;
  dna: BookDNA;
}

/**
 * Calculate similarity score between a book and the seed book.
 */
function calculateSeedSimilarity(
  bookData: {
    metadata: BookMetadata | Record<string, never>;
    genres: string[];
    tags: string[];
    dna: BookDNA;
  },
  seedData: SeedBookData
): { score: number; reason: string | null } {
  let score = 0;
  let reason: string | null = null;

  const bookMeta = bookData.metadata as BookMetadata;

  // Same author (big boost)
  if (seedData.author && bookMeta.authorName) {
    const bookAuthor = bookMeta.authorName.toLowerCase();
    if (bookAuthor.includes(seedData.author) || seedData.author.includes(bookAuthor)) {
      score += SEED_WEIGHTS.sameAuthor;
      reason = 'Same author';
    }
  }

  // Same series (big boost)
  if (seedData.series && bookMeta.seriesName) {
    const bookSeries = bookMeta.seriesName.toLowerCase();
    if (bookSeries.includes(seedData.series) || seedData.series.includes(bookSeries)) {
      score += SEED_WEIGHTS.sameSeries;
      reason = reason ? `${reason}, same series` : 'Same series';
    }
  }

  // Matching genres
  for (const genre of bookData.genres) {
    if (seedData.genres.has(genre.toLowerCase())) {
      score += SEED_WEIGHTS.matchingGenre;
      if (score >= SEED_WEIGHTS.maxBoost) break;
    }
  }

  // Matching tags
  for (const tag of bookData.tags) {
    if (seedData.tags.has(tag.toLowerCase())) {
      score += SEED_WEIGHTS.matchingTag;
      if (score >= SEED_WEIGHTS.maxBoost) break;
    }
  }

  // Cap at max boost
  score = Math.min(score, SEED_WEIGHTS.maxBoost);

  return { score, reason };
}

/**
 * Pre-compute seed book data for efficient similarity scoring.
 */
function prepareSeedBookData(seedBook: LibraryItem): SeedBookData {
  const meta = seedBook.media?.metadata as BookMetadata | undefined;
  const tags = getItemTags(seedBook);
  const dna = parseBookDNA(tags);

  return {
    id: seedBook.id,
    author: meta?.authorName?.toLowerCase() || null,
    series: meta?.seriesName?.toLowerCase() || null,
    genres: new Set((meta?.genres || []).map(g => g.toLowerCase())),
    tags: new Set(tags.map(t => t.toLowerCase())),
    dna,
  };
}

/**
 * Pre-computed book data for scoring.
 * PERF: Avoids redundant getMetadata/getItemTags calls.
 */
interface BookScoringData {
  metadata: BookMetadata | Record<string, never>;
  genres: string[];
  description: string;
  tags: string[];
  durationHours: number;
  /** Parsed BookDNA (if available) */
  dna: BookDNA;
}

/**
 * Extended mood score result that includes DNA information
 */
interface ExtendedMoodScore extends MoodScore {
  penaltyApplied: number;
  /** Whether scoring used BookDNA (more accurate) */
  usedDNA: boolean;
  /** Match reasons for UI display */
  matchReasons: string[];
  /** DNA score contribution (if DNA was used) */
  dnaScore: number;
}

/**
 * Calculate mood score for a single book.
 * Uses BookDNA scoring when available (more accurate), falls back to genre inference.
 * Now applies hard mismatch penalties (Tier 1.1).
 * PERF: Accepts pre-computed data to avoid redundant lookups.
 */
function calculateMoodScore(
  bookData: BookScoringData,
  session: MoodSession
): ExtendedMoodScore {
  const { genres: bookGenres, description, tags, durationHours, dna } = bookData;
  const matchReasons: string[] = [];

  // Initialize scores
  let moodScore = 0;
  let paceScore = 0;
  let weightScore = 0;
  let worldScore = 0;
  let isPrimaryMoodMatch = false;
  let dnaScore = 0;
  let usedDNA = false;

  // ============================================================================
  // DNA-BASED SCORING (preferred when available)
  // ============================================================================
  if (dna.hasDNA && hasMoodScores(dna)) {
    const dnaResult = calculateDNAScore(dna, session);
    dnaScore = dnaResult.score;
    usedDNA = true;

    // DNA mood match takes precedence
    if (dnaResult.isPrimaryMoodMatch) {
      isPrimaryMoodMatch = true;
      moodScore = dnaResult.breakdown.moodScore;
    }

    // Add DNA match reasons
    matchReasons.push(...dnaResult.matchReasons);

    // DNA pacing can contribute to pace score
    if (dnaResult.breakdown.pacingScore > 0) {
      paceScore = Math.max(paceScore, dnaResult.breakdown.pacingScore);
    }
  }

  // ============================================================================
  // GENRE-BASED SCORING (fallback or supplement)
  // ============================================================================

  // Score mood match via genres (only if DNA didn't establish it)
  if (!isPrimaryMoodMatch && matchesMood(bookGenres, session.mood)) {
    moodScore = SCORE_WEIGHTS.moodMatch;
    isPrimaryMoodMatch = true;
    matchReasons.push('Genre match');
  }

  // Score pace match (optional dimension) via genres/description
  if (session.pace !== 'any' && paceScore === 0 && matchesPace(bookGenres, description, session.pace)) {
    paceScore = SCORE_WEIGHTS.paceMatch;
  }

  // Score weight match (optional dimension) via genres/description
  if (session.weight !== 'any' && matchesWeight(bookGenres, description, session.weight)) {
    weightScore = SCORE_WEIGHTS.weightMatch;
  }

  // Score world match (optional dimension) via genres
  if (session.world !== 'any' && matchesWorld(bookGenres, session.world)) {
    worldScore = SCORE_WEIGHTS.worldMatch;
    matchReasons.push('Setting match');
  }

  // Score length match
  const lengthResult = matchesLength(durationHours, session.length);
  const lengthScore = lengthResult.score;
  if (lengthResult.matches && session.length !== 'any') {
    matchReasons.push('Length fits');
  }

  // Tag-based scoring for themes/tropes (supplement to DNA)
  const tagResult = calculateTagMoodScore(tags, session);

  // Tag scoring can establish mood match if nothing else did
  if (tagResult.isPrimaryMoodMatch && !isPrimaryMoodMatch) {
    moodScore = SCORE_WEIGHTS.secondaryMoodMatch;
    isPrimaryMoodMatch = true;
    matchReasons.push('Tag match');
  }

  // Use tag score for theme+trope scoring
  const themeScore = tagResult.breakdown.mood + tagResult.breakdown.tropes;
  const tropeScore = 0; // Tropes are now part of tag scoring

  // Update isPrimaryMoodMatch
  isPrimaryMoodMatch = isPrimaryMoodMatch || tagResult.isPrimaryMoodMatch;

  // ============================================================================
  // APPLY HARD MISMATCH PENALTIES (Tier 1.1)
  // Wrong tone hurts more than soft matches help
  // ============================================================================

  let penaltyMultiplier = 1;

  // Check for weight mismatch (heavy book when user wants light, etc.)
  const weightMismatch = detectWeightMismatch(bookGenres, description, session.weight);
  if (weightMismatch.hasMismatch) {
    penaltyMultiplier *= weightMismatch.penalty;
  }

  // Check for pace mismatch (fast book when user wants slow, etc.)
  const paceMismatch = detectPaceMismatch(bookGenres, description, session.pace);
  if (paceMismatch.hasMismatch) {
    penaltyMultiplier *= paceMismatch.penalty;
  }

  // Calculate base total then apply penalty
  // DNA score is added on top of genre-based scoring
  const baseTotal = moodScore + paceScore + weightScore + worldScore + lengthScore + tagResult.score + dnaScore;
  const total = Math.round(baseTotal * penaltyMultiplier);

  return {
    total,
    moodScore,
    paceScore,
    weightScore,
    worldScore,
    lengthScore,
    themeScore,
    tropeScore,
    isPrimaryMoodMatch,
    penaltyApplied: penaltyMultiplier,
    usedDNA,
    matchReasons,
    dnaScore,
  };
}

/**
 * Convert score to match percentage (0-100)
 */
function scoreToPercent(score: MoodScore, session: MoodSession): number {
  // Calculate maximum possible score
  const maxMoodScore = SCORE_WEIGHTS.moodMatch;
  const maxPaceScore = session.pace !== 'any' ? SCORE_WEIGHTS.paceMatch : 0;
  const maxWeightScore = session.weight !== 'any' ? SCORE_WEIGHTS.weightMatch : 0;
  const maxWorldScore = session.world !== 'any' ? SCORE_WEIGHTS.worldMatch : 0;
  const maxLengthScore = session.length !== 'any' ? SCORE_WEIGHTS.lengthMatch : 0;

  // Base max (excluding theme/trope bonuses)
  const maxBaseScore = maxMoodScore + maxPaceScore + maxWeightScore + maxWorldScore + maxLengthScore;

  if (maxBaseScore === 0) return 100;

  // Calculate base percentage
  const baseScore = score.moodScore + score.paceScore + score.weightScore +
    score.worldScore + score.lengthScore;
  let percent = (baseScore / maxBaseScore) * 100;

  // Theme and trope bonuses can boost percentage
  const themeBoost = Math.min(score.themeScore / SCORE_WEIGHTS.themeMatch, 2) * 10;
  const tropeBoost = Math.min(score.tropeScore / SCORE_WEIGHTS.tropeMatch, 2) * 10;

  percent += themeBoost + tropeBoost;

  return Math.max(0, Math.min(100, Math.round(percent)));
}

// ============================================================================
// SCORING FUNCTION (extracted for async execution)
// ============================================================================

interface RunMoodScoringParams {
  items: LibraryItem[];
  session: MoodSession;
  sessionKey: string;
  isFinished: (itemId: string) => boolean;
  isSeriesAppropriate: (item: LibraryItem) => boolean;
  getPreferenceBoost: (item: LibraryItem) => PreferenceBoost;
  hasHistory: boolean;
  applyPreferenceBoosts: boolean;
  excludeFinished: boolean;
  dnaFilterMode: DNAFilterMode;
  includeUntagged: boolean;
  minMatchPercent: number;
}

interface RunMoodScoringResult {
  scored: ScoredBook[];
  unscored: LibraryItem[];
  dnaStats: {
    totalWithDNA: number;
    totalWithoutDNA: number;
    dnaPercentage: number;
  };
}

/**
 * Run mood-based scoring on all library items.
 * This is the expensive operation that scores each book against the session.
 * Extracted as a standalone function to allow async execution.
 */
function runMoodScoring(params: RunMoodScoringParams): RunMoodScoringResult {
  const {
    items,
    session,
    isFinished,
    isSeriesAppropriate,
    getPreferenceBoost,
    hasHistory,
    applyPreferenceBoosts,
    excludeFinished,
    dnaFilterMode,
    includeUntagged,
    minMatchPercent,
  } = params;

  const scored: ScoredBook[] = [];
  const unscored: LibraryItem[] = [];
  let totalWithDNA = 0;
  let totalWithoutDNA = 0;

  // Pre-compute seed book data if we have one
  let seedBookData: SeedBookData | null = null;
  if (session.seedBookId) {
    const seedBook = items.find((i) => i.id === session.seedBookId);
    if (seedBook) {
      seedBookData = prepareSeedBookData(seedBook);
    }
  }

  for (const item of items) {
    // Skip non-books
    if (item.mediaType !== 'book') continue;

    // Skip the seed book itself
    if (session.seedBookId && item.id === session.seedBookId) continue;

    // Skip finished books if requested
    if (excludeFinished && isFinished(item.id)) continue;

    // Skip books that aren't series-appropriate (wrong book in series)
    if (!isSeriesAppropriate(item)) continue;

    // Pre-compute data for this item (PERF: single lookup)
    const metadata = getMetadata(item);
    const genres = (metadata as BookMetadata).genres || [];
    const description = (metadata as BookMetadata).description || '';
    const tags = getItemTags(item);
    const durationHours = getDurationHours(item);
    const dna = parseBookDNA(tags);

    const bookData: BookScoringData = {
      metadata,
      genres,
      description,
      tags,
      durationHours,
      dna,
    };

    // Track DNA stats
    if (dna.hasDNA) {
      totalWithDNA++;
    } else {
      totalWithoutDNA++;
    }

    // Skip books without tags if not including untagged
    if (!includeUntagged && genres.length === 0 && tags.length === 0) {
      unscored.push(item);
      continue;
    }

    // DNA filter mode handling
    if (dnaFilterMode === 'dna-only' && !dna.hasDNA) {
      unscored.push(item);
      continue;
    }

    // Calculate score
    const score = calculateMoodScore(bookData, session);
    const matchPercent = scoreToPercent(score, session);

    // Skip below threshold
    if (matchPercent < minMatchPercent) {
      unscored.push(item);
      continue;
    }

    // Calculate preference boost (if enabled and we have history)
    let preferenceBoost = 0;
    if (applyPreferenceBoosts && hasHistory) {
      preferenceBoost = getPreferenceBoost(item).totalBoost;
    }

    // Calculate seed similarity boost
    let seedSimilarityBoost = 0;
    let seedMatchReason: string | null = null;
    if (seedBookData) {
      const similarity = calculateSeedSimilarity(bookData, seedBookData);
      seedSimilarityBoost = similarity.score;
      seedMatchReason = similarity.reason;
    }

    // Determine confidence
    const richness = calculateMetadataRichnessFromData(metadata, tags);
    let confidence = getConfidenceFromRichness(richness);

    // Boost confidence if we used DNA
    if (score.usedDNA) {
      if (confidence === 'low') confidence = 'medium';
      else if (confidence === 'medium') confidence = 'high';
    }

    // Calculate final score with boosts
    const boostedScore = score.total + preferenceBoost + seedSimilarityBoost;

    // Collect match reasons
    const matchReasons = [...score.matchReasons];
    if (seedMatchReason) {
      matchReasons.push(seedMatchReason);
    }

    scored.push({
      item,
      score,
      matchPercent,
      confidence,
      preferenceBoost,
      seedSimilarityBoost,
      matchReasons,
      hasDNA: dna.hasDNA,
      boostedScore,
    });
  }

  // Sort by boosted score (descending)
  scored.sort((a, b) => {
    // DNA-preferred mode: DNA books first, then by score
    if (dnaFilterMode === 'dna-preferred') {
      if (a.hasDNA && !b.hasDNA) return -1;
      if (!a.hasDNA && b.hasDNA) return 1;
    }
    return b.boostedScore - a.boostedScore;
  });

  // Calculate DNA stats
  const totalScored = totalWithDNA + totalWithoutDNA;
  const dnaPercentage = totalScored > 0 ? Math.round((totalWithDNA / totalScored) * 100) : 0;

  return {
    scored,
    unscored,
    dnaStats: {
      totalWithDNA,
      totalWithoutDNA,
      dnaPercentage,
    },
  };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

interface UseMoodRecommendationsOptions {
  session?: MoodSession | null;
  minMatchPercent?: number;
  limit?: number;
  includeUntagged?: boolean;
  /** Whether to exclude finished books (default: true) */
  excludeFinished?: boolean;
  /** Whether to apply preference boosts from reading history (default: true) */
  applyPreferenceBoosts?: boolean;
  /**
   * How to handle books without BookDNA tags:
   * - 'dna-only': Only show books WITH BookDNA (strictest, best accuracy)
   * - 'dna-preferred': Show DNA books first, then non-DNA (default)
   * - 'mixed': Mix all books by score only
   */
  dnaFilterMode?: DNAFilterMode;
}

interface UseMoodRecommendationsResult {
  recommendations: ScoredBook[];
  unscored: LibraryItem[];
  /** Stats about DNA coverage in results */
  dnaStats?: {
    totalWithDNA: number;
    totalWithoutDNA: number;
    dnaPercentage: number;
  };
  totalCount: number;
  isLoading: boolean;
  /** True when mood scoring is in progress (show loading UI) */
  isScoring: boolean;
  hasSession: boolean;
}

/**
 * Hook to get mood-based book recommendations.
 * Now integrates with reading history to:
 * - Exclude finished books (locally marked or server progress >= 95%)
 * - Boost books by authors/series/genres the user has enjoyed
 */
export function useMoodRecommendations(
  options: UseMoodRecommendationsOptions = {}
): UseMoodRecommendationsResult {
  const {
    minMatchPercent = 0,
    limit = 50,
    includeUntagged = false,
    excludeFinished = true,
    applyPreferenceBoosts = true,
    dnaFilterMode = 'dna-preferred', // Default: show DNA books first
  } = options;

  const activeSession = useActiveSession();
  const session = options.session ?? activeSession;
  const items = useLibraryCache((s) => s.items);
  const isLoaded = useLibraryCache((s) => s.isLoaded);

  // Get reading history for filtering and boosts
  const { isFinished, hasBeenStarted, getPreferenceBoost, hasHistory } = useReadingHistory();

  // Create series filter - only show first book or next book in series
  const isSeriesAppropriate = useMemo(() => {
    if (!items.length) return () => true;
    return createSeriesFilter({
      allItems: items,
      isFinished,
      hasStarted: hasBeenStarted,
    });
  }, [items, isFinished, hasBeenStarted]);

  // Cache store access - use selector that checks cache validity
  const sessionKey = getSessionCacheKey(session);
  const cachedResult = useMoodScoringCacheStore((s) => {
    if (!s.cachedResult || !s.cachedSessionKey) return null;
    if (s.cachedSessionKey !== sessionKey) return null;
    if (Math.abs(s.cachedItemCount - items.length) > 5) return null;
    return s.cachedResult;
  });
  const setCachedResult = useMoodScoringCacheStore((s) => s.setCachedResult);
  const isScoring = useMoodScoringCacheStore((s) => s.isScoring);
  const setIsScoring = useMoodScoringCacheStore((s) => s.setIsScoring);

  // Track if we need to run scoring (session exists but no cache)
  const needsScoring = isLoaded && session?.mood && !cachedResult && !isScoring;

  // Safety: reset stale isScoring state when there's no session
  useEffect(() => {
    if (isScoring && !session?.mood) {
      logger.debug('[Browse Perf] Resetting stale isScoring state (no session)');
      setIsScoring(false);
    }
  }, [isScoring, session?.mood, setIsScoring]);

  // Safety: timeout to reset isScoring if stuck for too long (60 seconds)
  // Note: scoring 2000+ items can take 30+ seconds on slower devices
  useEffect(() => {
    if (!isScoring) return;

    const timeout = setTimeout(() => {
      logger.debug('[Browse Perf] Resetting isScoring due to timeout (60s)');
      setIsScoring(false);
    }, 60000);

    return () => clearTimeout(timeout);
  }, [isScoring, setIsScoring]);

  // Use refs for values that shouldn't trigger effect restart
  const scoringParamsRef = useRef({
    items,
    session,
    sessionKey,
    isFinished,
    isSeriesAppropriate,
    getPreferenceBoost,
    hasHistory,
    applyPreferenceBoosts,
    excludeFinished,
    dnaFilterMode,
    includeUntagged,
    minMatchPercent,
  });

  // Update ref on each render (but don't trigger effect)
  scoringParamsRef.current = {
    items,
    session,
    sessionKey,
    isFinished,
    isSeriesAppropriate,
    getPreferenceBoost,
    hasHistory,
    applyPreferenceBoosts,
    excludeFinished,
    dnaFilterMode,
    includeUntagged,
    minMatchPercent,
  };

  // Trigger async scoring when needed - minimal dependencies to prevent restarts
  useEffect(() => {
    if (!needsScoring) return;

    const params = scoringParamsRef.current;
    if (!params.session || !params.items.length) return;

    // Mark as scoring to prevent duplicate runs
    setIsScoring(true);
    let cancelled = false;
    logger.debug(`[Browse Perf] Starting async mood scoring for ${params.items.length} items...`);

    // Run scoring after a short delay to allow loading UI to render
    const timeoutId = setTimeout(() => {
      logger.debug(`[Browse Perf] Scoring timeout fired, cancelled=${cancelled}`);

      // Don't proceed if cancelled during wait
      if (cancelled) {
        logger.debug('[Browse Perf] Scoring cancelled before it could start');
        setIsScoring(false);
        return;
      }

      try {
        logger.debug('[Browse Perf] Starting actual scoring work...');
        const startTime = Date.now();

        // Run the scoring (this is the expensive part)
        const scoringResult = runMoodScoring({
          items: params.items,
          session: params.session,
          sessionKey: params.sessionKey,
          isFinished: params.isFinished,
          isSeriesAppropriate: params.isSeriesAppropriate,
          getPreferenceBoost: params.getPreferenceBoost,
          hasHistory: params.hasHistory,
          applyPreferenceBoosts: params.applyPreferenceBoosts,
          excludeFinished: params.excludeFinished,
          dnaFilterMode: params.dnaFilterMode,
          includeUntagged: params.includeUntagged,
          minMatchPercent: params.minMatchPercent,
        });

        const elapsed = Date.now() - startTime;
        logger.debug(`[Browse Perf] useMoodRecommendations: scored ${params.items.length} items in ${elapsed}ms (results: ${scoringResult.scored.length}) - CACHING`);

        // Only cache if not cancelled
        if (!cancelled) {
          // Cache the results
          setCachedResult(params.sessionKey, params.items.length, {
            scoredBooks: scoringResult.scored,
            unscoredItems: scoringResult.unscored,
            totalCount: scoringResult.scored.length,
            timestamp: Date.now(),
            dnaStats: scoringResult.dnaStats,
          });
        }
      } catch (error) {
        logger.error('[Browse Perf] Error during mood scoring:', error);
      } finally {
        setIsScoring(false);
      }
    }, 100); // Short delay to let UI render

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [needsScoring, setCachedResult, setIsScoring]);

  // Defer heavy computation (unused now but kept for compatibility)
  const deferredMood = useDeferredValue(session?.mood ?? '');
  const deferredPace = useDeferredValue(session?.pace ?? 'any');
  const deferredWeight = useDeferredValue(session?.weight ?? 'any');
  const deferredWorld = useDeferredValue(session?.world ?? 'any');

  const result = useMemo(() => {
    // Return empty if not ready
    if (!isLoaded || !session || !session.mood) {
      return {
        recommendations: [],
        unscored: [],
        totalCount: 0,
        isLoading: !isLoaded,
        isScoring: false,
        hasSession: !!session,
        dnaStats: { totalWithDNA: 0, totalWithoutDNA: 0, dnaPercentage: 0 },
      };
    }

    // If scoring is in progress, return loading state
    if (isScoring || needsScoring) {
      return {
        recommendations: [],
        unscored: [],
        totalCount: 0,
        isLoading: false,
        isScoring: true,
        hasSession: true,
        dnaStats: { totalWithDNA: 0, totalWithoutDNA: 0, dnaPercentage: 0 },
      };
    }

    // Check cache - if valid, return cached results
    if (cachedResult) {
      logger.debug(`[Browse Perf] useMoodRecommendations: cache HIT (${cachedResult.scoredBooks.length} results)`);
      return {
        recommendations: cachedResult.scoredBooks.slice(0, limit),
        unscored: cachedResult.unscoredItems,
        totalCount: cachedResult.totalCount,
        isLoading: false,
        isScoring: false,
        hasSession: true,
        dnaStats: cachedResult.dnaStats,
      };
    }

    // Fallback (shouldn't happen - scoring should have been triggered)
    return {
      recommendations: [],
      unscored: [],
      totalCount: 0,
      isLoading: false,
      isScoring: false,
      hasSession: true,
      dnaStats: { totalWithDNA: 0, totalWithoutDNA: 0, dnaPercentage: 0 },
    };
  }, [isLoaded, session, cachedResult, isScoring, needsScoring, limit]);

  return result;
}

/**
 * Get a single book's mood score
 */
export function useBookMoodScore(
  itemId: string,
  session?: MoodSession | null
): { score: MoodScore; matchPercent: number } | null {
  const activeSession = useActiveSession();
  const effectiveSession = session ?? activeSession;
  const getItem = useLibraryCache((s) => s.getItem);

  return useMemo(() => {
    if (!effectiveSession || !effectiveSession.mood) {
      return null;
    }

    const item = getItem(itemId);
    if (!item) return null;

    // Convert item to BookScoringData
    const metadata = getMetadata(item);
    const bookData: BookScoringData = {
      metadata,
      genres: (metadata as BookMetadata).genres || [],
      description: (metadata as BookMetadata).description || '',
      tags: getItemTags(item),
      durationHours: getDurationHours(item),
      dna: parseBookDNA(getItemTags(item)),
    };

    const score = calculateMoodScore(bookData, effectiveSession);
    const matchPercent = scoreToPercent(score, effectiveSession);

    return { score, matchPercent };
  }, [itemId, effectiveSession, getItem]);
}

/**
 * Get books grouped by match quality
 */
export function useMoodRecommendationsByQuality(session?: MoodSession | null) {
  const { recommendations, isLoading, isScoring, hasSession } = useMoodRecommendations({
    session,
    limit: 200,
    minMatchPercent: 0,
  });

  return useMemo(() => {
    const perfect: ScoredBook[] = [];
    const great: ScoredBook[] = [];
    const good: ScoredBook[] = [];
    const partial: ScoredBook[] = [];
    const low: ScoredBook[] = [];

    for (const rec of recommendations) {
      if (rec.matchPercent >= 80) perfect.push(rec);
      else if (rec.matchPercent >= 60) great.push(rec);
      else if (rec.matchPercent >= 40) good.push(rec);
      else if (rec.matchPercent >= 20) partial.push(rec);
      else low.push(rec);
    }

    return {
      perfect,
      great,
      good,
      partial,
      low,
      isLoading,
      isScoring,
      hasSession,
    };
  }, [recommendations, isLoading, isScoring, hasSession]);
}
