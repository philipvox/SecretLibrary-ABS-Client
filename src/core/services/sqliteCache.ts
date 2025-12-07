/**
 * src/core/services/sqliteCache.ts
 *
 * SQLite-based persistent cache for offline-first architecture.
 * Provides instant data access on app startup by hydrating React Query from disk.
 */

import * as SQLite from 'expo-sqlite';
import { LibraryItem, Collection, Author } from '@/core/types';

// Types for cached data
interface CachedAuthor {
  id: string;
  name: string;
  description?: string;
  imagePath?: string;
  bookCount: number;
}

interface CachedSeries {
  id: string;
  name: string;
  description?: string;
  bookCount: number;
  totalDuration: number;
  coverUrl?: string;
}

interface CachedNarrator {
  id: string;
  name: string;
  bookCount: number;
}

interface PlaybackProgress {
  itemId: string;
  position: number;
  duration: number;
  updatedAt: number;
  synced: boolean;
}

interface SyncMetadata {
  key: string;
  value: string;
  updatedAt: number;
}

interface FavoriteItem {
  itemId: string;
  addedAt: string;
  synced: boolean;
}

interface SyncQueueItem {
  id: number;
  action: string;
  payload: string;
  createdAt: string;
  retryCount: number;
}

interface DownloadRecord {
  itemId: string;
  status: 'pending' | 'downloading' | 'complete' | 'error' | 'paused';
  progress: number;
  filePath: string | null;
  fileSize: number | null;
  downloadedAt: string | null;
  error: string | null;
}

interface SyncLogEntry {
  id: number;
  timestamp: string;
  direction: 'up' | 'down';
  entityType: string | null;
  entityId: string | null;
  status: 'success' | 'error' | 'conflict';
  details: string | null;
}

export interface QueueItem {
  id: string;
  bookId: string;
  bookData: string; // JSON serialized LibraryItem
  position: number;
  addedAt: number;
}

export interface ReadHistoryEntry {
  itemId: string;
  title: string;
  authorName: string;
  narratorName?: string;
  genres: string[];
  completedAt: number;
  timesRead: number;
  rating?: number;
}

class SQLiteCache {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database and create tables
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      console.log('[SQLiteCache] Initializing database...');
      this.db = await SQLite.openDatabaseAsync('abs_cache.db');

      // Create tables
      await this.db.execAsync(`
        -- Library items (stores full JSON for flexibility)
        CREATE TABLE IF NOT EXISTS library_items (
          id TEXT PRIMARY KEY,
          library_id TEXT NOT NULL,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        );

        -- Authors cache
        CREATE TABLE IF NOT EXISTS authors (
          id TEXT PRIMARY KEY,
          library_id TEXT NOT NULL,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Series cache
        CREATE TABLE IF NOT EXISTS series (
          id TEXT PRIMARY KEY,
          library_id TEXT NOT NULL,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Narrators cache (derived from items)
        CREATE TABLE IF NOT EXISTS narrators (
          id TEXT PRIMARY KEY,
          library_id TEXT NOT NULL,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Collections cache
        CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Playback progress (local-first, syncs in background)
        CREATE TABLE IF NOT EXISTS playback_progress (
          item_id TEXT PRIMARY KEY,
          position REAL NOT NULL,
          duration REAL NOT NULL,
          updated_at INTEGER NOT NULL,
          synced INTEGER DEFAULT 0
        );

        -- Sync metadata (last sync times, version info)
        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- Read history for recommendations (tracks completed books)
        CREATE TABLE IF NOT EXISTS read_history (
          item_id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author_name TEXT NOT NULL,
          narrator_name TEXT,
          genres TEXT NOT NULL DEFAULT '[]',
          completed_at INTEGER NOT NULL,
          times_read INTEGER NOT NULL DEFAULT 1,
          rating INTEGER
        );

        -- Favorites (local cache + offline support)
        CREATE TABLE IF NOT EXISTS favorites (
          item_id TEXT PRIMARY KEY,
          added_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        -- Sync queue for offline mutations
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT,
          entity_id TEXT,
          action TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0,
          last_error TEXT
        );

        -- Downloads (offline audio files)
        CREATE TABLE IF NOT EXISTS downloads (
          item_id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'pending',
          progress REAL DEFAULT 0,
          file_path TEXT,
          file_size INTEGER,
          downloaded_at TEXT,
          error TEXT
        );

        -- Download queue (ordered)
        CREATE TABLE IF NOT EXISTS download_queue (
          item_id TEXT PRIMARY KEY,
          priority INTEGER DEFAULT 0,
          added_at TEXT NOT NULL
        );

        -- Sync log (for debugging)
        CREATE TABLE IF NOT EXISTS sync_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          direction TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          status TEXT NOT NULL,
          details TEXT
        );

        -- Cached images
        CREATE TABLE IF NOT EXISTS image_cache (
          url TEXT PRIMARY KEY,
          file_path TEXT NOT NULL,
          cached_at TEXT NOT NULL,
          size INTEGER
        );

        -- Playback queue (ordered list of books to play next)
        CREATE TABLE IF NOT EXISTS playback_queue (
          id TEXT PRIMARY KEY,
          book_id TEXT NOT NULL,
          book_data TEXT NOT NULL,
          position INTEGER NOT NULL,
          added_at INTEGER NOT NULL
        );

        -- Indexes for faster lookups
        CREATE INDEX IF NOT EXISTS idx_items_library ON library_items(library_id);
        CREATE INDEX IF NOT EXISTS idx_items_updated ON library_items(updated_at);
        CREATE INDEX IF NOT EXISTS idx_authors_library ON authors(library_id);
        CREATE INDEX IF NOT EXISTS idx_series_library ON series(library_id);
        CREATE INDEX IF NOT EXISTS idx_progress_synced ON playback_progress(synced);
        CREATE INDEX IF NOT EXISTS idx_read_history_completed ON read_history(completed_at);
        CREATE INDEX IF NOT EXISTS idx_read_history_author ON read_history(author_name);
        CREATE INDEX IF NOT EXISTS idx_favorites_synced ON favorites(synced);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_retry ON sync_queue(retry_count);
        CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
        CREATE INDEX IF NOT EXISTS idx_download_queue_priority ON download_queue(priority DESC);
        CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_playback_queue_position ON playback_queue(position ASC);
      `);

      // Migration: Add last_played_at column if it doesn't exist
      try {
        await db.execAsync(`ALTER TABLE downloads ADD COLUMN last_played_at TEXT`);
        console.log('[SQLiteCache] Added last_played_at column to downloads');
      } catch {
        // Column already exists, ignore
      }

      this.isInitialized = true;
      console.log('[SQLiteCache] Database initialized successfully');
    } catch (err) {
      console.error('[SQLiteCache] Failed to initialize:', err);
      throw err;
    }
  }

  /**
   * Ensure database is ready before operations
   */
  private async ensureReady(): Promise<SQLite.SQLiteDatabase> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  // ============================================================================
  // LIBRARY ITEMS
  // ============================================================================

  async getLibraryItems(libraryId: string): Promise<LibraryItem[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{ data: string }>(
        'SELECT data FROM library_items WHERE library_id = ? ORDER BY updated_at DESC',
        [libraryId]
      );
      return rows.map(r => JSON.parse(r.data));
    } catch (err) {
      console.warn('[SQLiteCache] getLibraryItems error:', err);
      return [];
    }
  }

  async setLibraryItems(libraryId: string, items: LibraryItem[]): Promise<void> {
    const db = await this.ensureReady();
    const now = Date.now();

    try {
      await db.withTransactionAsync(async () => {
        // Clear existing items for this library
        await db.runAsync('DELETE FROM library_items WHERE library_id = ?', [libraryId]);

        // Insert new items in batches
        for (const item of items) {
          await db.runAsync(
            'INSERT INTO library_items (id, library_id, data, updated_at) VALUES (?, ?, ?, ?)',
            [item.id, libraryId, JSON.stringify(item), item.updatedAt || now]
          );
        }
      });

      // Update last sync time
      await this.setSyncMetadata(`items_${libraryId}`, now.toString());
      console.log(`[SQLiteCache] Cached ${items.length} library items`);
    } catch (err) {
      console.error('[SQLiteCache] setLibraryItems error:', err);
    }
  }

  async getLibraryItem(itemId: string): Promise<LibraryItem | null> {
    const db = await this.ensureReady();
    try {
      const row = await db.getFirstAsync<{ data: string }>(
        'SELECT data FROM library_items WHERE id = ?',
        [itemId]
      );
      return row ? JSON.parse(row.data) : null;
    } catch (err) {
      console.warn('[SQLiteCache] getLibraryItem error:', err);
      return null;
    }
  }

  async getLibraryItemCount(libraryId: string): Promise<number> {
    const db = await this.ensureReady();
    try {
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM library_items WHERE library_id = ?',
        [libraryId]
      );
      return result?.count || 0;
    } catch (err) {
      return 0;
    }
  }

  // ============================================================================
  // AUTHORS
  // ============================================================================

  async getAuthors(libraryId: string): Promise<CachedAuthor[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{ data: string }>(
        'SELECT data FROM authors WHERE library_id = ? ORDER BY data',
        [libraryId]
      );
      return rows.map(r => JSON.parse(r.data));
    } catch (err) {
      console.warn('[SQLiteCache] getAuthors error:', err);
      return [];
    }
  }

  async setAuthors(libraryId: string, authors: CachedAuthor[]): Promise<void> {
    const db = await this.ensureReady();
    const now = Date.now();

    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM authors WHERE library_id = ?', [libraryId]);
        for (const author of authors) {
          await db.runAsync(
            'INSERT INTO authors (id, library_id, data, updated_at) VALUES (?, ?, ?, ?)',
            [author.id, libraryId, JSON.stringify(author), now]
          );
        }
      });
      console.log(`[SQLiteCache] Cached ${authors.length} authors`);
    } catch (err) {
      console.error('[SQLiteCache] setAuthors error:', err);
    }
  }

  // ============================================================================
  // SERIES
  // ============================================================================

  async getSeries(libraryId: string): Promise<CachedSeries[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{ data: string }>(
        'SELECT data FROM series WHERE library_id = ? ORDER BY data',
        [libraryId]
      );
      return rows.map(r => JSON.parse(r.data));
    } catch (err) {
      console.warn('[SQLiteCache] getSeries error:', err);
      return [];
    }
  }

  async setSeries(libraryId: string, series: CachedSeries[]): Promise<void> {
    const db = await this.ensureReady();
    const now = Date.now();

    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM series WHERE library_id = ?', [libraryId]);
        for (const s of series) {
          await db.runAsync(
            'INSERT INTO series (id, library_id, data, updated_at) VALUES (?, ?, ?, ?)',
            [s.id, libraryId, JSON.stringify(s), now]
          );
        }
      });
      console.log(`[SQLiteCache] Cached ${series.length} series`);
    } catch (err) {
      console.error('[SQLiteCache] setSeries error:', err);
    }
  }

  // ============================================================================
  // NARRATORS
  // ============================================================================

  async getNarrators(libraryId: string): Promise<CachedNarrator[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{ data: string }>(
        'SELECT data FROM narrators WHERE library_id = ? ORDER BY data',
        [libraryId]
      );
      return rows.map(r => JSON.parse(r.data));
    } catch (err) {
      console.warn('[SQLiteCache] getNarrators error:', err);
      return [];
    }
  }

  async setNarrators(libraryId: string, narrators: CachedNarrator[]): Promise<void> {
    const db = await this.ensureReady();
    const now = Date.now();

    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM narrators WHERE library_id = ?', [libraryId]);
        for (const n of narrators) {
          await db.runAsync(
            'INSERT INTO narrators (id, library_id, data, updated_at) VALUES (?, ?, ?, ?)',
            [n.id, libraryId, JSON.stringify(n), now]
          );
        }
      });
      console.log(`[SQLiteCache] Cached ${narrators.length} narrators`);
    } catch (err) {
      console.error('[SQLiteCache] setNarrators error:', err);
    }
  }

  // ============================================================================
  // COLLECTIONS
  // ============================================================================

  async getCollections(): Promise<Collection[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{ data: string }>(
        'SELECT data FROM collections ORDER BY data'
      );
      return rows.map(r => JSON.parse(r.data));
    } catch (err) {
      console.warn('[SQLiteCache] getCollections error:', err);
      return [];
    }
  }

  async setCollections(collections: Collection[]): Promise<void> {
    const db = await this.ensureReady();
    const now = Date.now();

    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM collections');
        for (const c of collections) {
          await db.runAsync(
            'INSERT INTO collections (id, data, updated_at) VALUES (?, ?, ?)',
            [c.id, JSON.stringify(c), now]
          );
        }
      });
      console.log(`[SQLiteCache] Cached ${collections.length} collections`);
    } catch (err) {
      console.error('[SQLiteCache] setCollections error:', err);
    }
  }

  // ============================================================================
  // PLAYBACK PROGRESS (Local-first)
  // ============================================================================

  async getPlaybackProgress(itemId: string): Promise<PlaybackProgress | null> {
    const db = await this.ensureReady();
    try {
      const row = await db.getFirstAsync<PlaybackProgress>(
        'SELECT item_id as itemId, position, duration, updated_at as updatedAt, synced FROM playback_progress WHERE item_id = ?',
        [itemId]
      );
      return row || null;
    } catch (err) {
      return null;
    }
  }

  async setPlaybackProgress(
    itemId: string,
    position: number,
    duration: number,
    synced = false
  ): Promise<void> {
    const db = await this.ensureReady();
    const now = Date.now();

    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO playback_progress (item_id, position, duration, updated_at, synced)
         VALUES (?, ?, ?, ?, ?)`,
        [itemId, position, duration, now, synced ? 1 : 0]
      );
    } catch (err) {
      console.warn('[SQLiteCache] setPlaybackProgress error:', err);
    }
  }

  async getUnsyncedProgress(): Promise<PlaybackProgress[]> {
    const db = await this.ensureReady();
    try {
      return await db.getAllAsync<PlaybackProgress>(
        'SELECT item_id as itemId, position, duration, updated_at as updatedAt, synced FROM playback_progress WHERE synced = 0'
      );
    } catch (err) {
      return [];
    }
  }

  async markProgressSynced(itemId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync(
        'UPDATE playback_progress SET synced = 1 WHERE item_id = ?',
        [itemId]
      );
    } catch (err) {
      console.warn('[SQLiteCache] markProgressSynced error:', err);
    }
  }

  // ============================================================================
  // SYNC METADATA
  // ============================================================================

  async getSyncMetadata(key: string): Promise<string | null> {
    const db = await this.ensureReady();
    try {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM sync_metadata WHERE key = ?',
        [key]
      );
      return row?.value || null;
    } catch (err) {
      return null;
    }
  }

  async setSyncMetadata(key: string, value: string): Promise<void> {
    const db = await this.ensureReady();
    const now = Date.now();
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
        [key, value, now]
      );
    } catch (err) {
      console.warn('[SQLiteCache] setSyncMetadata error:', err);
    }
  }

  async getLastSyncTime(libraryId: string): Promise<number | null> {
    const value = await this.getSyncMetadata(`items_${libraryId}`);
    return value ? parseInt(value, 10) : null;
  }

  // ============================================================================
  // READ HISTORY (For Recommendations)
  // ============================================================================

  async getReadHistory(): Promise<ReadHistoryEntry[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{
        item_id: string;
        title: string;
        author_name: string;
        narrator_name: string | null;
        genres: string;
        completed_at: number;
        times_read: number;
        rating: number | null;
      }>('SELECT * FROM read_history ORDER BY completed_at DESC');

      return rows.map(r => ({
        itemId: r.item_id,
        title: r.title,
        authorName: r.author_name,
        narratorName: r.narrator_name || undefined,
        genres: JSON.parse(r.genres),
        completedAt: r.completed_at,
        timesRead: r.times_read,
        rating: r.rating || undefined,
      }));
    } catch (err) {
      console.warn('[SQLiteCache] getReadHistory error:', err);
      return [];
    }
  }

  async addToReadHistory(entry: Omit<ReadHistoryEntry, 'completedAt' | 'timesRead'>): Promise<void> {
    const db = await this.ensureReady();
    const now = Date.now();

    try {
      // Check if already exists
      const existing = await db.getFirstAsync<{ times_read: number }>(
        'SELECT times_read FROM read_history WHERE item_id = ?',
        [entry.itemId]
      );

      if (existing) {
        // Increment times_read
        await db.runAsync(
          'UPDATE read_history SET times_read = ?, completed_at = ?, rating = COALESCE(?, rating) WHERE item_id = ?',
          [existing.times_read + 1, now, entry.rating || null, entry.itemId]
        );
      } else {
        // Insert new entry
        await db.runAsync(
          `INSERT INTO read_history (item_id, title, author_name, narrator_name, genres, completed_at, times_read, rating)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
          [entry.itemId, entry.title, entry.authorName, entry.narratorName || null, JSON.stringify(entry.genres), now, entry.rating || null]
        );
      }
      console.log(`[SQLiteCache] Added to read history: ${entry.title}`);
    } catch (err) {
      console.error('[SQLiteCache] addToReadHistory error:', err);
    }
  }

  async updateReadHistoryRating(itemId: string, rating: number): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync(
        'UPDATE read_history SET rating = ? WHERE item_id = ?',
        [rating, itemId]
      );
    } catch (err) {
      console.warn('[SQLiteCache] updateReadHistoryRating error:', err);
    }
  }

  async removeFromReadHistory(itemId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('DELETE FROM read_history WHERE item_id = ?', [itemId]);
    } catch (err) {
      console.warn('[SQLiteCache] removeFromReadHistory error:', err);
    }
  }

  async getReadHistoryStats(): Promise<{
    totalBooksRead: number;
    favoriteAuthors: { name: string; count: number }[];
    favoriteNarrators: { name: string; count: number }[];
    favoriteGenres: { name: string; count: number }[];
  }> {
    const db = await this.ensureReady();
    try {
      const history = await this.getReadHistory();

      // Count authors
      const authorCounts = new Map<string, number>();
      const narratorCounts = new Map<string, number>();
      const genreCounts = new Map<string, number>();

      for (const entry of history) {
        // Authors
        authorCounts.set(entry.authorName, (authorCounts.get(entry.authorName) || 0) + entry.timesRead);

        // Narrators
        if (entry.narratorName) {
          narratorCounts.set(entry.narratorName, (narratorCounts.get(entry.narratorName) || 0) + entry.timesRead);
        }

        // Genres
        for (const genre of entry.genres) {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + entry.timesRead);
        }
      }

      const sortByCount = (map: Map<string, number>) =>
        Array.from(map.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count }));

      return {
        totalBooksRead: history.reduce((sum, e) => sum + e.timesRead, 0),
        favoriteAuthors: sortByCount(authorCounts),
        favoriteNarrators: sortByCount(narratorCounts),
        favoriteGenres: sortByCount(genreCounts),
      };
    } catch (err) {
      console.warn('[SQLiteCache] getReadHistoryStats error:', err);
      return { totalBooksRead: 0, favoriteAuthors: [], favoriteNarrators: [], favoriteGenres: [] };
    }
  }

  // ============================================================================
  // FAVORITES
  // ============================================================================

  async getFavorites(): Promise<FavoriteItem[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{
        item_id: string;
        added_at: string;
        synced: number;
      }>('SELECT item_id, added_at, synced FROM favorites ORDER BY added_at DESC');

      return rows.map((r) => ({
        itemId: r.item_id,
        addedAt: r.added_at,
        synced: r.synced === 1,
      }));
    } catch (err) {
      console.warn('[SQLiteCache] getFavorites error:', err);
      return [];
    }
  }

  async addFavorite(itemId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO favorites (item_id, added_at, synced) VALUES (?, ?, 0)',
        [itemId, new Date().toISOString()]
      );
      console.log(`[SQLiteCache] Added favorite: ${itemId}`);
    } catch (err) {
      console.warn('[SQLiteCache] addFavorite error:', err);
    }
  }

  async removeFavorite(itemId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('DELETE FROM favorites WHERE item_id = ?', [itemId]);
      console.log(`[SQLiteCache] Removed favorite: ${itemId}`);
    } catch (err) {
      console.warn('[SQLiteCache] removeFavorite error:', err);
    }
  }

  async isFavorite(itemId: string): Promise<boolean> {
    const db = await this.ensureReady();
    try {
      const row = await db.getFirstAsync<{ item_id: string }>(
        'SELECT item_id FROM favorites WHERE item_id = ?',
        [itemId]
      );
      return !!row;
    } catch (err) {
      return false;
    }
  }

  async cacheFavorites(favorites: FavoriteItem[]): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM favorites');
        for (const fav of favorites) {
          await db.runAsync(
            'INSERT INTO favorites (item_id, added_at, synced) VALUES (?, ?, 1)',
            [fav.itemId, fav.addedAt]
          );
        }
      });
      console.log(`[SQLiteCache] Cached ${favorites.length} favorites`);
    } catch (err) {
      console.error('[SQLiteCache] cacheFavorites error:', err);
    }
  }

  async getUnsyncedFavorites(): Promise<FavoriteItem[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{
        item_id: string;
        added_at: string;
        synced: number;
      }>('SELECT item_id, added_at, synced FROM favorites WHERE synced = 0');

      return rows.map((r) => ({
        itemId: r.item_id,
        addedAt: r.added_at,
        synced: false,
      }));
    } catch (err) {
      return [];
    }
  }

  async markFavoriteSynced(itemId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('UPDATE favorites SET synced = 1 WHERE item_id = ?', [itemId]);
    } catch (err) {
      console.warn('[SQLiteCache] markFavoriteSynced error:', err);
    }
  }

  // ============================================================================
  // SYNC QUEUE
  // ============================================================================

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync(
        'INSERT INTO sync_queue (action, payload, created_at, retry_count) VALUES (?, ?, ?, ?)',
        [item.action, item.payload, item.createdAt, item.retryCount]
      );
      console.log(`[SQLiteCache] Added to sync queue: ${item.action}`);
    } catch (err) {
      console.warn('[SQLiteCache] addToSyncQueue error:', err);
    }
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.ensureReady();
    try {
      return await db.getAllAsync<SyncQueueItem>(
        'SELECT id, action, payload, created_at as createdAt, retry_count as retryCount FROM sync_queue ORDER BY id ASC'
      );
    } catch (err) {
      console.warn('[SQLiteCache] getSyncQueue error:', err);
      return [];
    }
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
    } catch (err) {
      console.warn('[SQLiteCache] removeSyncQueueItem error:', err);
    }
  }

  async updateSyncQueueRetry(id: number, retryCount: number): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('UPDATE sync_queue SET retry_count = ? WHERE id = ?', [retryCount, id]);
    } catch (err) {
      console.warn('[SQLiteCache] updateSyncQueueRetry error:', err);
    }
  }

  async clearSyncQueue(): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('DELETE FROM sync_queue');
      console.log('[SQLiteCache] Cleared sync queue');
    } catch (err) {
      console.warn('[SQLiteCache] clearSyncQueue error:', err);
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  async clearLibraryCache(libraryId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM library_items WHERE library_id = ?', [libraryId]);
        await db.runAsync('DELETE FROM authors WHERE library_id = ?', [libraryId]);
        await db.runAsync('DELETE FROM series WHERE library_id = ?', [libraryId]);
        await db.runAsync('DELETE FROM narrators WHERE library_id = ?', [libraryId]);
        await db.runAsync('DELETE FROM sync_metadata WHERE key LIKE ?', [`%${libraryId}%`]);
      });
      console.log(`[SQLiteCache] Cleared cache for library: ${libraryId}`);
    } catch (err) {
      console.error('[SQLiteCache] clearLibraryCache error:', err);
    }
  }

  async clearAllCache(): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM library_items');
        await db.runAsync('DELETE FROM authors');
        await db.runAsync('DELETE FROM series');
        await db.runAsync('DELETE FROM narrators');
        await db.runAsync('DELETE FROM collections');
        await db.runAsync('DELETE FROM sync_metadata');
        // Keep playback_progress for offline use
      });
      console.log('[SQLiteCache] Cleared all cache');
    } catch (err) {
      console.error('[SQLiteCache] clearAllCache error:', err);
    }
  }

  async getCacheStats(): Promise<{
    itemCount: number;
    authorCount: number;
    seriesCount: number;
    narratorCount: number;
    collectionCount: number;
  }> {
    const db = await this.ensureReady();
    try {
      const [items, authors, series, narrators, collections] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM library_items'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM authors'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM series'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM narrators'),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM collections'),
      ]);

      return {
        itemCount: items?.count || 0,
        authorCount: authors?.count || 0,
        seriesCount: series?.count || 0,
        narratorCount: narrators?.count || 0,
        collectionCount: collections?.count || 0,
      };
    } catch (err) {
      return { itemCount: 0, authorCount: 0, seriesCount: 0, narratorCount: 0, collectionCount: 0 };
    }
  }

  // ============================================================================
  // DOWNLOADS
  // ============================================================================

  async getDownload(itemId: string): Promise<DownloadRecord | null> {
    const db = await this.ensureReady();
    try {
      const row = await db.getFirstAsync<{
        item_id: string;
        status: string;
        progress: number;
        file_path: string | null;
        file_size: number | null;
        downloaded_at: string | null;
        error: string | null;
      }>('SELECT * FROM downloads WHERE item_id = ?', [itemId]);

      if (!row) return null;
      return {
        itemId: row.item_id,
        status: row.status as DownloadRecord['status'],
        progress: row.progress,
        filePath: row.file_path,
        fileSize: row.file_size,
        downloadedAt: row.downloaded_at,
        error: row.error,
      };
    } catch (err) {
      return null;
    }
  }

  async getAllDownloads(): Promise<DownloadRecord[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{
        item_id: string;
        status: string;
        progress: number;
        file_path: string | null;
        file_size: number | null;
        downloaded_at: string | null;
        error: string | null;
      }>('SELECT * FROM downloads ORDER BY downloaded_at DESC');

      return rows.map((row) => ({
        itemId: row.item_id,
        status: row.status as DownloadRecord['status'],
        progress: row.progress,
        filePath: row.file_path,
        fileSize: row.file_size,
        downloadedAt: row.downloaded_at,
        error: row.error,
      }));
    } catch (err) {
      return [];
    }
  }

  async getDownloadsByStatus(status: DownloadRecord['status']): Promise<DownloadRecord[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{
        item_id: string;
        status: string;
        progress: number;
        file_path: string | null;
        file_size: number | null;
        downloaded_at: string | null;
        error: string | null;
      }>('SELECT * FROM downloads WHERE status = ?', [status]);

      return rows.map((row) => ({
        itemId: row.item_id,
        status: row.status as DownloadRecord['status'],
        progress: row.progress,
        filePath: row.file_path,
        fileSize: row.file_size,
        downloadedAt: row.downloaded_at,
        error: row.error,
      }));
    } catch (err) {
      return [];
    }
  }

  async setDownload(record: DownloadRecord): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO downloads (item_id, status, progress, file_path, file_size, downloaded_at, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.itemId,
          record.status,
          record.progress,
          record.filePath,
          record.fileSize,
          record.downloadedAt,
          record.error,
        ]
      );
    } catch (err) {
      console.warn('[SQLiteCache] setDownload error:', err);
    }
  }

  async updateDownloadProgress(itemId: string, progress: number): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('UPDATE downloads SET progress = ?, status = ? WHERE item_id = ?', [
        progress,
        'downloading',
        itemId,
      ]);
    } catch (err) {
      console.warn('[SQLiteCache] updateDownloadProgress error:', err);
    }
  }

  async completeDownload(itemId: string, filePath: string, fileSize: number): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync(
        `UPDATE downloads SET status = 'complete', progress = 1, file_path = ?, file_size = ?, downloaded_at = ?, error = NULL
         WHERE item_id = ?`,
        [filePath, fileSize, new Date().toISOString(), itemId]
      );
    } catch (err) {
      console.warn('[SQLiteCache] completeDownload error:', err);
    }
  }

  async failDownload(itemId: string, error: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync("UPDATE downloads SET status = 'error', error = ? WHERE item_id = ?", [
        error,
        itemId,
      ]);
    } catch (err) {
      console.warn('[SQLiteCache] failDownload error:', err);
    }
  }

  async updateDownloadLastPlayed(itemId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('UPDATE downloads SET last_played_at = ? WHERE item_id = ?', [
        new Date().toISOString(),
        itemId,
      ]);
    } catch (err) {
      console.warn('[SQLiteCache] updateDownloadLastPlayed error:', err);
    }
  }

  async deleteDownload(itemId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('DELETE FROM downloads WHERE item_id = ?', [itemId]);
      await db.runAsync('DELETE FROM download_queue WHERE item_id = ?', [itemId]);
    } catch (err) {
      console.warn('[SQLiteCache] deleteDownload error:', err);
    }
  }

  async isDownloaded(itemId: string): Promise<boolean> {
    const download = await this.getDownload(itemId);
    return download?.status === 'complete';
  }

  // Download Queue
  async addToDownloadQueue(itemId: string, priority = 0): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO download_queue (item_id, priority, added_at) VALUES (?, ?, ?)',
        [itemId, priority, new Date().toISOString()]
      );
    } catch (err) {
      console.warn('[SQLiteCache] addToDownloadQueue error:', err);
    }
  }

  async getNextDownload(): Promise<string | null> {
    const db = await this.ensureReady();
    try {
      const row = await db.getFirstAsync<{ item_id: string }>(
        'SELECT item_id FROM download_queue ORDER BY priority DESC, added_at ASC LIMIT 1'
      );
      return row?.item_id || null;
    } catch (err) {
      return null;
    }
  }

  async removeFromDownloadQueue(itemId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('DELETE FROM download_queue WHERE item_id = ?', [itemId]);
    } catch (err) {
      console.warn('[SQLiteCache] removeFromDownloadQueue error:', err);
    }
  }

  async getDownloadQueueCount(): Promise<number> {
    const db = await this.ensureReady();
    try {
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM download_queue'
      );
      return result?.count || 0;
    } catch (err) {
      return 0;
    }
  }

  // ============================================================================
  // SYNC LOG
  // ============================================================================

  async logSync(
    direction: 'up' | 'down',
    entityType: string | null,
    entityId: string | null,
    status: 'success' | 'error' | 'conflict',
    details?: string
  ): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync(
        `INSERT INTO sync_log (timestamp, direction, entity_type, entity_id, status, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [new Date().toISOString(), direction, entityType, entityId, status, details || null]
      );

      // Keep only last 1000 entries
      await db.runAsync(
        `DELETE FROM sync_log WHERE id NOT IN (
          SELECT id FROM sync_log ORDER BY timestamp DESC LIMIT 1000
        )`
      );
    } catch (err) {
      console.warn('[SQLiteCache] logSync error:', err);
    }
  }

  async getSyncLog(limit = 100): Promise<SyncLogEntry[]> {
    const db = await this.ensureReady();
    try {
      return await db.getAllAsync<SyncLogEntry>(
        `SELECT id, timestamp, direction, entity_type as entityType, entity_id as entityId, status, details
         FROM sync_log ORDER BY timestamp DESC LIMIT ?`,
        [limit]
      );
    } catch (err) {
      return [];
    }
  }

  async clearSyncLog(): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('DELETE FROM sync_log');
    } catch (err) {
      console.warn('[SQLiteCache] clearSyncLog error:', err);
    }
  }

  // ============================================================================
  // PLAYBACK QUEUE
  // ============================================================================

  async getQueue(): Promise<QueueItem[]> {
    const db = await this.ensureReady();
    try {
      const rows = await db.getAllAsync<{
        id: string;
        book_id: string;
        book_data: string;
        position: number;
        added_at: number;
      }>('SELECT * FROM playback_queue ORDER BY position ASC');

      return rows.map((r) => ({
        id: r.id,
        bookId: r.book_id,
        bookData: r.book_data,
        position: r.position,
        addedAt: r.added_at,
      }));
    } catch (err) {
      console.warn('[SQLiteCache] getQueue error:', err);
      return [];
    }
  }

  async addToQueue(bookId: string, bookData: string): Promise<string> {
    const db = await this.ensureReady();
    const id = `queue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();

    try {
      // Get max position
      const result = await db.getFirstAsync<{ maxPos: number | null }>(
        'SELECT MAX(position) as maxPos FROM playback_queue'
      );
      const nextPosition = (result?.maxPos ?? -1) + 1;

      await db.runAsync(
        'INSERT INTO playback_queue (id, book_id, book_data, position, added_at) VALUES (?, ?, ?, ?, ?)',
        [id, bookId, bookData, nextPosition, now]
      );
      console.log(`[SQLiteCache] Added to queue: ${bookId} at position ${nextPosition}`);
      return id;
    } catch (err) {
      console.warn('[SQLiteCache] addToQueue error:', err);
      throw err;
    }
  }

  async removeFromQueue(bookId: string): Promise<void> {
    const db = await this.ensureReady();
    try {
      // Get the position of the item being removed
      const item = await db.getFirstAsync<{ position: number }>(
        'SELECT position FROM playback_queue WHERE book_id = ?',
        [bookId]
      );

      if (item) {
        // Remove the item
        await db.runAsync('DELETE FROM playback_queue WHERE book_id = ?', [bookId]);

        // Reorder remaining items to fill the gap
        await db.runAsync(
          'UPDATE playback_queue SET position = position - 1 WHERE position > ?',
          [item.position]
        );
        console.log(`[SQLiteCache] Removed from queue: ${bookId}`);
      }
    } catch (err) {
      console.warn('[SQLiteCache] removeFromQueue error:', err);
    }
  }

  async isInQueue(bookId: string): Promise<boolean> {
    const db = await this.ensureReady();
    try {
      const row = await db.getFirstAsync<{ book_id: string }>(
        'SELECT book_id FROM playback_queue WHERE book_id = ?',
        [bookId]
      );
      return !!row;
    } catch (err) {
      return false;
    }
  }

  async getNextInQueue(): Promise<QueueItem | null> {
    const db = await this.ensureReady();
    try {
      const row = await db.getFirstAsync<{
        id: string;
        book_id: string;
        book_data: string;
        position: number;
        added_at: number;
      }>('SELECT * FROM playback_queue ORDER BY position ASC LIMIT 1');

      if (!row) return null;
      return {
        id: row.id,
        bookId: row.book_id,
        bookData: row.book_data,
        position: row.position,
        addedAt: row.added_at,
      };
    } catch (err) {
      return null;
    }
  }

  async clearQueue(): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.runAsync('DELETE FROM playback_queue');
      console.log('[SQLiteCache] Cleared playback queue');
    } catch (err) {
      console.warn('[SQLiteCache] clearQueue error:', err);
    }
  }

  async reorderQueue(fromPosition: number, toPosition: number): Promise<void> {
    const db = await this.ensureReady();
    try {
      await db.withTransactionAsync(async () => {
        // Get the item being moved
        const item = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM playback_queue WHERE position = ?',
          [fromPosition]
        );

        if (!item) return;

        if (fromPosition < toPosition) {
          // Moving down: shift items up
          await db.runAsync(
            'UPDATE playback_queue SET position = position - 1 WHERE position > ? AND position <= ?',
            [fromPosition, toPosition]
          );
        } else {
          // Moving up: shift items down
          await db.runAsync(
            'UPDATE playback_queue SET position = position + 1 WHERE position >= ? AND position < ?',
            [toPosition, fromPosition]
          );
        }

        // Set the moved item's new position
        await db.runAsync(
          'UPDATE playback_queue SET position = ? WHERE id = ?',
          [toPosition, item.id]
        );
      });
      console.log(`[SQLiteCache] Reordered queue: ${fromPosition} -> ${toPosition}`);
    } catch (err) {
      console.warn('[SQLiteCache] reorderQueue error:', err);
    }
  }

  async getQueueCount(): Promise<number> {
    const db = await this.ensureReady();
    try {
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM playback_queue'
      );
      return result?.count || 0;
    } catch (err) {
      return 0;
    }
  }
}

// Singleton instance
export const sqliteCache = new SQLiteCache();
