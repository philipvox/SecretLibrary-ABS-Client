/**
 * src/core/lifecycle/appStateListener.ts
 *
 * App state listener for foreground/background transitions.
 * Handles:
 * - Emitting app lifecycle events
 * - Triggering query refetch when returning from background
 * - Processing pending syncs on foreground return
 */

import { AppState, AppStateStatus } from 'react-native';
import { queryClient, queryKeys } from '@/core/queryClient';
import { useLibraryCache } from '@/core/cache/libraryCache';
import { logger } from '@/shared/utils/logger';

// Minimum time in background before triggering progress refetch (30 seconds)
const MIN_BACKGROUND_TIME = 30000;
// Minimum time in background before refreshing library/series data (5 minutes)
const LIBRARY_REFRESH_THRESHOLD = 300000;

// Track background timing
let backgroundedAt: number | null = null;
let currentState: AppStateStatus = AppState.currentState;
let subscription: any = null;

/**
 * Initialize the app state listener.
 * Call once at app startup.
 * Returns cleanup function.
 */
export function initializeAppStateListener(): () => void {
  if (subscription) {
    logger.warn('[AppStateListener] Already initialized');
    return () => {};
  }

  subscription = AppState.addEventListener('change', handleAppStateChange);
  logger.debug('[AppStateListener] Initialized');

  return () => {
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
    logger.debug('[AppStateListener] Cleaned up');
  };
}

/**
 * Handle app state changes
 */
function handleAppStateChange(nextState: AppStateStatus): void {
  const previousState = currentState;
  currentState = nextState;

  // App going to background
  if (nextState === 'background' || nextState === 'inactive') {
    if (!backgroundedAt) {
      backgroundedAt = Date.now();
      logger.debug('[AppStateListener] App backgrounded');
    }
    return;
  }

  // App returning to foreground
  if (nextState === 'active' && previousState !== 'active') {
    const timeInBackground = backgroundedAt ? Date.now() - backgroundedAt : 0;
    backgroundedAt = null;

    logger.debug(`[AppStateListener] App foregrounded (was background for ${timeInBackground}ms)`);

    // Only refetch if we were in background long enough
    if (timeInBackground >= MIN_BACKGROUND_TIME) {
      handleForegroundReturn(timeInBackground);
    }
  }
}

/**
 * Handle foreground return - refetch stale data and process pending syncs
 */
async function handleForegroundReturn(timeInBackground: number): Promise<void> {
  logger.debug(`[AppStateListener] Refreshing data after ${Math.round(timeInBackground / 1000)}s in background`);

  try {
    // CRITICAL: Check if library cache was cleared (e.g., by memory pressure)
    // If so, reload it immediately so authors/series/genres are available
    const libraryState = useLibraryCache.getState();
    const hasLibraryId = !!libraryState.currentLibraryId;
    const isCacheEmpty = libraryState.items.length === 0;

    if (hasLibraryId && isCacheEmpty) {
      logger.info('[AppStateListener] Library cache was cleared - reloading');
      // Force refresh to reload from server (or SQLite cache)
      await libraryState.loadCache(libraryState.currentLibraryId!, true);
      logger.info('[AppStateListener] Library cache reloaded');
    } else if (hasLibraryId && !libraryState.isLoaded) {
      // Cache exists but not marked as loaded (partial state)
      logger.info('[AppStateListener] Library cache not loaded - loading');
      await libraryState.loadCache(libraryState.currentLibraryId!);
    }

    // NOTE: backgroundSyncService has its own AppState listener that calls
    // syncUnsyncedFromStorage() on foreground. We do NOT duplicate that here
    // to avoid concurrent sync operations and double API calls.

    // Invalidate queries that might be stale
    // These will refetch on next access or if components are mounted
    const invalidations = [
      // Always refresh progress - most likely to have changed on other devices
      queryClient.invalidateQueries({ queryKey: queryKeys.user.progressAll() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.user.inProgress() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.user.continueListening() }),
    ];

    // If backgrounded for more than 5 minutes, also refresh library data
    if (timeInBackground > LIBRARY_REFRESH_THRESHOLD) {
      invalidations.push(
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.series.all })
      );
    }

    await Promise.allSettled(invalidations);
    logger.debug('[AppStateListener] Data refresh complete');
  } catch (error) {
    logger.warn('[AppStateListener] Error refreshing data:', error);
  }
}

/**
 * Get current app state
 */
export function getCurrentAppState(): AppStateStatus {
  return currentState;
}

/**
 * Check if app is currently in foreground
 */
export function isAppForeground(): boolean {
  return currentState === 'active';
}
