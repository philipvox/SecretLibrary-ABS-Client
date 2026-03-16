/**
 * src/features/recommendations/utils/comparableBooksEngine.ts
 *
 * Comparable Books Engine for the Enhanced Recommendation System v2.0.
 * Generates "Because You Loved X" recommendations using:
 * - Explicit dna:comparable tags (highest confidence)
 * - Author/series matching
 * - Genre/tag similarity
 * - BookDNA trope/theme/vibe matching
 * - Narrator matching for audiobook affinity
 */

import { LibraryItem, BookMetadata } from '@/core/types';
import { COMPARABLE_WEIGHTS, COMPARABLE_WEIGHTS_BYL, getTemporalDecay } from './scoreWeights';
import { parseBookDNA, BookDNA } from '@/shared/utils/bookDNA';
import { getPublicationEra, PublicationEra } from './publicationEra';

// ============================================================================
// TYPES
// ============================================================================

export interface ComparableResult {
  /** The recommended book */
  item: LibraryItem;
  /** The source book this is comparable to */
  sourceBook: {
    id: string;
    title: string;
    author: string;
  };
  /** Similarity score (0-100) */
  similarityScore: number;
  /** Reasons why books are similar */
  matchReasons: string[];
  /** Type of similarity */
  similarityType: SimilarityType;
  /** Whether this is an explicit comparable (from DNA tag) */
  isExplicitComparable: boolean;
}

export type SimilarityType =
  | 'explicit'       // dna:comparable tag
  | 'same-author'    // Same author
  | 'same-series'    // Same series
  | 'same-narrator'  // Same narrator
  | 'similar-dna'    // Similar BookDNA (themes, tropes, vibe)
  | 'similar-genre'; // Similar genres/tags

export interface ComparableSourceBook {
  id: string;
  title: string;
  author: string | null;
  narrator: string | null;
  series: string | null;
  genres: Set<string>;
  tags: Set<string>;
  dna: BookDNA;
  finishedAt: number | null;
  rating: number | null;
}

export interface ComparableCandidate {
  item: LibraryItem;
  metadata: BookMetadata;
  genres: string[];
  tags: string[];
  dna: BookDNA;
  author: string | null;
  narrator: string | null;
  series: string | null;
  era: PublicationEra | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize string for comparison (lowercase, trim)
 */
function normalize(str: string | null | undefined): string {
  return (str || '').toLowerCase().trim();
}

/**
 * Check if two strings match (case-insensitive, partial match)
 */
function stringsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const aNorm = normalize(a);
  const bNorm = normalize(b);
  if (!aNorm || !bNorm) return false;
  return aNorm.includes(bNorm) || bNorm.includes(aNorm);
}

/**
 * Count matching items between two sets
 */
function countMatches(setA: Set<string>, arrB: string[]): number {
  let count = 0;
  for (const item of arrB) {
    if (setA.has(item.toLowerCase())) {
      count++;
    }
  }
  return count;
}

/**
 * Get tags from a library item
 */
function getItemTags(item: LibraryItem): string[] {
  const media = item.media as { tags?: string[] } | undefined;
  return media?.tags || [];
}

/**
 * Prepare a finished book as a source for comparables
 */
export function prepareSourceBook(
  item: LibraryItem,
  finishedAt: number | null,
  rating: number | null = null
): ComparableSourceBook {
  const metadata = item.media?.metadata as BookMetadata | undefined;
  const tags = getItemTags(item);
  const dna = parseBookDNA(tags);

  return {
    id: item.id,
    title: metadata?.title || 'Unknown',
    author: metadata?.authorName || null,
    narrator: metadata?.narratorName || null,
    series: metadata?.seriesName || null,
    genres: new Set((metadata?.genres || []).map(g => g.toLowerCase())),
    tags: new Set(tags.map(t => t.toLowerCase())),
    dna,
    finishedAt,
    rating,
  };
}

/**
 * Prepare a candidate book for comparison
 */
export function prepareCandidate(item: LibraryItem): ComparableCandidate {
  const metadata = item.media?.metadata as BookMetadata | undefined;
  const tags = getItemTags(item);
  const dna = parseBookDNA(tags);

  return {
    item,
    metadata: metadata || {} as BookMetadata,
    genres: metadata?.genres || [],
    tags,
    dna,
    author: metadata?.authorName || null,
    narrator: metadata?.narratorName || null,
    series: metadata?.seriesName || null,
    era: getPublicationEra(item),
  };
}

// ============================================================================
// SCORING CONTEXT
// ============================================================================

/**
 * Distinguishes scoring weight sets:
 * - MORE_LIKE_THIS: Book detail "More Like This" — identity-inclusive weights (default)
 * - BECAUSE_YOU_LISTENED: Browse "Because You Listened" — DNA-first, identity de-emphasized
 */
export type ComparableScoringContext = 'BECAUSE_YOU_LISTENED' | 'MORE_LIKE_THIS';

// ============================================================================
// DNA SIMILARITY HELPERS (used by BECAUSE_YOU_LISTENED scoring)
// ============================================================================

/** Calculate mood similarity between two BookDNA profiles (0–1) */
function scoreDNAMoodSimilarity(a: BookDNA, b: BookDNA): number {
  const keys: (keyof BookDNA['moodScores'])[] = ['thrills', 'drama', 'laughs', 'wonder', 'heart', 'ideas'];
  let totalSim = 0;
  let count = 0;
  for (const key of keys) {
    const va = a.moodScores[key];
    const vb = b.moodScores[key];
    if (va !== null && vb !== null) {
      totalSim += 1 - Math.abs(va - vb);
      count++;
    }
  }
  return count > 0 ? totalSim / count : 0;
}

/** Calculate spectrum similarity between two BookDNA profiles (0–1) */
function scoreDNASpectrumSimilarity(a: BookDNA, b: BookDNA): number {
  const keys: (keyof BookDNA['spectrums'])[] = ['darkLight', 'seriousHumorous', 'denseAccessible', 'plotCharacter', 'bleakHopeful', 'familiarChallenging'];
  let totalSim = 0;
  let count = 0;
  for (const key of keys) {
    const va = a.spectrums[key];
    const vb = b.spectrums[key];
    if (va !== null && vb !== null) {
      totalSim += 1 - Math.abs(va - vb) / 2; // range is -1..1, max diff = 2
      count++;
    }
  }
  return count > 0 ? totalSim / count : 0;
}

/** Score pacing match between two BookDNA profiles (0 or partial/full bonus) */
function scoreBYLPacingMatch(a: BookDNA, b: BookDNA): number {
  if (!a.pacing || !b.pacing) return 0;
  if (a.pacing === b.pacing) return COMPARABLE_WEIGHTS_BYL.pacingMatch;
  // Adjacent pacing values get partial credit
  const order = ['slow', 'moderate', 'variable', 'fast'];
  const ai = order.indexOf(a.pacing);
  const bi = order.indexOf(b.pacing);
  if (ai >= 0 && bi >= 0 && Math.abs(ai - bi) === 1) {
    return Math.round(COMPARABLE_WEIGHTS_BYL.pacingMatch * 0.6); // ~3 pts
  }
  return 0;
}

// ============================================================================
// BECAUSE YOU LISTENED — DNA-FIRST SIMILARITY SCORING
// ============================================================================

/**
 * DNA-first similarity scoring for "Because You Listened" context.
 * Mood/spectrum/trope/theme dominate; author/narrator/series de-emphasized.
 */
function calculateBYLSimilarity(
  source: ComparableSourceBook,
  candidate: ComparableCandidate
): { score: number; reasons: string[]; type: SimilarityType; isExplicit: boolean } {
  const W = COMPARABLE_WEIGHTS_BYL;
  let score = 0;
  const reasons: string[] = [];
  let primaryType: SimilarityType = 'similar-genre';
  let isExplicit = false;

  // 1. Explicit comparable (dna:comparable tag)
  if (source.dna.comparableTitles.length > 0) {
    const candidateTitle = normalize(candidate.metadata.title);
    for (const comparable of source.dna.comparableTitles) {
      if (candidateTitle.includes(comparable) || comparable.includes(candidateTitle)) {
        score += W.explicitComparable;
        reasons.push('Explicitly comparable');
        primaryType = 'explicit';
        isExplicit = true;
        break;
      }
    }
  }
  if (!isExplicit && candidate.dna.comparableTitles.length > 0) {
    const sourceTitle = normalize(source.title);
    for (const comparable of candidate.dna.comparableTitles) {
      if (sourceTitle.includes(comparable) || comparable.includes(sourceTitle)) {
        score += W.explicitComparable;
        reasons.push('Explicitly comparable');
        primaryType = 'explicit';
        isExplicit = true;
        break;
      }
    }
  }

  // 2–5. DNA-based scoring (mood 30, spectrum 20, tropes 15, themes 10, pacing 5)
  if (source.dna.hasDNA && candidate.dna.hasDNA) {
    const moodSim = scoreDNAMoodSimilarity(source.dna, candidate.dna);
    if (moodSim > 0) {
      score += Math.round(moodSim * W.dnaMoodSimilarity);
      if (moodSim >= 0.7) reasons.push('Strong mood match');
      else if (moodSim >= 0.4) reasons.push('Similar mood');
      primaryType = 'similar-dna';
    }

    const specSim = scoreDNASpectrumSimilarity(source.dna, candidate.dna);
    if (specSim > 0) {
      score += Math.round(specSim * W.dnaSpectrumSimilarity);
      if (specSim >= 0.7 && !reasons.some(r => r.includes('mood'))) {
        reasons.push('Similar tone');
      }
    }

    const sourceTropes = new Set(source.dna.tropes);
    const tropeMatches = candidate.dna.tropes.filter(t => sourceTropes.has(t)).length;
    if (tropeMatches > 0) {
      score += Math.min(tropeMatches * W.matchingTrope, W.maxTropes);
      reasons.push(`Shared tropes: ${tropeMatches}`);
      primaryType = 'similar-dna';
    }

    const sourceThemes = new Set(source.dna.themes);
    const themeMatches = candidate.dna.themes.filter(t => sourceThemes.has(t)).length;
    if (themeMatches > 0) {
      score += Math.min(themeMatches * W.matchingTheme, W.maxThemes);
      reasons.push(`Shared themes: ${themeMatches}`);
      primaryType = 'similar-dna';
    }

    score += scoreBYLPacingMatch(source.dna, candidate.dna);
  }

  // 6. Genre overlap (2 per, max 12)
  const genreMatches = countMatches(source.genres, candidate.genres);
  if (genreMatches > 0) {
    score += Math.min(genreMatches * W.matchingGenre, W.maxGenres);
    if (genreMatches >= 2) reasons.push(`${genreMatches} matching genres`);
  }

  // 7. Tag overlap (1 per, max 8)
  const tagMatches = countMatches(source.tags, candidate.tags);
  if (tagMatches > 0) {
    score += Math.min(tagMatches * W.matchingTag, W.maxTags);
  }

  // 8. Same narrator (3 pts — de-emphasized)
  if (source.narrator && stringsMatch(source.narrator, candidate.narrator)) {
    score += W.sameNarrator;
    reasons.push(`Same narrator: ${candidate.narrator}`);
    if (primaryType === 'similar-genre') primaryType = 'same-narrator';
  }

  // 9. Same author (2 pts — de-emphasized, should not dominate mood recs)
  if (source.author && stringsMatch(source.author, candidate.author)) {
    score += W.sameAuthor;
    reasons.push(`Same author: ${candidate.author}`);
    if (primaryType === 'similar-genre') primaryType = 'same-author';
  }

  // 10. Same series: 0 pts (series continuation handled separately)

  score = Math.min(score, W.maxScore);
  return { score, reasons, type: primaryType, isExplicit };
}

// ============================================================================
// SIMILARITY SCORING
// ============================================================================

/**
 * Calculate similarity between a source book and a candidate.
 * @param context - 'MORE_LIKE_THIS' (default) for book detail, 'BECAUSE_YOU_LISTENED' for browse recs
 */
export function calculateSimilarity(
  source: ComparableSourceBook,
  candidate: ComparableCandidate,
  context: ComparableScoringContext = 'MORE_LIKE_THIS'
): { score: number; reasons: string[]; type: SimilarityType; isExplicit: boolean } {
  // DNA-first weights for "Because You Listened" context
  if (context === 'BECAUSE_YOU_LISTENED') {
    return calculateBYLSimilarity(source, candidate);
  }
  let score = 0;
  const reasons: string[] = [];
  let primaryType: SimilarityType = 'similar-genre';
  let isExplicit = false;

  // 1. Check for explicit comparable (dna:comparable tag)
  if (source.dna.comparableTitles.length > 0) {
    const candidateTitle = normalize(candidate.metadata.title);
    for (const comparable of source.dna.comparableTitles) {
      if (candidateTitle.includes(comparable) || comparable.includes(candidateTitle)) {
        score += COMPARABLE_WEIGHTS.explicitComparable;
        reasons.push('Explicitly comparable');
        primaryType = 'explicit';
        isExplicit = true;
        break;
      }
    }
  }

  // Also check if candidate lists source as comparable
  if (candidate.dna.comparableTitles.length > 0) {
    const sourceTitle = normalize(source.title);
    for (const comparable of candidate.dna.comparableTitles) {
      if (sourceTitle.includes(comparable) || comparable.includes(sourceTitle)) {
        if (!isExplicit) {
          score += COMPARABLE_WEIGHTS.explicitComparable;
          reasons.push('Explicitly comparable');
          primaryType = 'explicit';
          isExplicit = true;
        }
        break;
      }
    }
  }

  // 2. Same author
  if (source.author && stringsMatch(source.author, candidate.author)) {
    score += COMPARABLE_WEIGHTS.sameAuthor;
    reasons.push(`Same author: ${candidate.author}`);
    if (primaryType === 'similar-genre') primaryType = 'same-author';
  }

  // 3. Same series
  if (source.series && stringsMatch(source.series, candidate.series)) {
    score += COMPARABLE_WEIGHTS.sameSeries;
    reasons.push(`Same series: ${candidate.series}`);
    if (primaryType !== 'explicit') primaryType = 'same-series';
  }

  // 4. Same narrator
  if (source.narrator && stringsMatch(source.narrator, candidate.narrator)) {
    score += COMPARABLE_WEIGHTS.sameNarrator;
    reasons.push(`Same narrator: ${candidate.narrator}`);
    if (primaryType === 'similar-genre') primaryType = 'same-narrator';
  }

  // 5. Matching genres
  const genreMatches = countMatches(source.genres, candidate.genres);
  if (genreMatches > 0) {
    const genreScore = Math.min(genreMatches * COMPARABLE_WEIGHTS.matchingGenre, 24);
    score += genreScore;
    if (genreMatches >= 2) {
      reasons.push(`${genreMatches} matching genres`);
    }
  }

  // 6. Matching tags
  const tagMatches = countMatches(source.tags, candidate.tags);
  if (tagMatches > 0) {
    const tagScore = Math.min(tagMatches * COMPARABLE_WEIGHTS.matchingTag, 18);
    score += tagScore;
    if (tagMatches >= 3) {
      reasons.push(`${tagMatches} matching tags`);
    }
  }

  // 7. BookDNA similarity (if both have DNA)
  if (source.dna.hasDNA && candidate.dna.hasDNA) {
    // Matching tropes
    const sourceTropes = new Set(source.dna.tropes);
    const tropeMatches = candidate.dna.tropes.filter(t => sourceTropes.has(t)).length;
    if (tropeMatches > 0) {
      score += Math.min(tropeMatches * COMPARABLE_WEIGHTS.matchingTrope, 30);
      reasons.push(`Shared tropes: ${tropeMatches}`);
      if (primaryType === 'similar-genre') primaryType = 'similar-dna';
    }

    // Matching themes
    const sourceThemes = new Set(source.dna.themes);
    const themeMatches = candidate.dna.themes.filter(t => sourceThemes.has(t)).length;
    if (themeMatches > 0) {
      score += Math.min(themeMatches * COMPARABLE_WEIGHTS.matchingTheme, 30);
      reasons.push(`Shared themes: ${themeMatches}`);
      if (primaryType === 'similar-genre') primaryType = 'similar-dna';
    }

    // Matching vibe
    if (source.dna.vibe && source.dna.vibe === candidate.dna.vibe) {
      score += COMPARABLE_WEIGHTS.matchingVibe;
      reasons.push(`Same vibe: ${source.dna.vibe}`);
      if (primaryType === 'similar-genre') primaryType = 'similar-dna';
    }
  }

  // Cap at max score
  score = Math.min(score, COMPARABLE_WEIGHTS.maxScore);

  return { score, reasons, type: primaryType, isExplicit };
}

// ============================================================================
// COMPARABLE BOOKS ENGINE
// ============================================================================

export interface ComparableEngineOptions {
  /** Minimum similarity score to include (0-100) */
  minScore?: number;
  /** Maximum results per source book */
  maxPerSource?: number;
  /** Maximum total results */
  maxTotal?: number;
  /** Whether to apply temporal decay based on when source was finished */
  applyTemporalDecay?: boolean;
  /** Whether to exclude same-author matches (for discovery focus) */
  excludeSameAuthor?: boolean;
  /** Whether to exclude same-series matches */
  excludeSameSeries?: boolean;
  /** Scoring context: 'BECAUSE_YOU_LISTENED' uses DNA-first weights,
   *  'MORE_LIKE_THIS' uses identity-inclusive weights (default) */
  scoringContext?: ComparableScoringContext;
}

/**
 * Find comparable books for a set of loved/finished books.
 */
export function findComparableBooks(
  sourceBooks: ComparableSourceBook[],
  candidateItems: LibraryItem[],
  options: ComparableEngineOptions = {}
): ComparableResult[] {
  const {
    minScore = 20,
    maxPerSource = 5,
    maxTotal = 20,
    applyTemporalDecay = true,
    excludeSameAuthor = false,
    excludeSameSeries = false,
    scoringContext = 'MORE_LIKE_THIS' as ComparableScoringContext,
  } = options;

  // Prepare all candidates once
  const candidates = candidateItems.map(prepareCandidate);

  // Track seen books to avoid duplicates
  const seenIds = new Set<string>();
  const results: ComparableResult[] = [];

  // Sort source books by recency (most recent first)
  const sortedSources = [...sourceBooks].sort((a, b) => {
    return (b.finishedAt || 0) - (a.finishedAt || 0);
  });

  for (const source of sortedSources) {
    if (results.length >= maxTotal) break;

    let sourceResults: ComparableResult[] = [];

    // Calculate temporal decay for this source book
    const decay = applyTemporalDecay && source.finishedAt
      ? getTemporalDecay(source.finishedAt)
      : 1.0;

    for (const candidate of candidates) {
      // Skip if already seen or is the source itself
      if (seenIds.has(candidate.item.id)) continue;
      if (candidate.item.id === source.id) continue;

      // Optionally skip same author/series
      if (excludeSameAuthor && stringsMatch(source.author, candidate.author)) continue;
      if (excludeSameSeries && stringsMatch(source.series, candidate.series)) continue;

      const similarity = calculateSimilarity(source, candidate, scoringContext);

      // Apply temporal decay
      const adjustedScore = Math.round(similarity.score * decay);

      if (adjustedScore >= minScore) {
        sourceResults.push({
          item: candidate.item,
          sourceBook: {
            id: source.id,
            title: source.title,
            author: source.author || 'Unknown',
          },
          similarityScore: adjustedScore,
          matchReasons: similarity.reasons,
          similarityType: similarity.type,
          isExplicitComparable: similarity.isExplicit,
        });
      }
    }

    // Sort by similarity score (explicit comparables first, then score)
    sourceResults.sort((a, b) => {
      if (a.isExplicitComparable && !b.isExplicitComparable) return -1;
      if (!a.isExplicitComparable && b.isExplicitComparable) return 1;
      return b.similarityScore - a.similarityScore;
    });

    // Take top results for this source
    const topForSource = sourceResults.slice(0, maxPerSource);
    for (const result of topForSource) {
      if (results.length >= maxTotal) break;
      seenIds.add(result.item.id);
      results.push(result);
    }
  }

  // Final sort by similarity score
  results.sort((a, b) => {
    // Explicit comparables first
    if (a.isExplicitComparable && !b.isExplicitComparable) return -1;
    if (!a.isExplicitComparable && b.isExplicitComparable) return 1;
    return b.similarityScore - a.similarityScore;
  });

  return results;
}

// ============================================================================
// SINGLE BOOK COMPARABLES
// ============================================================================

/**
 * Find books comparable to a single book.
 * Useful for "More like this" or book detail page recommendations.
 */
export function findBooksLikeThis(
  sourceItem: LibraryItem,
  allItems: LibraryItem[],
  options: Omit<ComparableEngineOptions, 'applyTemporalDecay'> = {}
): ComparableResult[] {
  const source = prepareSourceBook(sourceItem, null);

  // Filter out the source book from candidates
  const candidates = allItems.filter(item => item.id !== sourceItem.id);

  return findComparableBooks([source], candidates, {
    ...options,
    applyTemporalDecay: false,
  });
}

// ============================================================================
// REVERSE COMPARABLES
// ============================================================================

/**
 * Find all books that explicitly list a given book as comparable.
 * Useful for "Readers of X also loved" when X is the target.
 */
export function findBooksComparableToThis(
  targetTitle: string,
  allItems: LibraryItem[]
): { item: LibraryItem; dna: BookDNA }[] {
  const normalizedTarget = normalize(targetTitle);
  const results: { item: LibraryItem; dna: BookDNA }[] = [];

  for (const item of allItems) {
    const tags = getItemTags(item);
    const dna = parseBookDNA(tags);

    if (!dna.hasDNA || dna.comparableTitles.length === 0) continue;

    // Check if any comparable title matches target
    for (const comparable of dna.comparableTitles) {
      if (normalizedTarget.includes(comparable) || comparable.includes(normalizedTarget)) {
        results.push({ item, dna });
        break;
      }
    }
  }

  return results;
}

// ============================================================================
// SIMILARITY CHAIN
// ============================================================================

/**
 * Build a similarity chain starting from a book.
 * Each step finds the most similar book not yet in the chain.
 * Useful for "discovery path" features.
 */
export function buildSimilarityChain(
  startItem: LibraryItem,
  allItems: LibraryItem[],
  chainLength: number = 5
): LibraryItem[] {
  const chain: LibraryItem[] = [startItem];
  const seenIds = new Set<string>([startItem.id]);
  const candidates = allItems.filter(item => item.id !== startItem.id);

  let currentItem = startItem;

  for (let i = 1; i < chainLength; i++) {
    const comparables = findBooksLikeThis(currentItem, candidates, {
      minScore: 15,
      maxPerSource: 10,
      excludeSameSeries: true, // Encourage diversity
    });

    // Find first comparable not in chain
    const next = comparables.find(c => !seenIds.has(c.item.id));
    if (!next) break;

    chain.push(next.item);
    seenIds.add(next.item.id);
    currentItem = next.item;
  }

  return chain;
}
