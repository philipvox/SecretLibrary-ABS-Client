/**
 * src/features/player/services/backgroundSyncService.ts
 *
 * Background service for reliable progress syncing.
 * - Writes to SQLite first (instant, offline-capable)
 * - Batches server sync to reduce API calls
 * - Retries failed syncs with exponential backoff
 * - Handles app backgrounding gracefully
 */

import { AppState, AppStateStatus } from 'react-native';
import { apiClient } from '@/core/api';
import { sqliteCache } from '@/core/services/sqliteCache';
import { sessionService } from './sessionService';
import { audioLog, formatDuration, logSection } from '@/shared/utils/audioDebug';

const DEBUG = __DEV__;
const log = (...args: any[]) => audioLog.sync(args.join(' '));

interface SyncQueueItem {
  itemId: string;
  position: number;
  duration: number;
  sessionId?: string;
  retryCount: number;
  lastAttempt: number;
}

class BackgroundSyncService {
  private syncQueue: Map<string, SyncQueueItem> = new Map();
  private syncIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private appStateSubscription: any = null;
  private lastSyncTime = 0;

  // Sync configuration
  private readonly SYNC_INTERVAL = 10000; // Check every 10 seconds
  private readonly MIN_SYNC_DELAY = 5000; // Min time between syncs for same item
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 2000; // Exponential backoff base

  /**
   * Initialize background sync service
   */
  async init(): Promise<void> {
    await sqliteCache.init();

    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    log('Initialized');
  }

  /**
   * Start the background sync loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.syncIntervalId = setInterval(() => {
      this.processSyncQueue();
    }, this.SYNC_INTERVAL);

    log('Started sync loop');
  }

  /**
   * Stop the background sync loop
   */
  stop(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    this.isRunning = false;
    log('Stopped sync loop');
  }

  /**
   * Save progress locally and queue for server sync
   * This is the main entry point for progress updates
   */
  async saveProgress(
    itemId: string,
    position: number,
    duration: number,
    sessionId?: string
  ): Promise<void> {
    log(`saveProgress: ${itemId} @ ${formatDuration(position)}`);

    // STEP 1: Write to SQLite immediately (fast, offline-capable)
    log('  Writing to SQLite...');
    await sqliteCache.setPlaybackProgress(itemId, position, duration, false);

    // STEP 2: Queue for server sync (batched, debounced)
    const existing = this.syncQueue.get(itemId);

    // Debounce: only queue if enough time has passed or position changed significantly
    const positionDelta = existing ? Math.abs(existing.position - position) : Infinity;
    const timeSinceLastAttempt = existing ? Date.now() - existing.lastAttempt : Infinity;
    const shouldQueue =
      !existing ||
      positionDelta > 10 || // Position changed by 10+ seconds
      timeSinceLastAttempt > this.MIN_SYNC_DELAY;

    if (shouldQueue) {
      log(`  Queuing for sync (delta: ${positionDelta.toFixed(1)}s, timeSince: ${timeSinceLastAttempt}ms)`);
      this.syncQueue.set(itemId, {
        itemId,
        position,
        duration,
        sessionId,
        retryCount: 0,
        lastAttempt: Date.now(),
      });
      log(`  Queue size: ${this.syncQueue.size}`);
    } else {
      log('  Skipped queue (debounced)');
    }
  }

  /**
   * Force immediate sync for critical operations (e.g., app backgrounding)
   */
  async forceSyncAll(): Promise<void> {
    logSection('FORCE SYNC ALL');
    log(`Queue size: ${this.syncQueue.size}`);

    const items = Array.from(this.syncQueue.values());
    log(`Syncing ${items.length} items from queue`);

    await Promise.all(items.map(item => this.syncToServer(item)));

    // Also sync any unsynced items from SQLite
    log('Checking SQLite for unsynced items...');
    await this.syncUnsyncedFromStorage();

    log('Force sync complete');
  }

  /**
   * Process the sync queue - called periodically
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.size === 0) {
      // Check SQLite for unsynced items
      await this.syncUnsyncedFromStorage();
      return;
    }

    const now = Date.now();
    const itemsToSync: SyncQueueItem[] = [];

    for (const [itemId, item] of this.syncQueue.entries()) {
      // Check if enough time has passed since last attempt
      const timeSinceAttempt = now - item.lastAttempt;
      const requiredDelay = item.retryCount > 0
        ? this.RETRY_DELAY_BASE * Math.pow(2, item.retryCount - 1)
        : 0;

      if (timeSinceAttempt >= requiredDelay) {
        itemsToSync.push(item);
      }
    }

    // Sync items
    for (const item of itemsToSync) {
      await this.syncToServer(item);
    }
  }

  /**
   * Sync a single item to the server
   */
  private async syncToServer(item: SyncQueueItem): Promise<boolean> {
    log(`syncToServer: ${item.itemId}`);
    log(`  Position: ${formatDuration(item.position)}`);
    log(`  Session ID: ${item.sessionId || 'none'}`);
    log(`  Retry count: ${item.retryCount}/${this.MAX_RETRIES}`);

    try {
      // Try session sync first (more accurate)
      if (item.sessionId) {
        audioLog.network('POST', `/api/session/${item.sessionId}/sync`);
        await apiClient.post(`/api/session/${item.sessionId}/sync`, {
          currentTime: item.position,
          timeListened: 0,
        });
        log('  Session sync successful');
      } else {
        // Fallback: update item progress directly
        audioLog.network('PATCH', `/api/me/progress/${item.itemId}`);
        await apiClient.patch(`/api/me/progress/${item.itemId}`, {
          currentTime: item.position,
          duration: item.duration,
          progress: item.duration > 0 ? item.position / item.duration : 0,
        });
        log('  Direct progress update successful');
      }

      // Success - mark as synced in SQLite and remove from queue
      await sqliteCache.markProgressSynced(item.itemId);
      this.syncQueue.delete(item.itemId);

      log(`  Synced: ${item.itemId} @ ${formatDuration(item.position)}`);
      return true;
    } catch (error: any) {
      // Handle failure
      item.retryCount++;
      item.lastAttempt = Date.now();

      audioLog.warn(`Sync failed for ${item.itemId}: ${error.message}`);

      if (item.retryCount >= this.MAX_RETRIES) {
        audioLog.warn(`Max retries (${this.MAX_RETRIES}) reached for ${item.itemId}, keeping in SQLite for later`);
        this.syncQueue.delete(item.itemId);
        // Keep in SQLite as unsynced for future retry
      } else {
        log(`  Will retry (${item.retryCount}/${this.MAX_RETRIES})`);
      }
      return false;
    }
  }

  /**
   * Sync any unsynced items from SQLite storage
   */
  private async syncUnsyncedFromStorage(): Promise<void> {
    try {
      const unsynced = await sqliteCache.getUnsyncedProgress();

      if (unsynced.length === 0) return;

      log(`Found ${unsynced.length} unsynced items in SQLite`);

      for (const item of unsynced) {
        // Add to queue if not already there
        if (!this.syncQueue.has(item.itemId)) {
          this.syncQueue.set(item.itemId, {
            itemId: item.itemId,
            position: item.position,
            duration: item.duration,
            retryCount: 0,
            lastAttempt: 0, // Process immediately
          });
        }
      }
    } catch (error) {
      log('Error checking unsynced storage:', error);
    }
  }

  /**
   * Handle app state changes (backgrounding/foregrounding)
   */
  private handleAppStateChange(nextState: AppStateStatus): void {
    log(`App state change: ${nextState}`);

    if (nextState === 'background' || nextState === 'inactive') {
      // App going to background - force sync
      logSection('APP BACKGROUNDING');
      log('Forcing sync before background...');
      this.forceSyncAll();
    } else if (nextState === 'active') {
      // App coming to foreground - check for unsynced
      logSection('APP FOREGROUNDING');
      log('Checking for unsynced progress...');
      this.syncUnsyncedFromStorage();
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    log('Destroyed');
  }

  /**
   * Get current sync status
   */
  getStatus(): { queueSize: number; isRunning: boolean } {
    return {
      queueSize: this.syncQueue.size,
      isRunning: this.isRunning,
    };
  }
}

// Singleton instance
export const backgroundSyncService = new BackgroundSyncService();
