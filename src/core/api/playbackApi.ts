/**
 * src/core/api/playbackApi.ts
 * 
 * AudiobookShelf Playback Session API
 * Uses the proper /api/items/{id}/play endpoint for streaming
 */

import { apiClient } from './apiClient';

export interface AudioTrack {
  index: number;
  startOffset: number;
  duration: number;
  title: string;
  contentUrl: string;
  mimeType: string;
}

export interface PlaybackChapter {
  id: number;
  start: number;
  end: number;
  title: string;
}

export interface PlaybackSession {
  id: string;
  userId: string;
  libraryId: string;
  libraryItemId: string;
  episodeId?: string | null;
  mediaType: 'book' | 'podcast';
  duration: number;
  playMethod: number; // 0 = direct play, 1 = direct stream, 2 = transcode
  startTime: number;
  currentTime: number;
  updatedAt: number;
  audioTracks: AudioTrack[];
  chapters: PlaybackChapter[];
  mediaMetadata: {
    title?: string;
    subtitle?: string;
    authors?: Array<{ id: string; name: string }>;
    narrators?: string[];
    series?: Array<{ id: string; name: string; sequence?: string }>;
  };
  displayTitle: string;
  displayAuthor: string;
  coverPath?: string;
}

interface DeviceInfo {
  clientName: string;
  clientVersion: string;
  deviceId: string;
  deviceType: string;
}

interface StartSessionRequest {
  deviceInfo: DeviceInfo;
  forceDirectPlay?: boolean;
  forceTranscode?: boolean;
  supportedMimeTypes?: string[];
  mediaPlayer?: string;
}

/**
 * Start a playback session with the server
 * POST /api/items/{libraryItemId}/play
 * 
 * This is the CORRECT way to get streaming URLs from AudiobookShelf!
 * Returns audioTracks with contentUrl that includes the proper streaming path.
 */
export async function startPlaybackSession(
  libraryItemId: string,
  episodeId?: string
): Promise<PlaybackSession> {
  const endpoint = episodeId
    ? `/api/items/${libraryItemId}/play/${episodeId}`
    : `/api/items/${libraryItemId}/play`;

  const request: StartSessionRequest = {
    deviceInfo: {
      clientName: 'AudiobookShelf-RN',
      clientVersion: '1.0.0',
      deviceId: 'expo-mobile',
      deviceType: 'mobile',
    },
    forceDirectPlay: true, // Prefer direct play for mobile
    forceTranscode: false,
    supportedMimeTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/m4b',
      'audio/flac',
      'audio/ogg',
      'audio/aac',
      'audio/wav',
    ],
    mediaPlayer: 'expo-audio',
  };

  return apiClient.post<PlaybackSession>(endpoint, request);
}

/**
 * Sync playback progress with server
 * POST /api/session/{sessionId}/sync
 */
export async function syncSessionProgress(
  sessionId: string,
  currentTime: number,
  timeListening: number
): Promise<void> {
  await apiClient.post(`/api/session/${sessionId}/sync`, {
    currentTime,
    timeListening,
  });
}

/**
 * Close a playback session
 * POST /api/session/{sessionId}/close
 */
export async function closePlaybackSession(
  sessionId: string,
  currentTime: number,
  timeListening: number
): Promise<void> {
  await apiClient.post(`/api/session/${sessionId}/close`, {
    currentTime,
    timeListening,
  });
}

/**
 * Build full streaming URL from track contentUrl
 * 
 * contentUrl from session is like: "/s/item/li_xxx/filename.mp3"
 * We need to add serverUrl and token
 */
export function buildStreamUrl(
  contentUrl: string,
  serverUrl: string,
  token: string
): string {
  // Remove trailing slash from server URL
  const baseUrl = serverUrl.replace(/\/+$/, '');
  
  // Add token as query param
  const separator = contentUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${contentUrl}${separator}token=${token}`;
}

/**
 * Get the current playback position for a library item
 * GET /api/me/progress/{libraryItemId}
 */
export async function getMediaProgress(
  libraryItemId: string,
  episodeId?: string
): Promise<{ currentTime: number; progress: number; isFinished: boolean } | null> {
  try {
    const endpoint = episodeId
      ? `/api/me/progress/${libraryItemId}/${episodeId}`
      : `/api/me/progress/${libraryItemId}`;
    
    return await apiClient.get(endpoint);
  } catch {
    return null;
  }
}

/**
 * Update media progress
 * PATCH /api/me/progress/{libraryItemId}
 */
export async function updateMediaProgress(
  libraryItemId: string,
  currentTime: number,
  duration: number,
  isFinished: boolean = false,
  episodeId?: string
): Promise<void> {
  const endpoint = episodeId
    ? `/api/me/progress/${libraryItemId}/${episodeId}`
    : `/api/me/progress/${libraryItemId}`;

  await apiClient.patch(endpoint, {
    currentTime,
    duration,
    progress: duration > 0 ? currentTime / duration : 0,
    isFinished,
  });
}

/**
 * Hide item from continue listening
 * PATCH /api/me/progress/{libraryItemId}
 */
export async function hideFromContinueListening(
  libraryItemId: string,
  episodeId?: string
): Promise<void> {
  const endpoint = episodeId
    ? `/api/me/progress/${libraryItemId}/${episodeId}`
    : `/api/me/progress/${libraryItemId}`;

  await apiClient.patch(endpoint, {
    hideFromContinueListening: true,
  });
}