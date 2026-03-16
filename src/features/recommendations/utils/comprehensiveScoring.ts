/**
 * src/features/recommendations/utils/comprehensiveScoring.ts
 *
 * Comprehensive Scoring System for the Enhanced Recommendation System v2.0.
 * Combines multiple scoring dimensions:
 * - Affinity scoring (author, narrator, genre, series)
 * - Mood/vibe scoring (with BookDNA support)
 * - Publication era preferences
 * - Temporal decay (recency of reading history)
 * - Mismatch penalties
 * - Diversity enforcement
 */

import { LibraryItem, BookMetadata, BookMedia } from '@/core/types';
import {
  AFFINITY_WEIGHTS,
  MOOD_WEIGHTS,
  DNA_WEIGHTS,
  MISMATCH_PENALTIES,
  ABANDONMENT_PENALTIES,
  DIVERSITY,
  calculateMetadataRichness,
  getConfidenceLevel,
} from './scoreWeights';
import { getPublicationEra, PublicationEra, EraPreference, matchesEraPreference } from './publicationEra';
import {
  parseBookDNA,
  BookDNA,
  hasMoodScores,
  getDNAMoodScore,
} from '@/shared/utils/bookDNA';
import { Mood } from '@/shared/utils/bookDNA';

// Local types for mood session scoring (legacy, kept for compatibility)
type Pace = 'slow' | 'steady' | 'fast' | 'any';
type Weight = 'light' | 'balanced' | 'heavy' | 'any';
type World = 'contemporary' | 'historical' | 'fantasy' | 'scifi' | 'any';
interface MoodSession {
  mood: Mood;
  pace: Pace;
  weight: Weight;
  world: World;
  flavor: string | null;
  seedBookId: string | null;
  length: string;
  excludeChildrens: boolean;
  createdAt: number;
  softExpiresAt: number;
  expiresAt: number;
}

// ============================================================================
// TYPES
// ============================================================================

export interface AffinityData {
  authorAffinities: Map<string, number>;
  narratorAffinities: Map<string, number>;
  genreAffinities: Map<string, number>;
  seriesStarted: Set<string>;
  authorPenalties: Map<string, number>;
  seriesPenalties: Map<string, number>;
}

export interface ScoringContext {
  /** User's affinity data from reading history */
  affinities: AffinityData;
  /** Active mood session (if any) */
  moodSession: MoodSession | null;
  /** User's era preferences (if any) */
  eraPreference: EraPreference | null;
  /** Known authors (from reading history) */
  knownAuthors: Set<string>;
  /** Known narrators (from reading history) */
  knownNarrators: Set<string>;
  /** User's preferred length category */
  preferredLength: 'short' | 'medium' | 'long' | 'any';
  /** Whether user prefers series or standalone */
  prefersSeries: boolean | null;
  /** Whether to exclude children's books */
  excludeChildrens: boolean;
}

export interface ScoreBreakdown {
  /** Author affinity contribution */
  authorAffinity: number;
  /** Narrator affinity contribution */
  narratorAffinity: number;
  /** Genre affinity contribution */
  genreAffinity: number;
  /** Series continuation bonus */
  seriesBonus: number;
  /** Mood match score */
  moodScore: number;
  /** Pace match score */
  paceScore: number;
  /** Weight (tone) match score */
  weightScore: number;
  /** World setting match score */
  worldScore: number;
  /** Length match score */
  lengthScore: number;
  /** Era preference score */
  eraScore: number;
  /** BookDNA contribution */
  dnaScore: number;
  /** Total before penalties */
  subtotal: number;
  /** Abandonment penalty multiplier */
  abandonmentPenalty: number;
  /** Mismatch penalty multiplier */
  mismatchPenalty: number;
  /** Final score */
  total: number;
}

export interface ComprehensiveScore {
  /** Final score (higher = better match) */
  total: number;
  /** Detailed score breakdown */
  breakdown: ScoreBreakdown;
  /** Confidence level based on metadata richness */
  confidence: 'high' | 'medium' | 'low';
  /** Whether BookDNA was used for scoring */
  usedDNA: boolean;
  /** Human-readable reasons for the match */
  matchReasons: string[];
  /** Primary recommendation category */
  category: RecommendationCategory;
  /** Parsed BookDNA (for reference) */
  dna: BookDNA;
  /** Publication era */
  era: PublicationEra | null;
  /** Debug breakdown — only present when debug=true */
  debugBreakdown?: DebugScoreBreakdown;
}

export type RecommendationCategory =
  | 'comfort'           // High author/narrator affinity
  | 'series-next'       // Next in series user started
  | 'mood-match'        // Strong mood/vibe match
  | 'genre-exploration' // Genre match, new author
  | 'narrator-gateway'  // Loved narrator, new author
  | 'wild-card'         // Discovery/serendipity
  | 'comparable';       // Similar to loved book

// ============================================================================
// DEBUG SCORE BREAKDOWN (opt-in via debug flag)
// ============================================================================

export interface DebugScoreBreakdown {
  total: number;
  factors: {
    genreOverlap: number;
    tagOverlap: number;
    moodMatch: number;
    spectrumMatch: number;
    authorBonus: number;
    narratorBonus: number;
    seriesBonus: number;
    durationSimilarity: number;
    yearProximity: number;
    abandonmentPenalty: number;
    pacingMatch: number;
  };
  confidence: 'LOW' | 'GOOD' | 'EXCELLENT';
  /** Auto-generated from the top 2 contributing factors */
  primaryReason: string;
}

/** Generate a human-readable reason string from the top 2 scoring factors */
function generatePrimaryReason(factors: DebugScoreBreakdown['factors']): string {
  const FACTOR_LABELS: Record<string, string> = {
    genreOverlap: 'genre overlap',
    tagOverlap: 'tag overlap',
    moodMatch: 'mood match',
    spectrumMatch: 'spectrum alignment',
    authorBonus: 'author affinity',
    narratorBonus: 'narrator affinity',
    seriesBonus: 'series continuation',
    durationSimilarity: 'similar length',
    yearProximity: 'era match',
    pacingMatch: 'pacing match',
  };

  const top = Object.entries(factors)
    .filter(([key]) => key !== 'abandonmentPenalty')
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  if (top.length === 0) return 'No strong match factors';

  return top
    .map(([key, val]) => {
      const label = FACTOR_LABELS[key] || key;
      return val >= 20 ? `Strong ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
    })
    .join(' + ');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalize(str: string | null | undefined): string {
  return (str || '').toLowerCase().trim();
}

function getItemTags(item: LibraryItem): string[] {
  const media = item.media as { tags?: string[] } | undefined;
  return media?.tags || [];
}

function getMetadata(item: LibraryItem): BookMetadata | null {
  if (item.mediaType !== 'book') return null;
  return (item.media?.metadata as BookMetadata) || null;
}

function getDurationHours(item: LibraryItem): number {
  const media = item.media as BookMedia | undefined;
  return ((media?.duration || 0) / 3600);
}

// ============================================================================
// AFFINITY SCORING
// ============================================================================

function scoreAuthorAffinity(
  author: string | null,
  affinities: AffinityData,
  _knownAuthors: Set<string>
): { score: number; reason: string | null } {
  if (!author) return { score: 0, reason: null };

  const normalized = normalize(author);
  const affinity = affinities.authorAffinities.get(normalized) || 0;

  if (affinity === 0) return { score: 0, reason: null };

  const score = AFFINITY_WEIGHTS.author.base +
    Math.min(affinity * AFFINITY_WEIGHTS.author.perBook, AFFINITY_WEIGHTS.author.maxBonus);

  return {
    score,
    reason: `More by ${author}`,
  };
}

function scoreNarratorAffinity(
  narrator: string | null,
  affinities: AffinityData,
  _knownNarrators: Set<string>
): { score: number; reason: string | null } {
  if (!narrator) return { score: 0, reason: null };

  const normalized = normalize(narrator);
  const affinity = affinities.narratorAffinities.get(normalized) || 0;

  if (affinity === 0) return { score: 0, reason: null };

  const score = AFFINITY_WEIGHTS.narrator.base +
    Math.min(affinity * AFFINITY_WEIGHTS.narrator.perBook, AFFINITY_WEIGHTS.narrator.maxBonus);

  return {
    score,
    reason: `Narrated by ${narrator}`,
  };
}

function scoreGenreAffinity(
  genres: string[],
  affinities: AffinityData
): { score: number; topGenre: string | null } {
  if (genres.length === 0) return { score: 0, topGenre: null };

  let score = 0;
  let topGenre: string | null = null;
  let topGenreScore = 0;

  for (const genre of genres) {
    const normalized = normalize(genre);
    const affinity = affinities.genreAffinities.get(normalized) || 0;
    if (affinity > 0) {
      const genreScore = Math.min(affinity * AFFINITY_WEIGHTS.genre.perMatch, 10);
      score += genreScore;
      if (genreScore > topGenreScore) {
        topGenreScore = genreScore;
        topGenre = genre;
      }
    }
  }

  score = Math.min(score, AFFINITY_WEIGHTS.genre.maxBonus);
  return { score, topGenre };
}

function scoreSeriesContinuation(
  seriesName: string | null,
  affinities: AffinityData
): { score: number; reason: string | null } {
  if (!seriesName) return { score: 0, reason: null };

  const normalized = normalize(seriesName);

  if (affinities.seriesStarted.has(normalized)) {
    return {
      score: AFFINITY_WEIGHTS.series.continuation,
      reason: `Continue ${seriesName}`,
    };
  }

  return { score: 0, reason: null };
}

// ============================================================================
// MOOD SCORING
// ============================================================================

/**
 * Maps mood to preferred spectrum values for DNA-based scoring
 */
const MOOD_SPECTRUM_PREFS: Record<Mood, { key: keyof BookDNA['spectrums']; value: number }> = {
  thrills: { key: 'seriousHumorous', value: -0.3 },
  comfort: { key: 'bleakHopeful', value: 0.6 },
  escape: { key: 'familiarChallenging', value: -0.3 },
  feels: { key: 'bleakHopeful', value: -0.2 },
};

function scoreMoodMatch(
  dna: BookDNA,
  genres: string[],
  session: MoodSession | null
): { moodScore: number; dnaScore: number; isPrimary: boolean; reason: string | null } {
  if (!session || !session.mood) {
    return { moodScore: 0, dnaScore: 0, isPrimary: false, reason: null };
  }

  let moodScore = 0;
  let dnaScore = 0;
  let isPrimary = false;
  let reason: string | null = null;

  // DNA-based mood scoring (preferred)
  if (dna.hasDNA && hasMoodScores(dna)) {
    const dnaMoodValue = getDNAMoodScore(dna, session.mood);
    if (dnaMoodValue !== null && dnaMoodValue > 0) {
      dnaScore = dnaMoodValue * DNA_WEIGHTS.moodScore;
      if (dnaMoodValue >= 0.7) {
        isPrimary = true;
        reason = `High ${session.mood}`;
      } else if (dnaMoodValue >= 0.5) {
        isPrimary = true;
        reason = `${session.mood} match`;
      }
    }

    // Spectrum alignment bonus
    const specPref = MOOD_SPECTRUM_PREFS[session.mood];
    if (specPref) {
      const specValue = dna.spectrums[specPref.key];
      if (specValue !== null) {
        const distance = Math.abs(specValue - specPref.value);
        const alignment = Math.max(0, 1 - distance);
        dnaScore += alignment * DNA_WEIGHTS.spectrumMatch;
      }
    }
  }

  // Genre-based mood scoring (fallback)
  if (!isPrimary) {
    // Import mood genre map
    const { MOOD_GENRE_MAP } = require('./moodMaps');
    const moodGenres = MOOD_GENRE_MAP[session.mood] || [];

    for (const genre of genres) {
      const genreLower = genre.toLowerCase();
      if (moodGenres.some((mg: string) => genreLower.includes(mg) || mg.includes(genreLower))) {
        moodScore = MOOD_WEIGHTS.moodMatch;
        isPrimary = true;
        reason = reason || 'Genre mood match';
        break;
      }
    }
  }

  return { moodScore, dnaScore, isPrimary, reason };
}

function scorePaceMatch(
  dna: BookDNA,
  genres: string[],
  description: string,
  pace: Pace | undefined
): number {
  if (!pace || pace === 'any') return 0;

  // DNA-based pacing
  if (dna.hasDNA && dna.pacing) {
    const paceMapping: Record<Exclude<Pace, 'any'>, string[]> = {
      slow: ['slow', 'moderate'],
      steady: ['moderate', 'variable'],
      fast: ['fast', 'variable'],
    };

    if (paceMapping[pace]?.includes(dna.pacing)) {
      return MOOD_WEIGHTS.paceMatch;
    }
  }

  // Genre/description fallback
  const { PACE_INDICATORS } = require('./moodMaps');
  const indicators = PACE_INDICATORS[pace] || [];

  const text = [...genres, description].join(' ').toLowerCase();
  for (const indicator of indicators) {
    if (text.includes(indicator)) {
      return MOOD_WEIGHTS.paceMatch;
    }
  }

  return 0;
}

function scoreWeightMatch(
  genres: string[],
  description: string,
  weight: Weight | undefined
): number {
  if (!weight || weight === 'any') return 0;

  const { WEIGHT_INDICATORS } = require('./moodMaps');
  const indicators = WEIGHT_INDICATORS[weight] || [];

  const text = [...genres, description].join(' ').toLowerCase();
  for (const indicator of indicators) {
    if (text.includes(indicator)) {
      return MOOD_WEIGHTS.weightMatch;
    }
  }

  return 0;
}

function scoreWorldMatch(
  genres: string[],
  world: World | undefined
): number {
  if (!world || world === 'any') return 0;

  const { WORLD_GENRE_MAP } = require('./moodMaps');
  const worldGenres = WORLD_GENRE_MAP[world] || [];

  for (const genre of genres) {
    const genreLower = genre.toLowerCase();
    if (worldGenres.some((wg: string) => genreLower.includes(wg) || wg.includes(genreLower))) {
      return MOOD_WEIGHTS.worldMatch;
    }
  }

  return 0;
}

function scoreLengthMatch(
  durationHours: number,
  preferredLength: string
): number {
  if (preferredLength === 'any' || durationHours === 0) return 0;

  const lengthRanges: Record<string, { min: number; max: number }> = {
    short: { min: 0, max: 6 },
    medium: { min: 6, max: 12 },
    long: { min: 12, max: Infinity },
  };

  const range = lengthRanges[preferredLength];
  if (!range) return 0;

  if (durationHours >= range.min && durationHours <= range.max) {
    return MOOD_WEIGHTS.lengthMatch;
  }

  // Partial credit for close matches
  if (durationHours >= range.min - 2 && durationHours <= range.max + 2) {
    return MOOD_WEIGHTS.lengthMatch / 2;
  }

  return 0;
}

// ============================================================================
// PENALTY CALCULATION
// ============================================================================

function calculateAbandonmentPenalty(
  author: string | null,
  seriesName: string | null,
  affinities: AffinityData
): number {
  let penalty = 1.0;

  if (author) {
    const authorPenalty = affinities.authorPenalties.get(normalize(author)) || 0;
    penalty *= (1 - Math.min(authorPenalty, ABANDONMENT_PENALTIES.maxPenalty));
  }

  if (seriesName) {
    const seriesPenalty = affinities.seriesPenalties.get(normalize(seriesName)) || 0;
    penalty *= (1 - Math.min(seriesPenalty, ABANDONMENT_PENALTIES.maxPenalty));
  }

  return penalty;
}

function calculateMismatchPenalty(
  genres: string[],
  description: string,
  session: MoodSession | null
): number {
  if (!session) return 1.0;

  let penalty = 1.0;
  const text = [...genres, description].join(' ').toLowerCase();

  // Weight mismatch
  if (session.weight && session.weight !== 'any' && session.weight !== 'balanced') {
    const { WEIGHT_INDICATORS } = require('./moodMaps');

    if (session.weight === 'light') {
      const heavyIndicators = WEIGHT_INDICATORS.heavy || [];
      if (heavyIndicators.some((ind: string) => text.includes(ind))) {
        penalty *= MISMATCH_PENALTIES.heavyForLight;
      }
    } else if (session.weight === 'heavy') {
      const lightIndicators = WEIGHT_INDICATORS.light || [];
      if (lightIndicators.some((ind: string) => text.includes(ind))) {
        penalty *= MISMATCH_PENALTIES.lightForHeavy;
      }
    }
  }

  // Pace mismatch
  if (session.pace && session.pace !== 'any' && session.pace !== 'steady') {
    const { PACE_INDICATORS } = require('./moodMaps');

    if (session.pace === 'slow') {
      const fastIndicators = PACE_INDICATORS.fast || [];
      if (fastIndicators.some((ind: string) => text.includes(ind))) {
        penalty *= MISMATCH_PENALTIES.fastForSlow;
      }
    } else if (session.pace === 'fast') {
      const slowIndicators = PACE_INDICATORS.slow || [];
      if (slowIndicators.some((ind: string) => text.includes(ind))) {
        penalty *= MISMATCH_PENALTIES.slowForFast;
      }
    }
  }

  return penalty;
}

// ============================================================================
// CATEGORY DETERMINATION
// ============================================================================

function determineCategory(
  breakdown: Omit<ScoreBreakdown, 'total'>,
  knownAuthors: Set<string>,
  author: string | null
): RecommendationCategory {
  const normalized = normalize(author);

  // Series continuation is highest priority
  if (breakdown.seriesBonus > 0) {
    return 'series-next';
  }

  // High author/narrator affinity = comfort
  if (breakdown.authorAffinity >= AFFINITY_WEIGHTS.author.base ||
      breakdown.narratorAffinity >= AFFINITY_WEIGHTS.narrator.base) {
    return 'comfort';
  }

  // Strong mood match
  if (breakdown.moodScore >= MOOD_WEIGHTS.moodMatch ||
      breakdown.dnaScore >= DNA_WEIGHTS.moodScore * 0.7) {
    return 'mood-match';
  }

  // Narrator gateway: loved narrator, new author
  if (breakdown.narratorAffinity > 0 && !knownAuthors.has(normalized)) {
    return 'narrator-gateway';
  }

  // Genre exploration: genre match, new author
  if (breakdown.genreAffinity > 0 && !knownAuthors.has(normalized)) {
    return 'genre-exploration';
  }

  return 'wild-card';
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate comprehensive score for a library item.
 * @param debug - When true, includes a DebugScoreBreakdown with factor-level
 *   traceability and an auto-generated primaryReason string.
 */
export function calculateComprehensiveScore(
  item: LibraryItem,
  context: ScoringContext,
  debug: boolean = false
): ComprehensiveScore {
  const metadata = getMetadata(item);
  const tags = getItemTags(item);
  const dna = parseBookDNA(tags);
  const era = getPublicationEra(item);
  const durationHours = getDurationHours(item);

  const genres = metadata?.genres || [];
  const description = metadata?.description || '';
  const author = metadata?.authorName || null;
  const narrator = metadata?.narratorName || null;
  const seriesName = metadata?.seriesName || null;

  const matchReasons: string[] = [];

  // Affinity scores
  const authorResult = scoreAuthorAffinity(author, context.affinities, context.knownAuthors);
  const narratorResult = scoreNarratorAffinity(narrator, context.affinities, context.knownNarrators);
  const genreResult = scoreGenreAffinity(genres, context.affinities);
  const seriesResult = scoreSeriesContinuation(seriesName, context.affinities);

  if (authorResult.reason) matchReasons.push(authorResult.reason);
  if (narratorResult.reason) matchReasons.push(narratorResult.reason);
  if (seriesResult.reason) matchReasons.push(seriesResult.reason);

  // Mood scores
  const moodResult = scoreMoodMatch(dna, genres, context.moodSession);
  const paceScore = scorePaceMatch(dna, genres, description, context.moodSession?.pace);
  const weightScore = scoreWeightMatch(genres, description, context.moodSession?.weight);
  const worldScore = scoreWorldMatch(genres, context.moodSession?.world);
  const lengthScore = scoreLengthMatch(durationHours, context.preferredLength);

  if (moodResult.reason) matchReasons.push(moodResult.reason);

  // Era score
  let eraScore = 0;
  if (context.eraPreference) {
    const eraResult = matchesEraPreference(era, context.eraPreference);
    eraScore = eraResult.score;
    if (eraScore > 0) {
      matchReasons.push(`${era} era`);
    }
  }

  // Calculate subtotal before penalties
  const subtotal =
    authorResult.score +
    narratorResult.score +
    genreResult.score +
    seriesResult.score +
    moodResult.moodScore +
    moodResult.dnaScore +
    paceScore +
    weightScore +
    worldScore +
    lengthScore +
    eraScore;

  // Calculate penalties
  const abandonmentPenalty = calculateAbandonmentPenalty(author, seriesName, context.affinities);
  const mismatchPenalty = calculateMismatchPenalty(genres, description, context.moodSession);

  // Final score
  const total = Math.round(subtotal * abandonmentPenalty * mismatchPenalty);

  const breakdown: ScoreBreakdown = {
    authorAffinity: authorResult.score,
    narratorAffinity: narratorResult.score,
    genreAffinity: genreResult.score,
    seriesBonus: seriesResult.score,
    moodScore: moodResult.moodScore,
    paceScore,
    weightScore,
    worldScore,
    lengthScore,
    eraScore,
    dnaScore: moodResult.dnaScore,
    subtotal,
    abandonmentPenalty,
    mismatchPenalty,
    total,
  };

  // Determine category
  const category = determineCategory(breakdown, context.knownAuthors, author);

  // Calculate confidence
  const richness = calculateMetadataRichness({
    tagCount: tags.length,
    genreCount: genres.length,
    hasDescription: description.length > 100,
    hasNarrator: !!narrator,
    hasPublisher: !!metadata?.publisher,
    hasDNA: dna.hasDNA,
  });
  const confidence = getConfidenceLevel(richness);

  const result: ComprehensiveScore = {
    total,
    breakdown,
    confidence,
    usedDNA: dna.hasDNA && moodResult.dnaScore > 0,
    matchReasons,
    category,
    dna,
    era,
  };

  // Debug breakdown: maps internal factor names to the standardized debug schema
  if (debug) {
    const debugFactors: DebugScoreBreakdown['factors'] = {
      genreOverlap: genreResult.score,
      tagOverlap: 0, // Tags are scored in comparable engine, not affinity scoring
      moodMatch: moodResult.moodScore + moodResult.dnaScore,
      spectrumMatch: 0, // Spectrum contribution is folded into dnaScore above
      authorBonus: authorResult.score,
      narratorBonus: narratorResult.score,
      seriesBonus: seriesResult.score,
      durationSimilarity: lengthScore,
      yearProximity: eraScore,
      abandonmentPenalty: abandonmentPenalty,
      pacingMatch: paceScore,
    };

    // If DNA was used, separate mood vs spectrum contributions for traceability
    if (dna.hasDNA && context.moodSession) {
      const specPref = MOOD_SPECTRUM_PREFS[context.moodSession.mood];
      if (specPref) {
        const specValue = dna.spectrums[specPref.key];
        if (specValue !== null) {
          const distance = Math.abs(specValue - specPref.value);
          const alignment = Math.max(0, 1 - distance);
          const spectrumContrib = alignment * DNA_WEIGHTS.spectrumMatch;
          debugFactors.spectrumMatch = spectrumContrib;
          debugFactors.moodMatch = moodResult.moodScore + moodResult.dnaScore - spectrumContrib;
        }
      }
    }

    const debugConfidence: DebugScoreBreakdown['confidence'] =
      confidence === 'high' ? 'EXCELLENT' : confidence === 'medium' ? 'GOOD' : 'LOW';

    result.debugBreakdown = {
      total,
      factors: debugFactors,
      confidence: debugConfidence,
      primaryReason: generatePrimaryReason(debugFactors),
    };
  }

  return result;
}

// ============================================================================
// BATCH SCORING
// ============================================================================

export interface ScoredItem {
  item: LibraryItem;
  score: ComprehensiveScore;
}

/**
 * Score multiple items efficiently.
 */
export function scoreItems(
  items: LibraryItem[],
  context: ScoringContext
): ScoredItem[] {
  return items.map(item => ({
    item,
    score: calculateComprehensiveScore(item, context),
  }));
}

/**
 * Score and sort items by total score (descending).
 */
export function scoreAndRank(
  items: LibraryItem[],
  context: ScoringContext
): ScoredItem[] {
  return scoreItems(items, context)
    .sort((a, b) => b.score.total - a.score.total);
}

// ============================================================================
// DIVERSITY ENFORCEMENT
// ============================================================================

/**
 * Apply diversity constraints to scored results.
 * Ensures variety in author, series, and narrator.
 */
export function applyDiversityConstraints(
  scored: ScoredItem[],
  maxResults: number = 20
): ScoredItem[] {
  const result: ScoredItem[] = [];
  const authorCounts = new Map<string, number>();
  const seriesCounts = new Map<string, number>();
  const narratorCounts = new Map<string, number>();

  for (const item of scored) {
    if (result.length >= maxResults) break;

    const metadata = getMetadata(item.item);
    const author = normalize(metadata?.authorName);
    const series = normalize(metadata?.seriesName);
    const narrator = normalize(metadata?.narratorName);

    // Check diversity limits
    if (author && (authorCounts.get(author) || 0) >= DIVERSITY.maxSameAuthor) continue;
    if (series && (seriesCounts.get(series) || 0) >= DIVERSITY.maxSameSeries) continue;
    if (narrator && (narratorCounts.get(narrator) || 0) >= DIVERSITY.maxSameNarrator) continue;

    // Add to result
    result.push(item);

    // Update counts
    if (author) authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
    if (series) seriesCounts.set(series, (seriesCounts.get(series) || 0) + 1);
    if (narrator) narratorCounts.set(narrator, (narratorCounts.get(narrator) || 0) + 1);
  }

  return result;
}
