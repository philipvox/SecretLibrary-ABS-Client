/**
 * src/core/services/syncQueue.ts
 *
 * Sync queue for offline-first mutations.
 * Queues mutations when offline and processes them when connection is restored.
 */

import { sqliteCache } from './sqliteCache';
// Import directly to avoid circular dependency with @/core/api
import { apiClient } from '@/core/api/apiClient';

// Safe NetInfo import - may not be available in Expo Go
let NetInfo: typeof import('@react-native-community/netinfo').default | null = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  // NetInfo not available
}

interface SyncQueueItem {
  id: number;
  action: string;
  payload: string;
  createdAt: string;
  retryCount: number;
}

class SyncQueue {
  private isProcessing = false;
  private maxRetries = 3;
  private unsubscribe: (() => void) | null = null;

  /**
   * Add action to sync queue
   */
  async enqueue(action: string, payload: object): Promise<void> {
    await sqliteCache.addToSyncQueue({
      action,
      payload: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });

    // Try to process immediately if online
    this.processQueue();
  }

  /**
   * Process pending sync items
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    // Check network status if NetInfo is available
    if (NetInfo) {
      try {
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) return;
      } catch {
        // Assume online on error
      }
    }

    this.isProcessing = true;

    try {
      const pendingItems = await sqliteCache.getSyncQueue();

      for (const item of pendingItems) {
        try {
          await this.processItem(item);
          await sqliteCache.removeSyncQueueItem(item.id);
        } catch (error) {
          console.warn('[SyncQueue] Failed to process item:', item.action, error);

          // Increment retry count
          if (item.retryCount < this.maxRetries) {
            await sqliteCache.updateSyncQueueRetry(item.id, item.retryCount + 1);
          } else {
            // Max retries reached, remove and log
            console.error('[SyncQueue] Max retries reached, removing:', item);
            await sqliteCache.removeSyncQueueItem(item.id);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    const payload = JSON.parse(item.payload);

    switch (item.action) {
      case 'favorite':
        // AudiobookShelf doesn't have a native favorites API, so we use myLibrary store
        // For server sync, we could use a custom collection named "Favorites"
        console.log('[SyncQueue] Processing favorite:', payload.itemId);
        break;

      case 'unfavorite':
        console.log('[SyncQueue] Processing unfavorite:', payload.itemId);
        break;

      case 'progress':
        await apiClient.updateProgress(payload.itemId, {
          currentTime: payload.currentTime,
          duration: payload.duration,
          progress: payload.duration > 0 ? payload.currentTime / payload.duration : 0,
        });
        await sqliteCache.markProgressSynced(payload.itemId);
        break;

      case 'add_to_collection':
        // Get current collection and add item
        const collection = await apiClient.getCollection(payload.collectionId);
        const updatedBooks = [...(collection.books || []), { id: payload.itemId }];
        await apiClient.updateCollection(payload.collectionId, { books: updatedBooks as any });
        break;

      case 'remove_from_collection':
        // Get current collection and remove item
        const col = await apiClient.getCollection(payload.collectionId);
        const filteredBooks = (col.books || []).filter((b: any) => b.id !== payload.itemId);
        await apiClient.updateCollection(payload.collectionId, { books: filteredBooks as any });
        break;

      default:
        console.warn('[SyncQueue] Unknown action:', item.action);
    }
  }

  /**
   * Start listening for network changes
   */
  startNetworkListener(): void {
    if (this.unsubscribe) return;

    if (NetInfo) {
      this.unsubscribe = NetInfo.addEventListener((state) => {
        if (state.isConnected) {
          console.log('[SyncQueue] Network connected, processing queue...');
          this.processQueue();
        }
      });
    }

    // Process any pending items on startup
    this.processQueue();
  }

  /**
   * Stop listening for network changes
   */
  stopNetworkListener(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Get pending sync count
   */
  async getPendingCount(): Promise<number> {
    const items = await sqliteCache.getSyncQueue();
    return items.length;
  }

  /**
   * Clear all pending items
   */
  async clear(): Promise<void> {
    await sqliteCache.clearSyncQueue();
  }
}

// Singleton instance
export const syncQueue = new SyncQueue();
