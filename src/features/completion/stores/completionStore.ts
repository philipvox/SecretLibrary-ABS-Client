/**
 * src/features/completion/stores/completionStore.ts
 *
 * Zustand store for managing book completion status.
 * Allows users to manually mark books as complete/incomplete
 * independent of listen progress.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { sqliteCache } from '@/core/services/sqliteCache';
import { apiClient } from '@/core/api';
import { queryClient, queryKeys } from '@/core/queryClient';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('CompletionStore');

interface CompletionState {
  // Map of bookId -> isComplete
  completedBooks: Map<string, boolean>;
  // Loading state
  isLoading: boolean;
  // Hydrated from SQLite
  isHydrated: boolean;
}

interface CompletionActions {
  // Core actions
  markComplete: (bookId: string) => Promise<void>;
  markIncomplete: (bookId: string) => Promise<void>;
  toggleComplete: (bookId: string) => Promise<void>;

  // Queries
  isComplete: (bookId: string) => boolean;

  // Sync & hydration
  hydrate: () => Promise<void>;
  syncWithServer: (bookId: string, isComplete: boolean) => Promise<void>;
}

type CompletionStore = CompletionState & CompletionActions;

export const useCompletionStore = create<CompletionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    completedBooks: new Map(),
    isLoading: false,
    isHydrated: false,

    // Mark a book as complete
    markComplete: async (bookId: string) => {
      const { completedBooks, syncWithServer } = get();

      // Optimistic update
      const newMap = new Map(completedBooks);
      newMap.set(bookId, true);
      set({ completedBooks: newMap });

      // Persist locally
      await sqliteCache.setMarkedComplete(bookId, true);

      // Sync with server
      await syncWithServer(bookId, true);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.user.inProgress() });
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
    },

    // Mark a book as incomplete
    markIncomplete: async (bookId: string) => {
      const { completedBooks, syncWithServer } = get();

      // Optimistic update
      const newMap = new Map(completedBooks);
      newMap.set(bookId, false);
      set({ completedBooks: newMap });

      // Persist locally
      await sqliteCache.setMarkedComplete(bookId, false);

      // Sync with server
      await syncWithServer(bookId, false);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.user.inProgress() });
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
    },

    // Toggle completion status
    toggleComplete: async (bookId: string) => {
      const { isComplete, markComplete, markIncomplete } = get();

      if (isComplete(bookId)) {
        await markIncomplete(bookId);
      } else {
        await markComplete(bookId);
      }
    },

    // Check if a book is marked complete
    isComplete: (bookId: string) => {
      const { completedBooks } = get();
      return completedBooks.get(bookId) === true;
    },

    // Hydrate from SQLite on app start
    hydrate: async () => {
      if (get().isHydrated) return;

      set({ isLoading: true });

      try {
        const records = await sqliteCache.getMarkedCompleteBooks();
        const newMap = new Map<string, boolean>();

        for (const record of records) {
          newMap.set(record.itemId, record.isComplete);
        }

        set({
          completedBooks: newMap,
          isHydrated: true,
          isLoading: false
        });
      } catch (error) {
        log.error('Hydration failed:', error);
        set({ isHydrated: true, isLoading: false });
      }
    },

    // Sync completion status with server
    syncWithServer: async (bookId: string, isComplete: boolean) => {
      try {
        // Use the AudiobookShelf API to mark as finished/not-started
        if (isComplete) {
          // Mark as finished on server
          await apiClient.patch(`/api/me/progress/${bookId}`, {
            isFinished: true,
          });
        } else {
          // Mark as not finished (reset progress)
          await apiClient.patch(`/api/me/progress/${bookId}`, {
            isFinished: false,
          });
        }

        // Mark as synced locally
        await sqliteCache.markCompleteSynced(bookId);

        log.debug(`Synced ${bookId} as ${isComplete ? 'complete' : 'incomplete'}`);
      } catch (error) {
        log.error('Server sync failed:', error);
        // Local state is still valid, will retry on next app launch
      }
    },
  }))
);

// Convenience hooks
export const useIsComplete = (bookId: string) => {
  return useCompletionStore((state) => state.isComplete(bookId));
};

export const useMarkComplete = () => {
  return useCompletionStore((state) => state.markComplete);
};

export const useMarkIncomplete = () => {
  return useCompletionStore((state) => state.markIncomplete);
};

export const useToggleComplete = () => {
  return useCompletionStore((state) => state.toggleComplete);
};
