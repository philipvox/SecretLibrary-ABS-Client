/**
 * src/core/api/index.ts
 * 
 * API module public exports
 */

export { apiClient } from './apiClient';
export type { ApiClient } from './apiClient';

// Playback session API
export {
  startPlaybackSession,
  syncSessionProgress,
  closePlaybackSession,
  buildStreamUrl,
  getMediaProgress,
  updateMediaProgress,
  hideFromContinueListening,
} from './playbackApi';
export type { 
  PlaybackSession, 
  AudioTrack, 
  PlaybackChapter 
} from './playbackApi';