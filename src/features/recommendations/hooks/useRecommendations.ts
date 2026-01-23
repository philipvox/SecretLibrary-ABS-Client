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
import { LibraryItem } from '@/core/types';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useMyLibraryStore } from '@/features/library';
import { getGenres, getAuthorName, getNarratorName, getSeriesName, getDuration } from '@/shared/utils/metadata';
import { createSeriesFilter } from '@/shared/utils/seriesFilter';
import { useDismissedIds } from '../stores/dismissedItemsStore';
import { useActiveSession } from '@/features/mood-discovery/stores/moodSessionStore';
import { Mood } from '@/features/mood-discovery/types';
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
}

function buildComfortPool(ctx: PoolContext, limit: number): ScoredItem[] {
  const scored: ScoredItem[] = [];

  for (const item of ctx.availableItems) {
    const author = getAuthorName(item).toLowerCase();
    const narrator = getNarratorName(item).toLowerCase();

    const authorAffinity = ctx.authorAffinities.get(author) || 0;
    const narratorAffinity = ctx.narratorAffinities.get(narrator) || 0;

    // Must have author OR narrator affinity for comfort picks
    if (authorAffinity === 0 && narratorAffinity === 0) continue;

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

  for (const item of ctx.availableItems) {
    const author = getAuthorName(item).toLowerCase();
    const genres = getGenres(item);

    // Skip if we already know this author (genre exploration = new authors)
    if (ctx.knownAuthors.has(author)) continue;

    // Must have genre match
    const matchingGenres = genres.filter(g =>
      ctx.topGenres.some(tg => g.toLowerCase().includes(tg) || tg.includes(g.toLowerCase()))
    );
    if (matchingGenres.length === 0) continue;

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

    // Bonus for new author
    score += 15;
    reasons.push(`Discover ${getAuthorName(item)}`);

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

  // Get active mood session (from Browse mood quiz) - this takes priority
  const activeSession = useActiveSession();
  const sessionMood = activeSession?.mood || null;

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

  // Build author penalties from abandoned books
  const authorPenalties = useMemo(() => {
    const penalties = new Map<string, number>();
    for (const book of abandonedBooks) {
      const author = book.author.toLowerCase();
      const current = penalties.get(author) || 0;
      penalties.set(author, current + 0.3);
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
    // Only apply if no active session mood (session takes priority)
    if (!sessionMood) {
      moods.forEach(mood => {
        const moodGenres = MOOD_GENRE_MAP[mood] || [];
        moodGenres.forEach(genre => {
          const key = genre.toLowerCase();
          // Mood boost is significant (+3) to influence recommendations
          genreAffinities.set(key, (genreAffinities.get(key) || 0) + 3);
        });
      });
    }

    // Apply session mood boosts (from Browse mood quiz) - HIGHER PRIORITY
    // Session mood gives stronger boost (+5) since it's "what you want right now"
    if (sessionMood) {
      const sessionMoodGenres = SESSION_MOOD_GENRE_MAP[sessionMood] || [];
      sessionMoodGenres.forEach(genre => {
        const key = genre.toLowerCase();
        // Session mood boost is stronger (+5) - this is the user's current intent
        genreAffinities.set(key, (genreAffinities.get(key) || 0) + 5);
      });
    }

    return { authorAffinities, narratorAffinities, genreAffinities };
  }, [historyStats, favoriteAuthors, favoriteNarrators, favoriteGenres, moods, sessionMood]);

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
    if (!isCacheLoaded || !allItems.length) return [];

    // Helpers for series filtering
    const isFinished = (bookId: string): boolean => {
      if (finishedBookIds.has(bookId)) return true;
      const item = allItems.find(i => i.id === bookId);
      if (!item) return false;
      const progress = item.userMediaProgress?.progress || 0;
      return progress >= 0.95 || item.userMediaProgress?.isFinished === true;
    };

    const hasStarted = (bookId: string): boolean => {
      const item = allItems.find(i => i.id === bookId);
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
    };

    // Build pools
    const comfortPool = buildComfortPool(ctx, SLOT_CONFIG.comfort);
    const genrePool = buildGenreExplorationPool(ctx, SLOT_CONFIG.genre_exploration);
    const narratorPool = buildNarratorGatewayPool(ctx, SLOT_CONFIG.narrator_gateway);
    const wildCardPool = buildWildCardPool(ctx, SLOT_CONFIG.wild_card);

    // Fill slots with deduplication
    const seen = new Set<string>();
    const result: ScoredItem[] = [];

    // Comfort picks (6 slots)
    for (const item of comfortPool) {
      if (seen.has(item.item.id)) continue;
      if (result.filter(r => r.slotType === 'comfort').length >= SLOT_CONFIG.comfort) break;
      result.push(item);
      seen.add(item.item.id);
    }

    // Genre exploration (5 slots)
    for (const item of genrePool) {
      if (seen.has(item.item.id)) continue;
      if (result.filter(r => r.slotType === 'genre_exploration').length >= SLOT_CONFIG.genre_exploration) break;
      result.push(item);
      seen.add(item.item.id);
    }

    // Narrator gateway (2 slots)
    for (const item of narratorPool) {
      if (seen.has(item.item.id)) continue;
      if (result.filter(r => r.slotType === 'narrator_gateway').length >= SLOT_CONFIG.narrator_gateway) break;
      result.push(item);
      seen.add(item.item.id);
    }

    // Wild cards (2 slots)
    for (const item of wildCardPool) {
      if (seen.has(item.item.id)) continue;
      if (result.filter(r => r.slotType === 'wild_card').length >= SLOT_CONFIG.wild_card) break;
      result.push(item);
      seen.add(item.item.id);
    }

    // If we don't have enough, backfill from largest pools
    while (result.length < limit && (comfortPool.length + genrePool.length > result.length)) {
      for (const pool of [comfortPool, genrePool, narratorPool, wildCardPool]) {
        for (const item of pool) {
          if (!seen.has(item.item.id)) {
            result.push(item);
            seen.add(item.item.id);
            break;
          }
        }
        if (result.length >= limit) break;
      }
    }

    return result.slice(0, limit);
  }, [allItems, finishedBookIds, libraryIds, dismissedIds, userBooksMap, affinities, knownAuthors, knownNarrators, topGenres, authorPenalties, preferredLength, prefersSeries, limit, isCacheLoaded]);

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

    if (historyStats?.mostRecentFinished) {
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
  }, [recommendations, historyStats]);

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

// Map session moods (from moodSessionStore) to genres
// These are the 6 core moods from the mood discovery quiz
const SESSION_MOOD_GENRE_MAP: Record<Mood, string[]> = {
  'comfort': ['cozy', 'romance', 'slice of life', 'contemporary', 'feel-good', 'heartwarming'],
  'thrills': ['thriller', 'mystery', 'horror', 'suspense', 'crime', 'action'],
  'escape': ['fantasy', 'sci-fi', 'paranormal', 'urban fantasy', 'epic fantasy', 'space opera'],
  'laughs': ['humor', 'comedy', 'satire', 'comedic', 'funny', 'lighthearted'],
  'feels': ['literary', 'drama', 'emotional', 'contemporary', 'coming-of-age', 'family'],
  'thinking': ['philosophy', 'non-fiction', 'history', 'science', 'literary', 'thought-provoking'],
};
