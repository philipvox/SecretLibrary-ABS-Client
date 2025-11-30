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

        -- Indexes for faster lookups
        CREATE INDEX IF NOT EXISTS idx_items_library ON library_items(library_id);
        CREATE INDEX IF NOT EXISTS idx_items_updated ON library_items(updated_at);
        CREATE INDEX IF NOT EXISTS idx_authors_library ON authors(library_id);
        CREATE INDEX IF NOT EXISTS idx_series_library ON series(library_id);
        CREATE INDEX IF NOT EXISTS idx_progress_synced ON playback_progress(synced);
      `);

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
}

// Singleton instance
export const sqliteCache = new SQLiteCache();
