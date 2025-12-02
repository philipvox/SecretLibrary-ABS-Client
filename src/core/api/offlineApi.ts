/**
 * src/core/api/offlineApi.ts
 *
 * Offline-aware API wrapper that queues mutations when offline
 * and provides cached data when network is unavailable.
 */

import { syncQueue } from '@/core/services/syncQueue';
import { sqliteCache } from '@/core/services/sqliteCache';
import { OfflineError, isNetworkError } from './errors';
import { userApi } from './endpoints/user';
import { collectionsApi } from './endpoints/collections';

// Safe NetInfo import - may not be available in Expo Go
let NetInfo: typeof import('@react-native-community/netinfo').default | null = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  console.warn('NetInfo not available - assuming online');
}

/**
 * Check if device is currently online
 */
async function isOnline(): Promise<boolean> {
  if (!NetInfo) {
    // NetInfo not available, assume online
    return true;
  }
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch {
    return true; // Assume online on error
  }
}

/**
 * Offline-aware progress update
 * Queues the update if offline, sends immediately if online
 */
export async function updateProgressOffline(
  itemId: string,
  currentTime: number,
  duration: number
): Promise<void> {
  // Always save to local cache first
  await sqliteCache.setProgress(itemId, currentTime, duration, false);

  const online = await isOnline();

  if (online) {
    try {
      await userApi.updateProgress(itemId, {
        currentTime,
        duration,
        progress: duration > 0 ? currentTime / duration : 0,
      });
      await sqliteCache.markProgressSynced(itemId);
    } catch (error) {
      if (isNetworkError(error)) {
        // Network failed after initial check, queue for later
        await syncQueue.enqueue('progress', { itemId, currentTime, duration });
      } else {
        throw error;
      }
    }
  } else {
    // Queue for later sync
    await syncQueue.enqueue('progress', { itemId, currentTime, duration });
  }
}

/**
 * Offline-aware favorite toggle
 */
export async function toggleFavoriteOffline(
  itemId: string,
  isFavorite: boolean
): Promise<void> {
  // Save to local SQLite first
  if (isFavorite) {
    await sqliteCache.addFavorite(itemId);
  } else {
    await sqliteCache.removeFavorite(itemId);
  }

  // Queue for server sync (if server supports it)
  const action = isFavorite ? 'favorite' : 'unfavorite';
  await syncQueue.enqueue(action, { itemId });
}

/**
 * Offline-aware add to collection
 */
export async function addToCollectionOffline(
  collectionId: string,
  itemId: string
): Promise<void> {
  const online = await isOnline();

  if (online) {
    try {
      await collectionsApi.addItem(collectionId, itemId);
    } catch (error) {
      if (isNetworkError(error)) {
        await syncQueue.enqueue('add_to_collection', { collectionId, itemId });
      } else {
        throw error;
      }
    }
  } else {
    await syncQueue.enqueue('add_to_collection', { collectionId, itemId });
  }
}

/**
 * Offline-aware remove from collection
 */
export async function removeFromCollectionOffline(
  collectionId: string,
  itemId: string
): Promise<void> {
  const online = await isOnline();

  if (online) {
    try {
      await collectionsApi.removeItem(collectionId, itemId);
    } catch (error) {
      if (isNetworkError(error)) {
        await syncQueue.enqueue('remove_from_collection', { collectionId, itemId });
      } else {
        throw error;
      }
    }
  } else {
    await syncQueue.enqueue('remove_from_collection', { collectionId, itemId });
  }
}

/**
 * Get progress with offline fallback
 * Returns cached progress if offline
 */
export async function getProgressOffline(
  itemId: string
): Promise<{ currentTime: number; duration: number; progress: number } | null> {
  const online = await isOnline();

  if (online) {
    try {
      const progress = await userApi.getMediaProgress(itemId);
      if (progress) {
        // Update local cache
        await sqliteCache.setProgress(
          itemId,
          progress.currentTime,
          progress.duration,
          true
        );
        return {
          currentTime: progress.currentTime,
          duration: progress.duration,
          progress: progress.progress,
        };
      }
    } catch {
      // Fall through to cached data
    }
  }

  // Return cached data
  const cached = await sqliteCache.getProgress(itemId);
  if (cached) {
    return {
      currentTime: cached.currentTime,
      duration: cached.duration,
      progress: cached.duration > 0 ? cached.currentTime / cached.duration : 0,
    };
  }

  return null;
}

/**
 * Require online connection or throw
 */
export async function requireOnline(): Promise<void> {
  const online = await isOnline();
  if (!online) {
    throw new OfflineError();
  }
}

/**
 * Execute callback only if online, otherwise queue action
 */
export async function onlineOrQueue<T>(
  action: string,
  payload: object,
  onlineCallback: () => Promise<T>
): Promise<T | null> {
  const online = await isOnline();

  if (online) {
    try {
      return await onlineCallback();
    } catch (error) {
      if (isNetworkError(error)) {
        await syncQueue.enqueue(action, payload);
        return null;
      }
      throw error;
    }
  }

  await syncQueue.enqueue(action, payload);
  return null;
}
