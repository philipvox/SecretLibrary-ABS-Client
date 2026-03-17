/**
 * src/features/player/stores/bookmarksStore.ts
 *
 * Bookmark management store for audiobooks.
 * Extracted from playerStore.ts for modularity (Phase 3 refactor).
 *
 * Features:
 * - CRUD operations for bookmarks
 * - SQLite persistence
 * - Haptic feedback on create/delete
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { sqliteCache } from '@/core/services/sqliteCache';
import { haptics } from '@/core/native/haptics';
import { createLogger } from '@/shared/utils/logger';

// Fix Bug #2: Use crypto for unique IDs to prevent collision
// Fallback to timestamp + random for environments without crypto
const generateUniqueId = (): string => {
  try {
    // Use expo-crypto for unique IDs
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback: timestamp + random to minimize collision chance
    return `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
};

// =============================================================================
// TYPES
// =============================================================================

export interface Bookmark {
  id: string;
  title: string;
  note: string | null;
  time: number;
  chapterTitle: string | null;
  createdAt: number;
}

interface BookmarksState {
  bookmarks: Bookmark[];
  currentBookId: string | null;
}

interface BookmarksActions {
  /**
   * Add a new bookmark for the current book
   */
  addBookmark: (bookmarkData: Omit<Bookmark, 'id' | 'createdAt'>) => Promise<void>;

  /**
   * Update an existing bookmark
   */
  updateBookmark: (bookmarkId: string, updates: { title?: string; note?: string | null }) => Promise<void>;

  /**
   * Remove a bookmark
   */
  removeBookmark: (bookmarkId: string) => Promise<void>;

  /**
   * Load bookmarks for a specific book
   */
  loadBookmarks: (bookId: string) => Promise<void>;

  /**
   * Set the current book ID (called when book is loaded)
   */
  setCurrentBookId: (bookId: string | null) => void;

  /**
   * Clear all bookmarks (called on cleanup)
   */
  clearBookmarks: () => void;
}

// =============================================================================
// LOGGING
// =============================================================================

const log = createLogger('BookmarksStore');

// =============================================================================
// STORE
// =============================================================================

export const useBookmarksStore = create<BookmarksState & BookmarksActions>()(
  subscribeWithSelector((set, get) => ({
    // =========================================================================
    // INITIAL STATE
    // =========================================================================

    bookmarks: [],
    currentBookId: null,

    // =========================================================================
    // ACTIONS
    // =========================================================================

    setCurrentBookId: (bookId: string | null) => {
      set({ currentBookId: bookId });
    },

    clearBookmarks: () => {
      set({ bookmarks: [], currentBookId: null });
    },

    /**
     * FIX Bug #1: Persist first, then update state to prevent inconsistency
     * FIX Bug #2: Use UUID-style ID to prevent collision on rapid creation
     * FIX LOW: Added validation for bookmark data
     */
    addBookmark: async (bookmarkData: Omit<Bookmark, 'id' | 'createdAt'>) => {
      const { currentBookId, bookmarks } = get();
      if (!currentBookId) {
        log.warn('Cannot add bookmark: no current book');
        return;
      }

      // FIX LOW: Validate bookmark time is non-negative
      if (bookmarkData.time < 0) {
        log.warn('Cannot add bookmark: negative time value', bookmarkData.time);
        return;
      }

      // FIX LOW: Validate title is not empty
      if (!bookmarkData.title?.trim()) {
        log.warn('Cannot add bookmark: empty title');
        return;
      }

      const now = Date.now();
      // Fix Bug #2: Use unique ID instead of timestamp to prevent collision
      const bookmark: Bookmark = {
        id: `${currentBookId}_${generateUniqueId()}`,
        ...bookmarkData,
        createdAt: now,
      };

      // Fix Bug #1: Persist to SQLite FIRST
      try {
        await sqliteCache.addBookmark({
          id: bookmark.id,
          bookId: currentBookId,
          title: bookmark.title,
          note: bookmark.note,
          time: bookmark.time,
          chapterTitle: bookmark.chapterTitle,
          createdAt: bookmark.createdAt,
        });

        // Only update local state after successful persist
        const updated = [...bookmarks, bookmark];
        set({ bookmarks: updated });

        // Haptic feedback for bookmark created
        haptics.bookmarkCreated();

        log.debug('Bookmark added:', bookmark.title);
      } catch (err) {
        // Fix Bug #1: Don't update state if persist failed
        log.error('Failed to save bookmark:', err);
        throw err; // Re-throw so caller knows it failed
      }
    },

    /**
     * FIX Bug #1: Persist first, then update state
     * FIX LOW: Added validation that bookmark exists
     */
    updateBookmark: async (bookmarkId: string, updates: { title?: string; note?: string | null }) => {
      const { bookmarks } = get();

      // FIX LOW: Validate bookmark exists before updating
      const existingBookmark = bookmarks.find((b) => b.id === bookmarkId);
      if (!existingBookmark) {
        log.warn('Cannot update bookmark: not found', bookmarkId);
        return;
      }

      // FIX LOW: Validate title is not empty if provided
      if (updates.title !== undefined && !updates.title?.trim()) {
        log.warn('Cannot update bookmark: empty title');
        return;
      }

      // Fix Bug #1: Persist to SQLite FIRST
      try {
        await sqliteCache.updateBookmark(bookmarkId, updates);

        // Only update local state after successful persist
        // Fix: Use !== undefined instead of ?? so explicitly setting note to null (to clear it) works
        const updated = bookmarks.map((b) =>
          b.id === bookmarkId
            ? { ...b, title: updates.title ?? b.title, note: updates.note !== undefined ? updates.note : b.note }
            : b
        );
        set({ bookmarks: updated });

        log.debug('Bookmark updated:', bookmarkId);
      } catch (err) {
        log.error('Failed to update bookmark:', err);
        throw err; // Re-throw so caller knows it failed
      }
    },

    /**
     * FIX Bug #1: Persist first, then update state
     * FIX LOW: Added validation that bookmark exists
     */
    removeBookmark: async (bookmarkId: string) => {
      const { bookmarks } = get();

      // FIX LOW: Validate bookmark exists before removing
      const existingBookmark = bookmarks.find((b) => b.id === bookmarkId);
      if (!existingBookmark) {
        log.warn('Cannot remove bookmark: not found', bookmarkId);
        return;
      }

      // Fix Bug #1: Persist to SQLite FIRST
      try {
        await sqliteCache.removeBookmark(bookmarkId);

        // Only update local state after successful persist
        const updated = bookmarks.filter((b) => b.id !== bookmarkId);
        set({ bookmarks: updated });

        // Haptic feedback for bookmark deleted
        haptics.bookmarkDeleted();

        log.debug('Bookmark removed:', bookmarkId);
      } catch (err) {
        log.error('Failed to remove bookmark:', err);
        throw err; // Re-throw so caller knows it failed
      }
    },

    /**
     * FIX: Validate book hasn't changed during async load to prevent stale data
     */
    loadBookmarks: async (bookId: string) => {
      // Set currentBookId immediately to track which book we're loading for
      set({ currentBookId: bookId });

      try {
        const records = await sqliteCache.getBookmarks(bookId);

        // FIX: Validate that the book hasn't changed during the async load
        // This prevents loading bookmarks for the wrong book after rapid switches
        const { currentBookId: currentBook } = get();
        if (currentBook !== bookId) {
          log.debug('Book changed during bookmark load, discarding results for:', bookId);
          return;
        }

        const bookmarks: Bookmark[] = records.map((r) => ({
          id: r.id,
          title: r.title,
          note: r.note,
          time: r.time,
          chapterTitle: r.chapterTitle,
          createdAt: r.createdAt,
        }));
        set({ bookmarks });
        log.debug('Loaded', bookmarks.length, 'bookmarks for book:', bookId);
      } catch (err) {
        // Only clear bookmarks if we're still on the same book
        const { currentBookId: currentBook } = get();
        if (currentBook === bookId) {
          log.error('Failed to load bookmarks:', err);
          set({ bookmarks: [] });
        }
      }
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get all bookmarks for the current book
 */
export const useBookmarks = () => useBookmarksStore((s) => s.bookmarks);

/**
 * Get bookmark count for the current book
 */
export const useBookmarkCount = () => useBookmarksStore((s) => s.bookmarks.length);

/**
 * Get a specific bookmark by ID
 */
export const useBookmarkById = (bookmarkId: string) =>
  useBookmarksStore((s) => s.bookmarks.find((b) => b.id === bookmarkId));

/**
 * Get bookmarks sorted by time
 */
export const useBookmarksSortedByTime = () =>
  useBookmarksStore((s) => [...s.bookmarks].sort((a, b) => a.time - b.time));
