/**
 * src/features/player/stores/completionSheetStore.ts
 *
 * Book completion management store.
 * Extracted from playerStore.ts for modularity (Phase 6 refactor).
 *
 * Features:
 * - Completion prompt preferences
 * - Auto-mark finished functionality
 * - Completion sheet state management
 * - Server sync and queue coordination
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sqliteCache } from '@/core/services/sqliteCache';
import { haptics } from '@/core/native/haptics';
import type { LibraryItem } from '@/core/types';

// =============================================================================
// LOGGING
// =============================================================================

import { createLogger } from '@/shared/utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const SHOW_COMPLETION_PROMPT_KEY = 'playerShowCompletionPrompt';
const AUTO_MARK_FINISHED_KEY = 'playerAutoMarkFinished';

// =============================================================================
// TYPES
// =============================================================================

interface CompletionState {
  showCompletionPrompt: boolean;          // Show prompt when book ends (default true)
  autoMarkFinished: boolean;              // Auto-mark books finished when prompt disabled (default false)
  showCompletionSheet: boolean;           // Currently showing completion sheet (transient)
  completionSheetBook: LibraryItem | null; // Book that just finished (for completion sheet)
}

interface CompletionActions {
  /**
   * Set whether to show completion prompt when book ends
   */
  setShowCompletionPrompt: (enabled: boolean) => Promise<void>;

  /**
   * Set whether to auto-mark books as finished when prompt is disabled
   */
  setAutoMarkFinished: (enabled: boolean) => Promise<void>;

  /**
   * Show the completion sheet for a book
   */
  showCompletionForBook: (book: LibraryItem) => void;

  /**
   * Dismiss the completion sheet
   */
  dismissCompletionSheet: () => void;

  /**
   * Mark a book as finished
   * @param bookId - Book ID to mark finished
   * @param duration - Total book duration (for progress update)
   * @param currentBook - Current book object (for reading history)
   */
  markBookFinished: (
    bookId: string,
    duration: number,
    currentBook: LibraryItem | null
  ) => Promise<void>;

  /**
   * Load completion settings from storage
   */
  loadCompletionSettings: () => Promise<void>;
}

const log = createLogger('CompletionSheetStore');

// =============================================================================
// STORE
// =============================================================================

export const useCompletionSheetStore = create<CompletionState & CompletionActions>()(
  subscribeWithSelector((set, _get) => ({
    // =========================================================================
    // INITIAL STATE
    // =========================================================================

    showCompletionPrompt: true,   // Show prompt when book ends
    autoMarkFinished: false,      // Auto-mark when prompt is disabled
    showCompletionSheet: false,   // Currently showing completion sheet
    completionSheetBook: null,    // Book that just finished

    // =========================================================================
    // ACTIONS
    // =========================================================================

    setShowCompletionPrompt: async (enabled: boolean) => {
      set({ showCompletionPrompt: enabled });
      try {
        await AsyncStorage.setItem(SHOW_COMPLETION_PROMPT_KEY, enabled.toString());
        log.debug('Show completion prompt set to:', enabled);
      } catch (err) {
        // Fix Low #3: Log storage errors
        log.debug('Failed to persist showCompletionPrompt setting:', err);
      }
    },

    setAutoMarkFinished: async (enabled: boolean) => {
      set({ autoMarkFinished: enabled });
      try {
        await AsyncStorage.setItem(AUTO_MARK_FINISHED_KEY, enabled.toString());
        log.debug('Auto-mark finished set to:', enabled);
      } catch (err) {
        // Fix Low #3: Log storage errors
        log.debug('Failed to persist autoMarkFinished setting:', err);
      }
    },

    showCompletionForBook: (book: LibraryItem) => {
      log.debug('Showing completion sheet for:', book.id);
      set({ showCompletionSheet: true, completionSheetBook: book });
    },

    dismissCompletionSheet: () => {
      set({ showCompletionSheet: false, completionSheetBook: null });
      log.debug('Sheet dismissed');
    },

    markBookFinished: async (
      bookId: string,
      duration: number,
      currentBook: LibraryItem | null
    ) => {
      log.debug('Marking book as finished:', bookId);

      try {
        // Provide haptic feedback
        haptics.bookmarkCreated(); // Reuse success haptic

        // Mark as finished in local SQLite (single source of truth)
        await sqliteCache.markUserBookFinished(bookId, true, 'progress');
        log.debug('Marked as finished in SQLite');

        // Sync to server (don't await - runs in background)
        import('@/core/services/finishedBooksSync').then(({ finishedBooksSync }) => {
          finishedBooksSync.syncBook(bookId, true, duration);
        }).catch((err) => {
          log.debug('Background sync failed:', err);
        });

        // Update local progress to 100%
        if (duration > 0) {
          await sqliteCache.setPlaybackProgress(bookId, duration, duration, false);
        }

        // Add to reading history
        if (currentBook?.id === bookId) {
          const metadata = currentBook.media?.metadata as any;
          if (metadata) {
            await sqliteCache.addToReadHistory({
              itemId: bookId,
              title: metadata.title || 'Unknown Title',
              authorName: metadata.authorName || metadata.authors?.[0]?.name || 'Unknown Author',
              narratorName: metadata.narratorName || metadata.narrators?.[0]?.name,
              genres: metadata.genres || [],
            });
            log.debug('Added to reading history');
          }
        }

        // Remove from queue if present, then auto-advance to next queued book
        try {
          const { useQueueStore } = await import('@/features/queue/stores/queueStore');
          const queueStore = useQueueStore.getState();
          if (queueStore.isInQueue(bookId)) {
            await queueStore.removeFromQueue(bookId);
            log.debug('Removed from queue');
          }

          // Auto-advance: play next book in queue (only if user hasn't started a different book)
          const nextBook = await queueStore.playNext();
          if (nextBook) {
            const { usePlayerStore } = await import('@/features/player/stores');
            const currentlyPlaying = usePlayerStore.getState().currentBook;
            if (!currentlyPlaying || currentlyPlaying.id === bookId) {
              log.debug('Auto-advancing to next queued book:', nextBook.id);
              usePlayerStore.getState().loadBook(nextBook, { autoPlay: true, showPlayer: false });
            } else {
              log.debug('Skipping auto-advance — user is already playing a different book');
            }
          }
        } catch (err) {
          log.debug('Queue advance failed:', err);
        }

        // Dismiss the completion sheet only after all critical operations succeed
        set({ showCompletionSheet: false, completionSheetBook: null });

        log.debug('Book marked as finished successfully');
      } catch (err) {
        log.error('Failed to mark book as finished:', err);
        // Dismiss sheet but keep book reference so user can retry from UI
        set({ showCompletionSheet: false });
      }
    },

    loadCompletionSettings: async () => {
      try {
        const [showCompletionPromptStr, autoMarkFinishedStr] = await Promise.all([
          AsyncStorage.getItem(SHOW_COMPLETION_PROMPT_KEY),
          AsyncStorage.getItem(AUTO_MARK_FINISHED_KEY),
        ]);

        const showCompletionPrompt = showCompletionPromptStr !== 'false'; // Default true
        const autoMarkFinished = autoMarkFinishedStr === 'true'; // Default false

        set({ showCompletionPrompt, autoMarkFinished });
        log.debug('Loaded settings - showPrompt:', showCompletionPrompt, 'autoMark:', autoMarkFinished);
      } catch (error) {
        log.debug('Error loading settings:', error);
        // Use defaults
      }
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get showCompletionPrompt preference
 */
export const useShowCompletionPrompt = () =>
  useCompletionSheetStore((s) => s.showCompletionPrompt);

/**
 * Get autoMarkFinished preference
 */
export const useAutoMarkFinished = () =>
  useCompletionSheetStore((s) => s.autoMarkFinished);

/**
 * Get whether completion sheet is showing
 */
export const useIsCompletionSheetVisible = () =>
  useCompletionSheetStore((s) => s.showCompletionSheet);

/**
 * Get the book that just finished (for completion sheet)
 */
export const useCompletionSheetBook = () =>
  useCompletionSheetStore((s) => s.completionSheetBook);

/**
 * Get full completion state for UI
 * Uses useShallow to prevent unnecessary re-renders when object reference changes
 */
export const useCompletionState = () =>
  useCompletionSheetStore(
    useShallow((s) => ({
      showCompletionPrompt: s.showCompletionPrompt,
      autoMarkFinished: s.autoMarkFinished,
      showCompletionSheet: s.showCompletionSheet,
      completionSheetBook: s.completionSheetBook,
    }))
  );
