/**
 * src/features/player/services/sessionService.ts
 * 
 * ABS Playback Session API
 * CORRECT endpoint: POST /api/items/{libraryItemId}/play
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
   * CORRECT endpoint: POST /api/items/{libraryItemId}/play
   */
  async startSession(libraryItemId: string): Promise<PlaybackSession> {
    console.log('[Session] Starting session for:', libraryItemId);
    const startTime = Date.now();

    // Close any existing session first
    await this.closeSession();

    try {
      // CORRECT ENDPOINT - was using /api/session which is wrong
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

      const elapsed = Date.now() - startTime;
      console.log('[Session] ✓ Session started in', elapsed, 'ms');
      console.log('[Session] ID:', session.id);
      console.log('[Session] Duration:', session.duration, 'sec');
      console.log('[Session] Tracks:', session.audioTracks?.length);
      console.log('[Session] Chapters:', session.chapters?.length);
      console.log('[Session] Resume at:', session.currentTime, 'sec');

      return session;
    } catch (error: any) {
      console.error('[Session] ❌ Failed to start:', error.message);
      throw error;
    }
  }

  /**
   * Get full stream URL with authentication token
   */
  getStreamUrl(trackIndex: number = 0): string | null {
    const tracks = this.currentSession?.audioTracks;
    if (!tracks || trackIndex >= tracks.length) return null;

    const baseUrl = apiClient.getBaseURL().replace(/\/+$/, '');
    const track = tracks[trackIndex];
    
    // Get token - try multiple approaches for compatibility
    let token = '';
    if (typeof (apiClient as any).getAuthToken === 'function') {
      token = (apiClient as any).getAuthToken() || '';
    } else if ((apiClient as any).authToken) {
      token = (apiClient as any).authToken;
    } else if ((apiClient as any).token) {
      token = (apiClient as any).token;
    }
    
    // contentUrl might already have token
    if (track.contentUrl.includes('token=')) {
      return `${baseUrl}${track.contentUrl}`;
    }
    
    const separator = track.contentUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${track.contentUrl}${separator}token=${token}`;
  }
  /**
   * Get current session
   */
  getCurrentSession(): PlaybackSession | null {
    return this.currentSession;
  }

  /**
   * Get chapters from current session
   */
  getChapters(): SessionChapter[] {
    return this.currentSession?.chapters || [];
  }

  /**
   * Get session start time (where to resume)
   */
  getStartTime(): number {
    return this.currentSession?.currentTime || 0;
  }

  /**
   * Sync progress with server
   */
  async syncProgress(currentTime: number): Promise<void> {
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

  /**
   * Start auto-sync interval (every 30 seconds)
   */
  startAutoSync(getCurrentTime: () => number): void {
    this.stopAutoSync();
    this.syncIntervalId = setInterval(() => {
      const time = getCurrentTime();
      if (time > 0) {
        this.syncProgress(time);
      }
    }, 30000);
  }

  /**
   * Stop auto-sync interval
   */
  stopAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Close the current session
   */
  async closeSession(finalTime?: number): Promise<void> {
    this.stopAutoSync();

    if (!this.currentSession) return;

    try {
      await apiClient.post(`/api/session/${this.currentSession.id}/close`, {
        currentTime: finalTime,
        timeListened: 0,
      });
      console.log('[Session] Closed:', this.currentSession.id);
    } catch (error) {
      console.warn('[Session] Close failed:', error);
    } finally {
      this.currentSession = null;
    }
  }
}

export const sessionService = new SessionService();