/**
 * src/core/services/finishedBooksSync.ts
 *
 * Service for syncing finished book status between local SQLite and server.
 * Handles both pushing local changes to server and importing from server.
 */

import { sqliteCache } from './sqliteCache';
import { playbackCache } from './playbackCache';
import { userApi } from '@/core/api/endpoints/user';
import { apiClient } from '@/core/api';
import { syncLogger as log } from '@/shared/utils/logger';
import { useLibraryCache } from '@/core/cache/libraryCache';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
import { LibraryItem, BookMedia } from '@/core/types';

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media;
}

// Helper to get book duration safely
function getBookDuration(item: LibraryItem | null | undefined): number {
  if (!item || !isBookMedia(item.media)) return 0;
  return item.media.duration || 0;
}

/**
 * Sync finished books between local SQLite and server.
 */
export const finishedBooksSync = {
  /**
   * Sync local unsynced finished books to server.
   * Called on app startup and after marking books.
   */
  async syncToServer(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    try {
      const unsynced = await sqliteCache.getUnsyncedUserBooks();
      const toSync = unsynced.filter((b) => !b.finishedSynced);

      for (const book of toSync) {
        try {
          if (book.isFinished) {
            await userApi.markAsFinished(book.bookId, book.duration);
          } else {
            await userApi.markAsNotStarted(book.bookId);
          }
          await sqliteCache.markUserBookSynced(book.bookId, { finished: true });
          synced++;
        } catch (err) {
          log.warn(`Failed to sync ${book.bookId}:`, err);
          failed++;
        }
      }

      if (synced > 0 || failed > 0) {
        log.info(`Synced ${synced}, failed ${failed}`);
      }
    } catch (err) {
      log.error('syncToServer error:', err);
    }

    return { synced, failed };
  },

  /**
   * Import progress for ALL recently played books.
   * Called on app startup to ensure correct progress shows everywhere.
   */
  async importRecentProgress(): Promise<number> {
    let progressImported = 0;

    try {
      // Get ALL items in progress from server (all recently played books)
      const items = await apiClient.getItemsInProgress();

      log.info(`Syncing progress for ${items.length} in-progress books...`);

      for (const item of items) {
        const serverProgress = item.userMediaProgress;
        if (!serverProgress) continue;

        const duration = getBookDuration(item);

        if (serverProgress.currentTime > 0) {
          // Write to playback_progress table (what the player reads from)
          await sqliteCache.setPlaybackProgress(
            item.id,
            serverProgress.currentTime,
            duration,
            true
          );

          // Also update user_books for book detail screen
          await sqliteCache.updateUserBookProgress(
            item.id,
            serverProgress.currentTime,
            duration,
            0
          );

          // Update spine cache
          useSpineCacheStore.getState().updateProgress(item.id, serverProgress.progress);

          // Cache in memory for instant access (no SQLite read needed)
          playbackCache.setProgress(item.id, {
            currentTime: serverProgress.currentTime,
            duration,
            progress: serverProgress.progress,
            updatedAt: Date.now(),
          });

          progressImported++;
          log.info(`Synced ${item.id}: ${serverProgress.currentTime}s (${Math.round(serverProgress.progress * 100)}%)`);
        }
      }

      if (progressImported > 0) {
        log.info(`Synced progress for ${progressImported} recent books`);
      }
    } catch (err) {
      log.warn('importRecentProgress error:', err);
    }

    return progressImported;
  },

  /**
   * Import finished books AND progress from server.
   * Called on app startup to get server's state.
   */
  async importFromServer(): Promise<number> {
    let imported = 0;
    let progressImported = 0;

    try {
      // Get library items from cache (they should be loaded by now)
      const libraryId = useLibraryCache.getState().currentLibraryId;
      if (!libraryId) {
        log.warn('No current library ID - skipping import');
        return 0;
      }
      // Fetch ALL library items (no limit)
      const response = await apiClient.getLibraryItems(libraryId, { limit: 0 });
      const items = response.results || [];
      log.info(`Fetched ${items.length} library items, now fetching user progress...`);

      // Fetch user data to get mediaProgress array (same approach as getItemsInProgress)
      const user = await apiClient.getCurrentUser();
      const progressMap = new Map<string, any>();

      // Build map of libraryItemId -> progress data
      if (user.mediaProgress) {
        for (const mp of user.mediaProgress) {
          if (mp.libraryItemId) {
            progressMap.set(mp.libraryItemId, mp);
          }
        }
      }
      log.info(`User has progress for ${progressMap.size} items`);

      let itemsWithProgress = 0;
      let itemsCached = 0;

      for (const item of items) {
        // Get progress from the user's mediaProgress map (not from item)
        const serverProgress = progressMap.get(item.id);
        if (!serverProgress) continue;

        itemsWithProgress++;
        const duration = getBookDuration(item);

        // Import progress if server has any
        if (serverProgress.currentTime > 0 || serverProgress.progress > 0) {
          itemsCached++;
          // ALWAYS cache in memory for instant access on book detail screens
          playbackCache.setProgress(item.id, {
            currentTime: serverProgress.currentTime,
            duration,
            progress: serverProgress.progress,
            updatedAt: Date.now(),
          });

          // Check existing playback_progress (what the player reads from)
          const existingPlayback = await sqliteCache.getPlaybackProgress(item.id);
          const existingTime = existingPlayback?.position || 0;

          // Only write to SQLite if server has more recent progress
          // This avoids overwriting local progress with stale server data
          if (serverProgress.currentTime > existingTime) {
            // Write to playback_progress table (what the player reads from)
            await sqliteCache.setPlaybackProgress(
              item.id,
              serverProgress.currentTime,
              duration,
              true // Mark as synced since it came from server
            );

            // Also update user_books for book detail screen
            await sqliteCache.updateUserBookProgress(
              item.id,
              serverProgress.currentTime,
              duration,
              0 // currentTrackIndex - not available from server
            );
            await sqliteCache.markUserBookSynced(item.id, { progress: true });

            // Also update spine cache so book spines show correct progress
            useSpineCacheStore.getState().updateProgress(item.id, serverProgress.progress);

            progressImported++;
          }
        }

        // Check if server has this book as finished (95% threshold for consistency)
        if (serverProgress.isFinished || serverProgress.progress >= 0.95) {
          const existing = await sqliteCache.getUserBook(item.id);

          // Only import if not already finished locally
          if (!existing?.isFinished) {
            await sqliteCache.markUserBookFinished(item.id, true, 'progress');
            await sqliteCache.markUserBookSynced(item.id, { finished: true });
            imported++;
          }
        }
      }

      // Log cache results
      log.info(`Items with progress data: ${itemsWithProgress}, cached in memory: ${itemsCached}`);

      if (imported > 0 || progressImported > 0) {
        log.info(`Imported ${imported} finished, ${progressImported} progress from server`);
      }
    } catch (err) {
      log.warn('importFromServer error:', err);
    }

    return imported;
  },

  /**
   * Full sync: import from server first, then sync local changes.
   */
  async fullSync(): Promise<{ imported: number; synced: number; failed: number }> {
    // Import from server first (get server's state)
    const imported = await this.importFromServer();

    // Then sync local changes to server
    const { synced, failed } = await this.syncToServer();

    return { imported, synced, failed };
  },

  /**
   * Sync a single book to server immediately.
   * Used after marking a book as finished.
   */
  async syncBook(bookId: string, isFinished: boolean, duration?: number): Promise<boolean> {
    try {
      if (isFinished) {
        await userApi.markAsFinished(bookId, duration);
      } else {
        await userApi.markAsNotStarted(bookId);
      }
      await sqliteCache.markUserBookSynced(bookId, { finished: true });
      return true;
    } catch (err) {
      log.warn(`Failed to sync book ${bookId}:`, err);
      return false;
    }
  },

  /**
   * Preload the most recently played book into the player store.
   * This allows the UI to show correct progress before user hits play.
   * Called during app startup after progress is synced.
   */
  async preloadMostRecentBook(): Promise<boolean> {
    try {
      // Get items in progress from server
      const items = await apiClient.getItemsInProgress();
      if (items.length === 0) {
        log.info('No recent books to preload');
        return false;
      }

      // Get the most recently played book
      const mostRecent = items[0];
      log.info(`Preloading most recent book: ${mostRecent.id}`);

      // Import playerStore dynamically to avoid circular deps
      const { usePlayerStore } = await import('@/features/player/stores');

      // Preload the book state (position, duration, chapters) without starting audio
      await usePlayerStore.getState().preloadBookState(mostRecent);

      log.info('Most recent book preloaded into player store');
      return true;
    } catch (err) {
      log.warn('preloadMostRecentBook error:', err);
      return false;
    }
  },

  /**
   * Pre-fetch sessions for recently played books.
   * Caches audio track URLs and chapters so playback starts instantly.
   * Called during app startup.
   *
   * IMPORTANT: Sessions are closed immediately after caching to prevent
   * multiple open sessions on the server (which causes progress corruption).
   */
  async prefetchSessions(): Promise<number> {
    let prefetched = 0;

    try {
      // Get items in progress from server (returns recently played books)
      const items = await apiClient.getItemsInProgress();
      const recentItems = items.slice(0, 5); // Only prefetch top 5

      log.info(`Pre-fetching sessions for ${recentItems.length} recent books...`);

      // Fetch sessions sequentially to avoid overwhelming server with sessions
      // and ensure each session is closed before starting the next
      for (const item of recentItems) {
        try {
          // Start a session to get audio tracks and chapters
          const session = await apiClient.post<any>(
            `/api/items/${item.id}/play`,
            {
              deviceInfo: {
                clientName: 'AudiobookShelf-RN',
                clientVersion: '1.0.0',
                deviceId: 'rn-mobile-app-prefetch',
              },
              forceDirectPlay: true,
              forceTranscode: false,
              supportedMimeTypes: [
                'audio/mpeg',
                'audio/mp4',
                'audio/m4b',
                'audio/m4a',
                'audio/flac',
                'audio/ogg',
                'audio/webm',
                'audio/aac',
              ],
              mediaPlayer: 'expo-audio',
            }
          );

          // Cache the session data (audio tracks, chapters, etc.)
          playbackCache.setSession(item.id, {
            id: session.id,
            libraryItemId: session.libraryItemId,
            duration: session.duration,
            currentTime: session.currentTime,
            updatedAt: session.updatedAt,
            audioTracks: session.audioTracks || [],
            chapters: session.chapters || [],
            mediaMetadata: session.mediaMetadata,
          });

          // CRITICAL FIX: Close the session immediately after caching
          // This prevents multiple open sessions which causes progress corruption
          // (position from one book being applied to another)
          try {
            await apiClient.post(`/api/session/${session.id}/close`, {
              currentTime: session.currentTime, // Keep current position
              timeListened: 0,
            });
            log.debug(`Closed prefetch session ${session.id} for ${item.id}`);
          } catch (closeErr) {
            // Non-fatal - session will eventually timeout on server
            log.warn(`Failed to close prefetch session for ${item.id}:`, closeErr);
          }

          log.info(`Pre-fetched and cached session for ${item.id}`);
          prefetched++;
        } catch (err) {
          log.warn(`Failed to prefetch session for ${item.id}:`, err);
        }
      }

      if (prefetched > 0) {
        log.info(`Pre-fetched ${prefetched} sessions (all closed)`);
      }
    } catch (err) {
      log.warn('prefetchSessions error:', err);
    }

    return prefetched;
  },
};

export default finishedBooksSync;
