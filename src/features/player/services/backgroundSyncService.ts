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
import { trackEvent } from '@/core/monitoring';
import { eventBus } from '@/core/events';

const DEBUG = __DEV__;
const log = (...args: any[]) => audioLog.sync(args.join(' '));

interface SyncQueueItem {
  itemId: string;
  position: number;
  duration: number;
  sessionId?: string;
  retryCount: number;
  lastAttempt: number;
  localUpdatedAt: number; // Local timestamp for conflict detection
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
  private readonly SYNC_CONCURRENCY = 5; // Parallel sync requests

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
      const now = Date.now();
      log(`  Queuing for sync (delta: ${positionDelta.toFixed(1)}s, timeSince: ${timeSinceLastAttempt}ms)`);
      this.syncQueue.set(itemId, {
        itemId,
        position,
        duration,
        sessionId,
        retryCount: 0,
        lastAttempt: now,
        localUpdatedAt: now, // Track when this progress was recorded locally
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
   * Uses parallel processing with concurrency limit for better performance.
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

    if (itemsToSync.length === 0) return;

    // Process items in parallel with concurrency limit
    log(`Processing ${itemsToSync.length} items (concurrency: ${this.SYNC_CONCURRENCY})`);
    await this.processWithConcurrency(itemsToSync, this.SYNC_CONCURRENCY);
  }

  /**
   * Process items in parallel with a concurrency limit.
   * This is 5x faster than sequential processing for large queues.
   */
  private async processWithConcurrency(
    items: SyncQueueItem[],
    concurrency: number
  ): Promise<void> {
    const queue = [...items];
    const inProgress: Promise<void>[] = [];
    let succeeded = 0;
    let failed = 0;

    while (queue.length > 0 || inProgress.length > 0) {
      // Fill up to concurrency limit
      while (inProgress.length < concurrency && queue.length > 0) {
        const item = queue.shift()!;

        const promise = this.syncToServer(item)
          .then((success) => {
            if (success) succeeded++;
            else failed++;
          })
          .catch(() => {
            failed++;
          })
          .finally(() => {
            // Remove from inProgress
            const index = inProgress.indexOf(promise);
            if (index > -1) inProgress.splice(index, 1);
          });

        inProgress.push(promise);
      }

      // Wait for at least one to complete
      if (inProgress.length > 0) {
        await Promise.race(inProgress);
      }
    }

    log(`Sync batch complete: ${succeeded} succeeded, ${failed} failed`);
  }

  /**
   * Sync a single item to the server
   */
  private async syncToServer(item: SyncQueueItem): Promise<boolean> {
    log(`syncToServer: ${item.itemId}`);
    log(`  Position: ${formatDuration(item.position)}`);
    log(`  Session ID: ${item.sessionId || 'none'}`);
    log(`  Retry count: ${item.retryCount}/${this.MAX_RETRIES}`);
    log(`  Local updated: ${new Date(item.localUpdatedAt).toISOString()}`);

    try {
      // ============================================================
      // CONFLICT DETECTION: Check server timestamp before syncing
      // ============================================================
      let serverProgress: { lastUpdate: number; currentTime: number } | null = null;
      try {
        audioLog.network('GET', `/api/me/progress/${item.itemId}`);
        serverProgress = await apiClient.get(`/api/me/progress/${item.itemId}`);
      } catch (fetchError: any) {
        // 404 means no server progress exists - safe to create
        if (fetchError.message !== 'Resource not found') {
          log(`  Warning: Could not fetch server progress: ${fetchError.message}`);
          // Continue anyway - we'll try to sync
        }
      }

      if (serverProgress && serverProgress.lastUpdate > item.localUpdatedAt) {
        // SERVER IS NEWER - conflict detected
        const serverDate = new Date(serverProgress.lastUpdate).toISOString();
        const localDate = new Date(item.localUpdatedAt).toISOString();
        const serverPos = formatDuration(serverProgress.currentTime);
        const localPos = formatDuration(item.position);

        audioLog.warn(`CONFLICT: Server progress is newer for ${item.itemId}`);
        log(`  Server: ${serverPos} @ ${serverDate}`);
        log(`  Local:  ${localPos} @ ${localDate}`);
        log(`  Resolution: Keeping server version (last-write-wins)`);

        trackEvent('sync_conflict_detected', {
          item_id: item.itemId,
          server_time: serverProgress.lastUpdate,
          local_time: item.localUpdatedAt,
          server_position: serverProgress.currentTime,
          local_position: item.position,
          resolution: 'server_wins',
        }, 'warning');

        // Emit conflict event for UI/listeners
        eventBus.emit('progress:conflict', {
          bookId: item.itemId,
          localPosition: item.position,
          serverPosition: serverProgress.currentTime,
          winner: 'server',
        });

        // Update local cache with server's value (if valid)
        // Guard against undefined/null/NaN positions from server
        const serverPosition = serverProgress.currentTime;
        if (typeof serverPosition === 'number' && !isNaN(serverPosition)) {
          await sqliteCache.setPlaybackProgress(
            item.itemId,
            serverPosition,
            item.duration,
            true // Mark as synced
          );
        } else {
          // Server has newer timestamp but invalid position - just mark synced
          log(`  Server position invalid (${serverPosition}), keeping local and marking synced`);
          await sqliteCache.markProgressSynced(item.itemId);
        }

        this.syncQueue.delete(item.itemId);
        return true; // Resolved successfully (by accepting server)
      }

      // LOCAL IS NEWER (or no server progress) - proceed with upload
      let syncedViaSession = false;

      // Try session sync first (more accurate)
      if (item.sessionId) {
        try {
          audioLog.network('POST', `/api/session/${item.sessionId}/sync`);
          await apiClient.post(`/api/session/${item.sessionId}/sync`, {
            currentTime: item.position,
            timeListened: 0,
          });
          log('  Session sync successful');
          syncedViaSession = true;
        } catch (sessionError: any) {
          // Session gone (404) or other error - fallback to direct progress
          if (sessionError.message === 'Resource not found') {
            log('  Session expired (404), falling back to direct progress update');
          } else {
            log(`  Session sync failed (${sessionError.message}), falling back`);
          }
          // Fall through to direct progress update
        }
      }

      // Direct progress update (fallback or primary if no session)
      if (!syncedViaSession) {
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

      // Emit sync success event
      eventBus.emit('progress:synced', {
        bookId: item.itemId,
        position: item.position,
        syncedAt: Date.now(),
      });

      return true;
    } catch (error: any) {
      // Handle 404 - resource doesn't exist on server, no point retrying
      if (error.message === 'Resource not found' || error.status === 404) {
        audioLog.warn(`Item ${item.itemId} not found on server (404), removing from sync queue`);
        this.syncQueue.delete(item.itemId);
        // Mark as synced to prevent future retries for this non-existent item
        await sqliteCache.markProgressSynced(item.itemId);
        return false;
      }

      // Handle other failures (network errors, etc.)
      item.retryCount++;
      item.lastAttempt = Date.now();

      audioLog.warn(`Sync failed for ${item.itemId}: ${error.message}`);

      // Track sync failures for monitoring
      trackEvent('sync_progress_failed', {
        item_id: item.itemId,
        error: error.message,
        retry_count: item.retryCount,
        is_401: error.message?.includes('401') || error.message?.includes('Unauthorized'),
      });

      // Emit sync failed event
      eventBus.emit('progress:sync_failed', {
        bookId: item.itemId,
        position: item.position,
        error: error.message,
        retryCount: item.retryCount,
      });

      if (item.retryCount >= this.MAX_RETRIES) {
        audioLog.warn(`Max retries (${this.MAX_RETRIES}) reached for ${item.itemId}, keeping in SQLite for later`);

        trackEvent('sync_max_retries_reached', {
          item_id: item.itemId,
          error: error.message,
        }, 'warning');
        this.syncQueue.delete(item.itemId);
        // Keep in SQLite as unsynced for future retry
      } else {
        log(`  Will retry (${item.retryCount}/${this.MAX_RETRIES})`);
      }
      return false;
    }
  }

  /**
   * Sync any unsynced items from SQLite storage.
   * Public so it can be called by app lifecycle handlers.
   */
  async syncUnsyncedFromStorage(): Promise<void> {
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
            localUpdatedAt: item.updatedAt, // Use SQLite timestamp for conflict detection
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
