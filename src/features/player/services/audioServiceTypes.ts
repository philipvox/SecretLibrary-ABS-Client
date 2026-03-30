/**
 * src/features/player/services/audioServiceTypes.ts
 *
 * Shared type definitions for audio services.
 * These types are used by all platform-specific audio service implementations
 * (audioService.ts, audioService.android.ts, audioService.ios.ts).
 */

export interface PlaybackState {
  isPlaying: boolean;
  position: number;       // Global position across all tracks
  duration: number;       // Total duration of all tracks
  isBuffering: boolean;
  didJustFinish: boolean; // True when last track in queue ends
  isStuck?: boolean;      // True when playback appears stuck (position unchanged for 5+ seconds)
}

export interface AudioTrackInfo {
  url: string;
  title: string;
  startOffset: number;    // Global start position of this track
  duration: number;
}

export type AudioErrorType = 'URL_EXPIRED' | 'NETWORK_ERROR' | 'LOAD_FAILED';

export interface AudioError {
  type: AudioErrorType;
  message: string;
  httpStatus?: number;      // HTTP status code if applicable
  position?: number;        // Position when error occurred (for resume)
  bookId?: string;          // Book ID for session refresh
}

export type StatusCallback = (status: PlaybackState) => void;
export type ErrorCallback = (error: AudioError) => void;
export type RemoteCommandCallback = (command: 'nextChapter' | 'prevChapter' | 'skipForward' | 'skipBackward' | 'seek' | 'play' | 'pause', position?: number) => void;
