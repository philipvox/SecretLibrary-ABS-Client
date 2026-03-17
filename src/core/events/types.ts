/**
 * src/core/events/types.ts
 *
 * Centralized event type definitions for the app.
 *
 * Naming convention: 'domain:action'
 * - domain: book, progress, download, auth, network, app
 * - action: past tense verb (started, finished, failed, etc.)
 */

export type EventMap = {
  // === PLAYBACK EVENTS ===
  'book:started': {
    bookId: string;
    title: string;
    seriesId?: string;
    resumePosition: number;
  };

  'book:paused': {
    bookId: string;
    position: number;
  };

  'book:resumed': {
    bookId: string;
    position: number;
  };

  'book:finished': {
    bookId: string;
    seriesId?: string;
    seriesSequence?: string;
    nextBookId?: string;
  };

  'book:stopped': {
    bookId: string;
    position: number;
    reason: 'user' | 'error' | 'sleep_timer';
  };

  // === PROGRESS EVENTS ===
  'progress:updated': {
    bookId: string;
    position: number;
    duration: number;
    progress: number; // 0.0 - 1.0
  };

  'progress:synced': {
    bookId: string;
    position: number;
    syncedAt: number;
  };

  'progress:sync_failed': {
    bookId: string;
    position: number;
    error: string;
    retryCount: number;
  };

  'progress:conflict': {
    bookId: string;
    localPosition: number;
    serverPosition: number;
    winner: 'local' | 'server';
  };

  // === DOWNLOAD EVENTS ===
  'download:queued': {
    bookId: string;
    title: string;
    estimatedSize?: number;
  };

  'download:started': {
    bookId: string;
    totalFiles: number;
  };

  'download:progress': {
    bookId: string;
    progress: number; // 0.0 - 1.0
    currentFile: number;
    totalFiles: number;
    bytesDownloaded: number;
    totalBytes: number;
  };

  'download:file_complete': {
    bookId: string;
    fileIndex: number;
    totalFiles: number;
    filePath: string;
  };

  'download:complete': {
    bookId: string;
    totalSize: number;
    filePath: string;
  };

  'download:failed': {
    bookId: string;
    error: string;
    fileIndex?: number;
  };

  'download:paused': {
    bookId: string;
    progress: number;
  };

  'download:resumed': {
    bookId: string;
  };

  'download:cancelled': {
    bookId: string;
  };

  'download:stuck': {
    bookId: string;
    stuckDuration: number;
  };

  // === AUTH EVENTS ===
  'auth:token_refreshed': {
    expiresAt?: number;
  };

  'auth:token_expired': {
    endpoint?: string;
    sessionDuration?: number;
  };

  'auth:logout': {
    reason: 'user' | 'token_expired' | 'server_error';
  };

  // === NETWORK EVENTS ===
  'network:online': {
    connectionType: string;
  };

  'network:offline': Record<string, never>;

  // === APP LIFECYCLE ===
  'app:foreground': Record<string, never>;

  'app:background': Record<string, never>;

  'app:cold_start': {
    loadTimeMs: number;
  };

  // === WEBSOCKET EVENTS ===
  'websocket:connected': {
    serverUrl: string;
    userId: string;
  };

  'websocket:disconnected': {
    reason: 'manual' | 'error' | 'network' | 'auth';
  };

  'websocket:progress_updated': {
    libraryItemId: string;
    episodeId?: string;
    currentTime: number;
    duration: number;
    progress: number;
    isFinished: boolean;
    lastUpdate: number;
  };

  'websocket:item_added': {
    libraryItemId: string;
    libraryId: string;
  };

  'websocket:item_updated': {
    libraryItemId: string;
    libraryId: string;
  };

  'websocket:item_removed': {
    libraryItemId: string;
    libraryId: string;
  };

  'websocket:library_scan_complete': {
    libraryId: string;
    itemsAdded: number;
    itemsUpdated: number;
  };
};

// Helper type to get payload for a specific event
export type EventPayload<K extends keyof EventMap> = EventMap[K];
