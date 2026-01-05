/**
 * src/features/player/stores/playerSelectors.ts
 *
 * Player store selectors for derived state.
 * Extracted from playerStore.ts for modularity (Phase 8 refactor).
 *
 * These selectors compute derived values from player state, such as:
 * - Display position (uses seekPosition during seeking)
 * - Chapter progress
 * - Book progress
 * - Seek state
 */

import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from './playerStore';
import { findChapterIndex } from '../utils/bookLoadingHelpers';

// =============================================================================
// POSITION SELECTORS
// =============================================================================

/**
 * Returns the position to display in UI.
 * Uses seekPosition during seeking, otherwise uses position.
 */
export const useDisplayPosition = () =>
  usePlayerStore((s) => s.isSeeking ? s.seekPosition : s.position);

/**
 * Returns the effective position for calculations.
 * Same as useDisplayPosition but named for clarity in computation contexts.
 */
export const useEffectivePosition = () =>
  usePlayerStore((s) => s.isSeeking ? s.seekPosition : s.position);

// =============================================================================
// SEEK SELECTORS
// =============================================================================

/**
 * Returns the seek delta (difference from start position during seek).
 * Returns 0 when not seeking.
 */
export const useSeekDelta = () =>
  usePlayerStore((s) => s.isSeeking ? s.seekPosition - s.seekStartPosition : 0);

/**
 * Returns whether the user is currently seeking (for UI state).
 */
export const useIsSeeking = () =>
  usePlayerStore((s) => s.isSeeking);

/**
 * Returns the seek direction if seeking, null otherwise.
 */
export const useSeekDirection = () =>
  usePlayerStore((s) => s.seekDirection);

// =============================================================================
// CHAPTER SELECTORS
// =============================================================================

/**
 * Returns the current chapter index based on display position.
 */
export const useCurrentChapterIndex = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    return findChapterIndex(s.chapters, position);
  });

/**
 * Returns the current chapter based on display position.
 */
export const useCurrentChapter = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    const index = findChapterIndex(s.chapters, position);
    return s.chapters[index] || null;
  });

/**
 * Returns the progress within the current chapter (0-1).
 */
export const useChapterProgress = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    const index = findChapterIndex(s.chapters, position);
    const chapter = s.chapters[index];

    if (!chapter) return 0;

    const chapterDuration = chapter.end - chapter.start;
    if (chapterDuration <= 0) return 0;

    return Math.max(0, Math.min(1, (position - chapter.start) / chapterDuration));
  });

// =============================================================================
// PROGRESS SELECTORS
// =============================================================================

/**
 * Returns the overall book progress (0-1).
 */
export const useBookProgress = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    return s.duration > 0 ? position / s.duration : 0;
  });

/**
 * Returns the percent complete (0-100).
 */
export const usePercentComplete = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    return s.duration > 0 ? (position / s.duration) * 100 : 0;
  });

/**
 * Returns the time remaining in seconds.
 */
export const useTimeRemaining = () =>
  usePlayerStore((s) => {
    const position = s.isSeeking ? s.seekPosition : s.position;
    return Math.max(0, s.duration - position);
  });

// =============================================================================
// BOOK SELECTORS
// =============================================================================

/**
 * Returns true if viewing a different book than what's playing.
 */
export const useIsViewingDifferentBook = () =>
  usePlayerStore((s) => {
    if (!s.viewingBook || !s.currentBook) return false;
    return s.viewingBook.id !== s.currentBook.id;
  });

/**
 * Returns the viewing book (shown in PlayerScreen).
 */
export const useViewingBook = () =>
  usePlayerStore((s) => s.viewingBook);

/**
 * Returns the playing book (audio loaded).
 */
export const usePlayingBook = () =>
  usePlayerStore((s) => s.currentBook);

// =============================================================================
// SLEEP TIMER SELECTORS
// =============================================================================

/**
 * Returns whether shake detection is currently active.
 */
export const useIsShakeDetectionActive = () =>
  usePlayerStore((s) => s.isShakeDetectionActive);

/**
 * Returns the sleep timer state with shake detection info.
 * Uses useShallow to prevent unnecessary re-renders from object reference changes.
 */
export const useSleepTimerState = () =>
  usePlayerStore(
    useShallow((s) => ({
      sleepTimer: s.sleepTimer,
      isShakeDetectionActive: s.isShakeDetectionActive,
      shakeToExtendEnabled: s.shakeToExtendEnabled,
    }))
  );

// =============================================================================
// PLAYBACK STATE SELECTORS
// =============================================================================

/**
 * Returns core playback state for UI display.
 */
export const usePlaybackState = () =>
  usePlayerStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      isBuffering: s.isBuffering,
      duration: s.duration,
    }))
  );

/**
 * Returns player visibility state.
 */
export const usePlayerVisibility = () =>
  usePlayerStore((s) => s.isPlayerVisible);

/**
 * Returns the current book ID if a book is loaded.
 */
export const useCurrentBookId = () =>
  usePlayerStore((s) => s.currentBook?.id ?? null);
