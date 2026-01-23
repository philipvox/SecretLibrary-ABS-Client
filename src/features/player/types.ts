/**
 * src/features/player/types.ts
 *
 * Type definitions for the player feature.
 * Extracted to avoid circular dependencies.
 */

/**
 * Chapter information for audiobook playback
 */
export interface Chapter {
  id: number;
  start: number;
  end: number;
  title: string;
}
