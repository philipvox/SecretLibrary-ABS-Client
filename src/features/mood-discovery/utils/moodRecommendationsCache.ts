/**
 * src/features/mood-discovery/utils/moodRecommendationsCache.ts
 *
 * Mood recommendations cache management.
 * Extracted to break circular dependency between moodSessionStore and useMoodRecommendations.
 */

import { logger } from '@/shared/utils/logger';
import type { MoodSession, ScoredBook } from '../types';
import type { LibraryItem } from '@/core/types';

/**
 * Cached mood result structure
 */
export interface CachedMoodResult {
  recommendations: ScoredBook[];
  unscored: LibraryItem[];
  totalCount: number;
  sessionKey: string;
  timestamp: number;
}

// Global cache for mood recommendations - survives component unmounts
let moodRecommendationsCache: CachedMoodResult | null = null;

/**
 * Generate a cache key from a mood session
 */
export function getSessionCacheKey(session: MoodSession | null): string {
  if (!session) return '';
  return `${session.mood}-${session.flavor || 'any'}-${session.seedBookId || 'none'}-${session.pace}-${session.weight}-${session.world}-${session.length}-${session.excludeChildrens ? '1' : '0'}-${session.createdAt}`;
}

/**
 * Get the current cached mood recommendations
 */
export function getMoodRecommendationsCache(): CachedMoodResult | null {
  return moodRecommendationsCache;
}

/**
 * Set the mood recommendations cache
 */
export function setMoodRecommendationsCache(result: CachedMoodResult): void {
  moodRecommendationsCache = result;
}

/**
 * Clear the mood recommendations cache (call when session changes)
 * Also clears the new Zustand-based cache for backwards compatibility.
 */
export function clearMoodRecommendationsCache(): void {
  moodRecommendationsCache = null;
  // Also clear the new Zustand store cache (lazy import to avoid circular deps)
  import('../stores/moodScoringCacheStore').then(({ useMoodScoringCacheStore }) => {
    useMoodScoringCacheStore.getState().invalidateCache();
  }).catch(() => {});
  logger.debug('[Browse Perf] Mood recommendations cache cleared');
}

/**
 * Check if we have cached results for the current session
 */
export function hasCachedMoodRecommendations(session: MoodSession | null): boolean {
  if (!session || !moodRecommendationsCache) return false;
  return moodRecommendationsCache.sessionKey === getSessionCacheKey(session);
}
