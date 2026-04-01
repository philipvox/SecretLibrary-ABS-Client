/**
 * src/core/events/types.ts
 *
 * Centralized event type definitions for the app.
 *
 * Naming convention: 'domain:action'
 * - domain: book, progress, download, network, app, websocket
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

  'book:finished': {
    bookId: string;
    seriesId?: string;
    seriesSequence?: string;
    nextBookId?: string;
  };

  // === PROGRESS EVENTS ===
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

  // === DOWNLOAD EVENTS ===
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

  // === NETWORK EVENTS ===
  'network:online': {
    connectionType: string;
  };

  'network:offline': Record<string, never>;

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

  // === OFFLINE EVENTS ===
  'offline:listening_time_flushed': {
    bookId: string;
    seconds: number;
  };
};

// Helper type to get payload for a specific event
export type EventPayload<K extends keyof EventMap> = EventMap[K];
