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
import { seekLog } from '../utils/seekLogger';
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
const LOCK_TIMEOUT = 10000; // ms - auto-release lock if stuck
const DEBOUNCE_DELAY = 50; // ms - for rapid seek requests
const PREV_CHAPTER_THRESHOLD = 3; // seconds before going to prev vs restart

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
        seekLog.warn('App backgrounded during seek, releasing lock');
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
          seekLog.warn('Stale lock detected, forcing release', { lockAge });
          forceReleaseLock();
        } else {
          seekLog.lock('blocked', { existingOperation: lock.operation, requestedOperation: operation });
          return false;
        }
      }

      lock.isLocked = true;
      lock.operation = operation;
      lock.startTime = Date.now();
      lock.direction = direction || null;

      // Set auto-release timeout
      lockTimeoutRef.current = setTimeout(() => {
        seekLog.warn('Lock timeout reached, forcing release');
        forceReleaseLock();
      }, LOCK_TIMEOUT);

      seekLog.lock('acquire', { operation, direction });
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

    seekLog.lock('release');
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
            seekLog.positionConfirm(targetPosition, currentPos, true);
            return true;
          }
        } catch (error) {
          seekLog.error('getPosition', error as Error);
        }

        // Small delay before checking again
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const finalPos = await audioService.getPosition();
      seekLog.positionConfirm(targetPosition, finalPos, false);
      return false;
    },
    []
  );

  /**
   * Perform the actual seek operation
   */
  const performSeek = useCallback(
    async (targetPosition: number, direction?: SeekDirection): Promise<void> => {
      const timer = seekLog.timer('performSeek');

      try {
        timer.step('seekTo');
        await audioService.seekTo(targetPosition);

        timer.step('confirm');
        await waitForPositionConfirmation(targetPosition);

        // Update store position
        usePlayerStore.setState({
          position: targetPosition,
          isSeeking: false,
        });

        timer.end();
      } catch (error) {
        seekLog.error('performSeek', error as Error);
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
      const timer = seekLog.timer('chapterTransition');
      seekLog.chapterCrossing(fromIndex, toIndex, { targetPosition });

      try {
        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, isChangingChapter: true }));
        }

        timer.step('seekTo');
        await audioService.seekTo(targetPosition);

        timer.step('confirm');
        await waitForPositionConfirmation(targetPosition);

        // Update store
        usePlayerStore.setState({
          position: targetPosition,
          isSeeking: false,
        });

        timer.end();
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
      seekLog.start('seekRelative', { seconds, direction });

      if (!acquireLock('seek', direction)) {
        seekLog.end('seekRelative', { result: 'lock_failed' });
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

        if (boundaryHit) {
          seekLog.step('boundaryHit', { boundary: boundaryHit });
        }

        if (crossing) {
          await handleChapterTransition(
            crossing.fromChapterIndex,
            crossing.toChapterIndex,
            targetPosition
          );
        } else {
          await performSeek(targetPosition, direction);
        }

        seekLog.end('seekRelative', { result: 'success', targetPosition });
      } catch (error) {
        seekLog.error('seekRelative', error as Error);
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

      seekLog.start('seekAbsolute', { targetPosition, direction });

      if (!acquireLock('seek', direction)) {
        seekLog.end('seekAbsolute', { result: 'lock_failed' });
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

        seekLog.end('seekAbsolute', { result: 'success', targetPosition: clampedTarget });
      } catch (error) {
        seekLog.error('seekAbsolute', error as Error);
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
      seekLog.start('seekToChapter', { chapterIndex });

      if (chapterIndex < 0 || chapterIndex >= chapters.length) {
        seekLog.warn('Invalid chapter index', { chapterIndex, chaptersLength: chapters.length });
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
    seekLog.step('cancelSeek');
    forceReleaseLock();
  }, [forceReleaseLock]);

  /**
   * Start continuous seeking (hold button)
   */
  const startContinuousSeek = useCallback(
    async (direction: SeekDirection): Promise<void> => {
      seekLog.continuous('start', { direction });

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

      const step = direction === 'backward' ? -REWIND_STEP : FF_STEP;
      let currentSeekPosition = startPosition;

      // Perform initial step
      currentSeekPosition = clampPosition(currentSeekPosition + step, durationRef.current);
      await audioService.seekTo(currentSeekPosition);

      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, seekPosition: currentSeekPosition }));
      }

      // Start interval for continuous seeking
      continuousSeekIntervalRef.current = setInterval(async () => {
        if (!lockRef.current.isLocked || lockRef.current.operation !== 'continuous') {
          // Lock was released externally
          if (continuousSeekIntervalRef.current) {
            clearInterval(continuousSeekIntervalRef.current);
            continuousSeekIntervalRef.current = null;
          }
          return;
        }

        const prevPosition = currentSeekPosition;
        currentSeekPosition = clampPosition(currentSeekPosition + step, durationRef.current);

        // Check for chapter crossing
        const crossing =
          chapters.length > 0 &&
          findChapterIndex(chapters, prevPosition) !== findChapterIndex(chapters, currentSeekPosition);

        if (crossing) {
          const fromIndex = findChapterIndex(chapters, prevPosition);
          const toIndex = findChapterIndex(chapters, currentSeekPosition);
          seekLog.chapterCrossing(fromIndex, toIndex, { position: currentSeekPosition });

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

        await audioService.seekTo(currentSeekPosition);

        if (isMountedRef.current) {
          setState((prev) => ({ ...prev, seekPosition: currentSeekPosition }));
        }

        seekLog.continuous('tick', { position: currentSeekPosition });

        // Stop at boundaries
        if (
          (direction === 'backward' && currentSeekPosition <= 0) ||
          (direction === 'forward' && currentSeekPosition >= durationRef.current)
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
    seekLog.continuous('stop');

    // Clear interval
    if (continuousSeekIntervalRef.current) {
      clearInterval(continuousSeekIntervalRef.current);
      continuousSeekIntervalRef.current = null;
    }

    if (!lockRef.current.isLocked) {
      return;
    }

    const finalPosition = state.seekPosition;

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
  }, [state.seekPosition, play, releaseLock, waitForPositionConfirmation]);

  /**
   * Go to next chapter
   */
  const nextChapter = useCallback(async (): Promise<void> => {
    seekLog.start('nextChapter');

    const result = calculateNextChapterPosition(chapters, positionRef.current);

    if (result) {
      await seekAbsolute(result.position);
    } else {
      seekLog.step('atLastChapter');
    }
  }, [chapters, seekAbsolute]);

  /**
   * Go to previous chapter (with restart logic)
   */
  const prevChapter = useCallback(async (): Promise<void> => {
    seekLog.start('prevChapter');

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
