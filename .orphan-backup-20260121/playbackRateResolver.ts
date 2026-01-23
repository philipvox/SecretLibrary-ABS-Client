/**
 * src/features/player/utils/playbackRateResolver.ts
 *
 * Pure functions for playback rate resolution.
 * No side effects, fully testable.
 */

export const MIN_PLAYBACK_RATE = 0.5;
export const MAX_PLAYBACK_RATE = 3.0;
export const DEFAULT_PLAYBACK_RATE = 1.0;

// Standard rate increments
export const RATE_INCREMENTS = [
  0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0,
];

/**
 * Get playback rate for a specific book.
 * Falls back to global rate, then default.
 *
 * @param bookId - The book ID to look up
 * @param bookSpeedMap - Map of book IDs to their saved rates
 * @param globalRate - Global default rate
 * @returns Playback rate for the book
 */
export function getPlaybackRateForBook(
  bookId: string | null,
  bookSpeedMap: Record<string, number>,
  globalRate: number
): number {
  if (bookId && bookSpeedMap[bookId] !== undefined) {
    return clampPlaybackRate(bookSpeedMap[bookId]);
  }

  return clampPlaybackRate(globalRate);
}

/**
 * Clamp playback rate to valid bounds.
 *
 * @param rate - Rate to clamp
 * @returns Clamped rate (0.5 to 3.0)
 */
export function clampPlaybackRate(rate: number): number {
  return Math.max(MIN_PLAYBACK_RATE, Math.min(MAX_PLAYBACK_RATE, rate));
}

/**
 * Get next rate in standard increments.
 * Wraps around from max to min.
 *
 * @param currentRate - Current playback rate
 * @returns Next standard rate
 */
export function getNextPlaybackRate(currentRate: number): number {
  const currentIndex = RATE_INCREMENTS.findIndex((r) => r >= currentRate);

  if (currentIndex === -1 || currentIndex === RATE_INCREMENTS.length - 1) {
    return RATE_INCREMENTS[0]; // Wrap around
  }

  return RATE_INCREMENTS[currentIndex + 1];
}

/**
 * Get previous rate in standard increments.
 * Wraps around from min to max.
 *
 * @param currentRate - Current playback rate
 * @returns Previous standard rate
 */
export function getPreviousPlaybackRate(currentRate: number): number {
  const currentIndex = RATE_INCREMENTS.findIndex((r) => r >= currentRate);

  if (currentIndex === -1 || currentIndex === 0) {
    return RATE_INCREMENTS[RATE_INCREMENTS.length - 1]; // Wrap around
  }

  return RATE_INCREMENTS[currentIndex - 1];
}

/**
 * Format playback rate for display.
 *
 * @param rate - Playback rate
 * @returns Formatted string (e.g., "1.5x")
 */
export function formatPlaybackRate(rate: number): string {
  // Remove trailing zeros but keep at least one decimal if needed
  const formatted = rate.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted}x`;
}

/**
 * Check if a rate is a standard increment.
 *
 * @param rate - Rate to check
 * @returns True if rate matches a standard increment
 */
export function isStandardRate(rate: number): boolean {
  return RATE_INCREMENTS.includes(rate);
}

/**
 * Find the nearest standard rate to a given rate.
 *
 * @param rate - Rate to find nearest standard for
 * @returns Nearest standard rate
 */
export function nearestStandardRate(rate: number): number {
  let nearest = RATE_INCREMENTS[0];
  let minDiff = Math.abs(rate - nearest);

  for (const standardRate of RATE_INCREMENTS) {
    const diff = Math.abs(rate - standardRate);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = standardRate;
    }
  }

  return nearest;
}

/**
 * Adjust rate by a delta, clamping to valid bounds.
 *
 * @param currentRate - Current rate
 * @param delta - Amount to adjust (positive = faster, negative = slower)
 * @returns New clamped rate
 */
export function adjustPlaybackRate(
  currentRate: number,
  delta: number
): number {
  return clampPlaybackRate(currentRate + delta);
}
