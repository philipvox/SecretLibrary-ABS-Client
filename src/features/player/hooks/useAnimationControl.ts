/**
 * src/features/player/hooks/useAnimationControl.ts
 *
 * Animation control hook for coordinating player animations with seek operations.
 * Provides a way to suspend and resume animations during seeks to prevent visual glitches.
 */

import { useRef, useCallback } from 'react';
import { SharedValue } from 'react-native-reanimated';
import { seekLog } from '../utils/seekLogger';

export interface AnimationSuspensionState {
  isSuspended: boolean;
  suspendedAt: number;
  reason: 'seek' | 'chapter-change' | null;
}

export interface UseAnimationControlReturn {
  /** Whether animations are currently suspended */
  isSuspended: boolean;
  /** Suspend animations (call when seek starts) */
  suspend: (reason: 'seek' | 'chapter-change') => void;
  /** Resume animations (call when seek ends) */
  resume: () => void;
  /** Get current suspension state */
  getState: () => AnimationSuspensionState;
  /** Check if a position update should be applied to animations */
  shouldUpdateAnimation: (isSeekingFromStore: boolean) => boolean;
}

/**
 * Hook to control animation suspension during seek operations.
 * This helps prevent visual glitches when seeking crosses chapter boundaries.
 */
export function useAnimationControl(): UseAnimationControlReturn {
  const stateRef = useRef<AnimationSuspensionState>({
    isSuspended: false,
    suspendedAt: 0,
    reason: null,
  });

  /**
   * Suspend animations
   */
  const suspend = useCallback((reason: 'seek' | 'chapter-change') => {
    stateRef.current = {
      isSuspended: true,
      suspendedAt: Date.now(),
      reason,
    };
    seekLog.animation('suspend', reason);
  }, []);

  /**
   * Resume animations
   */
  const resume = useCallback(() => {
    stateRef.current = {
      isSuspended: false,
      suspendedAt: 0,
      reason: null,
    };
    seekLog.animation('resume');
  }, []);

  /**
   * Get current state
   */
  const getState = useCallback((): AnimationSuspensionState => {
    return { ...stateRef.current };
  }, []);

  /**
   * Check if animation should update based on current state.
   * Returns false during seeking to prevent position-based animations from jumping.
   */
  const shouldUpdateAnimation = useCallback((isSeekingFromStore: boolean): boolean => {
    // If store says we're seeking, don't update animations
    if (isSeekingFromStore) {
      return false;
    }

    // If locally suspended, don't update
    if (stateRef.current.isSuspended) {
      return false;
    }

    return true;
  }, []);

  return {
    isSuspended: stateRef.current.isSuspended,
    suspend,
    resume,
    getState,
    shouldUpdateAnimation,
  };
}

/**
 * Create an animation controller object for passing to components.
 * This is useful when you need to pass animation control to components
 * without using the hook directly.
 */
export function createAnimationController(): {
  isSuspended: boolean;
  suspend: (reason: 'seek' | 'chapter-change') => void;
  resume: () => void;
} {
  let isSuspended = false;

  return {
    get isSuspended() {
      return isSuspended;
    },
    suspend: (reason: 'seek' | 'chapter-change') => {
      isSuspended = true;
      seekLog.animation('suspend', reason);
    },
    resume: () => {
      isSuspended = false;
      seekLog.animation('resume');
    },
  };
}
