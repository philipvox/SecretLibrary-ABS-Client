/**
 * src/features/player/utils/timeFormatters.ts
 *
 * Time formatting utilities for the player UI.
 */

/**
 * Format seconds as MM:SS or H:MM:SS (hours only if > 0)
 * Example: 65 -> "1:05", 3665 -> "1:01:05"
 */
export const formatTime = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Format time as "00:00:00" - always show hours:minutes:seconds
 * Example: 65 -> "00:01:05", 3665 -> "01:01:05"
 */
export const formatTimeHHMMSS = (seconds: number): string => {
  if (!seconds || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Format time as "5h 23m 10s" - verbose format for remaining time display
 * Example: 65 -> "1m 5s", 3665 -> "1h 1m 5s"
 */
export const formatTimeVerbose = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(' ');
};
