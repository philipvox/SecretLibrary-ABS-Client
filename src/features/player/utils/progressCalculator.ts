/**
 * src/features/player/utils/progressCalculator.ts
 *
 * Pure functions for progress calculations.
 * No side effects, fully testable.
 */

/**
 * Calculate progress percentage (0.0 to 1.0).
 *
 * @param position - Current position in seconds
 * @param duration - Total duration in seconds
 * @returns Progress as decimal (0.0 to 1.0)
 */
export function calculateProgress(position: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(1, Math.max(0, position / duration));
}

/**
 * Check if book is complete (>= threshold progress).
 *
 * @param position - Current position in seconds
 * @param duration - Total duration in seconds
 * @param threshold - Completion threshold (default 0.95 = 95%)
 */
export function isBookComplete(
  position: number,
  duration: number,
  threshold: number = 0.95
): boolean {
  return calculateProgress(position, duration) >= threshold;
}

/**
 * Format seconds as HH:MM:SS or MM:SS.
 *
 * @param seconds - Time in seconds
 * @returns Formatted string
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format remaining time with leading minus sign.
 *
 * @param position - Current position in seconds
 * @param duration - Total duration in seconds
 * @returns Formatted remaining time string (e.g., "-1:23:45")
 */
export function formatRemaining(position: number, duration: number): string {
  const remaining = Math.max(0, duration - position);
  return `-${formatDuration(remaining)}`;
}

/**
 * Clamp position within valid bounds.
 *
 * @param position - Position to clamp
 * @param duration - Maximum valid position
 * @returns Clamped position (0 to duration)
 */
export function clampPosition(position: number, duration: number): number {
  return Math.max(0, Math.min(position, duration));
}

/**
 * Validate position data for sync operations.
 * Returns error message if invalid, null if valid.
 * Use this for data integrity checks where you want to REJECT bad data (not clamp it).
 *
 * @param position - Position to validate
 * @param duration - Expected duration (0 if unknown)
 * @param tolerance - How far past duration is allowed (default 60s for buffering)
 * @returns Error message if invalid, null if valid
 */
export function validatePositionForSync(
  position: number,
  duration: number,
  tolerance: number = 60
): string | null {
  if (position < 0) {
    return `Negative position: ${position}`;
  }
  if (duration > 0 && position > duration + tolerance) {
    return `Position ${position} exceeds duration ${duration} by more than ${tolerance}s`;
  }
  return null;
}

/**
 * Calculate position after skip (forward or backward).
 *
 * @param currentPosition - Current position in seconds
 * @param skipAmount - Seconds to skip (positive = forward, negative = backward)
 * @param duration - Total duration in seconds
 * @returns New clamped position
 */
export function calculateSkipPosition(
  currentPosition: number,
  skipAmount: number,
  duration: number
): number {
  return clampPosition(currentPosition + skipAmount, duration);
}

/**
 * Calculate progress percentage for display (0-100).
 *
 * @param position - Current position in seconds
 * @param duration - Total duration in seconds
 * @returns Progress as percentage (0-100)
 */
export function calculateProgressPercent(
  position: number,
  duration: number
): number {
  return Math.round(calculateProgress(position, duration) * 100);
}

/**
 * Calculate estimated time remaining at a given playback rate.
 *
 * @param position - Current position in seconds
 * @param duration - Total duration in seconds
 * @param playbackRate - Current playback rate (1.0 = normal)
 * @returns Estimated remaining time in seconds
 */
export function calculateTimeRemaining(
  position: number,
  duration: number,
  playbackRate: number = 1.0
): number {
  const remaining = Math.max(0, duration - position);
  return remaining / Math.max(0.1, playbackRate);
}

/**
 * Format time remaining with rate-adjusted estimate.
 *
 * @param position - Current position in seconds
 * @param duration - Total duration in seconds
 * @param playbackRate - Current playback rate
 * @returns Formatted string (e.g., "-1:23:45 at 1.5x")
 */
export function formatTimeRemainingWithRate(
  position: number,
  duration: number,
  playbackRate: number = 1.0
): string {
  const adjustedRemaining = calculateTimeRemaining(position, duration, playbackRate);
  return formatDuration(adjustedRemaining);
}
