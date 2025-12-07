/**
 * src/core/services/downloadManager.ts
 *
 * Download manager for offline audio files.
 * Handles download queue, progress tracking, and file management.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { sqliteCache } from './sqliteCache';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { formatBytes } from '@/shared/utils/format';

// =============================================================================
// LOGGING
// =============================================================================

const LOG_PREFIX = '[DownloadManager]';
const VERBOSE = true; // Set to false to reduce logging

function log(...args: any[]) {
  console.log(LOG_PREFIX, ...args);
}

function logVerbose(...args: any[]) {
  if (VERBOSE) {
    console.log(LOG_PREFIX, '[VERBOSE]', ...args);
  }
}

function logError(...args: any[]) {
  console.error(LOG_PREFIX, '[ERROR]', ...args);
}

function logWarn(...args: any[]) {
  console.warn(LOG_PREFIX, '[WARN]', ...args);
}

// =============================================================================
// TYPES
// =============================================================================

export interface DownloadTask {
  itemId: string;
  status: 'pending' | 'downloading' | 'complete' | 'error' | 'paused';
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
}

type DownloadListener = (tasks: DownloadTask[]) => void;
type ProgressListener = (itemId: string, progress: number, bytesDownloaded: number, totalBytes: number) => void;

// In-memory progress tracking (byte-level detail not stored in SQLite)
interface ProgressInfo {
  bytesDownloaded: number;
  totalBytes: number;
}

// =============================================================================
// DOWNLOAD MANAGER
// =============================================================================

class DownloadManager {
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private listeners: Set<DownloadListener> = new Set();
  private progressListeners: Set<ProgressListener> = new Set();
  private isProcessingQueue = false;

  // In-memory progress tracking with byte info
  private progressInfo: Map<string, ProgressInfo> = new Map();

  // Directory for downloaded files
  private readonly DOWNLOAD_DIR = `${FileSystem.documentDirectory}audiobooks/`;

  /**
   * Initialize the download manager
   */
  async init(): Promise<void> {
    log('Initializing download manager...');
    log('Download directory:', this.DOWNLOAD_DIR);

    // Ensure download directory exists
    const dirInfo = await FileSystem.getInfoAsync(this.DOWNLOAD_DIR);
    if (!dirInfo.exists) {
      log('Creating download directory...');
      await FileSystem.makeDirectoryAsync(this.DOWNLOAD_DIR, { intermediates: true });
      log('Download directory created');
    } else {
      log('Download directory exists');
    }

    // Resume any paused downloads
    await this.resumePausedDownloads();

    // Start processing the queue
    log('Starting queue processing...');
    this.processQueue();

    log('Download manager initialized');
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Queue a book for download
   */
  async queueDownload(item: LibraryItem, priority = 0): Promise<void> {
    const itemId = item.id;
    const title = (item.media?.metadata as any)?.title || 'Unknown';

    log(`Queueing download: "${title}" (${itemId}) with priority ${priority}`);

    // Check if already downloaded
    const existing = await sqliteCache.getDownload(itemId);
    if (existing?.status === 'complete') {
      log(`Already downloaded: "${title}" - skipping`);
      return;
    }

    if (existing) {
      log(`Existing download status: ${existing.status}, progress: ${(existing.progress * 100).toFixed(1)}%`);
    }

    // Add to database with pending status
    log(`Adding to download database with pending status...`);
    await sqliteCache.setDownload({
      itemId,
      status: 'pending',
      progress: 0,
      filePath: null,
      fileSize: null,
      downloadedAt: null,
      error: null,
    });

    // Add to queue
    log(`Adding to download queue...`);
    await sqliteCache.addToDownloadQueue(itemId, priority);

    // Cache the library item metadata for offline access
    // Only cache if we have a valid libraryId
    if (item.libraryId) {
      log(`Caching library item metadata for offline access...`);
      try {
        await sqliteCache.setLibraryItems(item.libraryId, [item]);
      } catch (err) {
        logWarn(`Failed to cache library item metadata:`, err);
      }
    } else {
      logWarn(`Item ${itemId} has no libraryId - skipping metadata cache`);
    }

    this.notifyListeners();

    // Start processing queue
    log(`Triggering queue processing...`);
    this.processQueue();
  }

  /**
   * Cancel a download
   */
  async cancelDownload(itemId: string): Promise<void> {
    log(`Cancelling download: ${itemId}`);

    // Cancel active download
    const download = this.activeDownloads.get(itemId);
    if (download) {
      log(`Pausing active download...`);
      try {
        await download.pauseAsync();
        log(`Active download paused`);
      } catch (err) {
        logWarn(`Error pausing download:`, err);
      }
      this.activeDownloads.delete(itemId);
    }

    // Remove from database and queue
    log(`Removing from database and queue...`);
    await sqliteCache.deleteDownload(itemId);

    // Delete any downloaded files
    await this.deleteFiles(itemId);

    this.notifyListeners();
    log(`Download cancelled: ${itemId}`);
  }

  /**
   * Pause a download
   */
  async pauseDownload(itemId: string): Promise<void> {
    log(`Pausing download: ${itemId}`);

    const download = this.activeDownloads.get(itemId);
    if (download) {
      await download.pauseAsync();
      this.activeDownloads.delete(itemId);

      const currentProgress = (await sqliteCache.getDownload(itemId))?.progress || 0;
      log(`Download paused at ${(currentProgress * 100).toFixed(1)}%`);

      await sqliteCache.setDownload({
        itemId,
        status: 'paused',
        progress: currentProgress,
        filePath: null,
        fileSize: null,
        downloadedAt: null,
        error: null,
      });

      this.notifyListeners();
    } else {
      logWarn(`No active download found to pause: ${itemId}`);
    }
  }

  /**
   * Resume a paused download
   */
  async resumeDownload(itemId: string): Promise<void> {
    log(`Resuming download: ${itemId}`);

    const download = await sqliteCache.getDownload(itemId);
    if (download?.status === 'paused') {
      log(`Current progress: ${(download.progress * 100).toFixed(1)}%`);
      await sqliteCache.setDownload({
        ...download,
        status: 'pending',
      });
      await sqliteCache.addToDownloadQueue(itemId, 10); // High priority for resumed
      log(`Added to queue with high priority`);
      this.processQueue();
    } else if (download?.status === 'error') {
      log(`Retrying failed download...`);
      await sqliteCache.setDownload({
        ...download,
        status: 'pending',
        error: null,
      });
      await sqliteCache.addToDownloadQueue(itemId, 10);
      this.processQueue();
    } else {
      logWarn(`Cannot resume - download status: ${download?.status || 'not found'}`);
    }
  }

  /**
   * Delete downloaded files
   */
  async deleteDownload(itemId: string): Promise<void> {
    log(`Deleting download: ${itemId}`);
    await sqliteCache.deleteDownload(itemId);
    await this.deleteFiles(itemId);
    this.notifyListeners();
    log(`Download deleted: ${itemId}`);
  }

  /**
   * Get download status for an item
   */
  async getDownloadStatus(itemId: string): Promise<DownloadTask | null> {
    const record = await sqliteCache.getDownload(itemId);
    if (!record) return null;

    const progressInfo = this.progressInfo.get(itemId);
    return {
      itemId: record.itemId,
      status: record.status,
      progress: record.progress,
      bytesDownloaded: progressInfo?.bytesDownloaded || 0,
      totalBytes: progressInfo?.totalBytes || record.fileSize || 0,
      error: record.error || undefined,
    };
  }

  /**
   * Get all downloads
   */
  async getAllDownloads(): Promise<DownloadTask[]> {
    const records = await sqliteCache.getAllDownloads();
    return records.map((r) => {
      const progressInfo = this.progressInfo.get(r.itemId);
      return {
        itemId: r.itemId,
        status: r.status,
        progress: r.progress,
        bytesDownloaded: progressInfo?.bytesDownloaded || 0,
        totalBytes: progressInfo?.totalBytes || r.fileSize || 0,
        error: r.error || undefined,
      };
    });
  }

  /**
   * Check if item is downloaded
   */
  async isDownloaded(itemId: string): Promise<boolean> {
    return sqliteCache.isDownloaded(itemId);
  }

  /**
   * Get local file path for downloaded item
   */
  getLocalPath(itemId: string): string {
    return `${this.DOWNLOAD_DIR}${itemId}/`;
  }

  /**
   * Get total downloaded size
   */
  async getTotalDownloadedSize(): Promise<number> {
    const downloads = await sqliteCache.getDownloadsByStatus('complete');
    return downloads.reduce((sum, d) => sum + (d.fileSize || 0), 0);
  }

  /**
   * Update last played timestamp for a downloaded item
   */
  async updateLastPlayed(itemId: string): Promise<void> {
    log(`Updating last played for: ${itemId}`);
    await sqliteCache.updateDownloadLastPlayed(itemId);
  }

  /**
   * Clear all downloads
   */
  async clearAllDownloads(): Promise<void> {
    log('Clearing all downloads...');
    const downloads = await this.getAllDownloads();
    for (const download of downloads) {
      await this.deleteDownload(download.itemId);
    }
    log(`Cleared ${downloads.length} downloads`);
  }

  // ===========================================================================
  // QUEUE PROCESSING
  // ===========================================================================

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      logVerbose('Queue processing already in progress, skipping...');
      return;
    }
    if (this.activeDownloads.size > 0) {
      logVerbose(`Active download in progress (${this.activeDownloads.size}), skipping queue...`);
      return;
    }

    this.isProcessingQueue = true;
    log('Processing download queue...');

    try {
      const nextItemId = await sqliteCache.getNextDownload();
      if (!nextItemId) {
        log('Queue empty - nothing to download');
        return;
      }

      log(`Next item in queue: ${nextItemId}`);

      // Get the library item from cache
      let item = await sqliteCache.getLibraryItem(nextItemId);

      // If not in cache, try fetching from API
      if (!item) {
        log(`Item not in cache, fetching from API: ${nextItemId}`);
        try {
          const fetchedItem = await apiClient.getItem(nextItemId);
          if (fetchedItem) {
            item = fetchedItem;
            // Cache it for future use if it has a libraryId
            if (item.libraryId) {
              await sqliteCache.setLibraryItems(item.libraryId, [item]);
              log(`Cached fetched item metadata`);
            }
          }
        } catch (err) {
          logWarn(`Failed to fetch item from API:`, err);
        }
      }

      if (!item) {
        // Can't download without metadata - remove from queue
        logError(`Item metadata not found for: ${nextItemId}`);
        await sqliteCache.removeFromDownloadQueue(nextItemId);
        await sqliteCache.failDownload(nextItemId, 'Item metadata not found');
        this.notifyListeners();
        // Continue processing queue in case there are more items
        setTimeout(() => this.processQueue(), 100);
        return;
      }

      const title = (item.media?.metadata as any)?.title || 'Unknown';
      log(`Starting download for: "${title}"`);

      // Remove from queue before starting
      await sqliteCache.removeFromDownloadQueue(nextItemId);

      // Start download
      await this.startDownload(item);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Download a single file with retry logic
   */
  private async downloadFileWithRetry(
    url: string,
    destPath: string,
    token: string,
    itemId: string,
    fileIndex: number,
    totalFiles: number,
    onProgress: (bytesWritten: number) => void,
    maxRetries: number = 3
  ): Promise<FileSystem.FileSystemDownloadResult> {
    let lastError: Error | null = null;

    logVerbose(`Downloading file ${fileIndex + 1}/${totalFiles}`);
    logVerbose(`URL: ${url}`);
    logVerbose(`Destination: ${destPath}`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          log(`Retry attempt ${attempt + 1}/${maxRetries} for file ${fileIndex + 1}...`);
        }

        const download = FileSystem.createDownloadResumable(
          url,
          destPath,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          (downloadProgress) => {
            onProgress(downloadProgress.totalBytesWritten);
          }
        );

        this.activeDownloads.set(itemId, download);

        // Create a timeout promise
        const timeoutMs = 5 * 60 * 1000; // 5 minutes per file
        log(`Starting download with ${timeoutMs / 1000}s timeout...`);

        const startTime = Date.now();
        const downloadPromise = download.downloadAsync();
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Download timed out')), timeoutMs);
        });

        const result = await Promise.race([downloadPromise, timeoutPromise]);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!result) {
          throw new Error('Download returned null');
        }

        log(`File ${fileIndex + 1}/${totalFiles} downloaded in ${elapsed}s`);
        logVerbose(`Result status: ${result.status}, URI: ${result.uri}`);

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Download failed');
        logWarn(`Attempt ${attempt + 1} failed: ${lastError.message}`);

        // Exponential backoff before retry
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          log(`Waiting ${delay / 1000}s before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Download failed after retries');
  }

  private async startDownload(item: LibraryItem): Promise<void> {
    const itemId = item.id;
    const destDir = this.getLocalPath(itemId);
    const title = (item.media?.metadata as any)?.title || 'Unknown';
    const startTime = Date.now();

    log(`═══════════════════════════════════════════════════════`);
    log(`STARTING DOWNLOAD: "${title}"`);
    log(`Item ID: ${itemId}`);
    log(`Destination: ${destDir}`);
    log(`═══════════════════════════════════════════════════════`);

    try {
      // Create item directory
      log(`Creating download directory...`);
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });

      // Update status to downloading
      await sqliteCache.updateDownloadProgress(itemId, 0);
      this.notifyListeners();

      // Get auth info from apiClient
      const serverUrl = apiClient.getBaseURL();
      const token = (apiClient as any).getAuthToken?.() || (apiClient as any).authToken || '';

      log(`Server URL: ${serverUrl}`);
      log(`Token available: ${token ? 'Yes' : 'NO - MISSING!'}`);

      if (!serverUrl || !token) {
        throw new Error('Not authenticated - missing server URL or token');
      }

      // Fetch full item details from API to get audioFiles
      // The cached item may not have audioFiles included
      log(`Fetching full item details from API...`);
      const fullItem = await apiClient.getItem(itemId);

      // Get audio files to download (cast to any for audioFiles access)
      const audioFiles = (fullItem.media as any)?.audioFiles || [];
      log(`Audio files found: ${audioFiles.length}`);

      if (audioFiles.length === 0) {
        throw new Error('No audio files found in item');
      }

      let totalSize = 0;
      let downloadedSize = 0;

      // Calculate total size
      for (const file of audioFiles) {
        totalSize += file.metadata?.size || 0;
      }

      log(`Total size to download: ${formatBytes(totalSize)}`);

      // Initialize progress tracking with total size
      this.progressInfo.set(itemId, { bytesDownloaded: 0, totalBytes: totalSize });

      // Download each audio file with retry logic
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const fileUrl = `${serverUrl}/api/items/${itemId}/file/${file.ino}`;
        const destPath = `${destDir}${i.toString().padStart(3, '0')}_${file.ino}.m4a`;
        const fileSize = file.metadata?.size || 0;

        log(`───────────────────────────────────────────────────────`);
        log(`File ${i + 1}/${audioFiles.length}: ${file.metadata?.filename || file.ino}`);
        log(`Size: ${formatBytes(fileSize)}`);

        const currentDownloadedSize = downloadedSize;
        const currentIndex = i;
        let lastLoggedProgress = 0;

        await this.downloadFileWithRetry(
          fileUrl,
          destPath,
          token,
          itemId,
          i,
          audioFiles.length,
          (bytesWritten) => {
            const currentBytesDownloaded = currentDownloadedSize + bytesWritten;
            const overallProgress = totalSize > 0
              ? currentBytesDownloaded / totalSize
              : (currentIndex + bytesWritten / (fileSize || 1)) / audioFiles.length;

            // Log progress every 10%
            const progressPercent = Math.floor(overallProgress * 100);
            if (progressPercent >= lastLoggedProgress + 10) {
              lastLoggedProgress = progressPercent;
              logVerbose(`Progress: ${progressPercent}% (${formatBytes(currentBytesDownloaded)} / ${formatBytes(totalSize)})`);
            }

            this.updateProgress(itemId, Math.min(overallProgress, 0.99), currentBytesDownloaded, totalSize);
          }
        );

        downloadedSize += fileSize;
        log(`File ${i + 1} complete. Downloaded so far: ${formatBytes(downloadedSize)}`);
      }

      // Download cover image
      log(`Downloading cover image...`);
      await this.downloadCover(item, destDir);

      // Mark complete
      this.activeDownloads.delete(itemId);
      this.progressInfo.delete(itemId); // Clear in-memory progress
      await sqliteCache.completeDownload(itemId, destDir, totalSize);
      this.notifyListeners();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`═══════════════════════════════════════════════════════`);
      log(`DOWNLOAD COMPLETE: "${title}"`);
      log(`Total size: ${formatBytes(totalSize)}`);
      log(`Total time: ${elapsed}s`);
      log(`═══════════════════════════════════════════════════════`);

      // Process next item in queue
      this.processQueue();
    } catch (error) {
      this.activeDownloads.delete(itemId);
      this.progressInfo.delete(itemId); // Clear in-memory progress
      const message = error instanceof Error ? error.message : 'Download failed';
      await sqliteCache.failDownload(itemId, message);
      this.notifyListeners();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logError(`═══════════════════════════════════════════════════════`);
      logError(`DOWNLOAD FAILED: "${title}"`);
      logError(`Error: ${message}`);
      logError(`Time elapsed: ${elapsed}s`);
      if (error instanceof Error && error.stack) {
        logError(`Stack trace:`, error.stack);
      }
      logError(`═══════════════════════════════════════════════════════`);

      // Process next item in queue
      this.processQueue();
    }
  }

  private async updateProgress(itemId: string, progress: number, bytesDownloaded: number, totalBytes: number): Promise<void> {
    // Store byte info in memory
    this.progressInfo.set(itemId, { bytesDownloaded, totalBytes });

    await sqliteCache.updateDownloadProgress(itemId, progress);

    // Notify progress listeners
    for (const listener of this.progressListeners) {
      listener(itemId, progress, bytesDownloaded, totalBytes);
    }
  }

  private async downloadCover(item: LibraryItem, destDir: string): Promise<void> {
    try {
      const serverUrl = apiClient.getBaseURL();
      const token = (apiClient as any).getAuthToken?.() || (apiClient as any).authToken || '';
      if (!serverUrl || !token) {
        logVerbose('Skipping cover download - not authenticated');
        return;
      }

      const coverUrl = `${serverUrl}/api/items/${item.id}/cover`;
      const destPath = `${destDir}cover.jpg`;

      logVerbose(`Cover URL: ${coverUrl}`);
      await FileSystem.downloadAsync(coverUrl, destPath, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      log('Cover image downloaded');
    } catch (err) {
      logVerbose('Cover download failed (optional):', err);
      // Cover is optional, don't fail the download
    }
  }

  private async deleteFiles(itemId: string): Promise<void> {
    const path = this.getLocalPath(itemId);
    log(`Deleting files at: ${path}`);
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
        log('Files deleted successfully');
      } else {
        logVerbose('No files to delete - path does not exist');
      }
    } catch (error) {
      logWarn('Failed to delete files:', error);
    }
  }

  private async resumePausedDownloads(): Promise<void> {
    log('Checking for paused/interrupted downloads to resume...');

    const paused = await sqliteCache.getDownloadsByStatus('paused');
    if (paused.length > 0) {
      log(`Found ${paused.length} paused downloads, adding to queue...`);
      for (const download of paused) {
        await sqliteCache.addToDownloadQueue(download.itemId, 5);
      }
    }

    // Also re-queue any that were downloading when app closed
    const downloading = await sqliteCache.getDownloadsByStatus('downloading');
    if (downloading.length > 0) {
      log(`Found ${downloading.length} interrupted downloads, re-queueing...`);
      for (const download of downloading) {
        await sqliteCache.setDownload({
          ...download,
          status: 'pending',
        });
        await sqliteCache.addToDownloadQueue(download.itemId, 10);
      }
    }

    if (paused.length === 0 && downloading.length === 0) {
      log('No paused or interrupted downloads found');
    }
  }

  // ===========================================================================
  // LISTENERS
  // ===========================================================================

  subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    this.getAllDownloads().then(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeToProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private async notifyListeners(): Promise<void> {
    const downloads = await this.getAllDownloads();
    for (const listener of this.listeners) {
      listener(downloads);
    }
  }
}

// Singleton instance
export const downloadManager = new DownloadManager();
