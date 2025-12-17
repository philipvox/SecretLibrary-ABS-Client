/**
 * src/core/services/downloadManager.ts
 *
 * Download manager for offline audio files.
 * Handles download queue, progress tracking, and file management.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { sqliteCache } from './sqliteCache';
import { waveformService } from './waveformService';
import { networkMonitor, NetworkState } from './networkMonitor';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';
import { formatBytes } from '@/shared/utils/format';
import { haptics } from '@/core/native/haptics';

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
  status: 'pending' | 'downloading' | 'complete' | 'error' | 'paused' | 'waiting_wifi';
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
  private networkUnsubscribe: (() => void) | null = null;
  private previousCanDownload: boolean = true;

  // In-memory progress tracking with byte info
  private progressInfo: Map<string, ProgressInfo> = new Map();

  // Throttle notifications to avoid excessive UI updates
  private lastNotifyTime = 0;
  private readonly NOTIFY_THROTTLE_MS = 500; // Notify UI every 500ms max

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

    // Subscribe to network changes
    this.previousCanDownload = networkMonitor.canDownload();
    this.networkUnsubscribe = networkMonitor.subscribe((state) => {
      this.handleNetworkChange(state);
    });
    log(`Network monitoring enabled, canDownload: ${this.previousCanDownload}`);

    // Clear any stuck downloads from previous session
    // (active downloads in memory don't persist across app restarts)
    const downloading = await sqliteCache.getDownloadsByStatus('downloading');
    if (downloading.length > 0) {
      log(`Found ${downloading.length} stuck downloads from previous session, resetting to pending...`);
      for (const item of downloading) {
        // Reset to pending so they can be retried
        await sqliteCache.addToDownloadQueue(item.itemId, 0);
        await sqliteCache.updateDownloadProgress(item.itemId, 0);
      }
    }

    // Resume any paused downloads
    await this.resumePausedDownloads();

    // Start processing the queue
    log('Starting queue processing...');
    this.processQueue();

    log('Download manager initialized');
  }

  /**
   * Handle network state changes
   */
  private async handleNetworkChange(state: NetworkState): Promise<void> {
    const canDownloadNow = state.canDownload;

    if (this.previousCanDownload && !canDownloadNow) {
      // Was able to download, now cannot (WiFi → Cellular or Offline)
      log('Network changed: downloads now blocked, pausing active downloads...');
      await this.pauseAllForNetwork();
    } else if (!this.previousCanDownload && canDownloadNow) {
      // Was blocked, now can download (Cellular → WiFi or Online)
      log('Network changed: downloads now allowed, resuming waiting downloads...');
      await this.resumeWaitingDownloads();
    }

    this.previousCanDownload = canDownloadNow;
  }

  /**
   * Pause all active downloads due to network change
   */
  private async pauseAllForNetwork(): Promise<void> {
    for (const [itemId, download] of this.activeDownloads) {
      try {
        await download.pauseAsync();
        log(`Paused download for network: ${itemId}`);
      } catch (err) {
        logWarn(`Failed to pause download ${itemId}:`, err);
      }
    }
    this.activeDownloads.clear();

    // Update all downloading items to waiting_wifi status
    const downloading = await sqliteCache.getDownloadsByStatus('downloading');
    for (const item of downloading) {
      await sqliteCache.setDownload({
        ...item,
        status: 'waiting_wifi' as any,
      });
    }

    this.notifyListeners();
  }

  /**
   * Resume downloads that were waiting for WiFi
   */
  private async resumeWaitingDownloads(): Promise<void> {
    const waiting = await sqliteCache.getDownloadsByStatus('waiting_wifi' as any);
    if (waiting.length > 0) {
      log(`Resuming ${waiting.length} downloads that were waiting for WiFi...`);
      for (const download of waiting) {
        await sqliteCache.setDownload({
          ...download,
          status: 'pending',
        });
        await sqliteCache.addToDownloadQueue(download.itemId, 10); // High priority
      }
      this.notifyListeners();
      this.processQueue();
    }
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Queue a book for download
   * @param item The library item to download
   * @param priority Download priority (higher = sooner)
   * @param overrideCellular If true, allow this download on cellular even if WiFi-only is enabled
   * @returns Object with success status and optional reason if blocked
   */
  async queueDownload(
    item: LibraryItem,
    priority = 0,
    overrideCellular = false
  ): Promise<{ success: boolean; reason?: string }> {
    const itemId = item.id;
    const title = (item.media?.metadata as any)?.title || 'Unknown';

    log(`Queueing download: "${title}" (${itemId}) with priority ${priority}`);

    // Check if already downloaded
    const existing = await sqliteCache.getDownload(itemId);
    if (existing?.status === 'complete') {
      log(`Already downloaded: "${title}" - skipping`);
      return { success: true };
    }

    if (existing) {
      log(`Existing download status: ${existing.status}, progress: ${(existing.progress * 100).toFixed(1)}%`);
    }

    // Check network conditions
    const canDownload = networkMonitor.canDownload();
    const blockedReason = networkMonitor.getDownloadBlockedReason();

    // Determine initial status based on network
    let initialStatus: 'pending' | 'waiting_wifi' = 'pending';

    if (!canDownload && !overrideCellular) {
      if (!networkMonitor.isConnected()) {
        log(`No network connection - rejecting download`);
        return { success: false, reason: blockedReason || 'No internet connection' };
      }

      // WiFi-only mode and on cellular - queue as waiting
      log(`WiFi-only mode enabled, on cellular - queuing as waiting_wifi`);
      initialStatus = 'waiting_wifi';
    }

    // Add to database
    log(`Adding to download database with ${initialStatus} status...`);
    await sqliteCache.setDownload({
      itemId,
      status: initialStatus as any,
      progress: 0,
      filePath: null,
      fileSize: null,
      downloadedAt: null,
      error: null,
    });

    // Add to queue (only if pending, not waiting)
    if (initialStatus === 'pending') {
      log(`Adding to download queue...`);
      await sqliteCache.addToDownloadQueue(itemId, priority);
    }

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

    // Start processing queue if we can download
    if (initialStatus === 'pending') {
      log(`Triggering queue processing...`);
      this.processQueue();
    }

    return {
      success: true,
      reason: initialStatus === 'waiting_wifi' ? 'Queued - will start when WiFi is available' : undefined,
    };
  }

  /**
   * Check if a download can start now (based on network)
   */
  canStartDownload(): boolean {
    return networkMonitor.canDownload();
  }

  /**
   * Get the reason downloads are blocked
   */
  getDownloadBlockedReason(): string | null {
    return networkMonitor.getDownloadBlockedReason();
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
    // Also delete waveform data
    await waveformService.deleteWaveform(itemId);
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

  /**
   * Cancel all active and pending downloads, clear the queue
   */
  async cancelAllDownloads(): Promise<void> {
    log('Cancelling all active and pending downloads...');

    // Cancel any active downloads
    for (const [itemId, download] of this.activeDownloads) {
      log(`Cancelling active download: ${itemId}`);
      try {
        await download.cancelAsync();
      } catch (e) {
        // Ignore cancel errors
      }
      await sqliteCache.failDownload(itemId, 'Cancelled by user');
    }
    this.activeDownloads.clear();
    this.progressInfo.clear();
    this.isProcessingQueue = false;

    // Fail all pending/downloading items in database
    const pending = await sqliteCache.getDownloadsByStatus('pending');
    const downloading = await sqliteCache.getDownloadsByStatus('downloading');

    for (const item of [...pending, ...downloading]) {
      log(`Cancelling queued item: ${item.itemId}`);
      await sqliteCache.failDownload(item.itemId, 'Cancelled by user');
    }

    // Clear the queue
    await sqliteCache.clearDownloadQueue();

    this.notifyListeners();
    log('All downloads cancelled');
  }

  /**
   * Check if downloads are stuck and reset if needed
   */
  async resetIfStuck(): Promise<boolean> {
    // If we have active downloads but no progress for 2 minutes, consider it stuck
    if (this.activeDownloads.size > 0) {
      log(`Resetting ${this.activeDownloads.size} stuck active downloads`);
      await this.cancelAllDownloads();
      return true;
    }

    // Also check if isProcessingQueue is stuck
    if (this.isProcessingQueue) {
      log('Resetting stuck processing queue flag');
      this.isProcessingQueue = false;
      return true;
    }

    return false;
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

    // Check if we can download
    if (!networkMonitor.canDownload()) {
      const reason = networkMonitor.getDownloadBlockedReason();
      log(`Cannot process queue: ${reason}`);
      return;
    }

    this.isProcessingQueue = true;
    log('Processing download queue...');

    try {
      const nextItemId = await sqliteCache.getNextDownload();
      if (!nextItemId) {
        log('Queue empty - nothing to download');
        this.isProcessingQueue = false;
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
        this.isProcessingQueue = false;
        // Continue processing queue in case there are more items
        setTimeout(() => this.processQueue(), 100);
        return;
      }

      const title = (item.media?.metadata as any)?.title || 'Unknown';
      log(`Starting download for: "${title}"`);

      // Remove from queue before starting
      await sqliteCache.removeFromDownloadQueue(nextItemId);

      // Release the processing lock before starting the actual download
      // The download itself is tracked via activeDownloads
      this.isProcessingQueue = false;

      // Start download (this may take a long time)
      await this.startDownload(item);
    } catch (error) {
      logError('Error processing queue:', error);
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
      let waitingInterval: ReturnType<typeof setInterval> | undefined;
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

        // Create a timeout promise - 5 minutes for uncached files
        // The server may need to fetch from origin first
        const timeoutMs = 5 * 60 * 1000; // 5 minutes per file
        log(`Starting download with ${timeoutMs / 1000}s timeout (waiting for server cache)...`);

        const startTime = Date.now();

        // Log a message every 30 seconds if still waiting
        waitingInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          log(`Still waiting for download to start... (${elapsed}s elapsed, server may be caching from origin)`);
        }, 30000);

        const downloadPromise = download.downloadAsync();
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Download timed out after 15 minutes - server may be unreachable or file too large')), timeoutMs);
        });

        const result = await Promise.race([downloadPromise, timeoutPromise]);
        clearInterval(waitingInterval);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!result) {
          throw new Error('Download returned null');
        }

        log(`File ${fileIndex + 1}/${totalFiles} downloaded in ${elapsed}s`);
        logVerbose(`Result status: ${result.status}, URI: ${result.uri}`);

        return result;
      } catch (error) {
        if (waitingInterval) clearInterval(waitingInterval);
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

      // Track downloaded file paths for waveform extraction
      const downloadedFilePaths: string[] = [];

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

        downloadedFilePaths.push(destPath);
        downloadedSize += fileSize;
        log(`File ${i + 1} complete. Downloaded so far: ${formatBytes(downloadedSize)}`);
      }

      // Download cover image
      log(`Downloading cover image...`);
      await this.downloadCover(item, destDir);

      // Extract waveform for scrub visualization (non-blocking)
      log(`Extracting waveform for scrub visualization...`);
      const bookMedia = fullItem.media as any;
      const bookDuration = bookMedia?.duration || 0;
      const chapters = bookMedia?.chapters?.map((ch: any) => ({
        title: ch.title,
        start: ch.start,
        end: ch.end,
      }));

      // Run waveform extraction in background (don't block download completion)
      waveformService.extractWaveform(
        itemId,
        downloadedFilePaths,
        bookDuration,
        chapters
      ).then(waveform => {
        if (waveform) {
          log(`Waveform extracted: ${waveform.totalSamples} samples`);
        } else {
          logWarn(`Waveform extraction failed for ${itemId}`);
        }
      }).catch(err => {
        logWarn(`Waveform extraction error:`, err);
      });

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

      // Haptic feedback for download complete
      haptics.downloadComplete();

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

      // Haptic feedback for download failed
      haptics.downloadFailed();

      // Process next item in queue
      this.processQueue();
    }
  }

  private async updateProgress(itemId: string, progress: number, bytesDownloaded: number, totalBytes: number): Promise<void> {
    // Store byte info in memory
    this.progressInfo.set(itemId, { bytesDownloaded, totalBytes });

    await sqliteCache.updateDownloadProgress(itemId, progress);

    // Notify progress listeners (for useDownloadProgress hook)
    for (const listener of this.progressListeners) {
      listener(itemId, progress, bytesDownloaded, totalBytes);
    }

    // Throttled notification to main listeners (for useDownloadStatus hook)
    // This ensures UI components like BookCard update during downloads
    const now = Date.now();
    if (now - this.lastNotifyTime >= this.NOTIFY_THROTTLE_MS) {
      this.lastNotifyTime = now;
      this.notifyListeners();
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
