/**
 * src/features/mood-discovery/stores/moodScoringCacheStore.ts
 *
 * Zustand store for caching mood-based book scoring results.
 * Prevents expensive re-scoring when multiple components use useMoodRecommendations
 * or when navigating back to the Browse screen.
 *
 * Key features:
 * - Results cached by session key (survives component unmounts)
 * - Only re-scores when session actually changes
 * - Shared across all components using mood recommendations
 */

import { create } from 'zustand';
import { logger } from '@/shared/utils/logger';
import type { ScoredBook, MoodSession } from '../types';
import type { LibraryItem } from '@/core/types';

// === TYPES ===

interface CachedScoringResult {
  /** All scored books (unfiltered) */
  scoredBooks: ScoredBook[];
  /** Unscored items (no metadata) */
  unscoredItems: LibraryItem[];
  /** Total count of scored items */
  totalCount: number;
  /** When this was cached */
  timestamp: number;
  /** DNA stats */
  dnaStats: {
    totalWithDNA: number;
    totalWithoutDNA: number;
    dnaPercentage: number;
  };
}

interface MoodScoringCacheState {
  /** Cached scoring result */
  cachedResult: CachedScoringResult | null;
  /** Session key for the cached result */
  cachedSessionKey: string | null;
  /** Number of items in library when scored (for invalidation) */
  cachedItemCount: number;

  /** Whether scoring is in progress */
  isScoring: boolean;

  // Actions
  getCachedResult: (sessionKey: string, itemCount: number) => CachedScoringResult | null;
  setCachedResult: (sessionKey: string, itemCount: number, result: CachedScoringResult) => void;
  invalidateCache: () => void;
  setIsScoring: (isScoring: boolean) => void;
}

// === HELPER ===

/**
 * Generate a cache key from a mood session
 */
export function getSessionCacheKey(session: MoodSession | null): string {
  if (!session) return '';
  return `${session.mood}-${session.flavor || 'any'}-${session.seedBookId || 'none'}-${session.pace}-${session.weight}-${session.world}-${session.length}-${session.excludeChildrens ? '1' : '0'}-${session.createdAt}`;
}

// === STORE ===

export const useMoodScoringCacheStore = create<MoodScoringCacheState>((set, get) => ({
  cachedResult: null,
  cachedSessionKey: null,
  cachedItemCount: 0,
  isScoring: false,

  /**
   * Get cached result if it matches the current session and item count.
   * Returns null if cache miss or stale.
   */
  getCachedResult: (sessionKey: string, itemCount: number): CachedScoringResult | null => {
    const state = get();

    // Cache miss: no cached result
    if (!state.cachedResult || !state.cachedSessionKey) {
      return null;
    }

    // Cache miss: session key changed
    if (state.cachedSessionKey !== sessionKey) {
      logger.debug('[MoodScoringCache] Cache miss: session key changed');
      return null;
    }

    // Cache miss: library item count changed significantly (items added/removed)
    // Allow small differences (±5) to account for slight sync delays
    if (Math.abs(state.cachedItemCount - itemCount) > 5) {
      logger.debug(`[MoodScoringCache] Cache miss: item count changed (${state.cachedItemCount} -> ${itemCount})`);
      return null;
    }

    // Cache hit!
    logger.debug(`[MoodScoringCache] Cache HIT (${state.cachedResult.scoredBooks.length} scored books)`);
    return state.cachedResult;
  },

  /**
   * Store scoring result in cache
   */
  setCachedResult: (sessionKey: string, itemCount: number, result: CachedScoringResult): void => {
    logger.debug(`[MoodScoringCache] Caching ${result.scoredBooks.length} scored books for session`);
    set({
      cachedResult: result,
      cachedSessionKey: sessionKey,
      cachedItemCount: itemCount,
    });
  },

  /**
   * Invalidate the cache (call when session changes or data refreshes)
   */
  invalidateCache: (): void => {
    const state = get();
    if (state.cachedResult) {
      logger.debug('[MoodScoringCache] Cache invalidated');
    }
    set({
      cachedResult: null,
      cachedSessionKey: null,
      cachedItemCount: 0,
    });
  },

  setIsScoring: (isScoring: boolean): void => {
    set({ isScoring });
  },
}));

// === SELECTORS ===

export const selectCachedResult = (state: MoodScoringCacheState) => state.cachedResult;
export const selectIsScoring = (state: MoodScoringCacheState) => state.isScoring;
export const selectCachedSessionKey = (state: MoodScoringCacheState) => state.cachedSessionKey;
