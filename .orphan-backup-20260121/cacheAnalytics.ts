/**
 * src/core/cache/cacheAnalytics.ts
 *
 * Cache hit/miss tracking for performance monitoring.
 * P2 Fix - Provides visibility into cache effectiveness.
 */

import { createLogger } from '@/shared/utils/logger';

const log = createLogger('cacheAnalytics');

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  lastAccess: number;
}

// Store stats per cache name
const stats: Map<string, CacheStats> = new Map();

/**
 * Initialize stats for a cache if not already present
 */
function ensureStats(cacheName: string): CacheStats {
  if (!stats.has(cacheName)) {
    stats.set(cacheName, {
      hits: 0,
      misses: 0,
      hitRate: 0,
      lastAccess: Date.now(),
    });
  }
  return stats.get(cacheName)!;
}

/**
 * Update the hit rate for a cache
 */
function updateHitRate(cacheName: string): void {
  const s = stats.get(cacheName);
  if (s) {
    const total = s.hits + s.misses;
    s.hitRate = total > 0 ? s.hits / total : 0;
  }
}

/**
 * Record a cache hit
 */
export function recordCacheHit(cacheName: string): void {
  const s = ensureStats(cacheName);
  s.hits++;
  s.lastAccess = Date.now();
  updateHitRate(cacheName);

  if (__DEV__) {
    log.debug(`[${cacheName}] HIT (rate: ${(s.hitRate * 100).toFixed(1)}%)`);
  }
}

/**
 * Record a cache miss
 */
export function recordCacheMiss(cacheName: string): void {
  const s = ensureStats(cacheName);
  s.misses++;
  s.lastAccess = Date.now();
  updateHitRate(cacheName);

  if (__DEV__) {
    log.debug(`[${cacheName}] MISS (rate: ${(s.hitRate * 100).toFixed(1)}%)`);
  }
}

/**
 * Get statistics for a specific cache
 */
export function getCacheStats(cacheName: string): CacheStats | undefined {
  return stats.get(cacheName);
}

/**
 * Get all cache statistics
 */
export function getAllCacheStats(): Record<string, CacheStats> {
  const result: Record<string, CacheStats> = {};
  stats.forEach((value, key) => {
    result[key] = { ...value };
  });
  return result;
}

/**
 * Reset statistics for a specific cache
 */
export function resetCacheStats(cacheName: string): void {
  stats.delete(cacheName);
}

/**
 * Reset all cache statistics
 */
export function resetAllCacheStats(): void {
  stats.clear();
}

/**
 * Log a summary of all cache statistics
 */
export function logCacheStatsSummary(): void {
  log.info('=== Cache Statistics Summary ===');

  if (stats.size === 0) {
    log.info('No cache statistics recorded');
    return;
  }

  let totalHits = 0;
  let totalMisses = 0;

  stats.forEach((s, name) => {
    const total = s.hits + s.misses;
    log.info(
      `  ${name}: ${s.hits}/${total} hits (${(s.hitRate * 100).toFixed(1)}%)`
    );
    totalHits += s.hits;
    totalMisses += s.misses;
  });

  const overallTotal = totalHits + totalMisses;
  const overallRate = overallTotal > 0 ? (totalHits / overallTotal) * 100 : 0;
  log.info(`  OVERALL: ${totalHits}/${overallTotal} hits (${overallRate.toFixed(1)}%)`);
}

/**
 * Get a formatted string summary of cache statistics
 */
export function getCacheStatsSummary(): string {
  const lines: string[] = ['Cache Statistics:'];

  if (stats.size === 0) {
    return 'No cache statistics recorded';
  }

  let totalHits = 0;
  let totalMisses = 0;

  stats.forEach((s, name) => {
    const total = s.hits + s.misses;
    lines.push(`  ${name}: ${s.hits}/${total} (${(s.hitRate * 100).toFixed(1)}%)`);
    totalHits += s.hits;
    totalMisses += s.misses;
  });

  const overallTotal = totalHits + totalMisses;
  const overallRate = overallTotal > 0 ? (totalHits / overallTotal) * 100 : 0;
  lines.push(`  Overall: ${totalHits}/${overallTotal} (${overallRate.toFixed(1)}%)`);

  return lines.join('\n');
}

// Pre-defined cache names for consistency
export const CacheNames = {
  LIBRARY_ITEMS: 'libraryItems',
  ITEMS_BY_ID: 'itemsById',
  AUTHORS: 'authors',
  SERIES: 'series',
  NARRATORS: 'narrators',
  COVER_URLS: 'coverUrls',
  SEARCH_INDEX: 'searchIndex',
  USER_BOOKS: 'userBooks',
} as const;
