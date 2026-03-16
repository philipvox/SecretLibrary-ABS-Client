/**
 * src/features/queue/stores/queueStore.ts
 *
 * Zustand store for managing playback queue.
 * Persists queue to SQLite for offline support.
 * Supports autoplay and auto-population of next series book.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LibraryItem, BookMetadata } from '@/core/types';
import { sqliteCache } from '@/core/services/sqliteCache';
import { getNextBookInSeries } from '@/core/cache/libraryCache';
import { createLogger } from '@/shared/utils/logger';

// Helper to get book metadata safely
function getBookMetadata(item: LibraryItem | null | undefined): BookMetadata | null {
  if (!item?.media?.metadata) return null;
  if (item.mediaType !== 'book') return null;
  return item.media.metadata as BookMetadata;
}

const log = createLogger('QueueStore');

const AUTOPLAY_KEY = 'queue_autoplay_enabled';

export interface QueueBook {
  id: string;
  bookId: string;
  book: LibraryItem;
  position: number;
  addedAt: number;
  played: boolean;
}

interface QueueState {
  queue: QueueBook[];
  isLoading: boolean;
  isInitialized: boolean;
  autoplayEnabled: boolean;
  autoSeriesBookId: string | null;  // ID of auto-added series book (if any)
  shouldShowClearDialog: boolean;
}

interface QueueActions {
  // Initialization
  init: () => Promise<void>;

  // Queue management
  addToQueue: (book: LibraryItem) => Promise<void>;
  addBooksToQueue: (books: LibraryItem[]) => Promise<void>;
  removeFromQueue: (bookId: string) => Promise<void>;
  clearQueue: () => Promise<void>;
  reorderQueue: (fromIndex: number, toIndex: number) => Promise<void>;

  // Autoplay & series
  setAutoplayEnabled: (enabled: boolean) => Promise<void>;
  checkAndAddSeriesBook: (currentBook: LibraryItem) => Promise<void>;

  // Playback
  playNext: () => Promise<LibraryItem | null>;
  getNextBook: () => LibraryItem | null;

  // History
  clearPlayed: () => Promise<void>;
  dismissClearDialog: () => void;

  // Queries
  isInQueue: (bookId: string) => boolean;
}

type QueueStore = QueueState & QueueActions;

export const useQueueStore = create<QueueStore>((set, get) => ({
  // State
  queue: [],
  isLoading: false,
  isInitialized: false,
  autoplayEnabled: true,  // Default to enabled
  autoSeriesBookId: null,
  shouldShowClearDialog: false,

  // Initialize store from SQLite
  init: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });
    try {
      // Load autoplay preference
      const autoplaySaved = await AsyncStorage.getItem(AUTOPLAY_KEY);
      const autoplayEnabled = autoplaySaved !== 'false';  // Default true

      const items = await sqliteCache.getQueue();
      const queue: QueueBook[] = items.map((item) => ({
        id: item.id,
        bookId: item.bookId,
        book: JSON.parse(item.bookData) as LibraryItem,
        position: item.position,
        addedAt: item.addedAt,
        played: false,  // Fresh start on app load
      }));

      set({ queue, isInitialized: true, isLoading: false, autoplayEnabled });
      log.info(`Initialized with ${queue.length} items, autoplay: ${autoplayEnabled}`);
    } catch (err) {
      log.error('Init error:', err);
      set({ isInitialized: true, isLoading: false });
    }
  },

  // Add a single book to the queue (user action)
  addToQueue: async (book: LibraryItem) => {
    const { queue, isInQueue, autoSeriesBookId } = get();

    // Don't add duplicates
    if (isInQueue(book.id)) {
      log.debug(`Book already in queue: ${book.id}`);
      return;
    }

    try {
      // If there's an auto-added series book, remove it first (user queue takes priority)
      if (autoSeriesBookId) {
        log.debug(`Clearing auto-series book: ${autoSeriesBookId}`);
        await sqliteCache.removeFromQueue(autoSeriesBookId);
        const filteredQueue = queue.filter((item) => item.bookId !== autoSeriesBookId);
        set({ queue: filteredQueue, autoSeriesBookId: null });
      }

      const currentQueue = get().queue;
      const bookData = JSON.stringify(book);
      const id = await sqliteCache.addToQueue(book.id, bookData);

      const newItem: QueueBook = {
        id,
        bookId: book.id,
        book,
        position: currentQueue.length,
        addedAt: Date.now(),
        played: false,
      };

      set({ queue: [...currentQueue, newItem] });
      log.debug(`Added to queue: ${book.id}`);
    } catch (err) {
      log.error('addToQueue error:', err);
    }
  },

  // Add multiple books to the queue (for series - user action)
  addBooksToQueue: async (books: LibraryItem[]) => {
    const { queue, isInQueue, autoSeriesBookId } = get();

    // Filter out duplicates
    const newBooks = books.filter((book) => !isInQueue(book.id));
    if (newBooks.length === 0) {
      log.debug('All books already in queue');
      return;
    }

    try {
      // If there's an auto-added series book, remove it first (user queue takes priority)
      if (autoSeriesBookId) {
        log.debug(`Clearing auto-series book: ${autoSeriesBookId}`);
        await sqliteCache.removeFromQueue(autoSeriesBookId);
        const filteredQueue = queue.filter((item) => item.bookId !== autoSeriesBookId);
        set({ queue: filteredQueue, autoSeriesBookId: null });
      }

      const currentQueue = get().queue;
      const newItems: QueueBook[] = [];
      let position = currentQueue.length;

      for (const book of newBooks) {
        const bookData = JSON.stringify(book);
        const id = await sqliteCache.addToQueue(book.id, bookData);

        newItems.push({
          id,
          bookId: book.id,
          book,
          position,
          addedAt: Date.now(),
          played: false,
        });
        position++;
      }

      set({ queue: [...currentQueue, ...newItems] });
      log.debug(`Added ${newItems.length} books to queue`);
    } catch (err) {
      log.error('addBooksToQueue error:', err);
    }
  },

  // Remove a book from the queue
  removeFromQueue: async (bookId: string) => {
    const { queue } = get();

    try {
      await sqliteCache.removeFromQueue(bookId);

      // Update local state and reindex positions
      const newQueue = queue
        .filter((item) => item.bookId !== bookId)
        .map((item, index) => ({ ...item, position: index }));

      set({ queue: newQueue });
      log.debug(`Removed from queue: ${bookId}`);
    } catch (err) {
      log.error('removeFromQueue error:', err);
    }
  },

  // Clear the entire queue
  clearQueue: async () => {
    try {
      await sqliteCache.clearQueue();
      set({ queue: [], autoSeriesBookId: null });
      log.debug('Queue cleared');
    } catch (err) {
      log.error('clearQueue error:', err);
    }
  },

  // Reorder queue items
  reorderQueue: async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const { queue } = get();
    if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) {
      return;
    }

    try {
      await sqliteCache.reorderQueue(fromIndex, toIndex);

      // Update local state
      const newQueue = [...queue];
      const [movedItem] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, movedItem);

      // Update positions
      const reindexedQueue = newQueue.map((item, index) => ({
        ...item,
        position: index,
      }));

      set({ queue: reindexedQueue });
      log.debug(`Reordered: ${fromIndex} -> ${toIndex}`);
    } catch (err) {
      log.error('reorderQueue error:', err);
    }
  },

  // Set autoplay enabled/disabled
  setAutoplayEnabled: async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(AUTOPLAY_KEY, enabled ? 'true' : 'false');
      set({ autoplayEnabled: enabled });
      log.debug(`Autoplay set to: ${enabled}`);
    } catch (err) {
      log.error('setAutoplayEnabled error:', err);
    }
  },

  // Check if current book is part of a series and add next book to queue
  checkAndAddSeriesBook: async (currentBook: LibraryItem) => {
    const { queue, autoplayEnabled, isInQueue } = get();

    const metadata = getBookMetadata(currentBook);
    log.debug('checkAndAddSeriesBook called');
    log.debug('Current book:', metadata?.title);
    log.debug('Series name:', metadata?.seriesName);
    log.debug(`Autoplay: ${autoplayEnabled}, Queue length: ${queue.length}`);

    // Only auto-add if autoplay is enabled and queue is empty
    if (!autoplayEnabled || queue.length > 0) {
      log.debug('Skipping series check - autoplay off or queue not empty');
      return;
    }

    try {
      const nextBook = getNextBookInSeries(currentBook);
      log.debug('getNextBookInSeries result:', nextBook ? getBookMetadata(nextBook)?.title : 'null');
      if (!nextBook) {
        log.debug('No next book in series found');
        return;
      }

      // Don't add if already in queue
      if (isInQueue(nextBook.id)) {
        log.debug('Next series book already in queue');
        return;
      }

      // Add to queue and mark as auto-series book
      const bookData = JSON.stringify(nextBook);
      const id = await sqliteCache.addToQueue(nextBook.id, bookData);

      const newItem: QueueBook = {
        id,
        bookId: nextBook.id,
        book: nextBook,
        position: 0,
        addedAt: Date.now(),
        played: false,
      };

      set({ queue: [newItem], autoSeriesBookId: nextBook.id });
      const nextMetadata = getBookMetadata(nextBook);
      log.info(`Auto-added next series book: ${nextMetadata?.title || nextBook.id}`);
    } catch (err) {
      log.error('checkAndAddSeriesBook error:', err);
    }
  },

  // Get the next unplayed book and mark it as played (called when book finishes)
  playNext: async () => {
    const { queue } = get();
    const nextItem = queue.find((item) => !item.played);
    if (!nextItem) {
      // All items played or queue empty — trigger clear dialog
      if (queue.length > 0) {
        set({ shouldShowClearDialog: true });
      }
      return null;
    }

    // Mark as played (keep in queue for history)
    const updatedQueue = queue.map((item) =>
      item.bookId === nextItem.bookId ? { ...item, played: true } : item
    );
    set({ queue: updatedQueue });

    log.debug(`Playing next: ${nextItem.book.id}`);
    return nextItem.book;
  },

  // Get the next unplayed book without marking it
  getNextBook: () => {
    const { queue } = get();
    const next = queue.find((item) => !item.played);
    return next ? next.book : null;
  },

  // Clear only played items from queue
  clearPlayed: async () => {
    const { queue } = get();
    const playedBookIds = queue.filter((item) => item.played).map((item) => item.bookId);

    try {
      for (const bookId of playedBookIds) {
        await sqliteCache.removeFromQueue(bookId);
      }
      const remaining = queue
        .filter((item) => !item.played)
        .map((item, index) => ({ ...item, position: index }));
      set({ queue: remaining, shouldShowClearDialog: false });
      log.debug(`Cleared ${playedBookIds.length} played items`);
    } catch (err) {
      log.error('clearPlayed error:', err);
    }
  },

  dismissClearDialog: () => {
    set({ shouldShowClearDialog: false });
  },

  // Check if a book is in the queue
  isInQueue: (bookId: string) => {
    return get().queue.some((item) => item.bookId === bookId);
  },
}));

// Selectors for optimized re-renders
export const useQueue = () => useQueueStore((state) => state.queue);
// Derived selectors — use in components with useMemo wrapping the queue
export const getUpNextQueue = (queue: QueueBook[]) => queue.filter((item) => !item.played);
export const getPlayedQueue = (queue: QueueBook[]) => queue.filter((item) => item.played);
export const useQueueCount = () => useQueueStore((state) => state.queue.length);
export const useIsInQueue = (bookId: string) =>
  useQueueStore((state) => state.queue.some((item) => item.bookId === bookId));
export const useAutoplayEnabled = () => useQueueStore((state) => state.autoplayEnabled);
export const useAutoSeriesBookId = () => useQueueStore((state) => state.autoSeriesBookId);
export const useShouldShowClearDialog = () => useQueueStore((state) => state.shouldShowClearDialog);
