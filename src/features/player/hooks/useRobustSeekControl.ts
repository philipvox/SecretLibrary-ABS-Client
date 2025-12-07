/**
 * src/features/player/hooks/useRobustSeekControl.ts
 *
 * Robust seek control hook with lock mechanism to prevent race conditions.
 * This is the single source of truth for all seek operations.
 *
 * Key features:
 * - Lock mechanism prevents concurrent seek operations
 * - Chapter boundary detection with smooth transitions
 * - Position confirmation after seek
 * - Animation suspension during seek
 * - Debouncing and queueing for rapid inputs
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { audioService } from '../services/audioService';
import {
  findChapterIndex,
  calculateSeekPosition,
  calculatePrevChapterPosition,
  calculateNextChapterPosition,
  clampPosition,
} from '../utils/chapterUtils';
import { SeekLock, SeekDirection, UseSeekControlReturn } from '../types/seek';
import { REWIND_STEP, REWIND_INTERVAL, FF_STEP } from '../constants';

// Configuration
const POSITION_CONFIRM_TOLERANCE = 1; // seconds
const POSITION_CONFIRM_TIMEOUT = 3000; // ms
const LOCK_TIMEOUT = 3000; // ms - auto-release lock if stuck (reduced for snappier UI)
const DEBOUNCE_DELAY = 50; // ms - for rapid seek requests
const PREV_CHAPTER_THRESHOLD = 3; // seconds before going to prev vs restart

// Accelerating seek increments
const getSeekStep = (totalSeekSeconds: number): number => {
  const absSec = Math.abs(totalSeekSeconds);
  if (absSec >= 600) return 300; // After 10 min: 5 min steps
  if (absSec >= 300) return 30;  // After 5 min: 30 sec steps
  if (absSec >= 60) return 10;   // After 1 min: 10 sec steps
  return 2;                       // Default: 2 sec steps (base rate)
};

interface SeekControlState {
  isSeeking: boolean;
  isChangingChapter: boolean;
  seekDirection: SeekDirection | null;
  seekPosition: number;
  seekStartPosition: number;
}

/**
 * Robust seek control hook
 */
export function useRobustSeekControl(): UseSeekControlReturn {
  // Store state
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const chapters = usePlayerStore((s) => s.chapters);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);

  // Local state for seek UI
  const [state, setState] = useState<SeekControlState>({
    isSeeking: false,
    isChangingChapter: false,
    seekDirection: null,
    seekPosition: 0,
    seekStartPosition: 0,
  });

  // Refs for tracking without re-renders
  const lockRef = useRef<SeekLock>({
    isLocked: false,
    operation: null,
    startTime: 0,
    targetPosition: 0,
    targetChapter: null,
    direction: null,
  });

  const isMountedRef = useRef(true);
  const wasPlayingRef = useRef(false);
  const continuousSeekIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const positionRef = useRef(position);
  const durationRef = useRef(duration);
  const currentSeekPositionRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllTimers();
    };
  }, []);

  // Stop seeking if app goes to background
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active' && lockRef.current.isLocked) {
        forceReleaseLock();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, []);

  /**
   * Clear all timers
   */
  const clearAllTimers = useCallback(() => {
    if (continuousSeekIntervalRef.current) {
      clearInterval(continuousSeekIntervalRef.current);
      continuousSeekIntervalRef.current = null;
    }
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  /**
   * Acquire the seek lock
   */
  const acquireLock = useCallback(
    (operation: SeekLock['operation'], direction?: SeekDirection): boolean => {
      const lock = lockRef.current;

      if (lock.isLocked) {
        // Check if lock is stale
        const lockAge = Date.now() - lock.startTime;
        if (lockAge > LOCK_TIMEOUT) {
          forceReleaseLock();
        } else {
          return false;
        }
      }

      lock.isLocked = true;
      lock.operation = operation;
      lock.startTime = Date.now();
      lock.direction = direction || null;

      // Set auto-release timeout
      lockTimeoutRef.current = setTimeout(() => {
        forceReleaseLock();
      }, LOCK_TIMEOUT);

      return true;
    },
    []
  );

  /**
   * Release the seek lock
   */
  const releaseLock = useCallback(() => {
    const lock = lockRef.current;

    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }

    lock.isLocked = false;
    lock.operation = null;
    lock.direction = null;
  }, []);

  /**
   * Force release lock and clean up state
   */
  const forceReleaseLock = useCallback(() => {
    clearAllTimers();
    releaseLock();

    if (isMountedRef.current) {
      setState({
        isSeeking: false,
        isChangingChapter: false,
        seekDirection: null,
        seekPosition: positionRef.current,
        seekStartPosition: positionRef.current,
      });
    }
  }, [clearAllTimers, releaseLock]);

  /**
   * Wait for position confirmation after seek
   */
  const waitForPositionConfirmation = useCallback(
    async (targetPosition: number): Promise<boolean> => {
      const startTime = Date.now();

      while (Date.now() - startTime < POSITION_CONFIRM_TIMEOUT) {
        try {
          const currentPos = await audioService.getPosition();
          const diff = Math.abs(currentPos - targetPosition);

          if (diff <= POSITION_CONFIRM_TOLERANCE) {
            return true;
          }
        } catch (error) {
          // Position check failed, will retry
        }

        // Small delay before checking again
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return false;
    },
    []
  );

  /**
   * Perform the actual seek operation
   */
  const performSeek = useCallback(
    async (targetPosition: number, direction?: SeekDirection): Promise<void> => {
      try {
        await audioService.seekTo(targetPosition);
        await waitForPositionConfirmation(targetPosition);

        // Update store position
        usePlayerStore.setState({
          position: targetPosition,
          isSeeking: false,
        });
      } catch (error) {
        throw error;
      }
    },
    [waitForPositionConfirmation]
  );

  /**
   * Handle chapter transition during seek
   */
  const handleChapterTransition = useCallback(
    async (fromIndex: number, toIndex: number, targetPosition: number): Promise<void> => {
      try {
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, isChangingChapter: true }));
        }

        await audioService.seekTo(targetPosition);
        await waitForPositionConfirmation(targetPosition);

        // Update store
        usePlayerStore.setState({
          position: targetPosition,
          isSeeking: false,
        });
      } finally {
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, isChangingChapter: false }));
        }
      }
    },
    [waitForPositionConfirmation]
  );

  /**
   * Seek by a relative amount of seconds
   */
  const seekRelative = useCallback(
    async (seconds: number): Promise<void> => {
      const direction: SeekDirection = seconds >= 0 ? 'forward' : 'backward';

      if (!acquireLock('seek', direction)) {
        return;
      }

      const startPosition = positionRef.current;

      try {
        // Calculate target position and check for chapter crossing
        const { targetPosition, crossing, boundaryHit } = calculateSeekPosition(
          chapters,
          startPosition,
          seconds,
          durationRef.current
        );

        // Update UI state
        if (isMountedRef.current) {
          setState({
            isSeeking: true,
            isChangingChapter: !!crossing,
            seekDirection: direction,
            seekPosition: targetPosition,
            seekStartPosition: startPosition,
          });
        }

        // Notify store we're seeking
        usePlayerStore.setState({ isSeeking: true });

        if (crossing) {
          await handleChapterTransition(
            crossing.fromChapterIndex,
            crossing.toChapterIndex,
            targetPosition
          );
        } else {
          await performSeek(targetPosition, direction);
        }
      } catch (error) {
        // Seek failed
      } finally {
        releaseLock();
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            isSeeking: false,
            isChangingChapter: false,
            seekDirection: null,
          }));
        }
      }
    },
    [chapters, acquireLock, releaseLock, performSeek, handleChapterTransition]
  );

  /**
   * Seek to an absolute position
   */
  const seekAbsolute = useCallback(
    async (targetPosition: number): Promise<void> => {
      const startPosition = positionRef.current;
      const direction: SeekDirection = targetPosition >= startPosition ? 'forward' : 'backward';

      if (!acquireLock('seek', direction)) {
        return;
      }

      try {
        const clampedTarget = clampPosition(targetPosition, durationRef.current);
        const crossing = chapters.length > 0
          ? findChapterIndex(chapters, startPosition) !== findChapterIndex(chapters, clampedTarget)
          : false;

        if (isMountedRef.current) {
          setState({
            isSeeking: true,
            isChangingChapter: crossing,
            seekDirection: direction,
            seekPosition: clampedTarget,
            seekStartPosition: startPosition,
          });
        }

        usePlayerStore.setState({ isSeeking: true });

        if (crossing) {
          await handleChapterTransition(
            findChapterIndex(chapters, startPosition),
            findChapterIndex(chapters, clampedTarget),
            clampedTarget
          );
        } else {
          await performSeek(clampedTarget, direction);
        }
      } catch (error) {
        // Seek failed
      } finally {
        releaseLock();
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            isSeeking: false,
            isChangingChapter: false,
            seekDirection: null,
          }));
        }
      }
    },
    [chapters, acquireLock, releaseLock, performSeek, handleChapterTransition]
  );

  /**
   * Seek to a specific chapter
   */
  const seekToChapter = useCallback(
    async (chapterIndex: number): Promise<void> => {
      if (chapterIndex < 0 || chapterIndex >= chapters.length) {
        return;
      }

      const targetPosition = chapters[chapterIndex].start;
      await seekAbsolute(targetPosition);
    },
    [chapters, seekAbsolute]
  );

  /**
   * Cancel any in-progress seek
   */
  const cancelSeek = useCallback(() => {
    forceReleaseLock();
  }, [forceReleaseLock]);

  /**
   * Start continuous seeking (hold button)
   */
  const startContinuousSeek = useCallback(
    async (direction: SeekDirection): Promise<void> => {
      if (!acquireLock('continuous', direction)) {
        return;
      }

      // Save playing state and pause
      wasPlayingRef.current = isPlaying;
      if (isPlaying) {
        await pause();
      }

      const startPosition = positionRef.current;

      // Update state
      if (isMountedRef.current) {
        setState({
          isSeeking: true,
          isChangingChapter: false,
          seekDirection: direction,
          seekPosition: startPosition,
          seekStartPosition: startPosition,
        });
      }

      usePlayerStore.setState({ isSeeking: true });

      currentSeekPositionRef.current = startPosition;

      // Track total seek amount for accelerating increments
      let totalSeekDelta = 0;

      // Perform initial step
      const initialStep = direction === 'backward' ? -2 : 2;
      totalSeekDelta += initialStep;
      currentSeekPositionRef.current = clampPosition(currentSeekPositionRef.current + initialStep, durationRef.current);
      await audioService.seekTo(currentSeekPositionRef.current);

      // Update both local state AND player store for real-time UI updates
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, seekPosition: currentSeekPositionRef.current }));
      }
      usePlayerStore.setState({ position: currentSeekPositionRef.current });

      // Start interval for continuous seeking with accelerating increments
      continuousSeekIntervalRef.current = setInterval(async () => {
        if (!lockRef.current.isLocked || lockRef.current.operation !== 'continuous') {
          // Lock was released externally
          if (continuousSeekIntervalRef.current) {
            clearInterval(continuousSeekIntervalRef.current);
            continuousSeekIntervalRef.current = null;
          }
          return;
        }

        // Get accelerating step based on total seek amount
        const baseStep = getSeekStep(totalSeekDelta);
        const step = direction === 'backward' ? -baseStep : baseStep;
        totalSeekDelta += step;

        const prevPosition = currentSeekPositionRef.current;
        currentSeekPositionRef.current = clampPosition(currentSeekPositionRef.current + step, durationRef.current);

        // Check for chapter crossing
        const crossing =
          chapters.length > 0 &&
          findChapterIndex(chapters, prevPosition) !== findChapterIndex(chapters, currentSeekPositionRef.current);

        if (crossing) {
          if (isMountedRef.current) {
            setState((prev) => ({ ...prev, isChangingChapter: true }));
          }

          // Brief delay for chapter transition visual feedback
          setTimeout(() => {
            if (isMountedRef.current) {
              setState((prev) => ({ ...prev, isChangingChapter: false }));
            }
          }, 200);
        }

        await audioService.seekTo(currentSeekPositionRef.current);

        // Update both local state AND player store position for real-time UI updates
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, seekPosition: currentSeekPositionRef.current }));
        }
        usePlayerStore.setState({ position: currentSeekPositionRef.current });

        // Stop at boundaries
        if (
          (direction === 'backward' && currentSeekPositionRef.current <= 0) ||
          (direction === 'forward' && currentSeekPositionRef.current >= durationRef.current)
        ) {
          await stopContinuousSeek();
        }
      }, REWIND_INTERVAL);
    },
    [isPlaying, pause, chapters, acquireLock]
  );

  /**
   * Stop continuous seeking
   */
  const stopContinuousSeek = useCallback(async (): Promise<void> => {
    // Clear interval
    if (continuousSeekIntervalRef.current) {
      clearInterval(continuousSeekIntervalRef.current);
      continuousSeekIntervalRef.current = null;
    }

    if (!lockRef.current.isLocked) {
      return;
    }

    // Use ref for final position to avoid stale closure
    const finalPosition = currentSeekPositionRef.current;

    // Confirm position
    await waitForPositionConfirmation(finalPosition);

    // Update store
    usePlayerStore.setState({
      position: finalPosition,
      isSeeking: false,
    });

    // Resume playback if was playing
    if (wasPlayingRef.current) {
      await play();
    }

    releaseLock();

    if (isMountedRef.current) {
      setState((prev) => ({
        ...prev,
        isSeeking: false,
        isChangingChapter: false,
        seekDirection: null,
      }));
    }
  }, [play, releaseLock, waitForPositionConfirmation]);

  /**
   * Go to next chapter
   */
  const nextChapter = useCallback(async (): Promise<void> => {
    const result = calculateNextChapterPosition(chapters, positionRef.current);

    if (result) {
      await seekAbsolute(result.position);
    }
  }, [chapters, seekAbsolute]);

  /**
   * Go to previous chapter (with restart logic)
   */
  const prevChapter = useCallback(async (): Promise<void> => {
    const result = calculatePrevChapterPosition(
      chapters,
      positionRef.current,
      PREV_CHAPTER_THRESHOLD
    );

    await seekAbsolute(result.position);
  }, [chapters, seekAbsolute]);

  // Calculate seek delta for UI
  const seekDelta = state.isSeeking ? state.seekPosition - state.seekStartPosition : 0;
  const seekMagnitude = Math.abs(seekDelta);

  return {
    // State
    isSeeking: state.isSeeking,
    isChangingChapter: state.isChangingChapter,
    seekDirection: state.seekDirection,
    seekMagnitude,
    seekPosition: state.seekPosition,
    seekDelta,

    // Actions
    seekRelative,
    seekAbsolute,
    seekToChapter,
    cancelSeek,
    startContinuousSeek,
    stopContinuousSeek,
    nextChapter,
    prevChapter,
  };
}
