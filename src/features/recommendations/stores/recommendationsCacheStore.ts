/**
 * src/features/recommendations/stores/recommendationsCacheStore.ts
 *
 * Cache store for recommendations SQLite queries.
 * Prevents duplicate queries when multiple components use useRecommendations.
 * Data is loaded once per session and shared across all consumers.
 */

import { create } from 'zustand';
import { sqliteCache } from '@/core/services/sqliteCache';
import { logger } from '@/shared/utils/logger';

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

interface UserBookProgress {
  progress: number;
  lastPlayedAt: string | null;
}

interface RecommendationsCacheState {
  // Cached data
  historyStats: ReadHistoryStats | null;
  finishedBookIds: Set<string>;
  abandonedBooks: AbandonedBook[];
  userBooksMap: Map<string, UserBookProgress>;

  // Loading state
  isLoading: boolean;
  isLoaded: boolean;
  loadError: string | null;

  // Actions
  loadCache: () => Promise<void>;
  invalidateCache: () => void;
}

// === STORE ===

export const useRecommendationsCacheStore = create<RecommendationsCacheState>((set, get) => ({
  // Initial state
  historyStats: null,
  finishedBookIds: new Set(),
  abandonedBooks: [],
  userBooksMap: new Map(),
  isLoading: false,
  isLoaded: false,
  loadError: null,

  // Load all SQLite data in parallel (once per session)
  loadCache: async () => {
    const state = get();

    // Skip if already loaded or loading
    if (state.isLoaded || state.isLoading) {
      return;
    }

    set({ isLoading: true, loadError: null });

    const startTime = Date.now();
    logger.debug('[RecommendationsCache] Loading SQLite data...');

    try {
      // Run all queries in parallel
      const [historyStats, finishedBooks, inProgressBooks, abandonedBooks] = await Promise.all([
        sqliteCache.getReadHistoryStats().catch(() => null),
        sqliteCache.getFinishedUserBooks().catch(() => []),
        sqliteCache.getInProgressUserBooks().catch(() => []),
        sqliteCache.getAbandonedBooks().catch(() => []),
      ]);

      const totalTime = Date.now() - startTime;
      logger.debug(`[RecommendationsCache] Loaded in ${totalTime}ms (finished: ${finishedBooks.length}, inProgress: ${inProgressBooks.length}, abandoned: ${abandonedBooks.length})`);

      // Build finished book IDs set
      const finishedBookIds = new Set(finishedBooks.map(b => b.bookId));

      // Build user books map (combine finished and in-progress)
      const userBooksMap = new Map<string, UserBookProgress>();
      finishedBooks.forEach(b => {
        userBooksMap.set(b.bookId, { progress: b.progress, lastPlayedAt: b.lastPlayedAt });
      });
      inProgressBooks.forEach(b => {
        userBooksMap.set(b.bookId, { progress: b.progress, lastPlayedAt: b.lastPlayedAt });
      });

      set({
        historyStats,
        finishedBookIds,
        abandonedBooks,
        userBooksMap,
        isLoading: false,
        isLoaded: true,
      });
    } catch (error) {
      logger.error('[RecommendationsCache] Failed to load:', error);
      set({
        isLoading: false,
        loadError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Invalidate cache (call when user data changes significantly)
  invalidateCache: () => {
    set({
      historyStats: null,
      finishedBookIds: new Set(),
      abandonedBooks: [],
      userBooksMap: new Map(),
      isLoading: false,
      isLoaded: false,
      loadError: null,
    });
  },
}));

// === SELECTORS ===

export const selectHistoryStats = (state: RecommendationsCacheState) => state.historyStats;
export const selectFinishedBookIds = (state: RecommendationsCacheState) => state.finishedBookIds;
export const selectAbandonedBooks = (state: RecommendationsCacheState) => state.abandonedBooks;
export const selectUserBooksMap = (state: RecommendationsCacheState) => state.userBooksMap;
export const selectIsLoaded = (state: RecommendationsCacheState) => state.isLoaded;
export const selectIsLoading = (state: RecommendationsCacheState) => state.isLoading;
