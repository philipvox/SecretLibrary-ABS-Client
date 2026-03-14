/**
 * src/features/recommendations/hooks/useRecommendations.ts
 *
 * Generate personalized recommendations using slot-based allocation:
 * - 6 slots: Comfort picks (high author/narrator affinity)
 * - 5 slots: Genre exploration (matching genres, new-to-you authors)
 * - 2 slots: Narrator gateway (loved narrators, unfamiliar authors)
 * - 2 slots: Wild cards (zero overlap with history, genre match only)
 *
 * Features:
 * - Temporal decay: <6mo = 1.0x, 6-18mo = 0.7x, >18mo = 0.4x
 * - Progress state machine: eligible, sampled, abandoned, active, finished
 * - Abandonment penalty: -0.3x per abandoned book (max -0.9x)
 */

import { useMemo, useEffect } from 'react';
import { LibraryItem, BookMetadata } from '@/core/types';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useMyLibraryStore } from '@/features/library';
import { getGenres, getAuthorName, getNarratorName, getSeriesName, getDuration, getTags } from '@/shared/utils/metadata';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import { useDismissedIds } from '../stores/dismissedItemsStore';
import { parseBookDNA, BookDNA, getDNAMoodScore, Mood } from '@/shared/utils/bookDNA';
import { ABANDONMENT_PENALTIES } from '../utils/scoreWeights';
import {
  useRecommendationsCacheStore,
  selectHistoryStats,
  selectFinishedBookIds,
  selectAbandonedBooks,
  selectUserBooksMap,
  selectIsLoaded,
} from '../stores/recommendationsCacheStore';

// === TYPES ===

interface ReadHistoryStats {
  totalBooksRead: number;
  favoriteAuthors: { name: string; count: number; weightedCount: number }[];
  favoriteNarrators: { name: string; count: number; weightedCount: number }[];
  favoriteGenres: { name: string; count: number; weightedCount: number }[];
  mostRecentFinished?: {
    id: string;
    title: string;
    author: string;
    finishedAt: number;
  };
  currentlyListening?: Array<{
    id: string;
    title: string;
    progress: number;
  }>;
}

interface AbandonedBook {
  bookId: string;
  author: string;
  progress: number;
  lastPlayedAt: string;
  daysSincePlay: number;
}

type ProgressState = 'eligible' | 'sampled' | 'abandoned' | 'active' | 'finished';

type SlotType = 'comfort' | 'genre_exploration' | 'narrator_gateway' | 'wild_card';

interface ScoredItem {
  item: LibraryItem;
  score: number;
  reasons: string[];
  slotType: SlotType;
}

export interface RecommendationSourceAttribution {
  itemId: string;
  itemTitle: string;
  type: 'finished' | 'listening' | 'author' | 'narrator' | 'genre';
}

export interface RecommendationGroup {
  title: string;
  items: LibraryItem[];
  sourceAttribution?: RecommendationSourceAttribution;
}

// === SLOT CONFIGURATION ===

const SLOT_CONFIG = {
  comfort: 6,
  genre_exploration: 5,
  narrator_gateway: 2,
  wild_card: 2,
} as const;

/**
 * Minimum score (out of 100) a candidate must reach to fill a slot.
 * Prevents low-confidence recommendations from surfacing when the pool
 * doesn't have enough quality matches. Empty slots are better than weak ones.
 */
const MINIMUM_SLOT_SCORE = 25;

/**
 * 7-day window seed — locks the "Because You Listened To X" seed book identity
 * so the label is stable across app sessions for one week.
 */
const WEEK_SEED = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));

// === SEED BOOK SELECTION ===

/**
 * Select stable seed books for "Because You Listened To X" labels.
 * - Primary: books with progress >= 0.85 (finished or near-finished)
 * - Fallback: progress >= 0.5 if fewer than 3 primary seeds
 * - Hard exclude: progress < 0.3
 * - Stable: locked to 7-day window via WEEK_SEED
 */
function selectSeedBooks(
  allItems: LibraryItem[],
  userBooksMap: Map<string, { progress: number; lastPlayedAt: string | null }>,
  finishedBookIds: Set<string>
): LibraryItem[] {
  const primary: { item: LibraryItem; lastPlayed: number }[] = [];
  const fallback: { item: LibraryItem; lastPlayed: number }[] = [];

  for (const item of allItems) {
    const userData = userBooksMap.get(item.id);
    const progress = userData?.progress || item.userMediaProgress?.progress || 0;

    // Hard remove: progress < 0.3 regardless of last-played date
    if (progress < 0.3) continue;

    const lastPlayed = userData?.lastPlayedAt
      ? new Date(userData.lastPlayedAt).getTime()
      : 0;

    if (progress >= 0.85 || finishedBookIds.has(item.id)) {
      primary.push({ item, lastPlayed });
    } else if (progress >= 0.5) {
      fallback.push({ item, lastPlayed });
    }
  }

  // Weight by recency of completion (most recently finished = highest weight)
  primary.sort((a, b) => b.lastPlayed - a.lastPlayed);
  fallback.sort((a, b) => b.lastPlayed - a.lastPlayed);

  // Use primary if >= 3 qualifying seeds, else fill from fallback
  let seeds = primary.length >= 3 ? primary : [...primary, ...fallback];

  const topCandidates = seeds.slice(0, 10);
  if (topCandidates.length === 0) return [];

  // Lock seed identity to 7-day window so label is stable across sessions
  const seedIndex = WEEK_SEED % Math.min(topCandidates.length, 3);

  const result: LibraryItem[] = [];
  for (let i = 0; i < Math.min(3, topCandidates.length); i++) {
    const idx = (seedIndex + i) % topCandidates.length;
    result.push(topCandidates[idx].item);
  }

  return result;
}

// === FLAVOR & DNA SCORING ===

/** Minimal type for flavor config (legacy, always null now) */
interface FlavorConfig {
  id: string;
  label: string;
  matchTags: string[];
}

/** Always returns null — mood quiz flavors removed */
function scoreFlavorMatch(
  _item: LibraryItem,
  flavorConfig: FlavorConfig | null
): { score: number; matchedTags: string[] } {
  if (!flavorConfig) return { score: 0, matchedTags: [] };
  return { score: 0, matchedTags: [] };
}

/**
 * Score how well a book matches the mood using BookDNA.
 * Returns bonus points for DNA mood match.
 */
function scoreDNAMoodMatch(item: LibraryItem, mood: Mood): { score: number; hasDNA: boolean } {
  const tags = getTags(item);
  const dna = parseBookDNA(tags);

  if (!dna.hasDNA) {
    return { score: 0, hasDNA: false };
  }

  const moodScore = getDNAMoodScore(dna, mood);
  if (moodScore === null) {
    return { score: 0, hasDNA: true };
  }

  // DNA mood score is 0-1, scale to points (max 25 bonus)
  return { score: moodScore * 25, hasDNA: true };
}

// === PROGRESS STATE MACHINE ===

function getProgressState(
  item: LibraryItem,
  userBooksMap: Map<string, { progress: number; lastPlayedAt: string | null }>
): ProgressState {
  const userProgress = item.userMediaProgress;
  const progress = userProgress?.progress || 0;
  const isFinished = userProgress?.isFinished === true || progress >= 0.95;

  if (isFinished) return 'finished';

  // Check local user_books for last played info
  const localData = userBooksMap.get(item.id);
  const lastPlayedAt = localData?.lastPlayedAt;

  let daysSincePlay = 0;
  if (lastPlayedAt) {
    const lastPlayed = new Date(lastPlayedAt);
    daysSincePlay = Math.floor((Date.now() - lastPlayed.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Active: reading now (>30% or recently played)
  if (progress > 0.30) return 'active';
  if (progress > 0 && daysSincePlay < 14) return 'active';

  // Abandoned: started but stale (5-30%, >90 days)
  if (progress >= 0.05 && progress < 0.30 && daysSincePlay > 90) return 'abandoned';

  // Sampled: barely touched and forgotten (<2%, >30 days)
  if (progress > 0 && progress < 0.02 && daysSincePlay > 30) return 'sampled';

  // Still active if any progress
  if (progress > 0) return 'active';

  return 'eligible';
}

// === POOL BUILDERS ===

interface PoolContext {
  availableItems: LibraryItem[];
  authorAffinities: Map<string, number>;
  narratorAffinities: Map<string, number>;
  genreAffinities: Map<string, number>;
  knownAuthors: Set<string>;
  knownNarrators: Set<string>;
  topGenres: string[];
  authorPenalties: Map<string, number>;
  preferredLength: string;
  prefersSeries: boolean | null;
  // Session mood info for flavor/DNA scoring
  sessionMood: Mood | null;
  flavorConfig: FlavorConfig | null;
}

function buildComfortPool(ctx: PoolContext, limit: number): ScoredItem[] {
  const scored: ScoredItem[] = [];

  // Check what expensive scoring we need to do
  const hasMoodSession = ctx.sessionMood !== null;
  const hasFlavorConfig = ctx.flavorConfig !== null;

  for (const item of ctx.availableItems) {
    const author = getAuthorName(item).toLowerCase();
    const narrator = getNarratorName(item).toLowerCase();

    const authorAffinity = ctx.authorAffinities.get(author) || 0;
    const narratorAffinity = ctx.narratorAffinities.get(narrator) || 0;

    // Only run expensive scoring when needed
    let flavorMatch = { score: 0, matchedTags: [] as string[] };
    let dnaMatch = { score: 0, hasDNA: false };

    // Flavor scoring only if we have a flavor config
    if (hasFlavorConfig) {
      flavorMatch = scoreFlavorMatch(item, ctx.flavorConfig);
    }

    // DNA scoring only if we have a mood session
    if (hasMoodSession) {
      dnaMatch = scoreDNAMoodMatch(item, ctx.sessionMood!);
    }

    // If we have a session mood with flavor, allow books without author/narrator affinity
    // if they have strong flavor or DNA matches
    const hasFlavorBoost = flavorMatch.score >= 15;
    const hasDNABoost = dnaMatch.score >= 15;
    const hasAffinityBoost = authorAffinity > 0 || narratorAffinity > 0;

    // Must have at least one source of affinity/match
    if (!hasAffinityBoost && !hasFlavorBoost && !hasDNABoost) continue;

    let score = 0;
    const reasons: string[] = [];

    // Author affinity (primary signal for comfort)
    if (authorAffinity > 0) {
      score += 50 + Math.min(authorAffinity * 10, 50); // 50-100 range
      reasons.push(`More by ${getAuthorName(item)}`);
    }

    // Narrator affinity (secondary signal)
    if (narratorAffinity > 0) {
      score += 30 + Math.min(narratorAffinity * 8, 40); // 30-70 range
      if (!reasons.length) reasons.push(`Narrated by ${getNarratorName(item)}`);
    }

    // Flavor match bonus (from session)
    if (flavorMatch.score > 0) {
      score += flavorMatch.score;
      if (flavorMatch.matchedTags.length > 0 && ctx.flavorConfig) {
        reasons.push(`Matches "${ctx.flavorConfig.label}"`);
      }
    }

    // DNA mood match bonus
    if (dnaMatch.score > 0) {
      score += dnaMatch.score;
      if (dnaMatch.hasDNA && !reasons.some(r => r.includes('Matches'))) {
        reasons.push('DNA mood match');
      }
    }

    // Apply abandonment penalty
    const penalty = ctx.authorPenalties.get(author) || 0;
    if (penalty > 0) {
      score *= (1 - Math.min(penalty, 0.9));
    }

    scored.push({ item, score, reasons, slotType: 'comfort' });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit * 2); // Return extra for dedup
}

function buildGenreExplorationPool(ctx: PoolContext, limit: number): ScoredItem[] {
  const scored: ScoredItem[] = [];

  // Check what expensive scoring we need to do
  const hasMoodSession = ctx.sessionMood !== null;
  const hasFlavorConfig = ctx.flavorConfig !== null;

  for (const item of ctx.availableItems) {
    const author = getAuthorName(item).toLowerCase();
    const genres = getGenres(item);

    // Skip if we already know this author (genre exploration = new authors)
    if (ctx.knownAuthors.has(author)) continue;

    // Only run expensive scoring when needed
    let flavorMatch = { score: 0, matchedTags: [] as string[] };
    let dnaMatch = { score: 0, hasDNA: false };

    // Flavor scoring only if we have a flavor config
    if (hasFlavorConfig) {
      flavorMatch = scoreFlavorMatch(item, ctx.flavorConfig);
    }

    // DNA scoring only if we have a mood session
    if (hasMoodSession) {
      dnaMatch = scoreDNAMoodMatch(item, ctx.sessionMood!);
    }

    // Must have genre match OR strong flavor/DNA match
    const matchingGenres = genres.filter(g =>
      ctx.topGenres.some(tg => g.toLowerCase().includes(tg) || tg.includes(g.toLowerCase()))
    );
    const hasFlavorBoost = flavorMatch.score >= 15;
    const hasDNABoost = dnaMatch.score >= 15;

    if (matchingGenres.length === 0 && !hasFlavorBoost && !hasDNABoost) continue;

    let score = 0;
    const reasons: string[] = [];

    // Genre affinity score
    for (const genre of genres) {
      const affinity = ctx.genreAffinities.get(genre.toLowerCase()) || 0;
      if (affinity > 0) {
        score += Math.min(affinity * 5, 30);
      }
    }

    if (matchingGenres.length > 0) {
      score += matchingGenres.length * 20;
      reasons.push(`Explore ${matchingGenres[0]}`);
    }

    // Flavor match bonus (from session)
    if (flavorMatch.score > 0) {
      score += flavorMatch.score;
      if (flavorMatch.matchedTags.length > 0 && ctx.flavorConfig) {
        reasons.push(`Matches "${ctx.flavorConfig.label}"`);
      }
    }

    // DNA mood match bonus
    if (dnaMatch.score > 0) {
      score += dnaMatch.score;
    }

    // Bonus for new author
    score += 15;
    if (!reasons.some(r => r.startsWith('Explore') || r.includes('Matches'))) {
      reasons.push(`Discover ${getAuthorName(item)}`);
    }

    scored.push({ item, score, reasons, slotType: 'genre_exploration' });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit * 2);
}

function buildNarratorGatewayPool(ctx: PoolContext, limit: number): ScoredItem[] {
  const scored: ScoredItem[] = [];

  // Get top narrators (by affinity)
  const topNarrators = Array.from(ctx.narratorAffinities.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  for (const item of ctx.availableItems) {
    const author = getAuthorName(item).toLowerCase();
    const narrator = getNarratorName(item).toLowerCase();
    const genres = getGenres(item);

    // Must be narrated by someone we love
    if (!topNarrators.includes(narrator)) continue;

    // Must be an author we DON'T know
    if (ctx.knownAuthors.has(author)) continue;

    // Must have some genre overlap
    const hasGenreOverlap = genres.some(g =>
      ctx.topGenres.some(tg => g.toLowerCase().includes(tg) || tg.includes(g.toLowerCase()))
    );
    if (!hasGenreOverlap) continue;

    const narratorAffinity = ctx.narratorAffinities.get(narrator) || 0;
    const score = 60 + Math.min(narratorAffinity * 10, 40); // 60-100 range

    scored.push({
      item,
      score,
      reasons: [`${getNarratorName(item)} narrates new author ${getAuthorName(item)}`],
      slotType: 'narrator_gateway',
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit * 2);
}

function buildWildCardPool(ctx: PoolContext, limit: number): ScoredItem[] {
  const scored: ScoredItem[] = [];

  for (const item of ctx.availableItems) {
    const author = getAuthorName(item).toLowerCase();
    const narrator = getNarratorName(item).toLowerCase();
    const genres = getGenres(item);
    const duration = getDuration(item);

    // Must have ZERO overlap with known authors/narrators
    if (ctx.knownAuthors.has(author)) continue;
    if (ctx.knownNarrators.has(narrator)) continue;

    // Must have genre match (so it's not completely random)
    const hasGenreMatch = genres.some(g =>
      ctx.topGenres.some(tg => g.toLowerCase().includes(tg) || tg.includes(g.toLowerCase()))
    );
    if (!hasGenreMatch) continue;

    let score = 50; // Base score for wild cards
    const reasons: string[] = ['Something different'];

    // Prefer medium-length books (8-15 hours) for wild cards
    const hours = duration / 3600;
    if (hours >= 8 && hours <= 15) {
      score += 20;
    }

    // Prefer first-in-series for wild cards (low commitment if you don't like it)
    const series = getSeriesName(item);
    if (!series) {
      score += 10; // Standalone bonus
      reasons.push('Standalone');
    }

    scored.push({ item, score, reasons, slotType: 'wild_card' });
  }

  // Shuffle the top candidates for variety
  const topCandidates = scored.sort((a, b) => b.score - a.score).slice(0, limit * 3);
  for (let i = topCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [topCandidates[i], topCandidates[j]] = [topCandidates[j], topCandidates[i]];
  }

  return topCandidates.slice(0, limit * 2);
}

// === MAIN HOOK ===

export function useRecommendations(allItems: LibraryItem[], limit: number = 15) {
  const favoriteGenres = usePreferencesStore((s) => s.favoriteGenres);
  const favoriteAuthors = usePreferencesStore((s) => s.favoriteAuthors);
  const favoriteNarrators = usePreferencesStore((s) => s.favoriteNarrators);
  const prefersSeries = usePreferencesStore((s) => s.prefersSeries);
  const preferredLength = usePreferencesStore((s) => s.preferredLength);
  const moods = usePreferencesStore((s) => s.moods);
  const hasCompletedOnboarding = usePreferencesStore((s) => s.hasCompletedOnboarding);

  const libraryIds = useMyLibraryStore((s) => s.libraryIds);
  const dismissedIds = useDismissedIds();

  // Use cached SQLite data (shared across all useRecommendations consumers)
  const historyStats = useRecommendationsCacheStore(selectHistoryStats);
  const finishedBookIds = useRecommendationsCacheStore(selectFinishedBookIds);
  const abandonedBooks = useRecommendationsCacheStore(selectAbandonedBooks);
  const userBooksMap = useRecommendationsCacheStore(selectUserBooksMap);
  const isCacheLoaded = useRecommendationsCacheStore(selectIsLoaded);
  const loadCache = useRecommendationsCacheStore((s) => s.loadCache);

  // Trigger cache load on first mount (no-op if already loaded)
  useEffect(() => {
    loadCache();
  }, [loadCache]);

  // Build author penalties from abandoned books (time-decayed)
  const authorPenalties = useMemo(() => {
    const penalties = new Map<string, number>();
    for (const book of abandonedBooks) {
      const author = book.author.toLowerCase();
      const current = penalties.get(author) || 0;
      // Time-decayed: recent abandons penalize more, old ones fade
      let penalty: number;
      if (book.daysSincePlay < 90) {
        penalty = ABANDONMENT_PENALTIES.recentPenalty;   // 0.3
      } else if (book.daysSincePlay < 365) {
        penalty = ABANDONMENT_PENALTIES.olderPenalty;    // 0.15
      } else {
        penalty = ABANDONMENT_PENALTIES.stalePenalty;    // 0.05
      }
      penalties.set(author, current + penalty);
    }
    return penalties;
  }, [abandonedBooks]);

  // Build known authors/narrators from history
  const { knownAuthors, knownNarrators } = useMemo(() => {
    const authors = new Set<string>();
    const narrators = new Set<string>();

    if (historyStats) {
      historyStats.favoriteAuthors.forEach(a => authors.add(a.name.toLowerCase()));
      historyStats.favoriteNarrators.forEach(n => narrators.add(n.name.toLowerCase()));
    }

    // Also add from in-progress items
    allItems.forEach(item => {
      const progress = item.userMediaProgress?.progress || 0;
      if (progress > 0.1) {
        const author = getAuthorName(item).toLowerCase();
        const narrator = getNarratorName(item).toLowerCase();
        if (author) authors.add(author);
        if (narrator) narrators.add(narrator);
      }
    });

    return { knownAuthors: authors, knownNarrators: narrators };
  }, [historyStats, allItems]);

  // Build affinity maps (using weighted counts from temporal decay)
  const affinities = useMemo(() => {
    const authorAffinities = new Map<string, number>();
    const narratorAffinities = new Map<string, number>();
    const genreAffinities = new Map<string, number>();

    if (historyStats) {
      historyStats.favoriteAuthors.forEach(a => {
        authorAffinities.set(a.name.toLowerCase(), a.weightedCount);
      });
      historyStats.favoriteNarrators.forEach(n => {
        narratorAffinities.set(n.name.toLowerCase(), n.weightedCount);
      });
      historyStats.favoriteGenres.forEach(g => {
        genreAffinities.set(g.name.toLowerCase(), g.weightedCount);
      });
    }

    // Add preference-based affinities
    favoriteAuthors.forEach(a => {
      const key = a.toLowerCase();
      authorAffinities.set(key, (authorAffinities.get(key) || 0) + 2);
    });
    favoriteNarrators.forEach(n => {
      const key = n.toLowerCase();
      narratorAffinities.set(key, (narratorAffinities.get(key) || 0) + 2);
    });
    favoriteGenres.forEach(g => {
      const key = g.toLowerCase();
      genreAffinities.set(key, (genreAffinities.get(key) || 0) + 2);
    });

    // Apply mood-based genre boosts from preferences store (legacy)
    moods.forEach(mood => {
      const moodGenres = MOOD_GENRE_MAP[mood] || [];
      moodGenres.forEach(genre => {
        const key = genre.toLowerCase();
        genreAffinities.set(key, (genreAffinities.get(key) || 0) + 3);
      });
    });

    return { authorAffinities, narratorAffinities, genreAffinities };
  }, [historyStats, favoriteAuthors, favoriteNarrators, favoriteGenres, moods]);

  // Get top genres for filtering
  const topGenres = useMemo(() => {
    const genres = Array.from(affinities.genreAffinities.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    return genres;
  }, [affinities.genreAffinities]);

  // Main recommendations logic
  const recommendations = useMemo(() => {
    // Wait for cache to load before computing recommendations
    if (!isCacheLoaded || !allItems.length) {
      return [];
    }

    // Build a Map for O(1) lookups (avoids O(n²) in series filter with 2500+ items)
    const itemsById = new Map(allItems.map(i => [i.id, i]));

    // Helpers for series filtering
    const isFinished = (bookId: string): boolean => {
      if (finishedBookIds.has(bookId)) return true;
      const item = itemsById.get(bookId);
      if (!item) return false;
      const progress = item.userMediaProgress?.progress || 0;
      return progress >= 0.95 || item.userMediaProgress?.isFinished === true;
    };

    const hasStarted = (bookId: string): boolean => {
      const item = itemsById.get(bookId);
      if (!item) return false;
      return (item.userMediaProgress?.progress || 0) > 0;
    };

    const isSeriesAppropriate = createSeriesFilter({ allItems, isFinished, hasStarted });

    // Filter available items using progress state machine
    const availableItems = allItems.filter(item => {
      // Exclude items in user's library
      if (libraryIds.includes(item.id)) return false;

      // Exclude dismissed items
      if (dismissedIds.includes(item.id)) return false;

      // Check progress state
      const state = getProgressState(item, userBooksMap);
      if (state === 'finished' || state === 'active') return false;
      // 'eligible', 'sampled', and 'abandoned' can be recommended

      // Exclude middle-of-series books
      if (!isSeriesAppropriate(item)) return false;

      return true;
    });

    // Build pool context
    const ctx: PoolContext = {
      availableItems,
      authorAffinities: affinities.authorAffinities,
      narratorAffinities: affinities.narratorAffinities,
      genreAffinities: affinities.genreAffinities,
      knownAuthors,
      knownNarrators,
      topGenres,
      authorPenalties,
      preferredLength,
      prefersSeries,
      sessionMood: null,
      flavorConfig: null,
    };

    // Build pools
    const comfortPool = buildComfortPool(ctx, SLOT_CONFIG.comfort);
    const genrePool = buildGenreExplorationPool(ctx, SLOT_CONFIG.genre_exploration);
    const narratorPool = buildNarratorGatewayPool(ctx, SLOT_CONFIG.narrator_gateway);
    const wildCardPool = buildWildCardPool(ctx, SLOT_CONFIG.wild_card);

    // Fill slots with deduplication + minimum score threshold.
    // MINIMUM_SLOT_SCORE prevents low-confidence recommendations from surfacing.
    // If a slot can't be filled above threshold, it stays empty rather than
    // showing a weak match that erodes user trust in the recommendation system.
    const seen = new Set<string>();
    const result: ScoredItem[] = [];

    // Comfort picks (6 slots)
    for (const item of comfortPool) {
      if (seen.has(item.item.id)) continue;
      if (item.score < MINIMUM_SLOT_SCORE) continue;
      if (result.filter(r => r.slotType === 'comfort').length >= SLOT_CONFIG.comfort) break;
      result.push(item);
      seen.add(item.item.id);
    }

    // Genre exploration (5 slots)
    for (const item of genrePool) {
      if (seen.has(item.item.id)) continue;
      if (item.score < MINIMUM_SLOT_SCORE) continue;
      if (result.filter(r => r.slotType === 'genre_exploration').length >= SLOT_CONFIG.genre_exploration) break;
      result.push(item);
      seen.add(item.item.id);
    }

    // Narrator gateway (2 slots)
    for (const item of narratorPool) {
      if (seen.has(item.item.id)) continue;
      if (item.score < MINIMUM_SLOT_SCORE) continue;
      if (result.filter(r => r.slotType === 'narrator_gateway').length >= SLOT_CONFIG.narrator_gateway) break;
      result.push(item);
      seen.add(item.item.id);
    }

    // Wild cards (2 slots)
    for (const item of wildCardPool) {
      if (seen.has(item.item.id)) continue;
      if (item.score < MINIMUM_SLOT_SCORE) continue;
      if (result.filter(r => r.slotType === 'wild_card').length >= SLOT_CONFIG.wild_card) break;
      result.push(item);
      seen.add(item.item.id);
    }

    // If we don't have enough, backfill from largest pools (still respecting min score)
    let backfillIterations = 0;
    const maxBackfillIterations = 100; // Safety limit
    while (result.length < limit && (comfortPool.length + genrePool.length > result.length)) {
      backfillIterations++;
      if (backfillIterations > maxBackfillIterations) break;
      let addedAny = false;
      for (const pool of [comfortPool, genrePool, narratorPool, wildCardPool]) {
        for (const item of pool) {
          if (!seen.has(item.item.id) && item.score >= MINIMUM_SLOT_SCORE) {
            result.push(item);
            seen.add(item.item.id);
            addedAny = true;
            break;
          }
        }
        if (result.length >= limit) break;
      }
      // If we couldn't add anything, break to avoid infinite loop
      if (!addedAny) break;
    }

    return result.slice(0, limit);
  }, [allItems, finishedBookIds, libraryIds, dismissedIds, userBooksMap, affinities, knownAuthors, knownNarrators, topGenres, authorPenalties, preferredLength, prefersSeries, limit, isCacheLoaded]);

  // Select stable seed books for "Because You Listened To X" labels
  const seedBooks = useMemo(() => {
    if (!isCacheLoaded || !allItems.length) return [];
    return selectSeedBooks(allItems, userBooksMap, finishedBookIds);
  }, [allItems, userBooksMap, finishedBookIds, isCacheLoaded]);

  // Group recommendations for display
  const groupedRecommendations = useMemo((): RecommendationGroup[] => {
    const groups: Record<string, LibraryItem[]> = {
      'Comfort Picks': [],
      'Explore New Authors': [],
      'Narrator Gateway': [],
      'Something Different': [],
    };

    recommendations.forEach(({ item, slotType }) => {
      switch (slotType) {
        case 'comfort':
          groups['Comfort Picks'].push(item);
          break;
        case 'genre_exploration':
          groups['Explore New Authors'].push(item);
          break;
        case 'narrator_gateway':
          groups['Narrator Gateway'].push(item);
          break;
        case 'wild_card':
          groups['Something Different'].push(item);
          break;
      }
    });

    const sourceAttributions: Record<string, RecommendationSourceAttribution | undefined> = {};

    // Use stable seed books (locked to 7-day window) for "Because You Listened" labels
    if (seedBooks.length > 0) {
      const seed = seedBooks[0];
      const seedMeta = (seed.media?.metadata as BookMetadata);
      sourceAttributions['Comfort Picks'] = {
        itemId: seed.id,
        itemTitle: seedMeta?.title || 'Unknown',
        type: 'finished',
      };
    } else if (historyStats?.mostRecentFinished) {
      // Fallback to history stats if no seed books qualify
      sourceAttributions['Comfort Picks'] = {
        itemId: historyStats.mostRecentFinished.id,
        itemTitle: historyStats.mostRecentFinished.title,
        type: 'finished',
      };
    }

    if (historyStats?.favoriteGenres?.length) {
      sourceAttributions['Explore New Authors'] = {
        itemId: '',
        itemTitle: historyStats.favoriteGenres[0].name,
        type: 'genre',
      };
    }

    if (historyStats?.favoriteNarrators?.length) {
      sourceAttributions['Narrator Gateway'] = {
        itemId: '',
        itemTitle: historyStats.favoriteNarrators[0].name,
        type: 'narrator',
      };
    }

    return Object.entries(groups)
      .filter(([_, items]) => items.length > 0)
      .map(([title, items]) => ({
        title,
        items: items.slice(0, 10),
        sourceAttribution: sourceAttributions[title],
      }));
  }, [recommendations, historyStats, seedBooks]);

  return {
    recommendations: recommendations.map(r => r.item),
    scoredRecommendations: recommendations,
    groupedRecommendations,
    hasPreferences: hasCompletedOnboarding ||
      (historyStats?.totalBooksRead ?? 0) > 0 ||
      recommendations.length > 0,
  };
}

// Map moods to genres (kept for backward compatibility with preferencesStore.moods)
const MOOD_GENRE_MAP: Record<string, string[]> = {
  'Adventurous': ['adventure', 'action', 'thriller', 'fantasy', 'sci-fi'],
  'Relaxing': ['cozy', 'romance', 'slice of life', 'contemporary'],
  'Thoughtful': ['literary', 'philosophy', 'biography', 'history'],
  'Escapist': ['fantasy', 'sci-fi', 'paranormal', 'urban fantasy'],
  'Suspenseful': ['thriller', 'mystery', 'horror', 'suspense', 'crime'],
  'Romantic': ['romance', 'contemporary romance', 'historical romance'],
  'Educational': ['non-fiction', 'history', 'science', 'self-help', 'business'],
  'Funny': ['humor', 'comedy', 'satire', 'comedic'],
};

