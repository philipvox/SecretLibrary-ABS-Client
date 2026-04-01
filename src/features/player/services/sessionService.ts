/**
 * src/features/player/services/sessionService.ts
 *
 * OPTIMIZED for instant streaming
 * - Non-blocking session close
 * - Faster session start
 */

import { Platform } from 'react-native';
import { apiClient } from '@/core/api';
import { audioLog, createTimer, logSection, formatDuration } from '@/shared/utils/audioDebug';
import { getErrorMessage } from '@/shared/utils/errorUtils';
import { withTimeout } from '@/shared/utils/timeout';
import { APP_VERSION } from '@/constants/version';

const SESSION_START_TIMEOUT_MS = 10_000;

const log = (msg: string, ...args: any[]) => audioLog.session(msg, ...args);

/** Get device model (e.g. "Pixel 10 Pro XL", "iPhone16,2") */
function getDeviceModel(): string {
  const constants = Platform.constants as any;
  if (Platform.OS === 'android') {
    return constants?.Model || constants?.Brand || 'Android Device';
  }
  return constants?.systemName || 'iOS Device';
}

/** Get device manufacturer (e.g. "Google", "Apple") */
function getDeviceManufacturer(): string {
  const constants = Platform.constants as any;
  if (Platform.OS === 'android') {
    return constants?.Manufacturer || constants?.Brand || 'Unknown';
  }
  return 'Apple';
}

/** Get Android SDK version (e.g. 36). Returns null on iOS. */
function getSdkVersion(): number | null {
  if (Platform.OS === 'android') {
    const constants = Platform.constants as any;
    return constants?.Version || null;
  }
  return null;
}

export interface AudioTrack {
  index: number;
  startOffset: number;
  duration: number;
  title: string;
  contentUrl: string;
  mimeType: string;
}

export interface SessionChapter {
  id: number;
  start: number;
  end: number;
  title: string;
}

export interface PlaybackSession {
  id: string;
  libraryItemId: string;
  episodeId?: string;
  mediaType: string;
  duration: number;
  currentTime: number;
  updatedAt?: number; // Server timestamp for position resolution
  startedAt?: number; // Session start timestamp (optional)
  audioTracks: AudioTrack[];
  chapters: SessionChapter[];
  coverPath?: string;
  mediaMetadata?: {
    title?: string;
    authorName?: string;
    narratorName?: string;
  };
}

class SessionService {
  private currentSession: PlaybackSession | null = null;
  private syncIntervalId: NodeJS.Timeout | null = null;
  // Backup chapters from last session (for fallback when session is null)
  private lastKnownChapters: SessionChapter[] = [];
  // Fix Bug #1/#4: Track pending close operations to prevent race conditions
  private pendingClosePromise: Promise<void> | null = null;
  private closingSessionId: string | null = null;
  // HIGH WATER MARK: Track highest known position per item to prevent progress regression
  // Capped at 200 entries to prevent unbounded growth over long app sessions
  private static readonly MAX_HWM_ENTRIES = 200;
  private highWaterMark: Map<string, number> = new Map();
  // Track last sync time to calculate timeListened for server stats
  private lastSyncTimestamp: number = 0;

  /**
   * Start a new playback session
   * FIX Bug #1: Now properly awaits pending close operations to prevent race conditions
   */
  async startSession(libraryItemId: string): Promise<PlaybackSession> {
    const timing = createTimer('startSession');

    logSection('START SESSION');
    log('Library item ID:', libraryItemId);

    // Fix Bug #1: Await any pending close operation to prevent race conditions
    if (this.pendingClosePromise) {
      log('Waiting for pending session close to complete...');
      await this.pendingClosePromise;
    }

    // Close old session and wait for it
    if (this.currentSession) {
      log('Closing previous session:', this.currentSession.id);
      await this.closeSessionAsync();
    }

    const baseUrl = apiClient.getBaseURL();
    const requestUrl = `/api/items/${libraryItemId}/play`;
    log('Request URL:', `${baseUrl}${requestUrl}`);
    audioLog.network('POST', requestUrl);

    timing('Sending request');

    try {
      // Use raw fetch instead of axios - axios was truncating large JSON responses
      const token = apiClient.getAuthToken();
      const fullUrl = `${baseUrl}${requestUrl}`;

      const rawResponse = await withTimeout(
        fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceInfo: {
              clientName: 'Secret Library',
              clientVersion: APP_VERSION,
              deviceId: `${Platform.OS}-secret-library`,
              manufacturer: getDeviceManufacturer(),
              model: getDeviceModel(),
              ...(getSdkVersion() != null ? { sdkVersion: getSdkVersion() } : {}),
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
          }),
        }),
        SESSION_START_TIMEOUT_MS,
        'Session start request',
      );

      if (!rawResponse.ok) {
        throw new Error(`Session request failed: ${rawResponse.status} ${rawResponse.statusText}`);
      }

      let session: PlaybackSession;
      const responseText = await rawResponse.text();
      try {
        session = JSON.parse(responseText) as PlaybackSession;
      } catch (parseError) {
        // Server returned non-JSON (e.g. HTML error page, empty body)
        const preview = responseText.substring(0, 200);
        throw new Error(
          `Session response is not valid JSON (status ${rawResponse.status}). Body preview: ${preview}`
        );
      }

      timing('Response received');

      // Log session details
      log('Session created successfully');
      log('  Session ID:', session.id);
      log('  Library Item ID:', session.libraryItemId);
      log('  Media Type:', session.mediaType);
      log('  Duration:', formatDuration(session.duration), `(${session.duration.toFixed(1)}s)`);
      log('  Current Time:', formatDuration(session.currentTime), `(${session.currentTime.toFixed(1)}s)`);
      log('  Audio Tracks:', session.audioTracks?.length || 0);
      log('  Chapters:', session.chapters?.length || 0);
      // FIX 3 verification: Log timestamp fields to verify server returns them
      log('  Updated At:', session.updatedAt ? new Date(session.updatedAt).toISOString() : 'NOT PRESENT');
      log('  Started At:', session.startedAt ? new Date(session.startedAt).toISOString() : 'NOT PRESENT');

      if (session.audioTracks?.length) {
        log('  First track content URL:', session.audioTracks[0].contentUrl);
        log('  First track mime type:', session.audioTracks[0].mimeType);
      }

      this.currentSession = session;
      // Initialize listening time tracker
      this.lastSyncTimestamp = Date.now();
      // Backup chapters for fallback during race conditions
      if (session.chapters?.length) {
        this.lastKnownChapters = session.chapters;
      }

      // HIGH WATER MARK: Initialize with server's current position
      if (session.currentTime > 0) {
        const existingHwm = this.highWaterMark.get(session.libraryItemId) || 0;
        if (session.currentTime > existingHwm) {
          this.highWaterMark.set(session.libraryItemId, session.currentTime);
          log('  High water mark initialized:', formatDuration(session.currentTime));
        }
      }

      return session;
    } catch (error) {
      audioLog.error('startSession failed:', getErrorMessage(error));
      audioLog.error('Stack:', (error instanceof Error ? error.stack : undefined));
      throw error;
    }
  }

  /**
   * Get full stream URL with authentication token
   *
   * For direct file URLs (/api/items/{id}/file/{ino}), appends /stream
   * to use the moov cache proxy's stream endpoint which properly handles
   * moov-at-end M4B files by rewriting stco offsets.
   */
  getStreamUrl(trackIndex: number = 0): string | null {
    const tracks = this.currentSession?.audioTracks;
    if (!tracks || trackIndex >= tracks.length) {
      log('getStreamUrl: No tracks available (index:', trackIndex, ')');
      return null;
    }

    const baseUrl = apiClient.getBaseURL().replace(/\/+$/, '');
    const track = tracks[trackIndex];

    // Get token
    const token = apiClient.getAuthToken() || '';

    log('getStreamUrl:');
    log('  Track index:', trackIndex);
    log('  Base URL:', baseUrl);
    log('  Content URL:', track.contentUrl);
    log('  Token present:', !!token);

    // Check if this is a direct file URL that needs /stream endpoint
    // Pattern: /api/items/{item_id}/file/{file_ino}
    let contentUrl = track.contentUrl;
    const fileUrlPattern = /^\/api\/items\/[^/]+\/file\/\d+/;
    if (fileUrlPattern.test(contentUrl)) {
      // Extract the path before any query params
      const [path, query] = contentUrl.split('?');
      contentUrl = `${path}/stream${query ? '?' + query : ''}`;
      log('  Using /stream endpoint for moov-at-end support');
    }

    if (contentUrl.includes('token=')) {
      const url = `${baseUrl}${contentUrl}`;
      log('  Final URL (token in content):', url.substring(0, 80) + '...');
      return url;
    }

    const separator = contentUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${contentUrl}${separator}token=${encodeURIComponent(token)}`;
    log('  Final URL:', url.substring(0, 80) + '...');
    return url;
  }

  /**
   * Adopt a cached session as the current session.
   * Called when using a pre-fetched session from playbackCache to ensure
   * getStreamUrl(), syncProgress(), and other methods work correctly.
   */
  adoptSession(session: PlaybackSession): void {
    log('Adopting cached session:', session.id);
    log('  Audio tracks:', session.audioTracks?.length || 0);
    log('  Chapters:', session.chapters?.length || 0);
    this.currentSession = session;
    this.lastSyncTimestamp = Date.now();
    if (session.chapters?.length) {
      this.lastKnownChapters = session.chapters;
    }

    // HIGH WATER MARK: Initialize from adopted session's position
    if (session.currentTime > 0) {
      const existingHwm = this.highWaterMark.get(session.libraryItemId) || 0;
      if (session.currentTime > existingHwm) {
        this.highWaterMark.set(session.libraryItemId, session.currentTime);
        log('  High water mark set from adopted session:', formatDuration(session.currentTime));
      }
    }
  }

  getCurrentSession(): PlaybackSession | null {
    return this.currentSession;
  }

  getChapters(): SessionChapter[] {
    // Use current session chapters, fall back to last known chapters
    return this.currentSession?.chapters || this.lastKnownChapters;
  }

  /**
   * Get backup chapters (for fallback when session is null)
   */
  getBackupChapters(): SessionChapter[] {
    return this.lastKnownChapters;
  }

  /**
   * Clear backup chapters (when switching to a different book)
   */
  clearBackupChapters(): void {
    this.lastKnownChapters = [];
  }

  /**
   * Update the high water mark for an item.
   * Called when position is resolved during loadBook to ensure the HWM
   * reflects the highest known position from any source (server, local, session).
   */
  updateHighWaterMark(itemId: string, position: number): void {
    const current = this.highWaterMark.get(itemId) || 0;
    if (position > current) {
      this.highWaterMark.set(itemId, position);
      // Evict oldest entries if over capacity
      if (this.highWaterMark.size > SessionService.MAX_HWM_ENTRIES) {
        const firstKey = this.highWaterMark.keys().next().value;
        if (firstKey) this.highWaterMark.delete(firstKey);
      }
      log(`High water mark updated for ${itemId}: ${formatDuration(position)}`);
    }
  }

  /**
   * Get the high water mark for an item.
   * Used by backgroundSyncService to prevent position regression without extra API calls.
   */
  getHighWaterMark(itemId: string): number {
    return this.highWaterMark.get(itemId) || 0;
  }

  getStartTime(): number {
    return this.currentSession?.currentTime || 0;
  }

  /**
   * Sync progress - non-blocking with retry
   *
   * FIX: Added retry logic to prevent lost progress syncs on transient failures.
   * FIX: Added position validation to prevent corrupted data from being synced.
   */
  syncProgress(currentTime: number): void {
    if (!this.currentSession) {
      audioLog.warn('syncProgress: No active session — sync skipped');
      return;
    }
    log(`syncProgress: ${formatDuration(currentTime)} (session: ${this.currentSession.id.substring(0, 8)}...)`);

    // VALIDATION: Prevent corrupted position data from being synced
    // This fixes the bug where position from one book gets applied to another
    const duration = this.currentSession.duration;
    if (currentTime < 0) {
      audioLog.warn(`syncProgress: Rejecting negative position ${currentTime}`);
      return;
    }
    if (duration > 0 && currentTime > duration + 60) {
      // Allow up to 60 seconds past duration for edge cases, but reject clearly corrupted data
      audioLog.warn(`syncProgress: Rejecting position ${currentTime} exceeding duration ${duration} by more than 60s`);
      return;
    }

    // HIGH WATER MARK: Block regression
    const itemId = this.currentSession.libraryItemId;
    const hwm = this.highWaterMark.get(itemId) || 0;
    if (currentTime < hwm - 5) { // Allow 5s tolerance for normal scrubbing
      audioLog.warn(`syncProgress: Blocked regression for ${itemId}. Attempted=${formatDuration(currentTime)}, HWM=${formatDuration(hwm)}`);
      return;
    }
    // Update high water mark
    if (currentTime > hwm) {
      this.highWaterMark.set(itemId, currentTime);
    }

    const sessionId = this.currentSession.id;
    audioLog.network('POST', `/api/session/${sessionId}/sync`);

    // Calculate actual listening time since last sync
    const now = Date.now();
    const timeListened = this.lastSyncTimestamp > 0
      ? Math.max(0, (now - this.lastSyncTimestamp) / 1000)
      : 0;
    this.lastSyncTimestamp = now;

    // Non-blocking with retry
    this.syncProgressWithRetry(sessionId, currentTime, timeListened, 3);
  }

  /**
   * Helper to sync progress with retries
   */
  private async syncProgressWithRetry(sessionId: string, currentTime: number, timeListened: number, maxRetries: number): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await apiClient.post(`/api/session/${sessionId}/sync`, {
          currentTime,
          timeListened,
        });
        log(`Session sync OK: ${formatDuration(currentTime)} (listened: ${timeListened.toFixed(0)}s)${attempt > 1 ? ` [attempt ${attempt}]` : ''}`);
        return;
      } catch (error) {
        const message = getErrorMessage(error);
        if (attempt === maxRetries) {
          audioLog.warn(`Sync progress failed after ${maxRetries} attempts:`, message);

          // All retries exhausted — accumulate listening time in SQLite
          // so it can be flushed to the server when connectivity returns
          if (timeListened > 0 && this.currentSession) {
            try {
              const { sqliteCache } = await import('@/core/services/sqliteCache');
              await sqliteCache.incrementOfflineListeningTime(
                this.currentSession.libraryItemId,
                timeListened
              );
              log(`Accumulated ${timeListened.toFixed(0)}s offline listening time`);
            } catch (accErr) {
              audioLog.warn('Failed to accumulate offline listening time:', getErrorMessage(accErr));
            }
          }
        } else {
          // Wait before retry (500ms, 1000ms)
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }
  }

  /**
   * Sync progress and wait (for important saves)
   * FIX: Added position validation to prevent corrupted data from being synced.
   */
  async syncProgressAsync(currentTime: number): Promise<void> {
    if (!this.currentSession) {
      log('syncProgressAsync: No active session');
      return;
    }

    // VALIDATION: Prevent corrupted position data from being synced
    const duration = this.currentSession.duration;
    if (currentTime < 0) {
      audioLog.warn(`syncProgressAsync: Rejecting negative position ${currentTime}`);
      return;
    }
    if (duration > 0 && currentTime > duration + 60) {
      audioLog.warn(`syncProgressAsync: Rejecting position ${currentTime} exceeding duration ${duration} by more than 60s`);
      return;
    }

    // HIGH WATER MARK: Block regression
    const itemId = this.currentSession.libraryItemId;
    const hwm = this.highWaterMark.get(itemId) || 0;
    if (currentTime < hwm - 5) { // Allow 5s tolerance for normal scrubbing
      audioLog.warn(`syncProgressAsync: Blocked regression for ${itemId}. Attempted=${formatDuration(currentTime)}, HWM=${formatDuration(hwm)}`);
      return;
    }
    // Update high water mark
    if (currentTime > hwm) {
      this.highWaterMark.set(itemId, currentTime);
    }

    const sessionId = this.currentSession.id;
    log('Syncing progress:', formatDuration(currentTime));
    audioLog.network('POST', `/api/session/${sessionId}/sync`);

    // Calculate actual listening time since last sync
    const now = Date.now();
    const timeListened = this.lastSyncTimestamp > 0
      ? Math.max(0, (now - this.lastSyncTimestamp) / 1000)
      : 0;
    this.lastSyncTimestamp = now;

    try {
      await apiClient.post(`/api/session/${sessionId}/sync`, {
        currentTime,
        timeListened,
      });
      log('Progress synced successfully');
    } catch (error) {
      audioLog.warn('Sync failed:', getErrorMessage(error));
    }
  }

  startAutoSync(getCurrentTime: () => number): void {
    this.stopAutoSync();
    log('Starting auto-sync (interval: 10s)');
    this.syncIntervalId = setInterval(() => {
      const time = getCurrentTime();
      if (time > 0) {
        this.syncProgress(time); // Non-blocking
      } else {
        audioLog.warn('Auto-sync: getCurrentTime() returned 0, skipping');
      }
    }, 10000);
  }

  stopAutoSync(): void {
    if (this.syncIntervalId) {
      log('Stopping auto-sync');
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Close session - with retry and proper tracking
   *
   * FIX Bug #1/#4: Now returns a Promise and tracks the closing operation.
   * Only clears currentSession after close completes AND if it's still the same session.
   * This prevents race conditions when starting a new session while closing the old one.
   *
   * FIX: Added retry logic to prevent orphaned sessions on the server.
   * FIX: Added position validation to prevent corrupted data from being synced.
   */
  async closeSessionAsync(finalTime?: number): Promise<void> {
    this.stopAutoSync();

    if (!this.currentSession) return;

    // Capture session data before any async work
    const sessionToClose = this.currentSession;
    const sessionId = sessionToClose.id;
    const duration = sessionToClose.duration;

    // Fix Bug #4: Track which session is being closed
    this.closingSessionId = sessionId;

    // FALLBACK: If no finalTime provided, use high water mark or session's currentTime
    // This prevents closing a session with undefined/0 when called during reconnection
    const itemId = sessionToClose.libraryItemId;
    let sanitizedFinalTime = finalTime;
    if (sanitizedFinalTime === undefined || sanitizedFinalTime === null) {
      const hwm = this.highWaterMark.get(itemId) || 0;
      const sessionTime = sessionToClose.currentTime || 0;
      sanitizedFinalTime = Math.max(hwm, sessionTime);
      if (sanitizedFinalTime > 0) {
        log(`closeSessionAsync: No finalTime provided, using fallback position ${formatDuration(sanitizedFinalTime)} (HWM=${formatDuration(hwm)}, session=${formatDuration(sessionTime)})`);
      }
    }

    // VALIDATION: Sanitize finalTime before sending
    if (sanitizedFinalTime < 0) {
      audioLog.warn(`closeSessionAsync: Clamping negative position ${sanitizedFinalTime} to 0`);
      sanitizedFinalTime = 0;
    } else if (duration > 0 && sanitizedFinalTime > duration + 60) {
      audioLog.warn(`closeSessionAsync: Clamping position ${sanitizedFinalTime} to duration ${duration}`);
      sanitizedFinalTime = duration;
    }

    // HIGH WATER MARK: Don't close session with a position lower than our known max
    const hwm = this.highWaterMark.get(itemId) || 0;
    if (sanitizedFinalTime < hwm - 5) {
      audioLog.warn(`closeSessionAsync: Upgrading close position from ${formatDuration(sanitizedFinalTime)} to HWM ${formatDuration(hwm)} for ${itemId}`);
      sanitizedFinalTime = hwm;
    }
    // Update high water mark if closing at a higher position
    if (sanitizedFinalTime > hwm) {
      this.highWaterMark.set(itemId, sanitizedFinalTime);
    }

    // Backup chapters before clearing (for race condition safety)
    if (sessionToClose.chapters?.length) {
      this.lastKnownChapters = sessionToClose.chapters;
    }

    log('Closing session (async):', sessionId);
    if (sanitizedFinalTime !== undefined) {
      log('  Final time:', formatDuration(sanitizedFinalTime));
    }

    // Calculate timeListened for the close payload
    const now = Date.now();
    const closeTimeListened = this.lastSyncTimestamp > 0
      ? Math.max(0, (now - this.lastSyncTimestamp) / 1000)
      : 0;
    this.lastSyncTimestamp = 0; // Reset for next session

    // Fix Bug #1: Track the close promise so startSession can await it
    this.pendingClosePromise = this.closeSessionWithRetry(sessionId, sanitizedFinalTime, closeTimeListened, 3)
      .finally(() => {
        // Fix Bug #4: Only clear currentSession if it's still the session we're closing
        // This prevents clearing a new session that was started while we were closing
        if (this.currentSession?.id === sessionId) {
          this.currentSession = null;
        }
        // Clear tracking state
        if (this.closingSessionId === sessionId) {
          this.closingSessionId = null;
        }
        this.pendingClosePromise = null;
      });

    await this.pendingClosePromise;
  }

  /**
   * Helper to close session with retries
   */
  private async closeSessionWithRetry(sessionId: string, finalTime: number | undefined, timeListened: number, maxRetries: number): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await apiClient.post(`/api/session/${sessionId}/close`, {
          currentTime: finalTime,
          timeListened,
        });
        log(`Session ${sessionId} closed successfully (attempt ${attempt})`);
        return;
      } catch (error) {
        const message = getErrorMessage(error);
        if (attempt === maxRetries) {
          audioLog.warn(`Close session ${sessionId} failed after ${maxRetries} attempts:`, message);
        } else {
          log(`Close session ${sessionId} attempt ${attempt} failed, retrying...`);
          // Wait before retry (exponential backoff: 500ms, 1000ms, 2000ms)
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }
  }

  /**
   * Close session and wait (for app shutdown)
   * FIX: Added position validation to prevent corrupted data from being synced.
   * FIX Bug #4: Only clears currentSession if it's still the same session.
   */
  async closeSession(finalTime?: number): Promise<void> {
    this.stopAutoSync();

    // Await any pending async close first
    if (this.pendingClosePromise) {
      await this.pendingClosePromise;
    }

    if (!this.currentSession) {
      log('closeSession: No active session');
      return;
    }

    const sessionId = this.currentSession.id;
    const duration = this.currentSession.duration;

    // Track which session is being closed
    this.closingSessionId = sessionId;

    // FALLBACK: If no finalTime provided, use high water mark or session's currentTime
    const itemId = this.currentSession.libraryItemId;
    let sanitizedFinalTime = finalTime;
    if (sanitizedFinalTime === undefined || sanitizedFinalTime === null) {
      const hwm = this.highWaterMark.get(itemId) || 0;
      const sessionTime = this.currentSession.currentTime || 0;
      sanitizedFinalTime = Math.max(hwm, sessionTime);
      if (sanitizedFinalTime > 0) {
        log(`closeSession: No finalTime provided, using fallback position ${formatDuration(sanitizedFinalTime)} (HWM=${formatDuration(hwm)}, session=${formatDuration(sessionTime)})`);
      }
    }

    // VALIDATION: Sanitize finalTime before sending
    if (sanitizedFinalTime < 0) {
      audioLog.warn(`closeSession: Clamping negative position ${sanitizedFinalTime} to 0`);
      sanitizedFinalTime = 0;
    } else if (duration > 0 && sanitizedFinalTime > duration + 60) {
      audioLog.warn(`closeSession: Clamping position ${sanitizedFinalTime} to duration ${duration}`);
      sanitizedFinalTime = duration;
    }

    // HIGH WATER MARK: Don't close session with a position lower than our known max
    const hwmClose = this.highWaterMark.get(itemId) || 0;
    if (sanitizedFinalTime < hwmClose - 5) {
      audioLog.warn(`closeSession: Upgrading close position from ${formatDuration(sanitizedFinalTime)} to HWM ${formatDuration(hwmClose)} for ${itemId}`);
      sanitizedFinalTime = hwmClose;
    }
    // Update high water mark if closing at a higher position
    if (sanitizedFinalTime > hwmClose) {
      this.highWaterMark.set(itemId, sanitizedFinalTime);
    }

    // Calculate timeListened for the close payload
    const closeNow = Date.now();
    const closeTimeListened = this.lastSyncTimestamp > 0
      ? Math.max(0, (closeNow - this.lastSyncTimestamp) / 1000)
      : 0;
    this.lastSyncTimestamp = 0; // Reset for next session

    logSection('CLOSE SESSION');
    log('Session ID:', sessionId);
    if (sanitizedFinalTime !== undefined) {
      log('Final time:', formatDuration(sanitizedFinalTime));
    }

    try {
      await apiClient.post(`/api/session/${sessionId}/close`, {
        currentTime: sanitizedFinalTime,
        timeListened: closeTimeListened,
      });
      log('Session closed successfully');
    } catch (error) {
      audioLog.warn('Close session failed:', getErrorMessage(error));
    } finally {
      // Fix Bug #4: Only clear if it's still the same session
      if (this.currentSession?.id === sessionId) {
        this.currentSession = null;
      }
      if (this.closingSessionId === sessionId) {
        this.closingSessionId = null;
      }
    }
  }

  /**
   * Check if a session close operation is in progress
   */
  isClosingSession(): boolean {
    return this.closingSessionId !== null || this.pendingClosePromise !== null;
  }

  /**
   * Flush accumulated offline listening time to the server.
   * Opens a temporary session for each book with pending time,
   * syncs the accumulated seconds, then closes the session.
   *
   * Called when network connectivity is restored (network:online event).
   */
  async flushOfflineListeningTime(): Promise<void> {
    const { sqliteCache } = await import('@/core/services/sqliteCache');

    const pending = await sqliteCache.getAllPendingOfflineListeningTime();
    if (pending.length === 0) return;

    log(`Flushing offline listening time for ${pending.length} book(s)`);

    // Skip the currently playing book — its active session will handle its own time
    const currentBookId = this.currentSession?.libraryItemId;

    for (const item of pending) {
      if (item.bookId === currentBookId) {
        log(`Skipping ${item.bookId} — currently playing`);
        continue;
      }

      if (item.seconds <= 0) continue;

      try {
        // Open a temporary session
        const response = await apiClient.post<{ id: string }>(`/api/items/${item.bookId}/play`, {
          deviceInfo: {
            deviceId: `${Platform.OS}-offline-flush`,
            clientName: 'Secret Library',
            clientVersion: APP_VERSION,
          },
          mediaPlayer: 'offline-flush',
          forceDirectPlay: true,
        });

        const sessionId = response?.id;
        if (!sessionId) {
          audioLog.warn(`Failed to open flush session for ${item.bookId}: no session ID`);
          continue;
        }

        // Sync with accumulated listening time
        await apiClient.post(`/api/session/${sessionId}/sync`, {
          currentTime: item.currentTime,
          timeListened: item.seconds,
        });

        // Close the temporary session
        await apiClient.post(`/api/session/${sessionId}/close`, {
          currentTime: item.currentTime,
          timeListened: 0, // Already reported in sync
        });

        // Reset local counter
        await sqliteCache.resetOfflineListeningTime(item.bookId);

        log(`Flushed ${item.seconds}s offline listening for ${item.bookId}`);
      } catch (error) {
        // Network error — stop the batch (we're likely offline again)
        audioLog.warn(`Offline listening flush failed for ${item.bookId}:`, getErrorMessage(error));
        break;
      }
    }
  }
}


export const sessionService = new SessionService();