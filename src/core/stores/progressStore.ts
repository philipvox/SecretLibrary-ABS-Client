/**
 * src/core/stores/progressStore.ts
 *
 * UNIFIED PROGRESS STORE - Single Source of Truth
 *
 * This store unifies progress data that was previously fragmented across:
 * - Server /api/me/items-in-progress
 * - Server /api/me (mediaProgress array)
 * - SQLite user_books table
 * - SQLite playback_progress table (legacy)
 * - libraryCache (item.userMediaProgress)
 * - spineCache (CachedSpineData.progress)
 * - playerStore (currentPosition)
 *
 * ARCHITECTURE:
 * - SQLite user_books is the persistent source of truth
 * - This store is the in-memory view that all components subscribe to
 * - Changes propagate instantly to all subscribers (spineCache, UI, etc.)
 * - Background sync handles server communication
 *
 * FLOW:
 * 1. Player updates position → progressStore.updateProgress()
 * 2. progressStore writes to SQLite and updates in-memory Map
 * 3. Subscribers (spineCache, continue listening) react to changes
 * 4. backgroundSyncService queues server sync (unchanged)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { sqliteCache } from '@/core/services/sqliteCache';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('ProgressStore');

// =============================================================================
// TYPES
// =============================================================================

export interface ProgressData {
  bookId: string;
  currentTime: number;
  duration: number;
  progress: number; // 0-1
  lastPlayedAt: number; // timestamp
  isFinished: boolean;
  // Library membership
  isInLibrary: boolean;
  addedToLibraryAt: number | null; // timestamp
}

interface ProgressStoreState {
  /** Map of bookId -> progress data (in-memory cache of SQLite) */
  progressMap: Map<string, ProgressData>;

  /** Set of book IDs explicitly added to library */
  librarySet: Set<string>;

  /** Whether initial load from SQLite is complete */
  isLoaded: boolean;

  /** Version counter - increments on any change (for subscriber reactivity) */
  version: number;
}

interface ProgressStoreActions {
  /**
   * Load all progress from SQLite user_books table.
   * Call this once during app initialization.
   */
  loadFromDatabase: () => Promise<void>;

  /**
   * Get progress for a single book.
   * Returns undefined if book has no progress.
   */
  getProgress: (bookId: string) => ProgressData | undefined;

  /**
   * Get progress for multiple books (batch).
   * More efficient than multiple getProgress calls.
   */
  getProgressBatch: (bookIds: string[]) => Map<string, ProgressData>;

  /**
   * Update progress for a book.
   * This is the primary write path - updates SQLite and notifies all subscribers.
   *
   * @param bookId - Book ID
   * @param currentTime - Position in seconds
   * @param duration - Total duration in seconds
   * @param writeToSqlite - Whether to persist to SQLite (default: true)
   *                        Set to false for high-frequency updates during playback
   */
  updateProgress: (
    bookId: string,
    currentTime: number,
    duration: number,
    writeToSqlite?: boolean
  ) => Promise<void>;

  /**
   * Mark a book as finished.
   * Sets progress to 1.0 and isFinished to true.
   */
  markFinished: (bookId: string, duration: number) => Promise<void>;

  /**
   * Mark a book as not started (reset progress).
   */
  markNotStarted: (bookId: string) => Promise<void>;

  /**
   * Get book IDs that are in progress (started but not finished).
   * Sorted by lastPlayedAt descending (most recent first).
   * @deprecated Use getLibraryBookIds for unified view
   */
  getInProgressBookIds: () => string[];

  /**
   * Get book IDs in user's library (explicitly added OR in progress).
   * Sorted by most recent interaction (lastPlayedAt or addedToLibraryAt).
   */
  getLibraryBookIds: () => string[];

  /**
   * Add a book to the user's library.
   */
  addToLibrary: (bookId: string) => Promise<void>;

  /**
   * Remove a book from the user's library.
   */
  removeFromLibrary: (bookId: string) => Promise<void>;

  /**
   * Check if a book is in the user's library.
   */
  isInLibrary: (bookId: string) => boolean;

  /**
   * Flush any pending updates to SQLite.
   * Call this on app background or before significant operations.
   */
  flush: () => Promise<void>;

  /**
   * Clear all progress data (for logout).
   */
  clear: () => void;
}

// =============================================================================
// STORE
// =============================================================================

export const useProgressStore = create<ProgressStoreState & ProgressStoreActions>()(
  subscribeWithSelector((set, get) => {
    // Pending writes buffer (for batching high-frequency updates)
    let pendingWrites = new Map<string, ProgressData>();
    let flushTimeout: NodeJS.Timeout | null = null;
    const FLUSH_DELAY = 2000; // 2 seconds debounce for SQLite writes

    const scheduledFlush = () => {
      if (flushTimeout) {
        clearTimeout(flushTimeout);
      }
      flushTimeout = setTimeout(() => {
        get().flush();
      }, FLUSH_DELAY);
    };

    return {
      // State
      progressMap: new Map(),
      librarySet: new Set(),
      isLoaded: false,
      version: 0,

      // Actions
      loadFromDatabase: async () => {
        try {
          log.debug('Loading progress from SQLite...');

          // Get ALL user books (including library-only books with no progress)
          const allBooks = await sqliteCache.getAllUserBooks();

          const progressMap = new Map<string, ProgressData>();
          const librarySet = new Set<string>();

          for (const book of allBooks) {
            // Track library membership
            if (book.isInLibrary) {
              librarySet.add(book.bookId);
            }

            // Store if: has progress, is finished, or is in library
            if (book.currentTime > 0 || book.isFinished || book.isInLibrary) {
              progressMap.set(book.bookId, {
                bookId: book.bookId,
                currentTime: book.currentTime ?? 0,
                duration: book.duration ?? 0,
                progress: book.progress ?? 0,
                lastPlayedAt: book.lastPlayedAt
                  ? new Date(book.lastPlayedAt).getTime()
                  : 0,
                isFinished: book.isFinished ?? false,
                isInLibrary: book.isInLibrary ?? false,
                addedToLibraryAt: book.addedToLibraryAt
                  ? new Date(book.addedToLibraryAt).getTime()
                  : null,
              });
            }
          }

          set({
            progressMap,
            librarySet,
            isLoaded: true,
            version: get().version + 1,
          });

          log.info(`Loaded ${progressMap.size} books (${librarySet.size} in library)`);
        } catch (error) {
          log.error('Failed to load progress from database:', error);
          set({ isLoaded: true }); // Mark as loaded even on error to unblock UI
        }
      },

      getProgress: (bookId: string) => {
        return get().progressMap.get(bookId);
      },

      getProgressBatch: (bookIds: string[]) => {
        const { progressMap } = get();
        const result = new Map<string, ProgressData>();

        for (const id of bookIds) {
          const progress = progressMap.get(id);
          if (progress) {
            result.set(id, progress);
          }
        }

        return result;
      },

      updateProgress: async (
        bookId: string,
        currentTime: number,
        duration: number,
        writeToSqlite = true
      ) => {
        const progress = duration > 0 ? currentTime / duration : 0;
        const lastPlayedAt = Date.now();
        const isFinished = progress >= 0.95;

        // Preserve existing library membership
        const existing = get().progressMap.get(bookId);

        const progressData: ProgressData = {
          bookId,
          currentTime,
          duration,
          progress,
          lastPlayedAt,
          isFinished,
          isInLibrary: existing?.isInLibrary ?? false,
          addedToLibraryAt: existing?.addedToLibraryAt ?? null,
        };

        // Update in-memory state immediately (for instant UI updates)
        // Mutate the existing Map in place instead of creating a new one on every
        // position update (called ~1x/sec during playback). The version counter
        // triggers Zustand subscriber reactivity without the allocation overhead.
        const { progressMap } = get();
        progressMap.set(bookId, progressData);
        set({ version: get().version + 1 });

        // Queue for SQLite write (debounced for performance during playback)
        if (writeToSqlite) {
          pendingWrites.set(bookId, progressData);
          scheduledFlush();
        }
      },

      markFinished: async (bookId: string, duration: number) => {
        // Preserve existing library membership
        const existing = get().progressMap.get(bookId);

        const progressData: ProgressData = {
          bookId,
          currentTime: duration,
          duration,
          progress: 1,
          lastPlayedAt: Date.now(),
          isFinished: true,
          isInLibrary: existing?.isInLibrary ?? false,
          addedToLibraryAt: existing?.addedToLibraryAt ?? null,
        };

        // Update in-memory state
        set((state) => {
          const newMap = new Map(state.progressMap);
          newMap.set(bookId, progressData);
          return {
            progressMap: newMap,
            version: state.version + 1,
          };
        });

        // Write to SQLite immediately (important state change)
        try {
          await sqliteCache.setUserBook({
            bookId,
            currentTime: duration,
            duration,
            progress: 1,
            isFinished: true,
            finishSource: 'manual',
            finishedAt: new Date().toISOString(),
            lastPlayedAt: new Date().toISOString(),
            progressSynced: false,
            finishedSynced: false,
          });
          log.debug(`Marked ${bookId} as finished`);
        } catch (error) {
          log.error(`Failed to mark ${bookId} as finished:`, error);
        }
      },

      markNotStarted: async (bookId: string) => {
        // Reset progress but preserve library membership
        set((state) => {
          const newMap = new Map(state.progressMap);
          const existing = newMap.get(bookId);
          if (existing) {
            newMap.set(bookId, {
              ...existing,
              currentTime: 0,
              duration: existing.duration,
              progress: 0,
              isFinished: false,
              lastPlayedAt: existing.lastPlayedAt,
            });
          } else {
            newMap.delete(bookId);
          }
          return {
            progressMap: newMap,
            version: state.version + 1,
          };
        });

        // Update SQLite
        try {
          await sqliteCache.setUserBook({
            bookId,
            currentTime: 0,
            progress: 0,
            isFinished: false,
            finishSource: null,
            finishedAt: null,
            progressSynced: false,
          });
          log.debug(`Reset progress for ${bookId}`);
        } catch (error) {
          log.error(`Failed to reset progress for ${bookId}:`, error);
        }
      },

      getInProgressBookIds: () => {
        const { progressMap } = get();

        return Array.from(progressMap.values())
          .filter((p) => p.progress > 0 && !p.isFinished)
          .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
          .map((p) => p.bookId);
      },

      getLibraryBookIds: () => {
        const { progressMap } = get();

        return Array.from(progressMap.values())
          // Include if: in library OR has progress (and not finished)
          .filter((p) => (p.isInLibrary || p.progress > 0) && !p.isFinished)
          // Sort by most recent interaction
          .sort((a, b) => {
            const aTime = Math.max(a.lastPlayedAt, a.addedToLibraryAt ?? 0);
            const bTime = Math.max(b.lastPlayedAt, b.addedToLibraryAt ?? 0);
            return bTime - aTime;
          })
          .map((p) => p.bookId);
      },

      addToLibrary: async (bookId: string) => {
        const now = Date.now();

        // Update SQLite first
        await sqliteCache.addToLibrary(bookId);

        // Update store
        set((state) => {
          const newLibrarySet = new Set(state.librarySet);
          newLibrarySet.add(bookId);

          const newProgressMap = new Map(state.progressMap);
          const existing = newProgressMap.get(bookId);

          newProgressMap.set(bookId, {
            bookId,
            currentTime: existing?.currentTime ?? 0,
            duration: existing?.duration ?? 0,
            progress: existing?.progress ?? 0,
            lastPlayedAt: existing?.lastPlayedAt ?? now,
            isFinished: existing?.isFinished ?? false,
            isInLibrary: true,
            addedToLibraryAt: existing?.addedToLibraryAt ?? now,
          });

          return {
            librarySet: newLibrarySet,
            progressMap: newProgressMap,
            version: state.version + 1,
          };
        });

        // Sync to myLibraryStore + ABS collection
        const { useMyLibraryStore } = await import('@/shared/stores/myLibraryStore');
        const myLib = useMyLibraryStore.getState();
        if (!myLib.libraryIds.includes(bookId)) {
          myLib.addToLibrary(bookId);
        }

        log.info(`Added ${bookId} to library`);
      },

      removeFromLibrary: async (bookId: string) => {
        // Update SQLite first
        await sqliteCache.removeFromLibrary(bookId);

        // Update store
        set((state) => {
          const newLibrarySet = new Set(state.librarySet);
          newLibrarySet.delete(bookId);

          const newProgressMap = new Map(state.progressMap);
          const existing = newProgressMap.get(bookId);

          if (existing) {
            // Keep in map if has progress, just update library flag
            if (existing.progress > 0) {
              newProgressMap.set(bookId, { ...existing, isInLibrary: false });
            } else {
              // Remove entirely if no progress
              newProgressMap.delete(bookId);
            }
          }

          return {
            librarySet: newLibrarySet,
            progressMap: newProgressMap,
            version: state.version + 1,
          };
        });

        // Sync to myLibraryStore + ABS collection
        const { useMyLibraryStore } = await import('@/shared/stores/myLibraryStore');
        const myLib = useMyLibraryStore.getState();
        if (myLib.libraryIds.includes(bookId)) {
          myLib.removeFromLibrary(bookId);
        }

        log.info(`Removed ${bookId} from library`);
      },

      isInLibrary: (bookId: string) => {
        return get().librarySet.has(bookId);
      },

      flush: async () => {
        if (pendingWrites.size === 0) return;

        const toWrite = new Map(pendingWrites);
        pendingWrites.clear();

        log.debug(`Flushing ${toWrite.size} progress updates to SQLite`);

        for (const [bookId, data] of toWrite) {
          try {
            await sqliteCache.setUserBook({
              bookId,
              currentTime: data.currentTime,
              duration: data.duration,
              progress: data.progress,
              lastPlayedAt: new Date(data.lastPlayedAt).toISOString(),
              isFinished: data.isFinished,
              progressSynced: false, // Will be synced by backgroundSyncService
            });
          } catch (error) {
            log.error(`Failed to flush progress for ${bookId}:`, error);
            // Re-queue failed writes
            pendingWrites.set(bookId, data);
          }
        }
        // If any writes failed and were re-queued, schedule another flush
        if (pendingWrites.size > 0) {
          log.warn(`${pendingWrites.size} writes failed, scheduling retry`);
          scheduledFlush();
        }
      },

      clear: () => {
        pendingWrites.clear();
        if (flushTimeout) {
          clearTimeout(flushTimeout);
          flushTimeout = null;
        }
        set({
          progressMap: new Map(),
          librarySet: new Set(),
          isLoaded: false,
          version: 0,
        });
        log.debug('Progress store cleared');
      },
    };
  })
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Select just the version number (for reactivity without full map subscription)
 */
export const selectProgressVersion = (state: ProgressStoreState) => state.version;

/**
 * Select whether store is loaded
 */
export const selectIsLoaded = (state: ProgressStoreState) => state.isLoaded;

/**
 * Select progress for a specific book (creates new reference on change)
 */
export const selectBookProgress = (bookId: string) => (state: ProgressStoreState) =>
  state.progressMap.get(bookId);

/**
 * Select whether a book is in the user's library
 */
export const selectIsInLibrary = (bookId: string) => (state: ProgressStoreState & { isInLibrary: (id: string) => boolean }) =>
  state.librarySet.has(bookId);

// =============================================================================
// CONVENIENCE HOOKS
// =============================================================================

/**
 * Hook to check if a book is in the user's library
 */
export const useIsInLibrary = (bookId: string) =>
  useProgressStore((state) => state.librarySet.has(bookId));

/**
 * Hook to get library book IDs (reactive)
 */
export const useLibraryBookIds = () =>
  useProgressStore((state) => state.getLibraryBookIds());

// =============================================================================
// SUBSCRIBER SETUP
// =============================================================================

/**
 * Set up subscribers for other stores that need progress updates.
 * Call this once during app initialization, after all stores are created.
 */
export function setupProgressSubscribers() {
  // Import here to avoid circular dependencies
  const { useSpineCacheStore } = require('@/features/home/stores/spineCache');

  // Subscribe spineCache to progress changes
  useProgressStore.subscribe(
    (state) => state.version,
    () => {
      const { progressMap } = useProgressStore.getState();
      const spineCache = useSpineCacheStore.getState();

      // Update spine cache with latest progress values
      progressMap.forEach((data, bookId) => {
        spineCache.updateProgress(bookId, data.progress);
      });
    }
  );

  log.debug('Progress subscribers set up');
}
