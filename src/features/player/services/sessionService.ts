/**
 * src/features/player/services/sessionService.ts
 *
 * OPTIMIZED for instant streaming
 * - Non-blocking session close
 * - Faster session start
 */

import { apiClient } from '@/core/api';
import { audioLog, createTimer, logSection, formatDuration } from '@/shared/utils/audioDebug';

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
      const session = await apiClient.post<PlaybackSession>(
        requestUrl,
        {
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
        }
      );

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

      if (session.audioTracks?.length) {
        log('  First track content URL:', session.audioTracks[0].contentUrl);
        log('  First track mime type:', session.audioTracks[0].mimeType);
      }

      this.currentSession = session;
      return session;
    } catch (error: any) {
      audioLog.error('startSession failed:', error.message);
      audioLog.error('Stack:', error.stack);
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
    let token = '';
    if (typeof (apiClient as any).getAuthToken === 'function') {
      token = (apiClient as any).getAuthToken() || '';
    } else if ((apiClient as any).authToken) {
      token = (apiClient as any).authToken;
    } else if ((apiClient as any).token) {
      token = (apiClient as any).token;
    }

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
    return this.currentSession?.chapters || [];
  }

  getStartTime(): number {
    return this.currentSession?.currentTime || 0;
  }

  /**
   * Sync progress - fire and forget (non-blocking)
   */
  syncProgress(currentTime: number): void {
    if (!this.currentSession) {
      log('syncProgress: No active session');
      return;
    }

    const sessionId = this.currentSession.id;
    audioLog.network('POST', `/api/session/${sessionId}/sync`);

    // Fire and forget - don't await
    apiClient.post(`/api/session/${sessionId}/sync`, {
      currentTime,
      timeListened: 0,
    }).catch((error) => {
      audioLog.warn('Sync failed (non-blocking):', error.message);
    });
  }

  /**
   * Sync progress and wait (for important saves)
   */
  async syncProgressAsync(currentTime: number): Promise<void> {
    if (!this.currentSession) {
      log('syncProgressAsync: No active session');
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
    } catch (error: any) {
      audioLog.warn('Sync failed:', error.message);
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
   * Close session - NON-BLOCKING (fire and forget)
   */
  closeSessionAsync(finalTime?: number): void {
    this.stopAutoSync();

    if (!this.currentSession) return;

    const sessionId = this.currentSession.id;
    log('Closing session (async):', sessionId);
    if (finalTime !== undefined) {
      log('  Final time:', formatDuration(finalTime));
    }

    this.currentSession = null;

    // Fire and forget
    apiClient.post(`/api/session/${sessionId}/close`, {
      currentTime: finalTime,
      timeListened: 0,
    }).catch((error) => {
      audioLog.warn('Close session failed (non-blocking):', error.message);
    });
  }

  /**
   * Close session and wait (for app shutdown)
   */
  async closeSession(finalTime?: number): Promise<void> {
    this.stopAutoSync();

    if (!this.currentSession) {
      log('closeSession: No active session');
      return;
    }

    const sessionId = this.currentSession.id;
    logSection('CLOSE SESSION');
    log('Session ID:', sessionId);
    if (finalTime !== undefined) {
      log('Final time:', formatDuration(finalTime));
    }

    try {
      await apiClient.post(`/api/session/${sessionId}/close`, {
        currentTime: finalTime,
        timeListened: 0,
      });
      log('Session closed successfully');
    } catch (error: any) {
      audioLog.warn('Close session failed:', error.message);
    } finally {
      this.currentSession = null;
    }
  }
}


export const sessionService = new SessionService();