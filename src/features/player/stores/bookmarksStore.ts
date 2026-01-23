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

    addBookmark: async (bookmarkData: Omit<Bookmark, 'id' | 'createdAt'>) => {
      const { currentBookId, bookmarks } = get();
      if (!currentBookId) return;

      const now = Date.now();
      const bookmark: Bookmark = {
        id: `${currentBookId}_${now}`,
        ...bookmarkData,
        createdAt: now,
      };

      // Update local state immediately
      const updated = [...bookmarks, bookmark];
      set({ bookmarks: updated });

      // Haptic feedback for bookmark created
      haptics.bookmarkCreated();

      // Persist to SQLite
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
        log.debug('Bookmark added:', bookmark.title);
      } catch (err) {
        log.error('Failed to save bookmark:', err);
      }
    },

    updateBookmark: async (bookmarkId: string, updates: { title?: string; note?: string | null }) => {
      const { bookmarks } = get();

      // Update local state
      const updated = bookmarks.map((b) =>
        b.id === bookmarkId
          ? { ...b, title: updates.title ?? b.title, note: updates.note ?? b.note }
          : b
      );
      set({ bookmarks: updated });

      // Persist to SQLite
      try {
        await sqliteCache.updateBookmark(bookmarkId, updates);
        log.debug('Bookmark updated:', bookmarkId);
      } catch (err) {
        log.error('Failed to update bookmark:', err);
      }
    },

    removeBookmark: async (bookmarkId: string) => {
      const { bookmarks } = get();

      // Update local state
      const updated = bookmarks.filter((b) => b.id !== bookmarkId);
      set({ bookmarks: updated });

      // Haptic feedback for bookmark deleted
      haptics.bookmarkDeleted();

      // Persist to SQLite
      try {
        await sqliteCache.removeBookmark(bookmarkId);
        log.debug('Bookmark removed:', bookmarkId);
      } catch (err) {
        log.error('Failed to remove bookmark:', err);
      }
    },

    loadBookmarks: async (bookId: string) => {
      try {
        const records = await sqliteCache.getBookmarks(bookId);
        const bookmarks: Bookmark[] = records.map((r) => ({
          id: r.id,
          title: r.title,
          note: r.note,
          time: r.time,
          chapterTitle: r.chapterTitle,
          createdAt: r.createdAt,
        }));
        set({ bookmarks, currentBookId: bookId });
        log.debug('Loaded', bookmarks.length, 'bookmarks for book:', bookId);
      } catch (err) {
        log.error('Failed to load bookmarks:', err);
        set({ bookmarks: [] });
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
