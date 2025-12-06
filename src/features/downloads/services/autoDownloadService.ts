/**
 * src/features/downloads/services/autoDownloadService.ts
 *
 * Manual download manager for offline audiobooks
 * - Users explicitly download books they want
 * - Tracks downloaded books in a manifest
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager, AppState } from 'react-native';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

const MANIFEST_KEY = 'auto_downloads_manifest_v7';
const DOWNLOADS_SUBDIR = 'audiobooks';
const RUNTIME_DELAY_MS = 3000; // Wait 3 seconds for runtime to be ready

// Helper to format bytes as human-readable string
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Helper to format seconds as mm:ss or hh:mm:ss
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface DownloadedBook {
  id: string;
  title: string;
  localPath: string;
  coverPath: string | null;
  downloadedAt: number;
  lastPlayedAt: number;
  fileSize: number;
  duration: number;
}

interface DownloadManifest {
  books: DownloadedBook[];
  version: number;
}

export type DownloadStatus = 'none' | 'queued' | 'downloading' | 'completed' | 'error';

type ProgressCallback = (bookId: string, progress: number) => void;
type StatusCallback = (bookId: string, status: DownloadStatus) => void;

// FileSystem module - loaded lazily
let _fs: any = null;
let _downloadsDir: string | null = null;
let _fsReady = false;
let _fsReadyPromise: Promise<boolean> | null = null;

async function ensureFileSystem(): Promise<boolean> {
  if (_fsReady && _fs) return true;
  
  if (_fsReadyPromise) {
    return _fsReadyPromise;
  }
  
  _fsReadyPromise = new Promise<boolean>((resolve) => {
    // Wait for app to be active
    if (AppState.currentState !== 'active') {
      console.log('[AutoDownload] Waiting for app to become active...');
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          subscription.remove();
          initFileSystem().then(resolve);
        }
      });
      return;
    }
    
    initFileSystem().then(resolve);
  });
  
  return _fsReadyPromise;
}

async function initFileSystem(): Promise<boolean> {
  return new Promise((resolve) => {
    // Wait for interactions to complete
    InteractionManager.runAfterInteractions(async () => {
      try {
        // Longer delay to ensure runtime is fully ready
        console.log(`[AutoDownload] Waiting ${RUNTIME_DELAY_MS}ms for runtime...`);
        await new Promise(r => setTimeout(r, RUNTIME_DELAY_MS));
        
        // Check if we're still active
        if (AppState.currentState !== 'active') {
          console.log('[AutoDownload] App not active, skipping init');
          resolve(false);
          return;
        }
        
        // Use legacy API for SDK 54+
        _fs = require('expo-file-system/legacy');
        _downloadsDir = `${_fs.documentDirectory}${DOWNLOADS_SUBDIR}/`;
        
        // Create directory
        const info = await _fs.getInfoAsync(_downloadsDir);
        if (!info.exists) {
          await _fs.makeDirectoryAsync(_downloadsDir, { intermediates: true });
        }
        
        _fsReady = true;
        console.log('[AutoDownload] FileSystem ready');
        resolve(true);
      } catch (e) {
        console.error('[AutoDownload] FileSystem init error:', e);
        resolve(false);
      }
    });
  });
}

class AutoDownloadService {
  private manifest: DownloadManifest = { books: [], version: 7 };
  private activeDownloads: Set<string> = new Set();
  private downloadQueue: string[] = [];
  private isProcessingQueue = false;
  private progressCallbacks: Set<ProgressCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private progressState: Map<string, number> = new Map();
  private statusState: Map<string, DownloadStatus> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private downloadResumables: Map<string, any> = new Map();

  constructor() {
    // Don't initialize in constructor - wait for first use
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      try {
        // Load manifest from AsyncStorage (no native deps)
        await this.loadManifest();
        this.initialized = true;
        console.log('[AutoDownload] Initialized. Books:', this.manifest.books.length);
      } catch (e) {
        console.error('[AutoDownload] Init failed:', e);
        this.initPromise = null;
      }
    })();
    
    return this.initPromise;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  private async loadManifest(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(MANIFEST_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Filter out any books with invalid IDs and sanitize paths
        this.manifest = {
          ...parsed,
          books: (parsed.books || [])
            .filter((book: any) => book && book.id)
            .map((book: any) => ({
              ...book,
              // Sanitize paths - remove any parent directory traversal
              localPath: book.localPath?.replace(/\/\.\..*$/, '') || book.localPath,
              coverPath: book.coverPath?.replace(/\/\.\..*$/, '') || book.coverPath,
            })),
        };
        for (const book of this.manifest.books) {
          this.statusState.set(book.id, 'completed');
          this.progressState.set(book.id, 1);
        }
      }
    } catch (e) {
      console.warn('[AutoDownload] Failed to load manifest:', e);
    }
  }

  private async saveManifest(): Promise<void> {
    try {
      await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(this.manifest));
    } catch (e) {
      console.warn('[AutoDownload] Failed to save manifest:', e);
    }
  }

  // ========================================
  // Subscriptions
  // ========================================

  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    this.progressState.forEach((progress, bookId) => callback(bookId, progress));
    return () => this.progressCallbacks.delete(callback);
  }

  onStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    this.statusState.forEach((status, bookId) => callback(bookId, status));
    return () => this.statusCallbacks.delete(callback);
  }

  private notifyProgress(bookId: string, progress: number): void {
    this.progressState.set(bookId, progress);
    this.progressCallbacks.forEach(cb => { try { cb(bookId, progress); } catch {} });
  }

  private notifyStatus(bookId: string, status: DownloadStatus): void {
    this.statusState.set(bookId, status);
    this.statusCallbacks.forEach(cb => { try { cb(bookId, status); } catch {} });
  }

  // ========================================
  // Public API - Status
  // ========================================

  getProgress(bookId: string): number {
    return this.progressState.get(bookId) ?? 0;
  }

  getStatus(bookId: string): DownloadStatus {
    if (this.manifest.books.some(b => b.id === bookId)) return 'completed';
    return this.statusState.get(bookId) ?? 'none';
  }

  isDownloaded(bookId: string): boolean {
    return this.manifest.books.some(b => b.id === bookId);
  }

  isDownloading(bookId: string): boolean {
    return this.activeDownloads.has(bookId) || this.downloadQueue.includes(bookId);
  }

  getLocalPath(bookId: string): string | null {
    const book = this.manifest.books.find(b => b.id === bookId);
    return book?.localPath || null;
  }

  getDownloadedBook(bookId: string): DownloadedBook | null {
    return this.manifest.books.find(b => b.id === bookId) || null;
  }

  getAllDownloads(): DownloadedBook[] {
    return [...this.manifest.books].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  }

  getTotalSize(): number {
    return this.manifest.books.reduce((sum, b) => sum + b.fileSize, 0);
  }

  // ========================================
  // Public API - Actions
  // ========================================

  /**
   * Manually start downloading a book
   */
  startDownload(item: LibraryItem): void {
    const title = item.media?.metadata?.title || 'Unknown';
    console.log(`[AutoDownload] >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
    console.log(`[AutoDownload] startDownload called for: ${item.id}`);
    console.log(`[AutoDownload] Title: ${title}`);
    console.log(`[AutoDownload] Manifest has ${this.manifest.books.length} books`);
    console.log(`[AutoDownload] isDownloaded: ${this.isDownloaded(item.id)}, isDownloading: ${this.isDownloading(item.id)}`);

    if (this.isDownloaded(item.id) || this.isDownloading(item.id)) {
      console.log('[AutoDownload] Already downloaded or downloading - skipping');
      return;
    }
    console.log('[AutoDownload] Queuing download...');
    this.queueDownload(item);
  }

  private queueDownload(item: LibraryItem): void {
    const bookId = item?.id;
    console.log(`[AutoDownload] queueDownload called for: ${bookId}`);
    if (!bookId) {
      console.warn('[AutoDownload] Skipping item with no id');
      return;
    }
    if (this.downloadQueue.includes(bookId)) {
      console.log('[AutoDownload] Already in queue - skipping');
      return;
    }

    console.log(`[AutoDownload] Adding to queue. Queue before: ${this.downloadQueue.length}, Active: ${this.activeDownloads.size}`);
    this.downloadQueue.push(bookId);
    this.notifyStatus(bookId, 'queued');
    console.log(`[AutoDownload] Queue after: ${this.downloadQueue.length}. Calling processQueue...`);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    console.log(`[AutoDownload] processQueue called. isProcessing: ${this.isProcessingQueue}, queueLen: ${this.downloadQueue.length}, activeDownloads: ${this.activeDownloads.size}`);

    if (this.isProcessingQueue) {
      console.log('[AutoDownload] Already processing queue - returning');
      return;
    }
    if (this.downloadQueue.length === 0) {
      console.log('[AutoDownload] Queue empty - returning');
      return;
    }
    if (this.activeDownloads.size >= 1) {
      console.log('[AutoDownload] Already have active download - returning');
      return;
    }

    this.isProcessingQueue = true;
    console.log('[AutoDownload] Starting queue processing loop...');

    while (this.downloadQueue.length > 0 && this.activeDownloads.size < 1) {
      const bookId = this.downloadQueue.shift()!;
      console.log(`[AutoDownload] Processing book from queue: ${bookId}`);
      await this.downloadBook(bookId);
    }

    console.log('[AutoDownload] Queue processing complete');
    this.isProcessingQueue = false;
  }

  private async downloadBook(bookId: string): Promise<void> {
    console.log(`[AutoDownload] downloadBook called for: ${bookId}`);

    if (!bookId) {
      console.warn('[AutoDownload] Skipping undefined bookId');
      return;
    }

    // Ensure FileSystem is initialized before downloading
    console.log('[AutoDownload] Checking FileSystem...');
    const fsReady = await ensureFileSystem();
    console.log(`[AutoDownload] FileSystem ready: ${fsReady}, _fs: ${!!_fs}, _downloadsDir: ${_downloadsDir}`);

    if (!fsReady || !_fs || !_downloadsDir) {
      console.warn('[AutoDownload] FileSystem not ready, retrying in 2s...');
      // Retry after delay
      setTimeout(() => {
        this.downloadQueue.unshift(bookId);
        this.activeDownloads.delete(bookId);
        this.processQueue();
      }, 2000);
      return;
    }

    this.activeDownloads.add(bookId);
    this.notifyStatus(bookId, 'downloading');
    this.notifyProgress(bookId, 0);

    try {
      // Get book metadata from API - includes audioFiles with ino for each file
      console.log(`[AutoDownload] Fetching book metadata for: ${bookId}`);
      const book = await apiClient.getItem(bookId);
      console.log(`[AutoDownload] Got metadata for: ${book?.media?.metadata?.title}`);

      const title = book.media?.metadata?.title || 'Unknown';
      const audioFiles = (book.media as any)?.audioFiles || [];
      console.log(`[AutoDownload] Audio files found: ${audioFiles.length}`);

      if (audioFiles.length === 0) {
        throw new Error('No audio files found in book metadata');
      }

      // Get auth token and base URL
      const token = (apiClient as any).getAuthToken?.() ||
                    (apiClient as any).authToken ||
                    (apiClient as any).token || '';
      const baseUrl = apiClient.getBaseURL().replace(/\/+$/, '');

      console.log(`[AutoDownload] ====================================`);
      console.log(`[AutoDownload] BASE URL: ${baseUrl}`);
      console.log(`[AutoDownload] Token present: ${!!token} (length: ${token.length})`);
      console.log(`[AutoDownload] ====================================`);
      console.log(`[AutoDownload] Downloading: ${title} (${audioFiles.length} file${audioFiles.length > 1 ? 's' : ''})`);

      // Create book directory
      const bookDir = `${_downloadsDir}${bookId}/`;
      const dirInfo = await _fs.getInfoAsync(bookDir);
      if (!dirInfo.exists) {
        await _fs.makeDirectoryAsync(bookDir, { intermediates: true });
      }

      // Calculate total size for progress tracking
      let totalSize = 0;
      let downloadedSize = 0;
      for (const file of audioFiles) {
        totalSize += file.metadata?.size || 0;
      }

      // Download each audio file via /api/items/{itemId}/file/{ino}
      // This hits the server cache and is much faster than streaming
      const overallStartTime = Date.now();

      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const ino = file.ino;
        const ext = file.metadata?.ext || '.m4b';
        const filename = `${i.toString().padStart(3, '0')}_${ino}${ext}`;
        const localFilePath = `${bookDir}${filename}`;
        const fileSize = file.metadata?.size || 0;

        // Direct file download URL - hits server cache
        const downloadUrl = `${baseUrl}/api/items/${bookId}/file/${ino}?token=${token}`;

        const fileStartTime = Date.now();
        console.log(`[AutoDownload] File ${i + 1}/${audioFiles.length}: ${file.metadata?.filename || ino} (${formatBytes(fileSize)})`);
        console.log(`[AutoDownload] Download URL: ${downloadUrl.replace(/token=[^&]+/, 'token=***')}`);
        console.log(`[AutoDownload] Local path: ${localFilePath}`);

        const currentDownloadedSize = downloadedSize;
        let lastLogTime = Date.now();
        let lastLogBytes = 0;

        const downloadResumable = _fs.createDownloadResumable(
          downloadUrl,
          localFilePath,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
          (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
            const currentTotal = currentDownloadedSize + progress.totalBytesWritten;
            const pct = totalSize > 0 ? currentTotal / totalSize : (i + progress.totalBytesWritten / (fileSize || 1)) / audioFiles.length;
            this.notifyProgress(bookId, Math.min(pct, 0.99));

            // Log progress with speed every 2 seconds
            const now = Date.now();
            if (now - lastLogTime >= 2000) {
              const elapsed = (now - lastLogTime) / 1000;
              const bytesDelta = progress.totalBytesWritten - lastLogBytes;
              const speed = bytesDelta / elapsed;
              const overallPct = Math.round(pct * 100);
              const eta = speed > 0 ? (totalSize - currentTotal) / speed : 0;
              console.log(`[AutoDownload] ${overallPct}% | ${formatBytes(currentTotal)}/${formatBytes(totalSize)} | ${formatBytes(speed)}/s | ETA: ${formatTime(eta)}`);
              lastLogTime = now;
              lastLogBytes = progress.totalBytesWritten;
            }
          }
        );

        this.downloadResumables.set(bookId, downloadResumable);

        console.log(`[AutoDownload] Starting downloadAsync for file ${i + 1}...`);
        const result = await downloadResumable.downloadAsync();
        console.log(`[AutoDownload] downloadAsync returned:`, result ? `URI: ${result.uri?.substring(0, 50)}...` : 'null');
        if (!result?.uri) {
          throw new Error(`Download failed for file ${i + 1}: no URI`);
        }

        const fileElapsed = (Date.now() - fileStartTime) / 1000;
        const fileSpeed = fileSize / fileElapsed;
        console.log(`[AutoDownload] File ${i + 1} done in ${fileElapsed.toFixed(1)}s (${formatBytes(fileSpeed)}/s)`);

        downloadedSize += fileSize;
      }

      const totalElapsed = (Date.now() - overallStartTime) / 1000;
      const avgSpeed = downloadedSize / totalElapsed;
      console.log(`[AutoDownload] All files downloaded in ${totalElapsed.toFixed(1)}s (avg ${formatBytes(avgSpeed)}/s)`);

      // For single-file books, also save the direct path for easier playback
      const primaryPath = audioFiles.length === 1
        ? `${bookDir}000_${audioFiles[0].ino}${audioFiles[0].metadata?.ext || '.m4b'}`
        : bookDir;

      // Download cover
      let coverPath: string | null = null;
      try {
        const coverUrl = apiClient.getItemCoverUrl(bookId);
        if (coverUrl) {
          coverPath = `${bookDir}cover.jpg`;
          await _fs.downloadAsync(coverUrl, coverPath, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (e) {
        // Cover download optional
      }

      // Get total downloaded size
      let totalFileSize = 0;
      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        const filename = `${i.toString().padStart(3, '0')}_${file.ino}${file.metadata?.ext || '.m4b'}`;
        const filePath = `${bookDir}${filename}`;
        try {
          const info = await _fs.getInfoAsync(filePath);
          totalFileSize += info.size || 0;
        } catch {}
      }

      // Add to manifest
      const downloadedBook: DownloadedBook = {
        id: bookId,
        title,
        localPath: primaryPath,
        coverPath,
        downloadedAt: Date.now(),
        lastPlayedAt: Date.now(),
        fileSize: totalFileSize,
        duration: (book.media as any)?.duration || 0,
      };

      this.manifest.books.push(downloadedBook);
      await this.saveManifest();

      this.notifyProgress(bookId, 1);
      this.notifyStatus(bookId, 'completed');
      console.log(`[AutoDownload] Completed: ${title} (${(totalFileSize / 1024 / 1024).toFixed(1)} MB)`);

    } catch (e: any) {
      console.error(`[AutoDownload] ====================================`);
      console.error(`[AutoDownload] DOWNLOAD FAILED: ${bookId}`);
      console.error(`[AutoDownload] Error message: ${e.message}`);
      console.error(`[AutoDownload] Error stack:`, e.stack);
      console.error(`[AutoDownload] ====================================`);
      this.notifyStatus(bookId, 'error');
    } finally {
      this.activeDownloads.delete(bookId);
      this.downloadResumables.delete(bookId);
      this.processQueue();
    }
  }

  async waitForDownload(bookId: string): Promise<string | null> {
    // If already downloaded, return path
    const existing = this.getLocalPath(bookId);
    if (existing) return existing;

    // Wait for download to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const path = this.getLocalPath(bookId);
        if (path) {
          clearInterval(checkInterval);
          resolve(path);
        }
        
        const status = this.getStatus(bookId);
        if (status === 'error' || status === 'none') {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 5 * 60 * 1000);
    });
  }

  async cancelDownload(bookId: string): Promise<void> {
    // Remove from queue
    const queueIdx = this.downloadQueue.indexOf(bookId);
    if (queueIdx !== -1) {
      this.downloadQueue.splice(queueIdx, 1);
    }

    // Cancel active download
    const resumable = this.downloadResumables.get(bookId);
    if (resumable) {
      try {
        await resumable.pauseAsync();
      } catch (e) {}
      this.downloadResumables.delete(bookId);
    }

    this.activeDownloads.delete(bookId);
    this.notifyStatus(bookId, 'none');
    this.notifyProgress(bookId, 0);
  }

  async removeDownload(bookId: string): Promise<void> {
    await this.cancelDownload(bookId);

    const book = this.manifest.books.find(b => b.id === bookId);
    if (!book) return;

    // Delete files (validate paths don't contain directory traversal)
    if (_fs) {
      try {
        if (book.localPath && !book.localPath.includes('..')) {
          await _fs.deleteAsync(book.localPath, { idempotent: true });
        }
        if (book.coverPath && !book.coverPath.includes('..')) {
          await _fs.deleteAsync(book.coverPath, { idempotent: true });
        }
      } catch (e) {
        console.warn('[AutoDownload] Failed to delete files:', e);
      }
    }

    // Remove from manifest
    this.manifest.books = this.manifest.books.filter(b => b.id !== bookId);
    await this.saveManifest();

    this.statusState.delete(bookId);
    this.progressState.delete(bookId);
    
    console.log(`[AutoDownload] Removed: ${book.title}`);
  }

  async updateLastPlayed(bookId: string): Promise<void> {
    const book = this.manifest.books.find(b => b.id === bookId);
    if (book) {
      book.lastPlayedAt = Date.now();
      await this.saveManifest();
    }
  }

  async clearAll(): Promise<void> {
    for (const book of [...this.manifest.books]) {
      await this.removeDownload(book.id);
    }
    console.log('[AutoDownload] Cleared all downloads');
  }
}

// Export a getter function instead of instance
let _instance: AutoDownloadService | null = null;
let _initPromise: Promise<void> | null = null;

async function ensureInstance(): Promise<AutoDownloadService> {
  if (!_instance) {
    _instance = new AutoDownloadService();
  }
  // Always ensure initialized before returning
  if (!_initPromise) {
    _initPromise = _instance['init']();
  }
  await _initPromise;
  return _instance;
}

export const autoDownloadService = {
  get instance() {
    if (!_instance) {
      _instance = new AutoDownloadService();
      // Fire init in background (for sync access later)
      _initPromise = _instance['init']();
    }
    return _instance;
  },

  // Sync methods (use cached state, no await needed)
  onProgress: (cb: ProgressCallback) => autoDownloadService.instance.onProgress(cb),
  onStatus: (cb: StatusCallback) => autoDownloadService.instance.onStatus(cb),
  getProgress: (id: string) => autoDownloadService.instance.getProgress(id),
  getStatus: (id: string) => autoDownloadService.instance.getStatus(id),
  isDownloaded: (id: string) => autoDownloadService.instance.isDownloaded(id),
  isDownloading: (id: string) => autoDownloadService.instance.isDownloading(id),
  getLocalPath: (id: string) => autoDownloadService.instance.getLocalPath(id),
  getDownloadedBook: (id: string) => autoDownloadService.instance.getDownloadedBook(id),
  getAllDownloads: () => autoDownloadService.instance.getAllDownloads(),
  getTotalSize: () => autoDownloadService.instance.getTotalSize(),

  // Async methods (ensure init before action)
  startDownload: async (item: LibraryItem) => {
    console.log(`[AutoDownload] PROXY startDownload called for: ${item?.id}`);
    console.log(`[AutoDownload] PROXY awaiting ensureInstance...`);
    const inst = await ensureInstance();
    console.log(`[AutoDownload] PROXY got instance, calling startDownload...`);
    inst.startDownload(item);
  },
  waitForDownload: async (id: string) => {
    const inst = await ensureInstance();
    return inst.waitForDownload(id);
  },
  cancelDownload: async (id: string) => {
    const inst = await ensureInstance();
    return inst.cancelDownload(id);
  },
  removeDownload: async (id: string) => {
    const inst = await ensureInstance();
    return inst.removeDownload(id);
  },
  updateLastPlayed: async (id: string) => {
    const inst = await ensureInstance();
    return inst.updateLastPlayed(id);
  },
  clearAll: async () => {
    const inst = await ensureInstance();
    return inst.clearAll();
  },
};