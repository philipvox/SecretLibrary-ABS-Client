import { requireNativeModule, EventEmitter } from 'expo-modules-core';

// ── Event types ──

export interface AVPlayerPlaybackStateEvent {
  isPlaying: boolean;
  position: number;       // Global position in seconds
  duration: number;       // Total duration in seconds
  isBuffering: boolean;
  didJustFinish: boolean;
  isStuck: boolean;
}

export interface AVPlayerTrackChangeEvent {
  trackIndex: number;
  totalTracks: number;
  title?: string;
  startOffset?: number;
}

export interface AVPlayerErrorEvent {
  type: string;           // 'URL_EXPIRED' | 'NETWORK_ERROR' | 'LOAD_FAILED'
  message: string;
  errorCode: number;
  position: number;       // Global position when error occurred
}

export interface AVPlayerRemoteCommandEvent {
  command: string;        // 'play' | 'pause' | 'nextTrack' | 'previousTrack' | 'skipForward' | 'skipBackward' | 'changePlaybackPosition'
  param?: string;
}

// ── Track info for loadTracks ──

export interface AVPlayerTrackInfo {
  url: string;
  title: string;
  startOffset: number;    // Global start offset in seconds
  duration: number;       // Track duration in seconds
}

// ── Native module interface ──

interface AVPlayerModuleInterface {
  initialize(): Promise<void>;
  loadTracks(
    tracks: AVPlayerTrackInfo[],
    startTrackIndex: number,
    startPositionMs: number,
    autoPlay: boolean
  ): Promise<void>;
  play(): void;
  pause(): void;
  seekTo(globalPositionSec: number): void;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setMetadata(
    title: string,
    artist: string,
    artworkUrl: string | null,
    chapterTitle: string | null
  ): void;
  getCurrentState(): Promise<{
    isPlaying: boolean;
    position: number;
    duration: number;
    isBuffering: boolean;
  }>;
  cleanup(): Promise<void>;
}

// ── Module + EventEmitter ──

export const AVPlayerModule = requireNativeModule<AVPlayerModuleInterface>('AVPlayerModule');
export const AVPlayerEventEmitter = new EventEmitter(AVPlayerModule);
