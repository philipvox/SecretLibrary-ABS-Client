/**
 * src/core/hooks/useUserBooks.ts
 *
 * Unified data access hooks for user_books table.
 * Single source of truth for progress, favorites, finished status, and per-book settings.
 * Replaces separate hooks/stores for playback_progress, favorites, marked_complete.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sqliteCache, UserBook } from '@/core/services/sqliteCache';

// Query keys for React Query cache
export const userBooksKeys = {
  all: ['user-books'] as const,
  one: (bookId: string) => ['user-books', bookId] as const,
  favorites: () => ['user-books', 'favorites'] as const,
  finished: () => ['user-books', 'finished'] as const,
  inProgress: () => ['user-books', 'in-progress'] as const,
  unsynced: () => ['user-books', 'unsynced'] as const,
};

// ============================================================================
// SINGLE BOOK HOOKS
// ============================================================================

/**
 * Get user book data for a specific book.
 * Returns null if no data exists yet.
 */
export function useUserBook(bookId: string | null | undefined) {
  return useQuery({
    queryKey: userBooksKeys.one(bookId || ''),
    queryFn: () => (bookId ? sqliteCache.getUserBook(bookId) : null),
    enabled: !!bookId,
    staleTime: 30000, // 30 seconds - local data doesn't change often
  });
}

/**
 * Get playback progress for a book.
 * Returns { currentTime, duration, progress } or defaults.
 */
export function useBookProgress(bookId: string | null | undefined) {
  const { data: userBook, isLoading } = useUserBook(bookId);

  return {
    currentTime: userBook?.currentTime ?? 0,
    duration: userBook?.duration ?? 0,
    progress: userBook?.progress ?? 0,
    currentTrackIndex: userBook?.currentTrackIndex ?? 0,
    lastPlayedAt: userBook?.lastPlayedAt,
    isLoading,
  };
}

/**
 * Get favorite status for a book.
 */
export function useIsFavorite(bookId: string | null | undefined) {
  const { data: userBook, isLoading } = useUserBook(bookId);

  return {
    isFavorite: userBook?.isFavorite ?? false,
    addedToLibraryAt: userBook?.addedToLibraryAt,
    isLoading,
  };
}

/**
 * Get finished status for a book.
 */
export function useIsFinished(bookId: string | null | undefined) {
  const { data: userBook, isLoading } = useUserBook(bookId);

  return {
    isFinished: userBook?.isFinished ?? false,
    finishSource: userBook?.finishSource,
    finishedAt: userBook?.finishedAt,
    timesCompleted: userBook?.timesCompleted ?? 0,
    isLoading,
  };
}

/**
 * Get playback speed for a book.
 */
export function useBookPlaybackSpeed(bookId: string | null | undefined) {
  const { data: userBook, isLoading } = useUserBook(bookId);

  return {
    playbackSpeed: userBook?.playbackSpeed ?? 1.0,
    isLoading,
  };
}

// ============================================================================
// COLLECTION HOOKS
// ============================================================================

/**
 * Get all favorite books.
 */
export function useFavoriteBooks() {
  return useQuery({
    queryKey: userBooksKeys.favorites(),
    queryFn: () => sqliteCache.getFavoriteUserBooks(),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get all finished books.
 */
export function useFinishedBooks() {
  return useQuery({
    queryKey: userBooksKeys.finished(),
    queryFn: () => sqliteCache.getFinishedUserBooks(),
    staleTime: 60000,
  });
}

/**
 * Get all in-progress books (started but not finished).
 */
export function useInProgressBooks() {
  return useQuery({
    queryKey: userBooksKeys.inProgress(),
    queryFn: () => sqliteCache.getInProgressUserBooks(),
    staleTime: 60000,
  });
}

/**
 * Get books that need syncing.
 */
export function useUnsyncedBooks() {
  return useQuery({
    queryKey: userBooksKeys.unsynced(),
    queryFn: () => sqliteCache.getUnsyncedUserBooks(),
    staleTime: 10000, // 10 seconds - check more frequently
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Update playback progress for a book.
 * Automatically marks progressSynced = false for background sync.
 */
export function useUpdateProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      currentTime,
      duration,
      currentTrackIndex = 0,
    }: {
      bookId: string;
      currentTime: number;
      duration: number;
      currentTrackIndex?: number;
    }) => {
      await sqliteCache.updateUserBookProgress(bookId, currentTime, duration, currentTrackIndex);
    },
    onSuccess: (_, { bookId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: userBooksKeys.one(bookId) });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.inProgress() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.unsynced() });
    },
  });
}

/**
 * Toggle favorite status for a book.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      isFavorite,
    }: {
      bookId: string;
      isFavorite: boolean;
    }) => {
      await sqliteCache.toggleUserBookFavorite(bookId, isFavorite);
    },
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: userBooksKeys.one(bookId) });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.favorites() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.unsynced() });
    },
  });
}

/**
 * Mark a book as finished.
 */
export function useMarkFinished() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      isFinished,
      source = 'manual',
    }: {
      bookId: string;
      isFinished: boolean;
      source?: 'manual' | 'progress' | 'bulk_author' | 'bulk_series';
    }) => {
      await sqliteCache.markUserBookFinished(bookId, isFinished, source as 'manual' | 'progress');
    },
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: userBooksKeys.one(bookId) });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.finished() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.inProgress() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.unsynced() });
    },
  });
}

/**
 * Bulk mark multiple books as finished.
 * Used for "mark all by author" or "mark all in series" operations.
 */
export function useBulkMarkFinished() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookIds,
      isFinished,
      source = 'manual',
    }: {
      bookIds: string[];
      isFinished: boolean;
      source?: 'manual' | 'progress' | 'bulk_author' | 'bulk_series';
    }) => {
      await sqliteCache.markUserBooksFinished(bookIds, isFinished, source);
    },
    onSuccess: () => {
      // Invalidate all book queries since multiple books changed
      queryClient.invalidateQueries({ queryKey: userBooksKeys.all });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.finished() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.inProgress() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.unsynced() });
    },
  });
}

/**
 * Set playback speed for a book.
 */
export function useSetPlaybackSpeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      speed,
    }: {
      bookId: string;
      speed: number;
    }) => {
      await sqliteCache.setUserBookPlaybackSpeed(bookId, speed);
    },
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: userBooksKeys.one(bookId) });
    },
  });
}

/**
 * Update user book with partial data.
 */
export function useUpdateUserBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (book: Partial<UserBook> & { bookId: string }) => {
      await sqliteCache.setUserBook(book);
    },
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: userBooksKeys.one(bookId) });
      // Invalidate all collections since we don't know what changed
      queryClient.invalidateQueries({ queryKey: userBooksKeys.favorites() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.finished() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.inProgress() });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.unsynced() });
    },
  });
}

/**
 * Mark user book as synced (after successful server sync).
 */
export function useMarkSynced() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookId,
      fields,
    }: {
      bookId: string;
      fields: { progress?: boolean; favorite?: boolean; finished?: boolean };
    }) => {
      await sqliteCache.markUserBookSynced(bookId, fields);
    },
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: userBooksKeys.one(bookId) });
      queryClient.invalidateQueries({ queryKey: userBooksKeys.unsynced() });
    },
  });
}

// ============================================================================
// COMBINED / CONVENIENCE HOOKS
// ============================================================================

/**
 * Combined hook for book status (favorite, finished, progress).
 * Useful for UI components that need all status at once.
 */
export function useBookStatus(bookId: string | null | undefined) {
  const { data: userBook, isLoading } = useUserBook(bookId);

  return {
    isFavorite: userBook?.isFavorite ?? false,
    isFinished: userBook?.isFinished ?? false,
    progress: userBook?.progress ?? 0,
    currentTime: userBook?.currentTime ?? 0,
    duration: userBook?.duration ?? 0,
    playbackSpeed: userBook?.playbackSpeed ?? 1.0,
    lastPlayedAt: userBook?.lastPlayedAt,
    startedAt: userBook?.startedAt,
    finishedAt: userBook?.finishedAt,
    timesCompleted: userBook?.timesCompleted ?? 0,
    isLoading,
    hasData: !!userBook,
  };
}

/**
 * Hook that provides all actions for a book in one place.
 * Convenient for components that need multiple actions.
 */
export function useBookActions(bookId: string) {
  const queryClient = useQueryClient();
  const updateProgress = useUpdateProgress();
  const toggleFavorite = useToggleFavorite();
  const markFinished = useMarkFinished();
  const setPlaybackSpeed = useSetPlaybackSpeed();

  return {
    updateProgress: useCallback(
      (currentTime: number, duration: number, trackIndex?: number) =>
        updateProgress.mutate({ bookId, currentTime, duration, currentTrackIndex: trackIndex }),
      [bookId, updateProgress]
    ),

    toggleFavorite: useCallback(
      (isFavorite: boolean) => toggleFavorite.mutate({ bookId, isFavorite }),
      [bookId, toggleFavorite]
    ),

    markFinished: useCallback(
      (isFinished: boolean, source: 'manual' | 'progress' = 'manual') =>
        markFinished.mutate({ bookId, isFinished, source }),
      [bookId, markFinished]
    ),

    setPlaybackSpeed: useCallback(
      (speed: number) => setPlaybackSpeed.mutate({ bookId, speed }),
      [bookId, setPlaybackSpeed]
    ),

    refreshBook: useCallback(
      () => queryClient.invalidateQueries({ queryKey: userBooksKeys.one(bookId) }),
      [bookId, queryClient]
    ),

    isUpdating:
      updateProgress.isPending ||
      toggleFavorite.isPending ||
      markFinished.isPending ||
      setPlaybackSpeed.isPending,
  };
}

// ============================================================================
// STATS HOOKS
// ============================================================================

/**
 * Get counts for user book collections.
 */
export function useUserBookCounts() {
  const favorites = useFavoriteBooks();
  const finished = useFinishedBooks();
  const inProgress = useInProgressBooks();

  return {
    favoriteCount: favorites.data?.length ?? 0,
    finishedCount: finished.data?.length ?? 0,
    inProgressCount: inProgress.data?.length ?? 0,
    isLoading: favorites.isLoading || finished.isLoading || inProgress.isLoading,
  };
}

// ============================================================================
// UNDO SUPPORT
// ============================================================================

interface UndoAction {
  type: 'mark' | 'unmark' | 'bulk_mark' | 'bulk_unmark';
  bookIds: string[];
  source?: 'manual' | 'bulk_author' | 'bulk_series';
  timestamp: number;
  label?: string;
}

const UNDO_TIMEOUT = 15000; // 15 seconds

/**
 * Hook for marking books as finished with undo support.
 * Maintains last action for 15 seconds to allow undo.
 */
export function useUndoableMarkFinished() {
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);
  const markFinished = useMarkFinished();
  const bulkMarkFinished = useBulkMarkFinished();

  // Clear undo action after timeout
  useEffect(() => {
    if (!lastAction) return;

    const timer = setTimeout(() => {
      setLastAction(null);
    }, UNDO_TIMEOUT);

    return () => clearTimeout(timer);
  }, [lastAction]);

  const mark = useCallback(
    async (bookId: string, source: 'manual' | 'bulk_author' | 'bulk_series' = 'manual') => {
      await markFinished.mutateAsync({ bookId, isFinished: true, source });
      setLastAction({
        type: 'mark',
        bookIds: [bookId],
        source,
        timestamp: Date.now(),
      });
    },
    [markFinished]
  );

  const unmark = useCallback(
    async (bookId: string) => {
      await markFinished.mutateAsync({ bookId, isFinished: false });
      setLastAction({
        type: 'unmark',
        bookIds: [bookId],
        timestamp: Date.now(),
      });
    },
    [markFinished]
  );

  const bulkMark = useCallback(
    async (
      bookIds: string[],
      source: 'manual' | 'bulk_author' | 'bulk_series' = 'manual',
      label?: string
    ) => {
      await bulkMarkFinished.mutateAsync({ bookIds, isFinished: true, source });
      setLastAction({
        type: 'bulk_mark',
        bookIds,
        source,
        timestamp: Date.now(),
        label,
      });
    },
    [bulkMarkFinished]
  );

  const bulkUnmark = useCallback(
    async (bookIds: string[], label?: string) => {
      await bulkMarkFinished.mutateAsync({ bookIds, isFinished: false });
      setLastAction({
        type: 'bulk_unmark',
        bookIds,
        timestamp: Date.now(),
        label,
      });
    },
    [bulkMarkFinished]
  );

  const undo = useCallback(async () => {
    if (!lastAction) return;

    // Check if still within timeout
    if (Date.now() - lastAction.timestamp > UNDO_TIMEOUT) {
      setLastAction(null);
      return;
    }

    // Reverse the action
    if (lastAction.type === 'mark') {
      await markFinished.mutateAsync({ bookId: lastAction.bookIds[0], isFinished: false });
    } else if (lastAction.type === 'unmark') {
      await markFinished.mutateAsync({ bookId: lastAction.bookIds[0], isFinished: true });
    } else if (lastAction.type === 'bulk_mark') {
      await bulkMarkFinished.mutateAsync({ bookIds: lastAction.bookIds, isFinished: false });
    } else if (lastAction.type === 'bulk_unmark') {
      await bulkMarkFinished.mutateAsync({ bookIds: lastAction.bookIds, isFinished: true });
    }

    setLastAction(null);
  }, [lastAction, markFinished, bulkMarkFinished]);

  const clearUndo = useCallback(() => {
    setLastAction(null);
  }, []);

  // Time remaining for undo (in ms)
  const undoTimeRemaining = lastAction
    ? Math.max(0, UNDO_TIMEOUT - (Date.now() - lastAction.timestamp))
    : 0;

  return {
    mark,
    unmark,
    bulkMark,
    bulkUnmark,
    undo,
    clearUndo,
    lastAction,
    canUndo: !!lastAction && undoTimeRemaining > 0,
    undoTimeRemaining,
    isProcessing: markFinished.isPending || bulkMarkFinished.isPending,
  };
}

/**
 * Get user rating for a book.
 */
export function useBookRating(bookId: string | null | undefined) {
  const { data: userBook } = useUserBook(bookId);
  return userBook?.userRating ?? null;
}

/**
 * Set user rating for a book.
 */
export function useSetBookRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, rating }: { bookId: string; rating: number }) => {
      await sqliteCache.setUserBook({ bookId, userRating: rating || null });
    },
    onSuccess: (_, { bookId }) => {
      queryClient.invalidateQueries({ queryKey: userBooksKeys.one(bookId) });
    },
  });
}

/**
 * Simple hook to check if a book is finished.
 * More efficient than useIsFinished for simple boolean checks.
 */
export function useIsBookFinished(bookId: string | null | undefined): boolean {
  const { data: userBook } = useUserBook(bookId);
  return userBook?.isFinished ?? false;
}

/**
 * Get a Set of finished book IDs for efficient lookup.
 * Useful when checking multiple books.
 * Uses useMemo for synchronous updates when query data changes.
 */
export function useFinishedBookIds(): Set<string> {
  const { data: finishedBooks = [] } = useFinishedBooks();
  return useMemo(() => new Set(finishedBooks.map((b) => b.bookId)), [finishedBooks]);
}
