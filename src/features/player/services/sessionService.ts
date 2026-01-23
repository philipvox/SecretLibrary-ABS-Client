/**
 * src/features/player/services/sessionService.ts
 *
 * OPTIMIZED for instant streaming
 * - Non-blocking session close
 * - Faster session start
 */

import { apiClient } from '@/core/api';
import { audioLog, createTimer, logSection, formatDuration } from '@/shared/utils/audioDebug';
import { getErrorMessage } from '@/shared/utils/errorUtils';

const log = (msg: string, ...args: any[]) => audioLog.session(msg, ...args);

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

  /**
   * Start a new playback session
   * NON-BLOCKING: closes old session in background
   */
  async startSession(libraryItemId: string): Promise<PlaybackSession> {
    const timing = createTimer('startSession');

    logSection('START SESSION');
    log('Library item ID:', libraryItemId);

    // Close old session in BACKGROUND (don't await)
    if (this.currentSession) {
      log('Closing previous session:', this.currentSession.id);
      this.closeSessionAsync();
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

      const rawResponse = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceInfo: {
            clientName: 'AudiobookShelf-RN',
            clientVersion: '1.0.0',
            deviceId: 'rn-mobile-app',
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
      });

      if (!rawResponse.ok) {
        throw new Error(`Session request failed: ${rawResponse.status} ${rawResponse.statusText}`);
      }

      const session = JSON.parse(await rawResponse.text()) as PlaybackSession;

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
      // Backup chapters for fallback during race conditions
      if (session.chapters?.length) {
        this.lastKnownChapters = session.chapters;
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

    if (track.contentUrl.includes('token=')) {
      const url = `${baseUrl}${track.contentUrl}`;
      log('  Final URL (token in content):', url.substring(0, 80) + '...');
      return url;
    }

    const separator = track.contentUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${track.contentUrl}${separator}token=${token}`;
    log('  Final URL:', url.substring(0, 80) + '...');
    return url;
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
      log('syncProgress: No active session');
      return;
    }

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

    const sessionId = this.currentSession.id;
    audioLog.network('POST', `/api/session/${sessionId}/sync`);

    // Non-blocking with retry
    this.syncProgressWithRetry(sessionId, currentTime, 3);
  }

  /**
   * Helper to sync progress with retries
   */
  private async syncProgressWithRetry(sessionId: string, currentTime: number, maxRetries: number): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await apiClient.post(`/api/session/${sessionId}/sync`, {
          currentTime,
          timeListened: 0,
        });
        if (attempt > 1) {
          log(`Progress synced successfully (attempt ${attempt})`);
        }
        return;
      } catch (error) {
        const message = getErrorMessage(error);
        if (attempt === maxRetries) {
          audioLog.warn(`Sync progress failed after ${maxRetries} attempts:`, message);
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

    const sessionId = this.currentSession.id;
    log('Syncing progress:', formatDuration(currentTime));
    audioLog.network('POST', `/api/session/${sessionId}/sync`);

    try {
      await apiClient.post(`/api/session/${sessionId}/sync`, {
        currentTime,
        timeListened: 0,
      });
      log('Progress synced successfully');
    } catch (error) {
      audioLog.warn('Sync failed:', getErrorMessage(error));
    }
  }

  startAutoSync(getCurrentTime: () => number): void {
    this.stopAutoSync();
    log('Starting auto-sync (interval: 30s)');
    this.syncIntervalId = setInterval(() => {
      const time = getCurrentTime();
      if (time > 0) {
        this.syncProgress(time); // Non-blocking
      }
    }, 30000);
  }

  stopAutoSync(): void {
    if (this.syncIntervalId) {
      log('Stopping auto-sync');
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Close session - NON-BLOCKING with retry
   *
   * Clears currentSession immediately to prevent new requests using stale session.
   * Chapters are backed up in lastKnownChapters for fallback during race conditions.
   *
   * FIX: Added retry logic to prevent orphaned sessions on the server.
   * FIX: Added position validation to prevent corrupted data from being synced.
   */
  closeSessionAsync(finalTime?: number): void {
    this.stopAutoSync();

    if (!this.currentSession) return;

    // Capture session data before clearing
    const sessionToClose = this.currentSession;
    const sessionId = sessionToClose.id;
    const duration = sessionToClose.duration;

    // VALIDATION: Sanitize finalTime before sending
    let sanitizedFinalTime = finalTime;
    if (finalTime !== undefined) {
      if (finalTime < 0) {
        audioLog.warn(`closeSessionAsync: Clamping negative position ${finalTime} to 0`);
        sanitizedFinalTime = 0;
      } else if (duration > 0 && finalTime > duration + 60) {
        audioLog.warn(`closeSessionAsync: Clamping position ${finalTime} to duration ${duration}`);
        sanitizedFinalTime = duration;
      }
    }

    // Backup chapters before clearing (for race condition safety)
    if (sessionToClose.chapters?.length) {
      this.lastKnownChapters = sessionToClose.chapters;
    }

    log('Closing session (async):', sessionId);
    if (sanitizedFinalTime !== undefined) {
      log('  Final time:', formatDuration(sanitizedFinalTime));
    }

    // Clear immediately to prevent stale session usage
    this.currentSession = null;

    // Close with retry to prevent orphaned sessions
    this.closeSessionWithRetry(sessionId, sanitizedFinalTime, 3);
  }

  /**
   * Helper to close session with retries
   */
  private async closeSessionWithRetry(sessionId: string, finalTime: number | undefined, maxRetries: number): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await apiClient.post(`/api/session/${sessionId}/close`, {
          currentTime: finalTime,
          timeListened: 0,
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
   */
  async closeSession(finalTime?: number): Promise<void> {
    this.stopAutoSync();

    if (!this.currentSession) {
      log('closeSession: No active session');
      return;
    }

    const sessionId = this.currentSession.id;
    const duration = this.currentSession.duration;

    // VALIDATION: Sanitize finalTime before sending
    let sanitizedFinalTime = finalTime;
    if (finalTime !== undefined) {
      if (finalTime < 0) {
        audioLog.warn(`closeSession: Clamping negative position ${finalTime} to 0`);
        sanitizedFinalTime = 0;
      } else if (duration > 0 && finalTime > duration + 60) {
        audioLog.warn(`closeSession: Clamping position ${finalTime} to duration ${duration}`);
        sanitizedFinalTime = duration;
      }
    }

    logSection('CLOSE SESSION');
    log('Session ID:', sessionId);
    if (sanitizedFinalTime !== undefined) {
      log('Final time:', formatDuration(sanitizedFinalTime));
    }

    try {
      await apiClient.post(`/api/session/${sessionId}/close`, {
        currentTime: sanitizedFinalTime,
        timeListened: 0,
      });
      log('Session closed successfully');
    } catch (error) {
      audioLog.warn('Close session failed:', getErrorMessage(error));
    } finally {
      this.currentSession = null;
    }
  }
}


export const sessionService = new SessionService();