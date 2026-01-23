/**
 * src/constants/audio.ts
 *
 * Audio-related constants shared across the app.
 */

/**
 * Supported audio file extensions for audiobook playback.
 * Used for filtering audio files in downloaded directories.
 */
export const AUDIO_EXTENSIONS = [
  '.m4b',
  '.m4a',
  '.mp3',
  '.mp4',
  '.opus',
  '.ogg',
  '.flac',
  '.aac',
] as const;

/**
 * Check if a filename has a supported audio extension
 */
export function isAudioFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return AUDIO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}
