/**
 * src/features/player/hooks/useTimelineHaptics.ts
 *
 * Haptic feedback system for chapter timeline interactions.
 * Provides tactile feedback for:
 * - Chapter boundary crossings
 * - Minute marker crossings
 * - Tap confirmations
 * - Edge reached (start/end of book)
 * - Mode changes (entering/exiting scrub modes)
 */

import { useCallback, useRef } from 'react';
import { haptics } from '@/core/native/haptics';

export interface TimelineHapticConfig {
  enabled: boolean;
  chapterBoundaries: boolean;
  minuteMarkers: boolean;
  tapConfirm: boolean;
  edgeReached: boolean;
  modeChanges: boolean;
}

export const DEFAULT_HAPTIC_CONFIG: TimelineHapticConfig = {
  enabled: true,
  chapterBoundaries: true,
  minuteMarkers: true,
  tapConfirm: true,
  edgeReached: true,
  modeChanges: true,
};

export interface Chapter {
  index: number;
  startTime: number;
  endTime: number;
  title?: string;
}

export function useTimelineHaptics(config: TimelineHapticConfig = DEFAULT_HAPTIC_CONFIG) {
  // Debounce refs to prevent rapid-fire haptics
  const lastChapterHapticTime = useRef(0);
  const lastMinuteHapticTime = useRef(0);
  const lastEdgeHapticTime = useRef(0);
  const lastCrossedChapter = useRef<number | null>(null);
  const lastCrossedMinute = useRef<number | null>(null);

  /**
   * Trigger haptic for chapter boundary crossing
   */
  const triggerChapterCrossing = useCallback((chapterIndex: number) => {
    if (!config.enabled || !config.chapterBoundaries) return;

    const now = Date.now();
    // Debounce: 200ms between chapter haptics
    if (now - lastChapterHapticTime.current < 200) return;
    // Don't repeat for same chapter
    if (lastCrossedChapter.current === chapterIndex) return;

    lastChapterHapticTime.current = now;
    lastCrossedChapter.current = chapterIndex;

    // Medium impact for chapter boundaries
    haptics.impact('medium');
  }, [config.enabled, config.chapterBoundaries]);

  /**
   * Trigger haptic for minute marker crossing
   */
  const triggerMinuteCrossing = useCallback((minute: number) => {
    if (!config.enabled || !config.minuteMarkers) return;

    const now = Date.now();
    // Debounce: 100ms between minute haptics
    if (now - lastMinuteHapticTime.current < 100) return;
    // Don't repeat for same minute
    if (lastCrossedMinute.current === minute) return;

    lastMinuteHapticTime.current = now;
    lastCrossedMinute.current = minute;

    // Light impact for minute markers
    haptics.impact('light');
  }, [config.enabled, config.minuteMarkers]);

  /**
   * Trigger haptic for tap-to-seek confirmation
   */
  const triggerTapConfirm = useCallback(() => {
    if (!config.enabled || !config.tapConfirm) return;

    haptics.impact('light');
  }, [config.enabled, config.tapConfirm]);

  /**
   * Trigger haptic for reaching start/end of book
   */
  const triggerEdgeReached = useCallback((edge: 'start' | 'end') => {
    if (!config.enabled || !config.edgeReached) return;

    const now = Date.now();
    // Debounce: 500ms between edge haptics
    if (now - lastEdgeHapticTime.current < 500) return;

    lastEdgeHapticTime.current = now;

    // Warning/error haptic for edges
    haptics.error();
  }, [config.enabled, config.edgeReached]);

  /**
   * Trigger haptic for mode changes (entering/exiting scrub)
   */
  const triggerModeChange = useCallback((mode: 'enter' | 'exit' | 'speed-change') => {
    if (!config.enabled || !config.modeChanges) return;

    if (mode === 'enter') {
      haptics.toggle();
    } else if (mode === 'exit') {
      haptics.buttonPress();
    } else if (mode === 'speed-change') {
      haptics.impact('light');
    }
  }, [config.enabled, config.modeChanges]);

  /**
   * Trigger haptic for snap-to-chapter
   */
  const triggerSnap = useCallback(() => {
    if (!config.enabled) return;

    haptics.impact('medium');
  }, [config.enabled]);

  /**
   * Check if position crossed any chapter boundaries
   * Call this during scrubbing with prev and new positions
   */
  const checkChapterCrossing = useCallback((
    prevPositionSec: number,
    newPositionSec: number,
    chapters: Chapter[]
  ) => {
    if (!config.enabled || !config.chapterBoundaries) return;

    for (const chapter of chapters) {
      const boundaryTime = chapter.startTime;

      // Check if boundary is between prev and new position
      const crossedForward = prevPositionSec < boundaryTime && newPositionSec >= boundaryTime;
      const crossedBackward = prevPositionSec > boundaryTime && newPositionSec <= boundaryTime;

      if (crossedForward || crossedBackward) {
        triggerChapterCrossing(chapter.index);
        break; // Only trigger once per update
      }
    }
  }, [config.enabled, config.chapterBoundaries, triggerChapterCrossing]);

  /**
   * Check if position crossed any minute boundaries
   * Call this during scrubbing with prev and new positions
   */
  const checkMinuteCrossing = useCallback((
    prevPositionSec: number,
    newPositionSec: number
  ) => {
    if (!config.enabled || !config.minuteMarkers) return;

    const prevMinute = Math.floor(prevPositionSec / 60);
    const newMinute = Math.floor(newPositionSec / 60);

    if (prevMinute !== newMinute) {
      triggerMinuteCrossing(newMinute);
    }
  }, [config.enabled, config.minuteMarkers, triggerMinuteCrossing]);

  /**
   * Check if position reached start or end of book
   */
  const checkEdgeReached = useCallback((
    positionSec: number,
    durationSec: number
  ) => {
    if (!config.enabled || !config.edgeReached) return;

    if (positionSec <= 0.5) {
      triggerEdgeReached('start');
    } else if (positionSec >= durationSec - 0.5) {
      triggerEdgeReached('end');
    }
  }, [config.enabled, config.edgeReached, triggerEdgeReached]);

  /**
   * Reset tracking (call when scrub starts)
   */
  const resetTracking = useCallback(() => {
    lastCrossedChapter.current = null;
    lastCrossedMinute.current = null;
  }, []);

  return {
    // Individual triggers
    triggerChapterCrossing,
    triggerMinuteCrossing,
    triggerTapConfirm,
    triggerEdgeReached,
    triggerModeChange,
    triggerSnap,

    // Convenience checkers (use during scrub updates)
    checkChapterCrossing,
    checkMinuteCrossing,
    checkEdgeReached,

    // Reset
    resetTracking,
  };
}

export default useTimelineHaptics;
