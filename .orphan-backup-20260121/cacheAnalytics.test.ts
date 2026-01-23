/**
 * src/core/cache/__tests__/cacheAnalytics.test.ts
 *
 * Tests for cache analytics module.
 */

import {
  recordCacheHit,
  recordCacheMiss,
  getCacheStats,
  getAllCacheStats,
  resetCacheStats,
  resetAllCacheStats,
  getCacheStatsSummary,
  CacheNames,
} from '../cacheAnalytics';

// Mock the logger
jest.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('cacheAnalytics', () => {
  // Reset stats before each test
  beforeEach(() => {
    resetAllCacheStats();
  });

  describe('recordCacheHit', () => {
    it('creates stats for new cache name', () => {
      recordCacheHit('testCache');

      const stats = getCacheStats('testCache');
      expect(stats).toBeDefined();
      expect(stats?.hits).toBe(1);
      expect(stats?.misses).toBe(0);
      expect(stats?.hitRate).toBe(1);
    });

    it('increments hits counter', () => {
      recordCacheHit('testCache');
      recordCacheHit('testCache');
      recordCacheHit('testCache');

      const stats = getCacheStats('testCache');
      expect(stats?.hits).toBe(3);
    });

    it('updates lastAccess timestamp', () => {
      const before = Date.now();
      recordCacheHit('testCache');
      const after = Date.now();

      const stats = getCacheStats('testCache');
      expect(stats?.lastAccess).toBeGreaterThanOrEqual(before);
      expect(stats?.lastAccess).toBeLessThanOrEqual(after);
    });

    it('calculates correct hit rate', () => {
      recordCacheHit('testCache');
      recordCacheHit('testCache');
      recordCacheMiss('testCache');

      const stats = getCacheStats('testCache');
      // 2 hits out of 3 total = 0.6666...
      expect(stats?.hitRate).toBeCloseTo(0.6667, 3);
    });
  });

  describe('recordCacheMiss', () => {
    it('creates stats for new cache name', () => {
      recordCacheMiss('testCache');

      const stats = getCacheStats('testCache');
      expect(stats).toBeDefined();
      expect(stats?.hits).toBe(0);
      expect(stats?.misses).toBe(1);
      expect(stats?.hitRate).toBe(0);
    });

    it('increments misses counter', () => {
      recordCacheMiss('testCache');
      recordCacheMiss('testCache');

      const stats = getCacheStats('testCache');
      expect(stats?.misses).toBe(2);
    });

    it('calculates correct hit rate after miss', () => {
      recordCacheHit('testCache');
      recordCacheMiss('testCache');

      const stats = getCacheStats('testCache');
      // 1 hit out of 2 total = 0.5
      expect(stats?.hitRate).toBe(0.5);
    });
  });

  describe('getCacheStats', () => {
    it('returns undefined for unknown cache', () => {
      const stats = getCacheStats('unknownCache');
      expect(stats).toBeUndefined();
    });

    it('returns stats for known cache', () => {
      recordCacheHit('testCache');

      const stats = getCacheStats('testCache');
      expect(stats).toEqual({
        hits: 1,
        misses: 0,
        hitRate: 1,
        lastAccess: expect.any(Number),
      });
    });
  });

  describe('getAllCacheStats', () => {
    it('returns empty object when no stats', () => {
      const allStats = getAllCacheStats();
      expect(allStats).toEqual({});
    });

    it('returns all cache stats', () => {
      recordCacheHit('cache1');
      recordCacheMiss('cache2');
      recordCacheHit('cache2');

      const allStats = getAllCacheStats();

      expect(Object.keys(allStats)).toHaveLength(2);
      expect(allStats['cache1']).toBeDefined();
      expect(allStats['cache2']).toBeDefined();
      expect(allStats['cache1'].hits).toBe(1);
      expect(allStats['cache2'].hits).toBe(1);
      expect(allStats['cache2'].misses).toBe(1);
    });

    it('returns copies not references', () => {
      recordCacheHit('testCache');

      const allStats = getAllCacheStats();
      allStats['testCache'].hits = 999;

      const freshStats = getCacheStats('testCache');
      expect(freshStats?.hits).toBe(1);
    });
  });

  describe('resetCacheStats', () => {
    it('removes stats for specific cache', () => {
      recordCacheHit('cache1');
      recordCacheHit('cache2');

      resetCacheStats('cache1');

      expect(getCacheStats('cache1')).toBeUndefined();
      expect(getCacheStats('cache2')).toBeDefined();
    });

    it('does nothing for unknown cache', () => {
      recordCacheHit('testCache');
      resetCacheStats('unknownCache');

      expect(getCacheStats('testCache')).toBeDefined();
    });
  });

  describe('resetAllCacheStats', () => {
    it('removes all cache stats', () => {
      recordCacheHit('cache1');
      recordCacheHit('cache2');
      recordCacheHit('cache3');

      resetAllCacheStats();

      expect(getAllCacheStats()).toEqual({});
    });
  });

  describe('getCacheStatsSummary', () => {
    it('returns message when no stats', () => {
      const summary = getCacheStatsSummary();
      expect(summary).toBe('No cache statistics recorded');
    });

    it('returns formatted summary with stats', () => {
      recordCacheHit('cache1');
      recordCacheHit('cache1');
      recordCacheMiss('cache1');
      recordCacheHit('cache2');

      const summary = getCacheStatsSummary();

      expect(summary).toContain('Cache Statistics:');
      expect(summary).toContain('cache1: 2/3');
      expect(summary).toContain('cache2: 1/1');
      expect(summary).toContain('Overall: 3/4');
    });

    it('calculates correct percentages', () => {
      // 50% hit rate
      recordCacheHit('test');
      recordCacheMiss('test');

      const summary = getCacheStatsSummary();
      expect(summary).toContain('50.0%');
    });
  });

  describe('CacheNames', () => {
    it('has all expected cache names', () => {
      expect(CacheNames.LIBRARY_ITEMS).toBe('libraryItems');
      expect(CacheNames.ITEMS_BY_ID).toBe('itemsById');
      expect(CacheNames.AUTHORS).toBe('authors');
      expect(CacheNames.SERIES).toBe('series');
      expect(CacheNames.NARRATORS).toBe('narrators');
      expect(CacheNames.COVER_URLS).toBe('coverUrls');
      expect(CacheNames.SEARCH_INDEX).toBe('searchIndex');
      expect(CacheNames.USER_BOOKS).toBe('userBooks');
    });

    it('can be used with analytics functions', () => {
      recordCacheHit(CacheNames.LIBRARY_ITEMS);
      recordCacheMiss(CacheNames.LIBRARY_ITEMS);

      const stats = getCacheStats(CacheNames.LIBRARY_ITEMS);
      expect(stats?.hits).toBe(1);
      expect(stats?.misses).toBe(1);
    });
  });

  describe('hit rate calculations', () => {
    it('handles 100% hit rate', () => {
      recordCacheHit('test');
      recordCacheHit('test');
      recordCacheHit('test');

      const stats = getCacheStats('test');
      expect(stats?.hitRate).toBe(1);
    });

    it('handles 0% hit rate', () => {
      recordCacheMiss('test');
      recordCacheMiss('test');

      const stats = getCacheStats('test');
      expect(stats?.hitRate).toBe(0);
    });

    it('handles mixed hits and misses', () => {
      // 75% hit rate: 3 hits, 1 miss
      recordCacheHit('test');
      recordCacheHit('test');
      recordCacheHit('test');
      recordCacheMiss('test');

      const stats = getCacheStats('test');
      expect(stats?.hitRate).toBe(0.75);
    });
  });

  describe('multiple caches', () => {
    it('tracks stats independently for each cache', () => {
      recordCacheHit('cache1');
      recordCacheHit('cache1');
      recordCacheMiss('cache2');
      recordCacheMiss('cache2');
      recordCacheMiss('cache2');

      const stats1 = getCacheStats('cache1');
      const stats2 = getCacheStats('cache2');

      expect(stats1?.hits).toBe(2);
      expect(stats1?.misses).toBe(0);
      expect(stats1?.hitRate).toBe(1);

      expect(stats2?.hits).toBe(0);
      expect(stats2?.misses).toBe(3);
      expect(stats2?.hitRate).toBe(0);
    });
  });
});
