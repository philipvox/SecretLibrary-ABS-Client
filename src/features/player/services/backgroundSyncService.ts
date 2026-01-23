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
import { audioService } from './audioService';
import { audioLog, formatDuration, logSection } from '@/shared/utils/audioDebug';
import { trackEvent } from '@/core/monitoring';
import { eventBus } from '@/core/events';
import { networkMonitor } from '@/core/services/networkMonitor';
// NOTE: usePlayerStore is imported lazily in syncToServer() to break circular dependency
import { getErrorMessage } from '@/shared/utils/errorUtils';
import { useToastStore } from '@/shared/hooks/useToast';
import { validatePositionForSync } from '../utils/progressCalculator';

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
  private processScheduleTimeout: NodeJS.Timeout | null = null;
  private firstUnprocessedTime: number = 0; // Track when first unsynced item was added
  private backgroundSyncInProgress = false; // FIX: Prevent concurrent background sync operations

  // Sync configuration
  private readonly SYNC_INTERVAL = 10000; // Check every 10 seconds
  private readonly MIN_SYNC_DELAY = 5000; // Min time between syncs for same item
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 2000; // Exponential backoff base
  private readonly SYNC_CONCURRENCY = 5; // Parallel sync requests
  private readonly PROCESS_DEBOUNCE = 5000; // 5 seconds of inactivity before processing
  private readonly PROCESS_MAX_DELAY = 30000; // Max 30 seconds before forced processing
  private readonly BACKGROUND_SYNC_TIMEOUT = 4000; // 4 seconds - iOS gives ~5s before suspension

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
   * Save progress locally only (SQLite) - FAST PATH
   * Use this during active playback for instant saves without network overhead.
   * Progress will be synced to server at key moments (pause, background, finish).
   *
   * UNIFIED PROGRESS: Also updates progressStore for instant UI reactivity.
   * FIX: Added position validation to prevent corrupted data from being saved.
   */
  async saveProgressLocal(
    itemId: string,
    position: number,
    duration: number
  ): Promise<void> {
    // VALIDATION: Reject clearly corrupted position data
    const validationError = validatePositionForSync(position, duration);
    if (validationError) {
      audioLog.warn(`saveProgressLocal: Rejecting ${itemId} - ${validationError}`);
      return;
    }

    // SQLite write only - no network, no queue processing
    await sqliteCache.setPlaybackProgress(itemId, position, duration, false);

    // UNIFIED PROGRESS: Update progressStore for instant UI updates
    // This makes spine progress bars, continue listening, etc. update immediately
    try {
      const { useProgressStore } = await import('@/core/stores/progressStore');
      // Don't write to SQLite again - we just did that above
      await useProgressStore.getState().updateProgress(itemId, position, duration, false);
    } catch {
      // Progress store not loaded yet, skip
    }
  }

  /**
   * Save progress locally AND queue for server sync - KEY MOMENTS ONLY
   * Use this only at key moments: pause, app background, book finish.
   * This triggers server sync to ensure data durability.
   *
   * UNIFIED PROGRESS: Also updates progressStore for instant UI reactivity.
   * FIX: Added position validation to prevent corrupted data from being saved/synced.
   */
  async saveProgress(
    itemId: string,
    position: number,
    duration: number,
    sessionId?: string
  ): Promise<void> {
    // VALIDATION: Reject clearly corrupted position data
    // This prevents cross-book position contamination
    const validationError = validatePositionForSync(position, duration);
    if (validationError) {
      audioLog.warn(`saveProgress: Rejecting ${itemId} - ${validationError}`);
      return;
    }

    log(`saveProgress: ${itemId} @ ${formatDuration(position)}`);

    // STEP 1: Write to SQLite immediately (fast, offline-capable)
    await sqliteCache.setPlaybackProgress(itemId, position, duration, false);

    // UNIFIED PROGRESS: Update progressStore for instant UI updates
    try {
      const { useProgressStore } = await import('@/core/stores/progressStore');
      // Don't write to SQLite again - we just did that above
      await useProgressStore.getState().updateProgress(itemId, position, duration, false);
    } catch {
      // Progress store not loaded yet, skip
    }

    // STEP 2: Queue for server sync
    const existing = this.syncQueue.get(itemId);
    const now = Date.now();

    // Track first unprocessed time for max delay enforcement
    if (this.syncQueue.size === 0) {
      this.firstUnprocessedTime = now;
    }

    // Update queue entry - newer overwrites older
    this.syncQueue.set(itemId, {
      itemId,
      position,
      duration,
      sessionId,
      retryCount: 0,
      lastAttempt: existing?.lastAttempt || 0,
      localUpdatedAt: now,
    });

    // STEP 3: Schedule debounced processing
    this.scheduleProcessQueue();
  }

  /**
   * Schedule queue processing with debounce
   * Processes after 5s of inactivity OR 30s max delay (whichever comes first)
   */
  private scheduleProcessQueue(): void {
    // Clear existing timeout
    if (this.processScheduleTimeout) {
      clearTimeout(this.processScheduleTimeout);
    }

    const now = Date.now();
    const timeSinceFirst = now - this.firstUnprocessedTime;

    // If we've exceeded max delay, process immediately
    if (timeSinceFirst >= this.PROCESS_MAX_DELAY) {
      log('  Max delay reached, processing immediately');
      this.firstUnprocessedTime = 0;
      this.processSyncQueue();
      return;
    }

    // Otherwise, schedule debounced processing
    const remainingMaxDelay = this.PROCESS_MAX_DELAY - timeSinceFirst;
    const delay = Math.min(this.PROCESS_DEBOUNCE, remainingMaxDelay);

    this.processScheduleTimeout = setTimeout(() => {
      this.processScheduleTimeout = null;
      this.firstUnprocessedTime = 0;
      this.processSyncQueue();
    }, delay);
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
    // Skip sync if offline - don't waste retry counts
    if (!networkMonitor.isConnected()) {
      log('Offline - skipping sync');
      return;
    }

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
   *
   * OPTIMIZED: Skip conflict detection during sync for better performance.
   * - Conflict detection requires an extra network round-trip
   * - Server uses timestamps for conflict resolution
   * - Sync only happens at key moments when user isn't actively interacting
   *
   * FIX: Added position validation to prevent corrupted data from being synced.
   */
  private async syncToServer(item: SyncQueueItem): Promise<boolean> {
    // VALIDATION: Reject clearly corrupted position data before syncing
    const validationError = validatePositionForSync(item.position, item.duration);
    if (validationError) {
      audioLog.warn(`syncToServer: Rejecting ${item.itemId} - ${validationError}`);
      this.syncQueue.delete(item.itemId);
      return false;
    }

    log(`syncToServer: ${item.itemId} @ ${formatDuration(item.position)}`);

    // Skip if offline - don't increment retry count
    if (!networkMonitor.isConnected()) {
      log(`  Skipping - offline`);
      return false;
    }

    // Skip sync if user is actively playing this book (they'll sync on pause)
    // Lazy import to break circular dependency with playerStore
    const { usePlayerStore } = require('../stores/playerStore');
    const playerState = usePlayerStore.getState();
    const isActivelyPlaying = playerState.isPlaying && playerState.currentBook?.id === item.itemId;
    const isInTransition = audioService.isInTransition();
    const isCurrentBook = playerState.currentBook?.id === item.itemId;

    if (isActivelyPlaying || (isInTransition && isCurrentBook)) {
      log(`  Skipping - user active with this book`);
      // Don't remove from queue - will sync when user pauses
      return false;
    }

    try {
      // Direct upload - server handles timestamp comparison
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
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      // Handle 404 - resource doesn't exist on server, no point retrying
      if (errorMessage === 'Resource not found' || (error as any)?.status === 404) {
        audioLog.warn(`Item ${item.itemId} not found on server (404), removing from sync queue`);
        this.syncQueue.delete(item.itemId);
        // Mark as synced to prevent future retries for this non-existent item
        await sqliteCache.markProgressSynced(item.itemId);
        return false;
      }

      // Handle other failures (network errors, etc.)
      item.retryCount++;
      item.lastAttempt = Date.now();

      audioLog.warn(`Sync failed for ${item.itemId}: ${errorMessage}`);

      // Track sync failures for monitoring
      trackEvent('sync_progress_failed', {
        item_id: item.itemId,
        error: errorMessage,
        retry_count: item.retryCount,
        is_401: errorMessage.includes('401') || errorMessage.includes('Unauthorized'),
      });

      // Emit sync failed event
      eventBus.emit('progress:sync_failed', {
        bookId: item.itemId,
        position: item.position,
        error: errorMessage,
        retryCount: item.retryCount,
      });

      if (item.retryCount >= this.MAX_RETRIES) {
        audioLog.warn(`Max retries (${this.MAX_RETRIES}) reached for ${item.itemId}, keeping in SQLite for later`);

        trackEvent('sync_max_retries_reached', {
          item_id: item.itemId,
          error: errorMessage,
        }, 'warning');

        // Show user-facing notification (P1 Fix - sync failure visibility)
        useToastStore.getState().addToast({
          type: 'warning',
          message: 'Sync failed. Progress saved locally and will sync when online.',
          duration: 5000,
        });

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
   *
   * FIX 1: Await forceSyncAll with timeout before app suspension
   * iOS gives ~5 seconds before suspension, so we use 4s timeout
   */
  /**
   * Handle app state changes for background/foreground sync
   *
   * FIX: Added flag to prevent concurrent background sync operations,
   * preventing race conditions when app state changes rapidly.
   */
  private handleAppStateChange(nextState: AppStateStatus): void {
    log(`App state change: ${nextState}`);

    if (nextState === 'background' || nextState === 'inactive') {
      // App going to background - force sync with timeout
      logSection('APP BACKGROUNDING');

      // Prevent concurrent background sync operations
      if (this.backgroundSyncInProgress) {
        log('Background sync already in progress, skipping');
        return;
      }

      log('Forcing sync before background...');
      this.backgroundSyncInProgress = true;

      // Use IIFE to handle async in callback
      (async () => {
        try {
          // Race forceSyncAll against timeout
          const timeoutPromise = new Promise<'timeout'>((resolve) =>
            setTimeout(() => resolve('timeout'), this.BACKGROUND_SYNC_TIMEOUT)
          );

          const result = await Promise.race([
            this.forceSyncAll().then(() => 'success' as const),
            timeoutPromise,
          ]);

          if (result === 'timeout') {
            audioLog.warn('Background sync timed out - some progress may not be saved');
            trackEvent('background_sync_timeout', {
              queue_size: this.syncQueue.size,
              timeout_ms: this.BACKGROUND_SYNC_TIMEOUT,
            }, 'warning');
          } else {
            log('Background sync completed successfully');
          }
        } catch (error) {
          audioLog.error('Background sync failed:', getErrorMessage(error));
        } finally {
          this.backgroundSyncInProgress = false;
        }
      })();
    } else if (nextState === 'active') {
      // App coming to foreground - check for unsynced
      logSection('APP FOREGROUNDING');
      log('Checking for unsynced progress...');

      // FIX: Handle async properly with error logging
      this.syncUnsyncedFromStorage().catch((error) => {
        audioLog.error('Foreground sync failed:', getErrorMessage(error));
      });
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
