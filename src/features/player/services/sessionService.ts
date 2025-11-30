/**
 * src/features/player/services/sessionService.ts
 * 
 * OPTIMIZED for instant streaming
 * - Non-blocking session close
 * - Faster session start
 */

import { apiClient } from '@/core/api';

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
    // Close old session in BACKGROUND (don't await)
    this.closeSessionAsync();

    const session = await apiClient.post<PlaybackSession>(
      `/api/items/${libraryItemId}/play`,
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

    this.currentSession = session;
    return session;
  }

  /**
   * Get full stream URL with authentication token
   */
  getStreamUrl(trackIndex: number = 0): string | null {
    const tracks = this.currentSession?.audioTracks;
    if (!tracks || trackIndex >= tracks.length) return null;

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
    
    if (track.contentUrl.includes('token=')) {
      return `${baseUrl}${track.contentUrl}`;
    }
    
    const separator = track.contentUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${track.contentUrl}${separator}token=${token}`;
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
    if (!this.currentSession) return;

    // Fire and forget - don't await
    apiClient.post(`/api/session/${this.currentSession.id}/sync`, {
      currentTime,
      timeListened: 0,
    }).catch(() => {}); // Silently ignore errors
  }

  /**
   * Sync progress and wait (for important saves)
   */
  async syncProgressAsync(currentTime: number): Promise<void> {
    if (!this.currentSession) return;

    try {
      await apiClient.post(`/api/session/${this.currentSession.id}/sync`, {
        currentTime,
        timeListened: 0,
      });
    } catch (error) {
      console.warn('[Session] Sync failed:', error);
    }
  }

  startAutoSync(getCurrentTime: () => number): void {
    this.stopAutoSync();
    this.syncIntervalId = setInterval(() => {
      const time = getCurrentTime();
      if (time > 0) {
        this.syncProgress(time); // Non-blocking
      }
    }, 30000);
  }

  stopAutoSync(): void {
    if (this.syncIntervalId) {
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
    this.currentSession = null;

    // Fire and forget
    apiClient.post(`/api/session/${sessionId}/close`, {
      currentTime: finalTime,
      timeListened: 0,
    }).catch(() => {});
  }

  /**
   * Close session and wait (for app shutdown)
   */
  async closeSession(finalTime?: number): Promise<void> {
    this.stopAutoSync();

    if (!this.currentSession) return;

    try {
      await apiClient.post(`/api/session/${this.currentSession.id}/close`, {
        currentTime: finalTime,
        timeListened: 0,
      });
    } catch {
      // Ignore close errors
    } finally {
      this.currentSession = null;
    }
  }
}


export const sessionService = new SessionService();