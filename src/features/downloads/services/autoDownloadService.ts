/**
 * src/features/downloads/services/autoDownloadService.ts
 * 
 * Audible-style auto-download manager
 * - Downloads top 3 most recently played books
 * - Uses delayed initialization to avoid runtime issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager, AppState } from 'react-native';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

const MAX_DOWNLOADS = 3;
const MANIFEST_KEY = 'auto_downloads_manifest_v7';
const DOWNLOADS_SUBDIR = 'audiobooks';
const RUNTIME_DELAY_MS = 3000; // Wait 3 seconds for runtime to be ready

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
        this.manifest = JSON.parse(data);
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

  async syncWithContinueListening(items: LibraryItem[]): Promise<void> {
    await this.ensureInit();
    
    // Ensure file system is ready before any downloads
    const fsReady = await ensureFileSystem();
    if (!fsReady) {
      console.warn('[AutoDownload] FileSystem not ready, skipping sync');
      return;
    }
    
    const topItems = items.slice(0, MAX_DOWNLOADS);
    const topIds = new Set(topItems.map(i => i.id));

    console.log('[AutoDownload] Syncing:', topItems.map(i => i.media?.metadata?.title?.substring(0, 20)).join(', '));

    // Remove books no longer in top 3
    const toRemove = this.manifest.books.filter(b => !topIds.has(b.id));
    for (const book of toRemove) {
      await this.removeDownload(book.id);
    }

    // Queue downloads for new items
    for (const item of topItems) {
      if (!this.isDownloaded(item.id) && !this.isDownloading(item.id)) {
        this.queueDownload(item);
      }
    }
  }

  /**
   * Manually start downloading a book
   */
  startDownload(item: LibraryItem): void {
    if (this.isDownloaded(item.id) || this.isDownloading(item.id)) {
      console.log('[AutoDownload] Already downloaded or downloading:', item.id);
      return;
    }
    console.log('[AutoDownload] Manual download started:', item.media?.metadata?.title);
    this.queueDownload(item);
  }

  private queueDownload(item: LibraryItem): void {
    const bookId = item.id;
    if (this.downloadQueue.includes(bookId)) return;
    
    this.downloadQueue.push(bookId);
    this.notifyStatus(bookId, 'queued');
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    if (this.downloadQueue.length === 0) return;
    if (this.activeDownloads.size >= 1) return; // One at a time
    
    this.isProcessingQueue = true;
    
    while (this.downloadQueue.length > 0 && this.activeDownloads.size < 1) {
      const bookId = this.downloadQueue.shift()!;
      await this.downloadBook(bookId);
    }
    
    this.isProcessingQueue = false;
  }

  private async downloadBook(bookId: string): Promise<void> {
    if (!_fs || !_downloadsDir) {
      console.warn('[AutoDownload] FileSystem not ready');
      return;
    }

    this.activeDownloads.add(bookId);
    this.notifyStatus(bookId, 'downloading');
    this.notifyProgress(bookId, 0);

    try {
      // Get book details
      const book = await apiClient.getItem(bookId);
      const title = book.media?.metadata?.title || 'Unknown';
      
      // Get auth token and base URL
      const token = (apiClient as any).getAuthToken?.() || 
                    (apiClient as any).authToken || 
                    (apiClient as any).token || '';
      const baseUrl = apiClient.getBaseURL().replace(/\/+$/, '');

      // Start a session to get stream URL
      const sessionResponse = await apiClient.post<any>(`/api/items/${bookId}/play`, {
        deviceInfo: { clientName: 'AudiobookShelf-Download', deviceId: 'download' },
        forceDirectPlay: true,
        forceTranscode: false,
      });

      if (!sessionResponse?.audioTracks?.length) {
        throw new Error('No audio tracks');
      }

      const sessionId = sessionResponse.id;
      const audioTrack = sessionResponse.audioTracks[0];
      let downloadUrl = audioTrack.contentUrl;
      
      // Build full URL with token
      if (downloadUrl.startsWith('/')) {
        downloadUrl = `${baseUrl}${downloadUrl}`;
      }
      if (!downloadUrl.includes('token=')) {
        downloadUrl += `${downloadUrl.includes('?') ? '&' : '?'}token=${token}`;
      }

      const ext = audioTrack.metadata?.ext || '.m4b';
      const filename = `${bookId}${ext}`;
      const localPath = `${_downloadsDir}${filename}`;

      console.log(`[AutoDownload] Downloading: ${title}`);

      // Create download resumable
      const downloadResumable = _fs.createDownloadResumable(
        downloadUrl,
        localPath,
        {},
        (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
          const pct = progress.totalBytesExpectedToWrite > 0
            ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
            : 0;
          this.notifyProgress(bookId, pct);
        }
      );

      this.downloadResumables.set(bookId, downloadResumable);

      const result = await downloadResumable.downloadAsync();
      
      if (!result?.uri) {
        throw new Error('Download failed - no URI');
      }

      // Close session
      if (sessionId) {
        apiClient.post(`/api/session/${sessionId}/close`, {}).catch(() => {});
      }

      // Download cover
      let coverPath: string | null = null;
      try {
        const coverUrl = apiClient.getItemCoverUrl(bookId);
        if (coverUrl) {
          coverPath = `${_downloadsDir}${bookId}_cover.jpg`;
          await _fs.downloadAsync(coverUrl, coverPath);
        }
      } catch (e) {
        // Cover download optional
      }

      // Get file size
      const fileInfo = await _fs.getInfoAsync(localPath);
      const fileSize = fileInfo.size || 0;

      // Add to manifest
      const downloadedBook: DownloadedBook = {
        id: bookId,
        title,
        localPath,
        coverPath,
        downloadedAt: Date.now(),
        lastPlayedAt: Date.now(),
        fileSize,
        duration: book.media?.duration || 0,
      };

      this.manifest.books.push(downloadedBook);
      await this.saveManifest();

      this.notifyProgress(bookId, 1);
      this.notifyStatus(bookId, 'completed');
      console.log(`[AutoDownload] Completed: ${title}`);

    } catch (e: any) {
      console.error(`[AutoDownload] Failed: ${bookId}`, e.message);
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

    // Delete files
    if (_fs) {
      try {
        if (book.localPath) {
          await _fs.deleteAsync(book.localPath, { idempotent: true });
        }
        if (book.coverPath) {
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

export const autoDownloadService = {
  get instance() {
    if (!_instance) {
      _instance = new AutoDownloadService();
    }
    return _instance;
  },
  
  // Proxy all methods
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
  syncWithContinueListening: (items: LibraryItem[]) => autoDownloadService.instance.syncWithContinueListening(items),
  startDownload: (item: LibraryItem) => autoDownloadService.instance.startDownload(item),
  waitForDownload: (id: string) => autoDownloadService.instance.waitForDownload(id),
  cancelDownload: (id: string) => autoDownloadService.instance.cancelDownload(id),
  removeDownload: (id: string) => autoDownloadService.instance.removeDownload(id),
  updateLastPlayed: (id: string) => autoDownloadService.instance.updateLastPlayed(id),
  clearAll: () => autoDownloadService.instance.clearAll(),
};