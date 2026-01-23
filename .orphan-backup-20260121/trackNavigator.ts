/**
 * src/features/player/utils/trackNavigator.ts
 *
 * Pure functions for track navigation in multi-file audiobooks.
 * No side effects, fully testable.
 */

import { AudioTrackInfo } from './types';

export interface TrackPosition {
  trackIndex: number;
  positionInTrack: number;
}

/**
 * Find which track contains a given global position.
 * Pure function - no side effects.
 *
 * @param tracks - Array of audio tracks with startOffset and duration
 * @param globalPosition - Position in seconds from start of book
 * @returns Track index and position within that track, or null if tracks empty
 */
export function findTrackForPosition(
  tracks: AudioTrackInfo[],
  globalPosition: number
): TrackPosition | null {
  if (tracks.length === 0) return null;

  // Clamp to valid range
  const clampedPosition = Math.max(0, globalPosition);

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const trackEnd = track.startOffset + track.duration;

    if (clampedPosition >= track.startOffset && clampedPosition < trackEnd) {
      return {
        trackIndex: i,
        positionInTrack: clampedPosition - track.startOffset,
      };
    }
  }

  // Position beyond all tracks - return last track at end
  const lastTrack = tracks[tracks.length - 1];
  return {
    trackIndex: tracks.length - 1,
    positionInTrack: lastTrack.duration,
  };
}

/**
 * Calculate global position from track index and position within track.
 *
 * @param tracks - Array of audio tracks
 * @param trackIndex - Index of the track
 * @param positionInTrack - Position in seconds within the track
 * @returns Global position in seconds from start of book
 */
export function calculateGlobalPosition(
  tracks: AudioTrackInfo[],
  trackIndex: number,
  positionInTrack: number
): number {
  if (trackIndex < 0 || trackIndex >= tracks.length) {
    return 0;
  }

  return tracks[trackIndex].startOffset + positionInTrack;
}

/**
 * Check if position is near the end of a track (within threshold).
 * Used to decide whether to bump to next track.
 *
 * @param tracks - Array of audio tracks
 * @param trackIndex - Current track index
 * @param positionInTrack - Position within the track
 * @param thresholdSeconds - How close to end counts as "near" (default 0.5s)
 */
export function isNearTrackEnd(
  tracks: AudioTrackInfo[],
  trackIndex: number,
  positionInTrack: number,
  thresholdSeconds: number = 0.5
): boolean {
  if (trackIndex < 0 || trackIndex >= tracks.length) {
    return false;
  }

  const track = tracks[trackIndex];
  return positionInTrack >= track.duration - thresholdSeconds;
}

/**
 * Get the next track index, or null if at the end.
 */
export function getNextTrackIndex(
  tracks: AudioTrackInfo[],
  currentIndex: number
): number | null {
  if (currentIndex < tracks.length - 1) {
    return currentIndex + 1;
  }
  return null;
}

/**
 * Get the previous track index, or null if at the start.
 */
export function getPreviousTrackIndex(currentIndex: number): number | null {
  if (currentIndex > 0) {
    return currentIndex - 1;
  }
  return null;
}

/**
 * Calculate total duration from all tracks.
 */
export function calculateTotalDuration(tracks: AudioTrackInfo[]): number {
  if (tracks.length === 0) return 0;

  const lastTrack = tracks[tracks.length - 1];
  return lastTrack.startOffset + lastTrack.duration;
}

/**
 * Get track info at a specific index, or null if invalid.
 */
export function getTrackAtIndex(
  tracks: AudioTrackInfo[],
  index: number
): AudioTrackInfo | null {
  if (index < 0 || index >= tracks.length) {
    return null;
  }
  return tracks[index];
}
