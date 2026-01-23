/**
 * src/core/api/networkOptimizer.ts
 *
 * Network optimization utilities for the API client:
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Short-term response caching
 * - Exponential backoff retry
 * - Request queue with priority
 */

import { createLogger } from '@/shared/utils/logger';

const log = createLogger('Network');

// ============================================================================
// REQUEST DEDUPLICATION
// ============================================================================

interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class RequestDeduplicator {
  private inFlight = new Map<string, InFlightRequest<any>>();
  private readonly maxAge = 100; // Max ms to consider requests as duplicates

  /**
   * Execute a request with deduplication
   * If an identical request is already in flight, return its promise
   */
  async execute<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();

    // Check for existing in-flight request
    const existing = this.inFlight.get(key);
    if (existing && now - existing.timestamp < this.maxAge) {
      log.debug(`Deduped request: ${key}`);
      return existing.promise;
    }

    // Execute new request
    const promise = requestFn().finally(() => {
      // Clean up after request completes
      setTimeout(() => this.inFlight.delete(key), 10);
    });

    this.inFlight.set(key, { promise, timestamp: now });
    return promise;
  }

  /**
   * Clear all in-flight requests
   */
  clear(): void {
    this.inFlight.clear();
  }
}

// ============================================================================
// RESPONSE CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 30000; // 30 seconds default TTL
  private readonly maxSize = 100; // Max cache entries

  /**
   * Get cached response if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    log.debug(`Cache hit: ${key}`);
    return entry.data;
  }

  /**
   * Cache a response
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldest = key;
        oldestTime = entry.timestamp;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }
}

// ============================================================================
// RETRY WITH EXPONENTIAL BACKOFF (Enhanced with 429 Rate Limit Handling)
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryOn: (error: any) => boolean;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3, // Increased from 2 for better resilience
  baseDelay: 500,
  maxDelay: 10000, // Increased from 3000 for rate limit scenarios
  retryOn: (error: any) => {
    // Retry on network errors, 5xx server errors, and 429 rate limit
    if (!error.response) return true; // Network error
    const status = error.response?.status;
    // Retry on 5xx server errors AND 429 rate limit
    return (status >= 500 && status < 600) || status === 429;
  },
};

/**
 * Parse Retry-After header value
 * Can be either a number (seconds) or an HTTP date
 */
function parseRetryAfter(retryAfter: string | undefined): number | null {
  if (!retryAfter) return null;

  // Try parsing as number (seconds)
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000; // Convert to ms
  }

  // Try parsing as HTTP date
  const date = Date.parse(retryAfter);
  if (!isNaN(date)) {
    const delayMs = date - Date.now();
    return delayMs > 0 ? delayMs : null;
  }

  return null;
}

async function withRetry<T>(
  requestFn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, retryOn } = {
    ...defaultRetryConfig,
    ...config,
  };

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }

      let delay: number;

      // RATE LIMIT HANDLING: Check for 429 with Retry-After header
      if (error.response?.status === 429) {
        const retryAfterHeader = error.response?.headers?.['retry-after'];
        const retryAfterMs = parseRetryAfter(retryAfterHeader);

        if (retryAfterMs !== null) {
          // Use server-specified delay (capped at maxDelay)
          delay = Math.min(retryAfterMs, maxDelay);
          log.warn(`[RATE_LIMIT] 429 received - waiting ${delay}ms (from Retry-After header)`);
        } else {
          // No Retry-After header - use aggressive backoff for rate limits
          // Start with 5 seconds, double each time
          delay = Math.min(5000 * Math.pow(2, attempt), maxDelay);
          log.warn(`[RATE_LIMIT] 429 received - waiting ${delay}ms (no Retry-After, using backoff)`);
        }
      } else {
        // Standard exponential backoff for other errors (5xx, network)
        delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelay
        );
      }

      log.debug(`Retry ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================================
// REQUEST QUEUE WITH PRIORITY
// ============================================================================

type Priority = 'high' | 'normal' | 'low';

interface QueuedRequest<T> {
  id: string;
  priority: Priority;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
}

class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private activeCount = 0;
  private readonly maxConcurrent = 6; // Browser typically allows 6 concurrent requests per domain
  private requestId = 0;

  /**
   * Add a request to the queue
   */
  enqueue<T>(
    execute: () => Promise<T>,
    priority: Priority = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: `req-${++this.requestId}`,
        priority,
        execute,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Insert based on priority
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const insertIndex = this.queue.findIndex(
        r => priorityOrder[r.priority] > priorityOrder[priority]
      );

      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      this.activeCount++;

      request
        .execute()
        .then(request.resolve)
        .catch(request.reject)
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }
  }

  /**
   * Get queue status
   */
  getStatus(): { queued: number; active: number } {
    return {
      queued: this.queue.length,
      active: this.activeCount,
    };
  }

  /**
   * Clear all queued requests (active requests will complete)
   */
  clear(): void {
    for (const request of this.queue) {
      request.reject(new Error('Request cancelled'));
    }
    this.queue = [];
  }
}

// ============================================================================
// NETWORK OPTIMIZER (Combined)
// ============================================================================

class NetworkOptimizer {
  readonly deduplicator = new RequestDeduplicator();
  readonly cache = new ResponseCache();
  readonly queue = new RequestQueue();

  /**
   * Execute a GET request with all optimizations
   */
  async get<T>(
    key: string,
    requestFn: () => Promise<T>,
    options: {
      cacheTTL?: number;
      priority?: Priority;
      skipCache?: boolean;
      skipRetry?: boolean;
    } = {}
  ): Promise<T> {
    const { cacheTTL, priority = 'normal', skipCache = false, skipRetry = false } = options;

    // Check cache first
    if (!skipCache) {
      const cached = this.cache.get<T>(key);
      if (cached !== null) return cached;
    }

    // Execute with deduplication and optional retry
    const execute = async () => {
      return this.deduplicator.execute(key, async () => {
        const result = skipRetry
          ? await requestFn()
          : await withRetry(requestFn);

        // Cache successful response
        if (cacheTTL !== undefined) {
          this.cache.set(key, result, cacheTTL);
        }

        return result;
      });
    };

    // Queue the request
    return this.queue.enqueue(execute, priority);
  }

  /**
   * Execute a mutation (POST/PATCH/DELETE) with retry
   */
  async mutate<T>(
    requestFn: () => Promise<T>,
    options: {
      priority?: Priority;
      invalidateCache?: string | RegExp;
      skipRetry?: boolean;
    } = {}
  ): Promise<T> {
    const { priority = 'high', invalidateCache, skipRetry = false } = options;

    const execute = async () => {
      const result = skipRetry
        ? await requestFn()
        : await withRetry(requestFn, { maxRetries: 2 });

      // Invalidate related cache entries
      if (invalidateCache) {
        this.cache.invalidatePattern(invalidateCache);
      }

      return result;
    };

    return this.queue.enqueue(execute, priority);
  }

  /**
   * Prefetch data into cache (low priority)
   */
  prefetch<T>(
    key: string,
    requestFn: () => Promise<T>,
    cacheTTL: number = 60000
  ): void {
    // Don't prefetch if already cached
    if (this.cache.get(key) !== null) return;

    this.get(key, requestFn, {
      cacheTTL,
      priority: 'low',
      skipRetry: true,
    }).catch(() => {
      // Silently ignore prefetch errors
    });
  }

  /**
   * Clear all caches and pending requests
   */
  reset(): void {
    this.cache.clear();
    this.deduplicator.clear();
    this.queue.clear();
  }
}

// Export singleton and utilities
export const networkOptimizer = new NetworkOptimizer();
export { withRetry, ResponseCache, RequestDeduplicator, RequestQueue };
export type { RetryConfig, Priority };
