/**
 * src/features/player/stores/playerSelectors.ts
 *
 * Player store selectors for derived state.
 * Refactored to read from source stores (single source of truth).
 *
 * ARCHITECTURE:
 * - Seeking state → seekingStore (source of truth)
 * - Sleep timer state → sleepTimerStore (source of truth)
 * - Speed state → speedStore (source of truth)
 * - Bookmarks → bookmarksStore (source of truth)
 * - Settings → playerSettingsStore (source of truth)
 * - Core playback state → playerStore (position, duration, isPlaying, etc.)
 *
 * This eliminates bidirectional sync and race conditions.
 */

import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from './playerStore';
import { useSeekingStore } from './seekingStore';
import { findChapterIndex } from '../utils/bookLoadingHelpers';

// =============================================================================
// POSITION SELECTORS
// =============================================================================

/**
 * Returns the position to display in UI.
 * Uses seekPosition during seeking (from seekingStore), otherwise uses position (from playerStore).
 */
export const useDisplayPosition = () => {
  const isSeeking = useSeekingStore((s) => s.isSeeking);
  const seekPosition = useSeekingStore((s) => s.seekPosition);
  const position = usePlayerStore((s) => s.position);
  return isSeeking ? seekPosition : position;
};

/**
 * Returns the effective position for calculations.
 * Same as useDisplayPosition but named for clarity in computation contexts.
 */
export const useEffectivePosition = useDisplayPosition;

// =============================================================================
// SEEK SELECTORS (from seekingStore - source of truth)
// =============================================================================

// Simple seeking hooks (useIsSeeking, useSeekDelta, etc.) are in seekingStore.ts
// Import from '@/features/player/stores' which routes through playerHooks.ts

// =============================================================================
// CHAPTER SELECTORS
// =============================================================================

/**
 * Returns the current chapter index based on display position.
 */
export const useCurrentChapterIndex = () => {
  const isSeeking = useSeekingStore((s) => s.isSeeking);
  const seekPosition = useSeekingStore((s) => s.seekPosition);
  const position = usePlayerStore((s) => s.position);
  const chapters = usePlayerStore((s) => s.chapters);

  const effectivePosition = isSeeking ? seekPosition : position;
  return findChapterIndex(chapters, effectivePosition);
};

/**
 * Returns the current chapter based on display position.
 */
export const useCurrentChapter = () => {
  const isSeeking = useSeekingStore((s) => s.isSeeking);
  const seekPosition = useSeekingStore((s) => s.seekPosition);
  const position = usePlayerStore((s) => s.position);
  const chapters = usePlayerStore((s) => s.chapters);

  const effectivePosition = isSeeking ? seekPosition : position;
  const index = findChapterIndex(chapters, effectivePosition);
  return chapters[index] || null;
};

/**
 * Returns the progress within the current chapter (0-1).
 */
export const useChapterProgress = () => {
  const isSeeking = useSeekingStore((s) => s.isSeeking);
  const seekPosition = useSeekingStore((s) => s.seekPosition);
  const position = usePlayerStore((s) => s.position);
  const chapters = usePlayerStore((s) => s.chapters);

  const effectivePosition = isSeeking ? seekPosition : position;
  const index = findChapterIndex(chapters, effectivePosition);
  const chapter = chapters[index];

  if (!chapter) return 0;

  const chapterDuration = chapter.end - chapter.start;
  if (chapterDuration <= 0) return 0;

  return Math.max(0, Math.min(1, (effectivePosition - chapter.start) / chapterDuration));
};

// =============================================================================
// PROGRESS SELECTORS
// =============================================================================

/**
 * Returns the overall book progress (0-1).
 */
export const useBookProgress = () => {
  const isSeeking = useSeekingStore((s) => s.isSeeking);
  const seekPosition = useSeekingStore((s) => s.seekPosition);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);

  const effectivePosition = isSeeking ? seekPosition : position;
  return duration > 0 ? effectivePosition / duration : 0;
};

/**
 * Returns the percent complete (0-100).
 */
export const usePercentComplete = () => {
  const isSeeking = useSeekingStore((s) => s.isSeeking);
  const seekPosition = useSeekingStore((s) => s.seekPosition);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);

  const effectivePosition = isSeeking ? seekPosition : position;
  return duration > 0 ? (effectivePosition / duration) * 100 : 0;
};

/**
 * Returns the time remaining in seconds.
 */
export const useTimeRemaining = () => {
  const isSeeking = useSeekingStore((s) => s.isSeeking);
  const seekPosition = useSeekingStore((s) => s.seekPosition);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);

  const effectivePosition = isSeeking ? seekPosition : position;
  return Math.max(0, duration - effectivePosition);
};

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

// Simple sleep timer hooks are in sleepTimerStore.ts
// Simple speed hooks are in speedStore.ts
// Import from '@/features/player/stores' which routes through playerHooks.ts

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

/**
 * Returns position and duration for progress display.
 */
export const usePositionState = () =>
  usePlayerStore(
    useShallow((s) => ({
      position: s.position,
      duration: s.duration,
    }))
  );

/**
 * Returns chapters for the current book.
 */
export const useChapters = () =>
  usePlayerStore((s) => s.chapters);
