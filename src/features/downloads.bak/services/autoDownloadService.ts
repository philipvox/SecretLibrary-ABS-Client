/**
 * src/features/downloads/services/autoDownloadService.ts
 * 
 * Audible-style auto-download manager
 * - Downloads top 3 most recently played books
 * - Uses delayed initialization to avoid runtime issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';
import { apiClient } from '@/core/api';
import { LibraryItem } from '@/core/types';

const MAX_DOWNLOADS = 3;
const MANIFEST_KEY = 'auto_downloads_manifest_v7';
const DOWNLOADS_SUBDIR = 'audiobooks';

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
let _fsReadyPromise: Promise<void> | null = null;

async function ensureFileSystem(): Promise<any> {
  if (_fsReady && _fs) return _fs;
  
  if (_fsReadyPromise) {
    await _fsReadyPromise;
    return _fs;
  }
  
  _fsReadyPromise = new Promise<void>((resolve) => {
    // Wait for interactions to complete before loading native module
    InteractionManager.runAfterInteractions(async () => {
      try {
        // Small delay to ensure runtime is ready
        await new Promise(r => setTimeout(r, 100));
        
        _fs = require('expo-file-system/legacy');
        _downloadsDir = `${_fs.documentDirectory}${DOWNLOADS_SUBDIR}/`;
        
        // Create directory
        const info = await _fs.getInfoAsync(_downloadsDir);
        if (!info.exists) {
          await _fs.makeDirectoryAsync(_downloadsDir, { intermediates: true });
        }
        
        _fsReady = true;
        console.log('[AutoDownload] FileSystem ready');
        resolve();
      } catch (e) {
        console.error('[AutoDownload] FileSystem init error:', e);
        resolve(); // Resolve anyway to not block
      }
    });
  });
  
  await _fsReadyPromise;
  return _fs;
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
  private abortControllers: Map<string, AbortController> = new Map();

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
    await ensureFileSystem();
    if (!_fsReady) {
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

    // Queue new downloads
    for (const item of topItems) {
      if (!this.isDownloaded(item.id) && !this.isDownloading(item.id)) {
        this.queueDownload(item.id);
      }
    }

    this.processQueue();
  }

  async waitForDownload(bookId: string): Promise<string | null> {
    const existing = this.getLocalPath(bookId);
    if (existing) return existing;

    if (!this.isDownloading(bookId)) return null;

    return new Promise((resolve) => {
      const unsubStatus = this.onStatus((id, status) => {
        if (id === bookId) {
          if (status === 'completed') {
            unsubStatus();
            resolve(this.getLocalPath(bookId));
          } else if (status === 'error' || status === 'none') {
            unsubStatus();
            resolve(null);
          }
        }
      });
    });
  }

  async cancelDownload(bookId: string): Promise<void> {
    this.downloadQueue = this.downloadQueue.filter(id => id !== bookId);
    
    const controller = this.abortControllers.get(bookId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(bookId);
    }
    
    this.activeDownloads.delete(bookId);
    this.notifyStatus(bookId, 'none');
    this.progressState.delete(bookId);
    this.statusState.delete(bookId);
  }

  async removeDownload(bookId: string): Promise<void> {
    const book = this.manifest.books.find(b => b.id === bookId);
    if (!book) return;

    console.log('[AutoDownload] Removing:', book.title);

    try {
      const fs = await ensureFileSystem();
      if (fs) {
        await fs.deleteAsync(book.localPath, { idempotent: true });
        if (book.coverPath) {
          await fs.deleteAsync(book.coverPath, { idempotent: true });
        }
      }
    } catch {}

    this.manifest.books = this.manifest.books.filter(b => b.id !== bookId);
    await this.saveManifest();

    this.progressState.delete(bookId);
    this.statusState.delete(bookId);
    this.notifyStatus(bookId, 'none');
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
  }

  // ========================================
  // Private - Queue
  // ========================================

  private queueDownload(bookId: string): void {
    if (this.downloadQueue.includes(bookId)) return;
    if (this.isDownloaded(bookId)) return;
    if (this.activeDownloads.has(bookId)) return;

    this.downloadQueue.push(bookId);
    this.notifyStatus(bookId, 'queued');
    this.notifyProgress(bookId, 0);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    if (this.downloadQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.downloadQueue.length > 0) {
      const bookId = this.downloadQueue.shift()!;
      
      if (this.isDownloaded(bookId)) continue;

      try {
        await this.executeDownload(bookId);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('[AutoDownload] Failed:', bookId, e.message);
        }
      }

      if (this.downloadQueue.length > 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    this.isProcessingQueue = false;
  }

  // ========================================
  // Private - Download
  // ========================================

  private async executeDownload(bookId: string): Promise<void> {
    const fs = await ensureFileSystem();
    if (!fs || !_downloadsDir) {
      throw new Error('FileSystem not ready');
    }

    console.log('[AutoDownload] Starting:', bookId);
    
    this.activeDownloads.add(bookId);
    this.notifyStatus(bookId, 'downloading');
    this.notifyProgress(bookId, 0);

    const abortController = new AbortController();
    this.abortControllers.set(bookId, abortController);

    try {
      // Get book metadata
      const book = await apiClient.getItem(bookId);
      const title = book.media?.metadata?.title || 'Unknown';
      console.log('[AutoDownload] Book:', title);

      // Get stream URL from session API
      const token = apiClient.getAuthToken?.() || (apiClient as any).authToken || (apiClient as any).token || '';
      const baseUrl = apiClient.getBaseURL().replace(/\/+$/, '');
      
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
      
      if (downloadUrl.startsWith('/')) {
        downloadUrl = `${baseUrl}${downloadUrl}`;
      }
      if (!downloadUrl.includes('token=')) {
        downloadUrl += `${downloadUrl.includes('?') ? '&' : '?'}token=${token}`;
      }

      const ext = audioTrack.metadata?.ext || '.m4b';
      const filename = `${bookId}${ext}`;
      const localPath = `${_downloadsDir}${filename}`;

      console.log('[AutoDownload] Downloading:', downloadUrl.substring(0, 60) + '...');

      // Download with progress tracking
      const response = await fetch(downloadUrl, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('No response body');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        if (contentLength > 0) {
          this.notifyProgress(bookId, receivedLength / contentLength);
        }
      }

      // Combine and write
      const allChunks = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }

      const base64 = uint8ArrayToBase64(allChunks);
      await fs.writeAsStringAsync(localPath, base64, {
        encoding: fs.EncodingType.Base64,
      });

      // Close session
      if (sessionId) {
        apiClient.post(`/api/session/${sessionId}/close`, {}).catch(() => {});
      }

      // Verify
      const fileInfo = await fs.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        throw new Error('File not created');
      }

      const fileSize = (fileInfo as any).size || receivedLength;
      console.log('[AutoDownload] Size:', Math.round(fileSize / 1024 / 1024), 'MB');

      // Cover
      let coverPath: string | null = null;
      try {
        const coverUrl = `${baseUrl}/api/items/${bookId}/cover?token=${token}`;
        const coverLocalPath = `${_downloadsDir}${bookId}_cover.jpg`;
        await fs.downloadAsync(coverUrl, coverLocalPath);
        const coverInfo = await fs.getInfoAsync(coverLocalPath);
        if (coverInfo.exists) coverPath = coverLocalPath;
      } catch {}

      // Save manifest
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

      console.log('[AutoDownload] ✓ Complete:', title);
      this.notifyProgress(bookId, 1);
      this.notifyStatus(bookId, 'completed');

    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[AutoDownload] Cancelled:', bookId);
        this.notifyStatus(bookId, 'none');
      } else {
        console.error('[AutoDownload] Error:', e.message);
        this.notifyStatus(bookId, 'error');
      }
      throw e;
    } finally {
      this.activeDownloads.delete(bookId);
      this.abortControllers.delete(bookId);
    }
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Export a getter function instead of instance
// Service is created lazily on first access
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
  waitForDownload: (id: string) => autoDownloadService.instance.waitForDownload(id),
  cancelDownload: (id: string) => autoDownloadService.instance.cancelDownload(id),
  removeDownload: (id: string) => autoDownloadService.instance.removeDownload(id),
  updateLastPlayed: (id: string) => autoDownloadService.instance.updateLastPlayed(id),
  clearAll: () => autoDownloadService.instance.clearAll(),
};



