/**
 * src/core/services/databaseRecoveryService.ts
 *
 * Database corruption detection and recovery service.
 * Detects SQLite database corruption and attempts recovery.
 *
 * Recovery strategies:
 * 1. PRAGMA integrity_check - Detect corruption
 * 2. Backup tables before risky operations
 * 3. Recreate corrupted tables from schema
 * 4. Restore from AsyncStorage backup (critical data)
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { trackEvent } from '@/core/monitoring';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('DatabaseRecovery');

// Database paths (SQLite stores in document directory)
const getDatabasePath = () => {
  const dbDir = `${FileSystem.documentDirectory}SQLite`;
  return `${dbDir}/abs_cache.db`;
};

export interface IntegrityCheckResult {
  isCorrupted: boolean;
  errors: string[];
  checkedAt: number;
}

export interface RecoveryResult {
  success: boolean;
  tablesRecovered: string[];
  dataLost: boolean;
  error?: string;
}

// Critical tables that should be backed up
const CRITICAL_TABLES = ['user_books', 'sync_metadata'];

// Table schemas for recreation
const TABLE_SCHEMAS: Record<string, string> = {
  user_books: `
    CREATE TABLE IF NOT EXISTS user_books (
      bookId TEXT PRIMARY KEY,
      libraryItemId TEXT,
      title TEXT,
      author TEXT,
      coverPath TEXT,
      duration REAL DEFAULT 0,
      currentTime REAL DEFAULT 0,
      progress REAL DEFAULT 0,
      currentTrackIndex INTEGER DEFAULT 0,
      isFinished INTEGER DEFAULT 0,
      finishedAt TEXT,
      finishSource TEXT,
      progressSynced INTEGER DEFAULT 1,
      isFavorite INTEGER DEFAULT 0,
      favoriteSynced INTEGER DEFAULT 1,
      lastPlayedAt TEXT,
      addedToLibraryAt TEXT,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  sync_metadata: `
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  library_items: `
    CREATE TABLE IF NOT EXISTS library_items (
      id TEXT PRIMARY KEY,
      libraryId TEXT,
      title TEXT,
      author TEXT,
      narrator TEXT,
      series TEXT,
      duration REAL,
      coverPath TEXT,
      mediaType TEXT,
      addedAt TEXT,
      updatedAt TEXT,
      data TEXT
    )
  `,
  progress_cache: `
    CREATE TABLE IF NOT EXISTS progress_cache (
      bookId TEXT PRIMARY KEY,
      currentTime REAL,
      duration REAL,
      progress REAL,
      isFinished INTEGER DEFAULT 0,
      lastUpdated TEXT
    )
  `,
};

class DatabaseRecoveryService {
  private lastIntegrityCheck: IntegrityCheckResult | null = null;
  private isRecovering: boolean = false;

  /**
   * Run SQLite integrity check on the database.
   * Returns list of errors if corruption is detected.
   */
  async checkIntegrity(): Promise<IntegrityCheckResult> {
    log.debug('Running integrity check...');

    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');
      const db = sqliteCache.getDatabase();

      if (!db) {
        log.debug('Database not initialized');
        return {
          isCorrupted: false,
          errors: ['Database not initialized'],
          checkedAt: Date.now(),
        };
      }

      // Run PRAGMA integrity_check
      const result = await db.getAllAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check'
      );

      const errors: string[] = [];
      let isCorrupted = false;

      for (const row of result) {
        if (row.integrity_check !== 'ok') {
          errors.push(row.integrity_check);
          isCorrupted = true;
        }
      }

      const checkResult: IntegrityCheckResult = {
        isCorrupted,
        errors,
        checkedAt: Date.now(),
      };

      this.lastIntegrityCheck = checkResult;

      if (isCorrupted) {
        log.error('Corruption detected:', errors);
        trackEvent('database_corruption_detected', {
          errorCount: errors.length,
          errors: errors.slice(0, 5).join('; '),
          platform: Platform.OS,
        }, 'error');
      } else {
        log.debug('Integrity check passed');
      }

      return checkResult;
    } catch (error) {
      log.error('Integrity check failed:', error);

      // If we can't even run the check, assume corruption
      const checkResult: IntegrityCheckResult = {
        isCorrupted: true,
        errors: [`Integrity check failed: ${error}`],
        checkedAt: Date.now(),
      };

      this.lastIntegrityCheck = checkResult;
      return checkResult;
    }
  }

  /**
   * Quick check if database is accessible.
   * Faster than full integrity check.
   */
  async quickHealthCheck(): Promise<boolean> {
    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');
      const db = sqliteCache.getDatabase();

      if (!db) return false;

      // Try a simple query
      await db.getFirstAsync('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to recover from database corruption.
   * This is a destructive operation that may result in data loss.
   */
  async attemptRecovery(): Promise<RecoveryResult> {
    if (this.isRecovering) {
      log.warn('Recovery already in progress');
      return {
        success: false,
        tablesRecovered: [],
        dataLost: false,
        error: 'Recovery already in progress',
      };
    }

    this.isRecovering = true;
    log.info('Attempting database recovery...');

    const tablesRecovered: string[] = [];
    let dataLost = false;

    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');

      // Step 1: Backup critical data to AsyncStorage
      log.info('Backing up critical data...');
      await this.backupCriticalData();

      // Step 2: Try to salvage data from corrupted tables
      const salvagedData = await this.salvageTableData(CRITICAL_TABLES);

      // Step 3: Close database connection
      log.info('Closing database connection...');
      await sqliteCache.close();

      // Step 4: Delete corrupted database file
      log.info('Removing corrupted database...');
      const dbPath = getDatabasePath();
      const dbInfo = await FileSystem.getInfoAsync(dbPath);

      if (dbInfo.exists) {
        // Keep a backup of corrupted file for debugging
        const backupPath = `${dbPath}.corrupted.${Date.now()}`;
        try {
          await FileSystem.moveAsync({ from: dbPath, to: backupPath });
          log.info(`Corrupted database backed up to: ${backupPath}`);
        } catch {
          // If move fails, just delete
          await FileSystem.deleteAsync(dbPath, { idempotent: true });
        }
      }

      // Also remove WAL and SHM files
      await FileSystem.deleteAsync(`${dbPath}-wal`, { idempotent: true });
      await FileSystem.deleteAsync(`${dbPath}-shm`, { idempotent: true });

      // Step 5: Reinitialize database (creates fresh tables)
      log.info('Reinitializing database...');
      await sqliteCache.initialize();

      // Step 6: Restore salvaged data
      for (const [tableName, rows] of Object.entries(salvagedData)) {
        if (rows.length > 0) {
          const restored = await this.restoreTableData(tableName, rows);
          if (restored > 0) {
            tablesRecovered.push(tableName);
            log.info(`Restored ${restored} rows to ${tableName}`);
          }
        }
      }

      // Step 7: Restore from AsyncStorage backup if needed
      if (!tablesRecovered.includes('user_books')) {
        const restoredFromBackup = await this.restoreFromBackup();
        if (restoredFromBackup > 0) {
          tablesRecovered.push('user_books (from backup)');
          log.info(`Restored ${restoredFromBackup} items from backup`);
        } else {
          dataLost = true;
        }
      }

      // Step 8: Verify recovery
      const postRecoveryCheck = await this.checkIntegrity();

      const result: RecoveryResult = {
        success: !postRecoveryCheck.isCorrupted,
        tablesRecovered,
        dataLost,
      };

      trackEvent('database_recovery_completed', {
        success: result.success,
        tablesRecovered: tablesRecovered.join(', '),
        dataLost,
        platform: Platform.OS,
      }, result.success ? 'info' : 'error');

      log.info('Recovery completed:', result);
      return result;

    } catch (error) {
      log.error('Recovery failed:', error);

      trackEvent('database_recovery_failed', {
        error: String(error),
        platform: Platform.OS,
      }, 'error');

      return {
        success: false,
        tablesRecovered,
        dataLost: true,
        error: String(error),
      };
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Backup critical data to AsyncStorage.
   * This provides a recovery point if SQLite becomes corrupted.
   */
  private async backupCriticalData(): Promise<void> {
    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const db = sqliteCache.getDatabase();

      if (!db) return;

      // Backup user_books (most critical - contains progress)
      try {
        const userBooks = await db.getAllAsync<Record<string, any>>(
          'SELECT * FROM user_books WHERE isFinished = 1 OR progress > 0'
        );

        if (userBooks.length > 0) {
          await AsyncStorage.setItem(
            'db_backup_user_books',
            JSON.stringify({
              data: userBooks,
              backedUpAt: Date.now(),
            })
          );
          log.info(`Backed up ${userBooks.length} user_books records`);
        }
      } catch {
        // Table might not exist or be corrupted
      }

    } catch (error) {
      log.error('Backup failed:', error);
    }
  }

  /**
   * Try to salvage data from potentially corrupted tables.
   * Uses LIMIT to avoid getting stuck on corrupted rows.
   */
  private async salvageTableData(
    tableNames: string[]
  ): Promise<Record<string, Record<string, any>[]>> {
    const salvaged: Record<string, Record<string, any>[]> = {};

    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');
      const db = sqliteCache.getDatabase();

      if (!db) return salvaged;

      for (const tableName of tableNames) {
        try {
          // Try to read table in chunks to salvage what we can
          const rows = await db.getAllAsync<Record<string, any>>(
            `SELECT * FROM ${tableName} LIMIT 10000`
          );
          salvaged[tableName] = rows;
          log.info(`Salvaged ${rows.length} rows from ${tableName}`);
        } catch (error) {
          log.warn(`Failed to salvage ${tableName}:`, error);
          salvaged[tableName] = [];
        }
      }
    } catch (error) {
      log.error('Salvage operation failed:', error);
    }

    return salvaged;
  }

  /**
   * Restore salvaged data to a table.
   */
  private async restoreTableData(
    tableName: string,
    rows: Record<string, any>[]
  ): Promise<number> {
    if (rows.length === 0) return 0;

    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');
      const db = sqliteCache.getDatabase();

      if (!db) return 0;

      let restored = 0;

      for (const row of rows) {
        try {
          const columns = Object.keys(row);
          const placeholders = columns.map(() => '?').join(', ');
          const values = columns.map(c => row[c]);

          await db.runAsync(
            `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            values
          );
          restored++;
        } catch {
          // Skip corrupted rows
        }
      }

      return restored;
    } catch {
      return 0;
    }
  }

  /**
   * Restore user_books from AsyncStorage backup.
   */
  private async restoreFromBackup(): Promise<number> {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const backupData = await AsyncStorage.getItem('db_backup_user_books');

      if (!backupData) return 0;

      const { data, backedUpAt } = JSON.parse(backupData);

      // Only use backup if it's less than 7 days old
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - backedUpAt > maxAge) {
        log.warn('Backup too old, skipping restore');
        return 0;
      }

      const restored = await this.restoreTableData('user_books', data);
      log.info(`Restored ${restored} records from backup (${new Date(backedUpAt).toISOString()})`);

      return restored;
    } catch (error) {
      log.error('Restore from backup failed:', error);
      return 0;
    }
  }

  /**
   * Recreate a table from schema.
   * WARNING: This will delete all data in the table.
   */
  async recreateTable(tableName: string): Promise<boolean> {
    const schema = TABLE_SCHEMAS[tableName];
    if (!schema) {
      log.warn(`Unknown table: ${tableName}`);
      return false;
    }

    try {
      const { sqliteCache } = await import('@/core/services/sqliteCache');
      const db = sqliteCache.getDatabase();

      if (!db) return false;

      // Drop and recreate
      await db.runAsync(`DROP TABLE IF EXISTS ${tableName}`);
      await db.runAsync(schema);

      log.info(`Recreated table: ${tableName}`);
      return true;
    } catch (error) {
      log.error(`Failed to recreate ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Get last integrity check result.
   */
  getLastCheckResult(): IntegrityCheckResult | null {
    return this.lastIntegrityCheck;
  }

  /**
   * Check if recovery is in progress.
   */
  isRecoveryInProgress(): boolean {
    return this.isRecovering;
  }
}

export const databaseRecoveryService = new DatabaseRecoveryService();
