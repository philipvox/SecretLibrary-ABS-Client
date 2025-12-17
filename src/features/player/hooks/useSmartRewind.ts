/**
 * src/features/player/hooks/useSmartRewind.ts
 *
 * Smart Rewind Hook
 * Automatically rewinds playback when resuming based on pause duration.
 * Uses a logarithmic curve that mirrors how memory actually decays:
 * - Short pauses (< 3s): No rewind (echoic memory intact)
 * - Brief pauses (3-30s): Small rewind (3-10s)
 * - Medium pauses (30s-5min): Moderate rewind (10-20s)
 * - Long pauses (5min-1hr): Larger rewind (20-30s)
 * - Very long pauses (1hr+): Maximum rewind (30-60s, capped by user setting)
 *
 * Based on Ebbinghaus forgetting curve research:
 * - Short-term memory holds info for 15-30 seconds without rehearsal
 * - Memory decay is logarithmic - rapid at first, then levels off
 * - Echoic (auditory) memory lasts only 3-4 seconds
 */

import { useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerStore } from '../stores/playerStore';
import { calculateSmartRewindSeconds } from '../utils/smartRewindCalculator';

// =============================================================================
// CONSTANTS
// =============================================================================

const PAUSE_TIMESTAMP_KEY = 'smartRewindPauseTimestamp';
const PAUSE_BOOK_ID_KEY = 'smartRewindPauseBookId';
const PAUSE_POSITION_KEY = 'smartRewindPausePosition';

// Minimum pause duration before any rewind is applied (echoic memory threshold)
const MIN_PAUSE_FOR_REWIND_MS = 3000; // 3 seconds

// =============================================================================
// TYPES
// =============================================================================

interface SmartRewindState {
  pauseTimestamp: number | null;
  pauseBookId: string | null;
  pausePosition: number | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useSmartRewind() {
  // Track pause state in memory
  const stateRef = useRef<SmartRewindState>({
    pauseTimestamp: null,
    pauseBookId: null,
    pausePosition: null,
  });

  // Store selectors
  const smartRewindEnabled = usePlayerStore((s) => s.smartRewindEnabled);
  const maxRewindSeconds = usePlayerStore((s) => s.smartRewindMaxSeconds);
  const currentBook = usePlayerStore((s) => s.currentBook);
  const chapters = usePlayerStore((s) => s.chapters);

  /**
   * Calculate rewind amount based on pause duration using logarithmic curve.
   * Wrapper around the pure utility function.
   */
  const calculateRewindSeconds = useCallback(
    (pauseDurationMs: number): number => {
      return calculateSmartRewindSeconds(pauseDurationMs, maxRewindSeconds);
    },
    [maxRewindSeconds]
  );

  /**
   * Get chapter start time for current position to prevent rewinding past chapter boundary
   */
  const getChapterStartForPosition = useCallback(
    (position: number): number => {
      if (!chapters || chapters.length === 0) return 0;

      // Find the chapter that contains this position
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (chapters[i].start <= position) {
          return chapters[i].start;
        }
      }
      return 0;
    },
    [chapters]
  );

  /**
   * Record pause event - call when playback is paused
   */
  const onPause = useCallback(
    async (currentPosition: number) => {
      if (!smartRewindEnabled || !currentBook?.id) return;

      const now = Date.now();
      stateRef.current = {
        pauseTimestamp: now,
        pauseBookId: currentBook.id,
        pausePosition: currentPosition,
      };

      // Persist for app restart scenarios
      try {
        await Promise.all([
          AsyncStorage.setItem(PAUSE_TIMESTAMP_KEY, now.toString()),
          AsyncStorage.setItem(PAUSE_BOOK_ID_KEY, currentBook.id),
          AsyncStorage.setItem(PAUSE_POSITION_KEY, currentPosition.toString()),
        ]);
      } catch (err) {
        console.warn('[SmartRewind] Failed to persist pause state:', err);
      }
    },
    [smartRewindEnabled, currentBook?.id]
  );

  /**
   * Calculate rewind on resume - call when playback resumes
   * Returns the new position to seek to, or null if no rewind needed
   */
  const onResume = useCallback(
    async (currentPosition: number): Promise<number | null> => {
      if (!smartRewindEnabled || !currentBook?.id) {
        return null;
      }

      let pauseTimestamp = stateRef.current.pauseTimestamp;
      let pauseBookId = stateRef.current.pauseBookId;
      let pausePosition = stateRef.current.pausePosition;

      // If no in-memory state, try to restore from storage (app was killed)
      if (!pauseTimestamp) {
        try {
          const [storedTimestamp, storedBookId, storedPosition] = await Promise.all([
            AsyncStorage.getItem(PAUSE_TIMESTAMP_KEY),
            AsyncStorage.getItem(PAUSE_BOOK_ID_KEY),
            AsyncStorage.getItem(PAUSE_POSITION_KEY),
          ]);

          if (storedTimestamp && storedBookId === currentBook.id) {
            pauseTimestamp = parseInt(storedTimestamp, 10);
            pauseBookId = storedBookId;
            pausePosition = storedPosition ? parseFloat(storedPosition) : currentPosition;
          }
        } catch (err) {
          console.warn('[SmartRewind] Failed to restore pause state:', err);
        }
      }

      // Clear stored state
      stateRef.current = {
        pauseTimestamp: null,
        pauseBookId: null,
        pausePosition: null,
      };
      clearPersistedState();

      // Validate we have valid pause data for this book
      if (!pauseTimestamp || pauseBookId !== currentBook.id) {
        return null;
      }

      // Calculate pause duration
      const pauseDuration = Date.now() - pauseTimestamp;

      // Check minimum pause threshold
      if (pauseDuration < MIN_PAUSE_FOR_REWIND_MS) {
        return null;
      }

      // Calculate rewind amount
      const rewindSeconds = calculateRewindSeconds(pauseDuration);
      if (rewindSeconds <= 0) {
        return null;
      }

      // Use pause position if available, otherwise current position
      const basePosition = pausePosition ?? currentPosition;

      // Calculate new position, ensuring we don't go past chapter start or beginning
      const chapterStart = getChapterStartForPosition(basePosition);
      const newPosition = Math.max(chapterStart, basePosition - rewindSeconds);

      // Only rewind if it would actually change position meaningfully
      if (basePosition - newPosition < 0.5) {
        return null;
      }

      console.log(
        `[SmartRewind] Pause: ${Math.round(pauseDuration / 1000)}s → Rewind: ${rewindSeconds}s (${Math.round(basePosition)}s → ${Math.round(newPosition)}s)`
      );

      return newPosition;
    },
    [smartRewindEnabled, currentBook?.id, calculateRewindSeconds, getChapterStartForPosition]
  );

  /**
   * Get preview of rewind amount for UI feedback
   */
  const getRewindPreview = useCallback(
    (pauseDurationMs: number): number => {
      return calculateRewindSeconds(pauseDurationMs);
    },
    [calculateRewindSeconds]
  );

  /**
   * Clear persisted pause state
   */
  const clearPersistedState = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(PAUSE_TIMESTAMP_KEY),
        AsyncStorage.removeItem(PAUSE_BOOK_ID_KEY),
        AsyncStorage.removeItem(PAUSE_POSITION_KEY),
      ]);
    } catch {
      // Ignore cleanup errors
    }
  };

  /**
   * Clear pause state when book changes
   */
  useEffect(() => {
    // When book changes, clear any pending smart rewind state
    stateRef.current = {
      pauseTimestamp: null,
      pauseBookId: null,
      pausePosition: null,
    };
    clearPersistedState();
  }, [currentBook?.id]);

  return {
    onPause,
    onResume,
    getRewindPreview,
    isEnabled: smartRewindEnabled,
    maxSeconds: maxRewindSeconds,
  };
}

// Re-export utility function for convenience
export { calculateSmartRewindSeconds } from '../utils/smartRewindCalculator';
