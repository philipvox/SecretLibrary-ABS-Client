/**
 * src/core/services/downloadManager.ts
 *
 * Download manager for offline audio files.
 * Handles download queue, progress tracking, and file management.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { sqliteCache } from './sqliteCache';
import { networkMonitor, NetworkState } from './networkMonitor';
import { apiClient } from '@/core/api';
import { LibraryItem, BookMedia, BookMetadata, BookChapter } from '@/core/types';
import { isAudioFile } from '@/constants/audio';
import { formatBytes } from '@/shared/utils/format';
import { haptics } from '@/core/native/haptics';
import { trackEvent } from '@/core/monitoring';
import { eventBus } from '@/core/events';
import { generateAndCacheTicks } from '@/features/player/services/tickCache';
import { ChapterInput } from '@/features/player/utils/tickGenerator';
import { logger } from '@/shared/utils/logger';
import {
  quickValidate,
  verifyFileIntegrity,
  getIntegrityStatusSummary,
  type FileIntegrityInfo,
} from './downloadIntegrity';

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'audioFiles' in media && Array.isArray(media.audioFiles);
}

// Helper to get book metadata safely
function getBookMetadata(item: LibraryItem | null | undefined): BookMetadata | null {
  if (!item || !isBookMedia(item.media)) return null;
  return item.media.metadata;
}

// Helper to get book title
function getBookTitle(item: LibraryItem | null | undefined): string {
  return getBookMetadata(item)?.title || 'Unknown';
}

// Audio file type (from audioFiles array)
interface AudioFileInfo {
  ino: string;
  metadata?: {
    filename?: string;
    ext?: string;  // Original file extension (e.g., '.mp3', '.m4a')
    size?: number;
  };
}

// =============================================================================
// LOGGING
// =============================================================================

const LOG_PREFIX = '[DownloadManager]';
const VERBOSE = __DEV__; // Only verbose logging in development

function log(...args: any[]) {
  logger.debug(LOG_PREFIX, ...args);
}

function logVerbose(...args: any[]) {
  if (VERBOSE) {
    logger.debug(LOG_PREFIX, '[VERBOSE]', ...args);
  }
}

function logError(...args: any[]) {
  logger.error(LOG_PREFIX, '[ERROR]', ...args);
}

function logWarn(...args: any[]) {
  logger.warn(LOG_PREFIX, '[WARN]', ...args);
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
  completedAt?: number;
  libraryItem?: LibraryItem; // Included for complete downloads
}

type DownloadListener = (tasks: DownloadTask[]) => void;
type ProgressListener = (itemId: string, progress: number, bytesDownloaded: number, totalBytes: number) => void;

// In-memory progress tracking (byte-level detail not stored in SQLite)
interface ProgressInfo {
  bytesDownloaded: number;
  totalBytes: number;
  totalFiles: number;
  filesDownloaded: number;
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
      // Clean up orphan directories (from crashed downloads)
      await this.cleanOrphanDirectories();
    }

    // Subscribe to network changes
    this.previousCanDownload = networkMonitor.canDownload();
    this.networkUnsubscribe = networkMonitor.subscribe((state) => {
      this.handleNetworkChange(state);
    });
    log(`Network monitoring enabled, canDownload: ${this.previousCanDownload}`);

    // Clear any stuck downloads from previous session
    // (active downloads in memory don't persist across app restarts)
    // If they have resumable state, keep progress for byte-level resume
    const downloading = await sqliteCache.getDownloadsByStatus('downloading');
    if (downloading.length > 0) {
      const withState = downloading.filter(d => d.resumableState);
      const withoutState = downloading.filter(d => !d.resumableState);

      log(`Found ${downloading.length} stuck downloads from previous session`);
      log(`  ${withState.length} with resumable state (will resume from byte position)`);
      log(`  ${withoutState.length} without state (will restart from beginning)`);

      trackEvent('download_stuck_on_init', {
        stuck_count: downloading.length,
        with_resume_state: withState.length,
        item_ids: downloading.map(d => d.itemId).slice(0, 5),
      }, 'warning');

      for (const item of downloading) {
        // Add to queue so they can be processed
        await sqliteCache.addToDownloadQueue(item.itemId, 0);
        // Only reset progress if no resumable state (will be resumed from saved bytes)
        if (!item.resumableState) {
          await sqliteCache.updateDownloadProgress(item.itemId, 0);
        }
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
        status: 'waiting_wifi',
      });
    }

    this.notifyListeners();
  }

  /**
   * Resume downloads that were waiting for WiFi
   */
  private async resumeWaitingDownloads(): Promise<void> {
    const waiting = await sqliteCache.getDownloadsByStatus('waiting_wifi');
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
    const title = getBookTitle(item);

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
      status: initialStatus,
      progress: 0,
      filePath: null,
      fileSize: null,
      downloadedAt: null,
      error: null,
      userPaused: false,
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

    // CRITICAL: Update DB status FIRST, before calling pauseAsync()
    // This prevents race condition where retry loop checks DB before we update it
    const existingDownload = await sqliteCache.getDownload(itemId);

    if (existingDownload && (existingDownload.status === 'downloading' || existingDownload.status === 'pending')) {
      // Get progress from memory (most up-to-date) or fall back to DB
      const memoryProgress = this.progressInfo.get(itemId);
      let currentProgress = existingDownload.progress || 0;

      // If we have in-memory progress with totalBytes, calculate real progress
      if (memoryProgress && memoryProgress.totalBytes > 0) {
        const calculatedProgress = memoryProgress.bytesDownloaded / memoryProgress.totalBytes;
        // Use the higher of the two (progress should only increase)
        currentProgress = Math.max(currentProgress, calculatedProgress);
      }

      log(`Setting status to 'paused' at ${(currentProgress * 100).toFixed(1)}%`);

      await sqliteCache.setDownload({
        itemId,
        status: 'paused',
        progress: currentProgress,
        filePath: existingDownload.filePath, // Preserve existing values
        fileSize: existingDownload.fileSize,
        downloadedAt: existingDownload.downloadedAt,
        error: null,
        userPaused: true, // User explicitly paused - don't auto-resume
      });

      // Remove from queue if pending
      await sqliteCache.removeFromDownloadQueue(itemId);
    }

    // NOW pause the actual download (after DB is updated)
    const download = this.activeDownloads.get(itemId);
    if (download) {
      await download.pauseAsync();
      this.activeDownloads.delete(itemId);
      log(`Download paused: ${itemId}`);
    }

    if (existingDownload && (existingDownload.status === 'downloading' || existingDownload.status === 'pending')) {
      this.notifyListeners();
    } else if (!existingDownload) {
      logWarn(`No download found to pause: ${itemId}`);
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
        userPaused: false, // Clear user pause flag on resume
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
        userPaused: false, // Clear user pause flag on retry
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
   * NOTE: This method only returns cached metadata - it does NOT make API calls.
   */
  async getDownloadStatus(itemId: string): Promise<DownloadTask | null> {
    const record = await sqliteCache.getDownload(itemId);
    if (!record) return null;

    const progressInfo = this.progressInfo.get(itemId);
    const task: DownloadTask = {
      itemId: record.itemId,
      status: record.status,
      progress: record.progress,
      bytesDownloaded: progressInfo?.bytesDownloaded || 0,
      totalBytes: progressInfo?.totalBytes || record.fileSize || 0,
      error: record.error || undefined,
    };

    // Include library item for completed downloads (from cache only)
    if (record.status === 'complete') {
      const libraryItem = await sqliteCache.getLibraryItem(itemId);
      if (libraryItem) {
        task.libraryItem = libraryItem;
      }
      // If not in cache, just skip - don't make API calls here
    }

    return task;
  }

  /**
   * Get all downloads
   * NOTE: This method only returns cached metadata - it does NOT make API calls.
   * Metadata should be cached when the download is queued or started.
   */
  async getAllDownloads(): Promise<DownloadTask[]> {
    const records = await sqliteCache.getAllDownloads();

    // Build tasks from cached data only - no API calls
    const tasks = await Promise.all(
      records.map(async (r) => {
        const progressInfo = this.progressInfo.get(r.itemId);
        const task: DownloadTask = {
          itemId: r.itemId,
          status: r.status,
          progress: r.progress,
          bytesDownloaded: progressInfo?.bytesDownloaded || 0,
          totalBytes: progressInfo?.totalBytes || r.fileSize || 0,
          error: r.error || undefined,
        };

        // Include library item for completed downloads (from cache only)
        if (r.status === 'complete') {
          const libraryItem = await sqliteCache.getLibraryItem(r.itemId);
          if (libraryItem) {
            task.libraryItem = libraryItem;
          }
          // If not in cache, just skip - don't make API calls here
          // The metadata should have been cached when the download was queued
        }

        return task;
      })
    );

    return tasks;
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
   * Get list of downloaded audio files for an item.
   * Returns array of file paths in order, or empty array if none downloaded.
   * Used for partial download playback.
   */
  async getDownloadedFiles(itemId: string): Promise<string[]> {
    const localPath = this.getLocalPath(itemId);
    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (!info.exists || !info.isDirectory) {
        return [];
      }

      const contents = await FileSystem.readDirectoryAsync(localPath);
      const audioFiles = contents
        .filter(isAudioFile)
        .sort() // Files are named 000_, 001_, etc. so sorting works
        .map(name => `${localPath}${name}`);

      return audioFiles;
    } catch (error) {
      logWarn(`Error getting downloaded files for ${itemId}:`, error);
      return [];
    }
  }

  /**
   * Check if an item has any files ready for playback.
   * Returns true if at least the first audio file is downloaded.
   * Used to enable "Play while downloading" functionality.
   */
  async canPlayPartially(itemId: string): Promise<boolean> {
    const files = await this.getDownloadedFiles(itemId);
    return files.length > 0;
  }

  /**
   * Get the download progress including file-level details.
   * Used for partial download playback to know which chapters/files are available.
   */
  async getDetailedProgress(itemId: string): Promise<{
    status: string;
    progress: number;
    downloadedFiles: number;
    totalFiles: number;
    filesReady: string[];
  } | null> {
    const record = await sqliteCache.getDownload(itemId);
    if (!record) return null;

    const downloadedFiles = await this.getDownloadedFiles(itemId);

    // Get total files from in-memory progress info (accurate during download)
    // Falls back to downloaded files count for completed downloads
    const progressInfo = this.progressInfo.get(itemId);
    const totalFiles = progressInfo?.totalFiles || downloadedFiles.length;

    return {
      status: record.status,
      progress: record.progress,
      downloadedFiles: downloadedFiles.length,
      totalFiles,
      filesReady: downloadedFiles,
    };
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
   * Clean up orphan directories from crashed/interrupted downloads.
   * Removes directories that exist on disk but don't have 'complete' status in DB.
   */
  private async cleanOrphanDirectories(): Promise<void> {
    try {
      log('Checking for orphan download directories...');

      // Get all directories in the download folder
      const contents = await FileSystem.readDirectoryAsync(this.DOWNLOAD_DIR);

      // Get all complete downloads from database
      const completeDownloads = await sqliteCache.getDownloadsByStatus('complete');
      const completeIds = new Set(completeDownloads.map(d => d.itemId));

      // Get all in-progress downloads (don't delete these)
      const downloadingItems = await sqliteCache.getDownloadsByStatus('downloading');
      const pendingItems = await sqliteCache.getDownloadsByStatus('pending');
      const pausedItems = await sqliteCache.getDownloadsByStatus('paused');
      const activeIds = new Set([
        ...downloadingItems.map(d => d.itemId),
        ...pendingItems.map(d => d.itemId),
        ...pausedItems.map(d => d.itemId),
      ]);

      let orphansRemoved = 0;
      for (const dirName of contents) {
        const dirPath = `${this.DOWNLOAD_DIR}${dirName}`;
        const info = await FileSystem.getInfoAsync(dirPath);

        // Only process directories (not files)
        if (!info.isDirectory) continue;

        // If directory doesn't correspond to a complete or active download, it's orphaned
        if (!completeIds.has(dirName) && !activeIds.has(dirName)) {
          logWarn(`Found orphan directory: ${dirName}, removing...`);
          await FileSystem.deleteAsync(dirPath, { idempotent: true });
          orphansRemoved++;
        }
      }

      if (orphansRemoved > 0) {
        log(`Cleaned up ${orphansRemoved} orphan directories`);
        trackEvent('download_orphans_cleaned', { count: orphansRemoved });
      } else {
        log('No orphan directories found');
      }
    } catch (error) {
      // Don't fail init if orphan cleanup fails
      logWarn('Failed to clean orphan directories:', error);
    }
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
      trackEvent('download_stuck_reset', {
        stuck_count: this.activeDownloads.size,
        active_ids: Array.from(this.activeDownloads.keys()).slice(0, 5),
      }, 'warning');
      await this.cancelAllDownloads();
      return true;
    }

    // Also check if isProcessingQueue is stuck
    if (this.isProcessingQueue) {
      log('Resetting stuck processing queue flag');
      trackEvent('download_queue_stuck_reset', {}, 'warning');
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

      const title = getBookTitle(item);
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
   * Download a single file with retry logic and byte-level resume support
   */
  private async downloadFileWithRetry(
    url: string,
    destPath: string,
    token: string,
    itemId: string,
    fileIndex: number,
    totalFiles: number,
    onProgress: (bytesWritten: number) => void,
    maxRetries: number = 3,
    savedResumeState?: string | null
  ): Promise<FileSystem.FileSystemDownloadResult> {
    let lastError: Error | null = null;
    let currentResumeData: string | undefined; // Just the resumeData string, not full state
    let existingBytes = 0;

    // Parse saved state if available and check existing file size
    if (savedResumeState) {
      try {
        const parsedState: FileSystem.DownloadPauseState = JSON.parse(savedResumeState);
        currentResumeData = parsedState.resumeData; // Extract just the resumeData string
        // Check how many bytes already downloaded by checking file on disk
        const fileInfo = await FileSystem.getInfoAsync(destPath);
        if (fileInfo.exists && fileInfo.size) {
          existingBytes = fileInfo.size;
        }
        log(`Resuming from saved state (${formatBytes(existingBytes)} already on disk)`);
      } catch {
        log('Failed to parse saved resume state, starting fresh');
      }
    }

    logVerbose(`Downloading file ${fileIndex + 1}/${totalFiles}`);
    logVerbose(`URL: ${url}`);
    logVerbose(`Destination: ${destPath}`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let waitingInterval: ReturnType<typeof setInterval> | undefined;
      let stateSaveInterval: ReturnType<typeof setInterval> | undefined;
      let download: FileSystem.DownloadResumable | null = null;

      try {
        if (attempt > 0) {
          log(`Retry attempt ${attempt + 1}/${maxRetries} for file ${fileIndex + 1}...`);
        }

        // Create download with resume data if available
        download = FileSystem.createDownloadResumable(
          url,
          destPath,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          (downloadProgress) => {
            onProgress(downloadProgress.totalBytesWritten);
          },
          currentResumeData // Pass resume data string for resume
        );

        this.activeDownloads.set(itemId, download);

        // Save download state periodically (every 10 seconds) for resume on crash/restart
        stateSaveInterval = setInterval(async () => {
          if (download) {
            try {
              const state = await download.savable();
              if (state) {
                await sqliteCache.updateDownloadResumableState(itemId, JSON.stringify(state));
                logVerbose(`Saved download state`);
              }
            } catch {
              // Ignore save errors - not critical
            }
          }
        }, 10000);

        // Create a timeout promise - 5 minutes for uncached files
        // The server may need to fetch from origin first
        const timeoutMs = 5 * 60 * 1000; // 5 minutes per file
        const isResuming = !!currentResumeData;
        log(`${isResuming ? 'Resuming' : 'Starting'} download with ${timeoutMs / 1000}s timeout...`);

        const startTime = Date.now();

        // Log a message every 30 seconds if still waiting
        waitingInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          log(`Still waiting for download to start... (${elapsed}s elapsed, server may be caching from origin)`);
        }, 30000);

        // Use resumeAsync if we have saved resume data, otherwise downloadAsync
        const downloadPromise = currentResumeData
          ? download.resumeAsync()
          : download.downloadAsync();

        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Download timed out after 5 minutes - server may be unreachable or file too large')), timeoutMs);
        });

        const result = await Promise.race([downloadPromise, timeoutPromise]);
        clearInterval(waitingInterval);
        clearInterval(stateSaveInterval);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (!result) {
          // Check if download was paused by user - if so, don't treat as error
          const downloadStatus = await sqliteCache.getDownload(itemId);
          if (downloadStatus?.status === 'paused') {
            log(`Download was paused by user, stopping retry loop`);
            throw new Error('DOWNLOAD_PAUSED');
          }
          throw new Error('Download returned null');
        }

        // Clear resume state on success
        await sqliteCache.updateDownloadResumableState(itemId, null);

        log(`File ${fileIndex + 1}/${totalFiles} downloaded in ${elapsed}s`);
        logVerbose(`Result status: ${result.status}, URI: ${result.uri}`);

        return result;
      } catch (error) {
        if (waitingInterval) clearInterval(waitingInterval);
        if (stateSaveInterval) clearInterval(stateSaveInterval);

        // Save current state for resume on next attempt
        if (download) {
          try {
            const state = await download.savable();
            if (state && state.resumeData) {
              currentResumeData = state.resumeData; // Extract just the resume data string
              await sqliteCache.updateDownloadResumableState(itemId, JSON.stringify(state));
              // Check file size to report progress
              const fileInfo = await FileSystem.getInfoAsync(destPath);
              const bytesOnDisk = fileInfo.exists && fileInfo.size ? fileInfo.size : 0;
              log(`Saved resume state on error (${formatBytes(bytesOnDisk)} on disk)`);
            }
          } catch {
            // Ignore save errors
          }
        }

        lastError = error instanceof Error ? error : new Error('Download failed');

        // If download was paused, don't retry - exit immediately
        if (lastError.message === 'DOWNLOAD_PAUSED') {
          throw lastError;
        }

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
    const title = getBookTitle(item);
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
      const token = apiClient.getAuthToken();

      log(`Server URL: ${serverUrl}`);
      log(`Token available: ${token ? 'Yes' : 'NO - MISSING!'}`);

      if (!serverUrl || !token) {
        throw new Error('Not authenticated - missing server URL or token');
      }

      // Fetch full item details from API to get audioFiles
      // The cached item may not have audioFiles included
      log(`Fetching full item details from API...`);
      const fullItem = await apiClient.getItem(itemId);

      // Get audio files to download
      const audioFiles: AudioFileInfo[] = isBookMedia(fullItem.media)
        ? (fullItem.media.audioFiles as AudioFileInfo[])
        : [];
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

      // DISK SPACE CHECK: Ensure enough storage before starting download
      // Add 20% buffer to account for file system overhead and temporary files
      const requiredSpace = Math.ceil(totalSize * 1.2);
      try {
        const freeSpace = await FileSystem.getFreeDiskStorageAsync();
        log(`Free disk space: ${formatBytes(freeSpace)}, Required: ${formatBytes(requiredSpace)}`);

        if (freeSpace < requiredSpace) {
          const shortfall = requiredSpace - freeSpace;
          throw new Error(
            `Insufficient disk space. Need ${formatBytes(shortfall)} more free space to download "${title}".`
          );
        }
      } catch (spaceError) {
        if (spaceError instanceof Error && spaceError.message.includes('Insufficient disk space')) {
          // Re-throw disk space errors
          throw spaceError;
        }
        // Log but don't fail on disk space check errors (e.g., API not available)
        logWarn('Failed to check disk space, proceeding with download:', spaceError);
      }

      // Check for saved resume state (for byte-level resume after crash/restart)
      const existingDownload = await sqliteCache.getDownload(itemId);
      let savedResumeState: FileSystem.DownloadPauseState | null = null;
      if (existingDownload?.resumableState) {
        try {
          savedResumeState = JSON.parse(existingDownload.resumableState);
          log(`Found saved resume state for file: ${savedResumeState?.fileUri}`);
        } catch {
          log('Failed to parse saved resume state');
        }
      }

      // Initialize progress tracking with total size and file counts
      this.progressInfo.set(itemId, {
        bytesDownloaded: 0,
        totalBytes: totalSize,
        totalFiles: audioFiles.length,
        filesDownloaded: 0,
      });

      // Track integrity verification retries per file (to avoid infinite loops)
      const integrityRetries: Map<number, number> = new Map();
      const MAX_INTEGRITY_RETRIES = 2;

      // Download each audio file with retry logic
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const fileUrl = `${serverUrl}/api/items/${itemId}/file/${file.ino}`;
        // Use original extension to avoid Android codec detection issues
        // Android's ExoPlayer may fail if extension doesn't match actual codec
        const ext = file.metadata?.ext || '.m4a';
        const destPath = `${destDir}${i.toString().padStart(3, '0')}_${file.ino}${ext}`;
        const fileSize = file.metadata?.size || 0;

        // Check if file is already fully downloaded (skip it)
        const fileInfo = await FileSystem.getInfoAsync(destPath);
        if (fileInfo.exists && fileInfo.size && fileInfo.size >= fileSize * 0.99) {
          log(`File ${i + 1}/${audioFiles.length} already exists (${formatBytes(fileInfo.size)}), skipping...`);
          downloadedSize += fileSize;
          continue;
        }

        // Check if this is the file to resume (matches saved state destination)
        let resumeStateForThisFile: string | null = null;
        let bytesAlreadyOnDisk = 0;
        if (savedResumeState && savedResumeState.fileUri === destPath) {
          resumeStateForThisFile = existingDownload?.resumableState || null;
          // Check actual bytes on disk
          bytesAlreadyOnDisk = fileInfo.exists && fileInfo.size ? fileInfo.size : 0;
          log(`Resuming file ${i + 1} from ${formatBytes(bytesAlreadyOnDisk)} (${Math.round(bytesAlreadyOnDisk / fileSize * 100)}%)`);
          downloadedSize += bytesAlreadyOnDisk; // Count already downloaded bytes
        }

        log(`───────────────────────────────────────────────────────`);
        log(`File ${i + 1}/${audioFiles.length}: ${file.metadata?.filename || file.ino}`);
        log(`Extension: ${ext}, Size: ${formatBytes(fileSize)}`);
        log(`Dest: ${destPath}`);

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
          },
          3, // maxRetries
          resumeStateForThisFile // Pass saved resume state if available
        );

        // Only add remaining file size if we didn't already count resumed bytes
        if (!resumeStateForThisFile) {
          downloadedSize += fileSize;
        } else {
          // Add the portion that wasn't already counted (fileSize - bytesAlreadyOnDisk)
          downloadedSize += Math.max(0, fileSize - bytesAlreadyOnDisk);
        }

        // Verify file integrity after download
        log(`Verifying file ${i + 1} integrity...`);
        const integrityResult = await verifyFileIntegrity({
          filePath: destPath,
          expectedSize: fileSize,
        });

        if (!integrityResult.isValid) {
          const summary = getIntegrityStatusSummary(integrityResult);
          const retryCount = integrityRetries.get(i) || 0;

          logWarn(`File ${i + 1} integrity check failed: ${summary} (retry ${retryCount}/${MAX_INTEGRITY_RETRIES})`);
          trackEvent('download_integrity_failed', {
            item_id: itemId,
            file_index: i,
            expected_size: fileSize,
            actual_size: integrityResult.actualSize,
            error: integrityResult.error,
            retry_count: retryCount,
          }, 'warning');

          // Check if we've exceeded max retries
          if (retryCount >= MAX_INTEGRITY_RETRIES) {
            logError(`File ${i + 1} failed integrity check after ${MAX_INTEGRITY_RETRIES} retries, aborting download`);
            throw new Error(`File integrity verification failed after ${MAX_INTEGRITY_RETRIES} retries: ${summary}`);
          }

          // Delete corrupted file and retry
          try {
            await FileSystem.deleteAsync(destPath, { idempotent: true });
            log(`Deleted corrupted file, retrying download...`);
          } catch {
            // Ignore deletion errors
          }

          // Track retry count and retry this file
          integrityRetries.set(i, retryCount + 1);
          downloadedSize -= fileSize; // Undo the size addition
          i--; // Decrement to retry same index after loop increment
          continue;
        }

        log(`File ${i + 1} verified: ${getIntegrityStatusSummary(integrityResult)}`);
        log(`File ${i + 1} complete. Downloaded so far: ${formatBytes(downloadedSize)}`);

        // Update files downloaded count in progress info
        const progressUpdate = this.progressInfo.get(itemId);
        if (progressUpdate) {
          progressUpdate.filesDownloaded = i + 1;
          this.progressInfo.set(itemId, progressUpdate);
        }

        // Emit file complete event for partial download playback
        eventBus.emit('download:file_complete', {
          bookId: itemId,
          fileIndex: i,
          totalFiles: audioFiles.length,
          filePath: destPath,
        });
      }

      // Download cover image
      log(`Downloading cover image...`);
      await this.downloadCover(item, destDir);

      // Final quick validation of all files before marking complete
      log(`Running final integrity check on all ${audioFiles.length} files...`);
      let allFilesValid = true;
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const ext = file.metadata?.ext || '.m4a';
        const filePath = `${destDir}${i.toString().padStart(3, '0')}_${file.ino}${ext}`;
        const expectedSize = file.metadata?.size || 0;

        const isValid = await quickValidate(filePath, expectedSize);
        if (!isValid) {
          logError(`Final validation failed for file ${i + 1}: ${filePath}`);
          allFilesValid = false;
        }
      }

      if (!allFilesValid) {
        trackEvent('download_final_validation_failed', { item_id: itemId }, 'error');
        throw new Error('Final integrity validation failed - some files are missing or corrupted');
      }
      log(`All ${audioFiles.length} files passed final validation`);

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

      // Pre-generate and cache timeline ticks for downloaded book
      try {
        const bookChapters: BookChapter[] = fullItem.media?.chapters || [];
        const bookDuration = fullItem.media?.duration || 0;

        if (bookDuration > 0 && bookChapters.length > 0) {
          const chapterInputs: ChapterInput[] = bookChapters.map((ch, i) => ({
            start: ch.start || 0,
            end: ch.end || bookChapters[i + 1]?.start || bookDuration,
            displayTitle: ch.title,
          }));

          log(`Pre-generating timeline ticks for "${title}"...`);
          await generateAndCacheTicks(itemId, bookDuration, chapterInputs, true);
          log(`Timeline ticks cached for "${title}"`);
        }
      } catch (tickError) {
        logWarn(`Failed to pre-generate ticks for "${title}":`, tickError);
        // Non-fatal - ticks will be generated on first play
      }

      // Emit download complete event
      eventBus.emit('download:complete', {
        bookId: itemId,
        totalSize,
        filePath: destDir,
      });

      // Process next item in queue
      this.processQueue();
    } catch (error) {
      this.activeDownloads.delete(itemId);
      this.progressInfo.delete(itemId); // Clear in-memory progress
      const message = error instanceof Error ? error.message : 'Download failed';

      // Handle user-paused downloads gracefully - don't mark as failed
      if (message === 'DOWNLOAD_PAUSED') {
        log(`Download paused by user: "${title}" - not marking as failed`);
        this.notifyListeners();
        // Process next item in queue (the paused one should already be removed)
        this.processQueue();
        return;
      }

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

      // Emit download failed event
      eventBus.emit('download:failed', {
        bookId: itemId,
        error: message,
      });

      // Process next item in queue
      this.processQueue();
    }
  }

  private async updateProgress(itemId: string, progress: number, bytesDownloaded: number, totalBytes: number): Promise<void> {
    // Store byte info in memory, preserving file counts
    const existing = this.progressInfo.get(itemId);
    this.progressInfo.set(itemId, {
      bytesDownloaded,
      totalBytes,
      totalFiles: existing?.totalFiles ?? 0,
      filesDownloaded: existing?.filesDownloaded ?? 0,
    });

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
      const token = apiClient.getAuthToken();
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
      // Only auto-resume downloads that weren't explicitly paused by user
      const systemPaused = paused.filter((d) => !d.userPaused);
      const userPaused = paused.filter((d) => d.userPaused);

      if (userPaused.length > 0) {
        log(`Skipping ${userPaused.length} user-paused downloads (won't auto-resume)`);
      }

      if (systemPaused.length > 0) {
        log(`Found ${systemPaused.length} system-paused downloads, adding to queue...`);
        for (const download of systemPaused) {
          await sqliteCache.addToDownloadQueue(download.itemId, 5);
        }
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
