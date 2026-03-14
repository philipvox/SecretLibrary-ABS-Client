/**
 * Book Loading Helper Functions
 *
 * Utility functions for loading books, extracting chapters, checking downloads.
 * Extracted from playerStore.ts for modularity.
 */

import { LibraryItem } from '@/core/types';
import { SessionChapter } from '../services/sessionService';
import { getCleanChapterName } from '@/core/services/chapterNormalizer';

// =============================================================================
// TYPES
// =============================================================================

export interface Chapter {
  id: number;
  start: number;
  end: number;
  title: string;
}

// =============================================================================
// CHAPTER HELPERS
// =============================================================================

/**
 * Map session chapters to internal Chapter format with normalized titles
 */
export function mapSessionChapters(sessionChapters: SessionChapter[]): Chapter[] {
  return sessionChapters.map((ch, i) => ({
    id: i,
    start: ch.start,
    end: ch.end,
    title: ch.title ? getCleanChapterName(ch.title) : `Chapter ${i + 1}`,
  }));
}

/**
 * Extract chapters from book metadata with normalized titles
 */
export function extractChaptersFromBook(book: LibraryItem): Chapter[] {
  const bookChapters = book.media?.chapters;
  if (!bookChapters?.length) return [];

  return bookChapters.map((ch, i) => ({
    id: i,
    start: ch.start ?? 0,
    end: ch.end ?? bookChapters[i + 1]?.start ?? book.media?.duration ?? 0,
    title: ch.title ? getCleanChapterName(ch.title) : `Chapter ${i + 1}`,
  }));
}

/**
 * Find chapter index for a given position
 */
export function findChapterIndex(chapters: Chapter[], position: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (position >= chapters[i].start) {
      return i;
    }
  }
  return 0;
}

// =============================================================================
// DURATION HELPERS
// =============================================================================

/**
 * Get book duration from various sources
 */
export function getBookDuration(book: LibraryItem): number {
  if (book.media?.duration && book.media.duration > 0) {
    return book.media.duration;
  }

  if (book.media?.audioFiles?.length) {
    const sum = book.media.audioFiles.reduce((acc, f) => acc + (f.duration || 0), 0);
    if (sum > 0) return sum;
  }

  const chapters = book.media?.chapters;
  if (chapters?.length) {
    const last = chapters[chapters.length - 1];
    if (last.end && last.end > 0) return last.end;
  }

  return 0;
}

// =============================================================================
// DOWNLOAD HELPERS
// =============================================================================

/**
 * Get download path for a book.
 * Returns path if book is fully downloaded OR if partial download is available.
 * For partial downloads, playback will use available files and wait/stream for rest.
 */
export async function getDownloadPath(
  bookId: string,
  log: (msg: string) => void = () => {},
  logError: (msg: string, ...args: any[]) => void = () => {}
): Promise<string | null> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const { downloadManager } = await import('@/core/services/downloadManager');

    // Check if book is fully downloaded
    const isDownloaded = await downloadManager.isDownloaded(bookId);

    // If not fully downloaded, check for partial download (at least first file ready)
    if (!isDownloaded) {
      const canPlayPartially = await downloadManager.canPlayPartially(bookId);
      if (!canPlayPartially) {
        log('Book not downloaded and no partial files ready');
        return null;
      }
      log('Partial download available - enabling partial playback mode');
    }

    const localPath = downloadManager.getLocalPath(bookId);
    // downloadManager stores files in a directory, check for any audio files
    const dirInfo = await FileSystem.getInfoAsync(localPath);
    if (dirInfo.exists && dirInfo.isDirectory) {
      const status = isDownloaded ? 'complete' : 'partial';
      log(`Found offline directory via downloadManager (${status})`);
      // Update last played timestamp
      await downloadManager.updateLastPlayed(bookId);
      return localPath;
    }

    log('Download directory not found or invalid');
    return null;
  } catch (error) {
    logError('Failed to verify download:', error);
    return null;
  }
}

// =============================================================================
// AUTO-DOWNLOAD HELPERS
// =============================================================================

/**
 * Check and trigger auto-download of next book in series.
 * Called when playback reaches 80% progress.
 */
export async function checkAutoDownloadNextInSeries(
  currentBook: LibraryItem,
  log: (msg: string) => void = () => {},
  logError: (msg: string, ...args: any[]) => void = () => {}
): Promise<void> {
  try {
    // Check if feature is enabled
    const { networkMonitor } = await import('@/core/services/networkMonitor');
    if (!networkMonitor.isAutoDownloadSeriesEnabled()) {
      log('Auto-download series disabled');
      return;
    }

    // Check if network allows download
    if (!networkMonitor.canDownload()) {
      log('Auto-download: Network does not allow downloads');
      return;
    }

    // Import series utils and find next book
    const { findNextInSeries } = await import('@/core/utils/seriesUtils');
    const { useLibraryCache } = await import('@/core/cache/libraryCache');
    const { downloadManager } = await import('@/core/services/downloadManager');

    const libraryItems = useLibraryCache.getState().items;
    const nextBook = findNextInSeries(currentBook, libraryItems);

    if (!nextBook) {
      log('Auto-download: No next book in series');
      return;
    }

    const nextTitle = (nextBook.media?.metadata as any)?.title || 'Unknown';

    // Check if already downloaded
    const isDownloaded = await downloadManager.isDownloaded(nextBook.id);
    if (isDownloaded) {
      log(`Auto-download: "${nextTitle}" already downloaded`);
      return;
    }

    // Check if already in download queue
    const status = await downloadManager.getDownloadStatus(nextBook.id);
    if (status && ['pending', 'downloading', 'waiting_wifi'].includes(status.status)) {
      log(`Auto-download: "${nextTitle}" already in queue`);
      return;
    }

    // Queue the download with low priority
    log(`Auto-download: Queueing "${nextTitle}"`);
    const result = await downloadManager.queueDownload(nextBook, -1); // Low priority

    if (result.success) {
      // Show toast notification (import lazily to avoid dependency issues)
      try {
        const ToastModule = await import('react-native-toast-message');
        ToastModule.default.show({
          type: 'info',
          text1: 'Auto-downloading next book',
          text2: nextTitle,
          position: 'bottom',
          visibilityTime: 3000,
        });
      } catch {
        // Toast not available, log instead
        log(`Auto-download started: "${nextTitle}"`);
      }
    }
  } catch (err) {
    logError('Auto-download check failed:', err);
  }
}
