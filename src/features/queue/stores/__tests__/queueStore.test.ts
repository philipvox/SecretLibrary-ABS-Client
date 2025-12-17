/**
 * src/features/queue/stores/__tests__/queueStore.test.ts
 *
 * Tests for queue store state management logic.
 * Tests the synchronous parts of the store.
 */

import { LibraryItem } from '@/core/types';

// Mock all dependencies before importing the store
jest.mock('@/core/services/sqliteCache', () => ({
  sqliteCache: {
    getQueue: jest.fn().mockResolvedValue([]),
    addToQueue: jest.fn().mockResolvedValue('queue-item-1'),
    removeFromQueue: jest.fn().mockResolvedValue(undefined),
    clearQueue: jest.fn().mockResolvedValue(undefined),
    reorderQueue: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/core/cache/libraryCache', () => ({
  getNextBookInSeries: jest.fn().mockReturnValue(null),
}));

describe('queueStore - state management', () => {
  // Create a fresh store for each test to avoid state pollution
  let useQueueStore: any;

  const createMockBook = (id: string, title: string): LibraryItem => ({
    id,
    ino: `ino-${id}`,
    libraryId: 'lib-1',
    folderId: 'folder-1',
    path: `/path/to/${id}`,
    relPath: id,
    isFile: false,
    mtimeMs: Date.now(),
    ctimeMs: Date.now(),
    birthtimeMs: Date.now(),
    addedAt: Date.now(),
    updatedAt: Date.now(),
    lastScan: Date.now(),
    scanVersion: '1.0.0',
    isMissing: false,
    isInvalid: false,
    mediaType: 'book',
    media: {
      id: `media-${id}`,
      metadata: { title, authorName: 'Test Author' } as any,
      audioFiles: [],
      chapters: [],
      duration: 3600,
      size: 100000000,
      tags: [],
    },
    libraryFiles: [],
  });

  const book1 = createMockBook('book-1', 'First Book');
  const book2 = createMockBook('book-2', 'Second Book');
  const book3 = createMockBook('book-3', 'Third Book');

  beforeEach(() => {
    // Clear module cache to get fresh store
    jest.resetModules();
    // Re-import after reset
    const storeModule = require('../queueStore');
    useQueueStore = storeModule.useQueueStore;
  });

  describe('initial state', () => {
    it('starts with empty queue', () => {
      const state = useQueueStore.getState();
      expect(state.queue).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(false);
      expect(state.autoplayEnabled).toBe(true);
      expect(state.autoSeriesBookId).toBeNull();
    });
  });

  describe('isInQueue', () => {
    it('returns false for empty queue', () => {
      expect(useQueueStore.getState().isInQueue('any-book')).toBe(false);
    });

    it('returns true when book is in queue', () => {
      // Manually set queue state
      useQueueStore.setState({
        queue: [{
          id: 'q1',
          bookId: 'book-1',
          book: book1,
          position: 0,
          addedAt: Date.now(),
        }],
      });

      expect(useQueueStore.getState().isInQueue('book-1')).toBe(true);
    });

    it('returns false when book is not in queue', () => {
      useQueueStore.setState({
        queue: [{
          id: 'q1',
          bookId: 'book-1',
          book: book1,
          position: 0,
          addedAt: Date.now(),
        }],
      });

      expect(useQueueStore.getState().isInQueue('book-2')).toBe(false);
    });
  });

  describe('getNextBook', () => {
    it('returns null for empty queue', () => {
      expect(useQueueStore.getState().getNextBook()).toBeNull();
    });

    it('returns first book in queue', () => {
      useQueueStore.setState({
        queue: [
          { id: 'q1', bookId: 'book-1', book: book1, position: 0, addedAt: Date.now() },
          { id: 'q2', bookId: 'book-2', book: book2, position: 1, addedAt: Date.now() },
        ],
      });

      const nextBook = useQueueStore.getState().getNextBook();
      expect(nextBook).not.toBeNull();
      expect(nextBook.id).toBe('book-1');
    });

    it('does not remove book from queue', () => {
      useQueueStore.setState({
        queue: [
          { id: 'q1', bookId: 'book-1', book: book1, position: 0, addedAt: Date.now() },
        ],
      });

      useQueueStore.getState().getNextBook();
      expect(useQueueStore.getState().queue.length).toBe(1);
    });
  });

  describe('setState - queue manipulation', () => {
    it('can manually add items to queue', () => {
      useQueueStore.setState({
        queue: [
          { id: 'q1', bookId: 'book-1', book: book1, position: 0, addedAt: Date.now() },
        ],
      });

      expect(useQueueStore.getState().queue.length).toBe(1);
    });

    it('can manually clear queue', () => {
      useQueueStore.setState({
        queue: [
          { id: 'q1', bookId: 'book-1', book: book1, position: 0, addedAt: Date.now() },
          { id: 'q2', bookId: 'book-2', book: book2, position: 1, addedAt: Date.now() },
        ],
      });

      useQueueStore.setState({ queue: [] });
      expect(useQueueStore.getState().queue.length).toBe(0);
    });

    it('maintains order when set', () => {
      useQueueStore.setState({
        queue: [
          { id: 'q1', bookId: 'book-1', book: book1, position: 0, addedAt: 1 },
          { id: 'q2', bookId: 'book-2', book: book2, position: 1, addedAt: 2 },
          { id: 'q3', bookId: 'book-3', book: book3, position: 2, addedAt: 3 },
        ],
      });

      const queue = useQueueStore.getState().queue;
      expect(queue[0].bookId).toBe('book-1');
      expect(queue[1].bookId).toBe('book-2');
      expect(queue[2].bookId).toBe('book-3');
    });
  });

  describe('autoplay state', () => {
    it('defaults to enabled', () => {
      expect(useQueueStore.getState().autoplayEnabled).toBe(true);
    });

    it('can be set to disabled', () => {
      useQueueStore.setState({ autoplayEnabled: false });
      expect(useQueueStore.getState().autoplayEnabled).toBe(false);
    });

    it('can be toggled', () => {
      useQueueStore.setState({ autoplayEnabled: false });
      useQueueStore.setState({ autoplayEnabled: true });
      expect(useQueueStore.getState().autoplayEnabled).toBe(true);
    });
  });

  describe('autoSeriesBookId', () => {
    it('defaults to null', () => {
      expect(useQueueStore.getState().autoSeriesBookId).toBeNull();
    });

    it('can be set when series book is auto-added', () => {
      useQueueStore.setState({ autoSeriesBookId: 'series-book-1' });
      expect(useQueueStore.getState().autoSeriesBookId).toBe('series-book-1');
    });

    it('can be cleared', () => {
      useQueueStore.setState({ autoSeriesBookId: 'series-book-1' });
      useQueueStore.setState({ autoSeriesBookId: null });
      expect(useQueueStore.getState().autoSeriesBookId).toBeNull();
    });
  });

  describe('loading state', () => {
    it('defaults to not loading', () => {
      expect(useQueueStore.getState().isLoading).toBe(false);
    });

    it('can be set to loading', () => {
      useQueueStore.setState({ isLoading: true });
      expect(useQueueStore.getState().isLoading).toBe(true);
    });
  });

  describe('initialized state', () => {
    it('defaults to not initialized', () => {
      expect(useQueueStore.getState().isInitialized).toBe(false);
    });

    it('can be set to initialized', () => {
      useQueueStore.setState({ isInitialized: true });
      expect(useQueueStore.getState().isInitialized).toBe(true);
    });
  });

  describe('QueueBook structure', () => {
    it('queue items have required properties', () => {
      const queueItem = {
        id: 'q1',
        bookId: 'book-1',
        book: book1,
        position: 0,
        addedAt: Date.now(),
      };

      useQueueStore.setState({ queue: [queueItem] });

      const item = useQueueStore.getState().queue[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('bookId');
      expect(item).toHaveProperty('book');
      expect(item).toHaveProperty('position');
      expect(item).toHaveProperty('addedAt');
    });

    it('book property contains full LibraryItem', () => {
      useQueueStore.setState({
        queue: [{
          id: 'q1',
          bookId: 'book-1',
          book: book1,
          position: 0,
          addedAt: Date.now(),
        }],
      });

      const queuedBook = useQueueStore.getState().queue[0].book;
      expect(queuedBook.id).toBe('book-1');
      expect(queuedBook.media.metadata.title).toBe('First Book');
    });
  });
});
