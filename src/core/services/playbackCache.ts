/**
 * src/core/services/playbackCache.ts
 *
 * In-memory cache for playback data to enable instant resume.
 * Pre-populated during app startup for recently played books.
 *
 * Caches:
 * - Progress data (position, duration) - avoids SQLite reads
 * - Sessions (audio tracks, chapters) - avoids server round-trip
 */

import { createLogger } from '@/shared/utils/logger';

const log = createLogger('PlaybackCache');

// Progress data cached in memory
export interface CachedProgress {
  itemId: string;
  currentTime: number;
  duration: number;
  progress: number;
  updatedAt: number;
}

// Session data cached in memory
export interface CachedSession {
  id: string;
  libraryItemId: string;
  duration: number;
  currentTime: number;
  updatedAt?: number;
  audioTracks: {
    index: number;
    startOffset: number;
    duration: number;
    title: string;
    contentUrl: string;
    mimeType: string;
  }[];
  chapters: {
    id: number;
    start: number;
    end: number;
    title: string;
  }[];
  mediaMetadata?: {
    title?: string;
    authorName?: string;
    narratorName?: string;
  };
  cachedAt: number; // When this was cached (for expiry)
}

// Session cache expiry (30 minutes) - extended for faster playback resume
// Sessions can become stale, but chapters rarely change
const SESSION_CACHE_EXPIRY_MS = 30 * 60 * 1000;

class PlaybackCache {
  // In-memory caches
  private progressCache = new Map<string, CachedProgress>();
  private sessionCache = new Map<string, CachedSession>();

  // Track if audio is pre-initialized
  private audioInitialized = false;

  /**
   * Cache progress data for a book (called during startup sync)
   */
  setProgress(itemId: string, data: Omit<CachedProgress, 'itemId'>): void {
    this.progressCache.set(itemId, {
      itemId,
      ...data,
    });
    log.debug(`Cached progress for ${itemId}: ${(data.currentTime || 0).toFixed(1)}s`);
  }

  /**
   * Cache progress without logging (for bulk operations like importFromServer)
   */
  setProgressSilent(itemId: string, data: Omit<CachedProgress, 'itemId'>): void {
    this.progressCache.set(itemId, {
      itemId,
      ...data,
    });
  }

  /**
   * Get cached progress (instant - no SQLite read)
   */
  getProgress(itemId: string): CachedProgress | null {
    return this.progressCache.get(itemId) || null;
  }

  /**
   * Check if progress is cached
   */
  hasProgress(itemId: string): boolean {
    return this.progressCache.has(itemId);
  }

  /**
   * Cache a session (called during startup pre-fetch)
   */
  setSession(libraryItemId: string, session: Omit<CachedSession, 'cachedAt'>): void {
    this.sessionCache.set(libraryItemId, {
      ...session,
      cachedAt: Date.now(),
    });
    log.debug(`Cached session for ${libraryItemId}`);
  }

  /**
   * Get cached session if not expired
   */
  getSession(libraryItemId: string): CachedSession | null {
    const cached = this.sessionCache.get(libraryItemId);
    if (!cached) return null;

    // Check if expired
    const age = Date.now() - cached.cachedAt;
    if (age > SESSION_CACHE_EXPIRY_MS) {
      log.debug(`Session cache expired for ${libraryItemId} (${(age / 1000).toFixed(0)}s old)`);
      this.sessionCache.delete(libraryItemId);
      return null;
    }

    log.debug(`Using cached session for ${libraryItemId} (${(age / 1000).toFixed(0)}s old)`);
    return cached;
  }

  /**
   * Check if session is cached and not expired
   */
  hasValidSession(libraryItemId: string): boolean {
    return this.getSession(libraryItemId) !== null;
  }

  /**
   * Invalidate session cache (e.g., when a new session is started)
   */
  invalidateSession(libraryItemId: string): void {
    this.sessionCache.delete(libraryItemId);
  }

  /**
   * Get chapters from session even if expired (for fallback)
   * Unlike getSession(), this doesn't check expiry or delete the cache.
   * Chapters rarely change, so stale chapters are better than no chapters.
   */
  getSessionChaptersForFallback(libraryItemId: string): CachedSession['chapters'] | null {
    const cached = this.sessionCache.get(libraryItemId);
    if (!cached?.chapters?.length) return null;

    log.debug(`Returning cached chapters for ${libraryItemId} (fallback mode)`);
    return cached.chapters;
  }

  /**
   * Mark audio as initialized
   */
  setAudioInitialized(initialized: boolean): void {
    this.audioInitialized = initialized;
  }

  /**
   * Check if audio is pre-initialized
   */
  isAudioInitialized(): boolean {
    return this.audioInitialized;
  }

  /**
   * Clear all caches (e.g., on logout)
   */
  clear(): void {
    this.progressCache.clear();
    this.sessionCache.clear();
    this.audioInitialized = false;
    log.info('Cache cleared');
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { progressCount: number; sessionCount: number; audioInitialized: boolean } {
    return {
      progressCount: this.progressCache.size,
      sessionCount: this.sessionCache.size,
      audioInitialized: this.audioInitialized,
    };
  }
}

export const playbackCache = new PlaybackCache();
