/**
 * src/features/player/hooks/useContinuousSeeking.ts
 *
 * Hook for continuous seeking (hold to scrub) functionality.
 * Provides accelerating seek speed the longer the button is held.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { audioService } from '../services/audioService';
import { haptics } from '@/core/native/haptics';

export interface UseContinuousSeekingOptions {
  seekTo: ((position: number) => void) | undefined;
  handleSkipBack: () => void;
  handleSkipForward: () => void;
}

export interface SeekingState {
  isActive: boolean;
  direction: 'back' | 'forward' | null;
  amount: number; // Current seek amount per tick (or skip interval for tap)
}

export interface UseContinuousSeekingReturn {
  handleRewindPressIn: () => void;
  handleFastForwardPressIn: () => void;
  handleSeekPressOut: () => void;
  handleSkipBackWithCheck: () => void;
  handleSkipForwardWithCheck: () => void;
  seekingState: SeekingState;
}

/**
 * Hook that provides continuous seeking functionality.
 * - Short press: single skip (back/forward)
 * - Long press (300ms+): continuous scrubbing with acceleration
 *
 * Acceleration schedule:
 * - First 1s: 2 seconds per tick
 * - 1-2s: 5 seconds per tick
 * - 2-4s: 10 seconds per tick
 * - 4s+: 15 seconds per tick
 */
export function useContinuousSeeking({
  seekTo,
  handleSkipBack,
  handleSkipForward,
}: UseContinuousSeekingOptions): UseContinuousSeekingReturn {
  const seekIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const seekDelayRef = useRef<NodeJS.Timeout | null>(null);
  const seekStartTimeRef = useRef<number>(0);
  const seekDirectionRef = useRef<'back' | 'forward' | null>(null);
  const didStartSeekingRef = useRef<boolean>(false);

  // Get skip intervals from store
  const skipBackInterval = usePlayerStore((s) => s.skipBackInterval ?? 15);
  const skipForwardInterval = usePlayerStore((s) => s.skipForwardInterval ?? 30);

  // Seeking state for UI display
  const [seekingState, setSeekingState] = useState<SeekingState>({
    isActive: false,
    direction: null,
    amount: 0,
  });

  // Calculate seek amount based on how long button has been held
  const getSeekAmount = useCallback(() => {
    const holdDuration = Date.now() - seekStartTimeRef.current;
    if (holdDuration < 1000) return 2;     // First 1s: 2 seconds per tick
    if (holdDuration < 2000) return 5;     // 1-2s: 5 seconds per tick
    if (holdDuration < 4000) return 10;    // 2-4s: 10 seconds per tick
    return 15;                              // 4s+: 15 seconds per tick
  }, []);

  // Start continuous seeking (called after delay)
  const beginContinuousSeeking = useCallback((direction: 'back' | 'forward') => {
    if (seekIntervalRef.current) return;

    didStartSeekingRef.current = true;
    seekStartTimeRef.current = Date.now();
    haptics.selection();

    // Prevent SmartRewind from activating when we release
    audioService.setScrubbing(true);

    // Set initial seeking state
    const initialAmount = 2; // First tick amount
    setSeekingState({ isActive: true, direction, amount: initialAmount });

    // Continue seeking every 100ms
    seekIntervalRef.current = setInterval(() => {
      const currentState = usePlayerStore.getState();
      const seekAmount = getSeekAmount();

      // Update seeking state with current amount
      setSeekingState({ isActive: true, direction, amount: seekAmount });

      let newPosition: number;
      if (direction === 'back') {
        newPosition = Math.max(0, currentState.position - seekAmount);
      } else {
        newPosition = Math.min(currentState.duration, currentState.position + seekAmount);
      }

      seekTo?.(newPosition);

      // Haptic feedback when accelerating
      if (seekAmount >= 10) {
        haptics.impact('light');
      }
    }, 100);
  }, [seekTo, getSeekAmount]);

  // Handle press in - start delay timer for continuous seeking
  const handleRewindPressIn = useCallback(() => {
    didStartSeekingRef.current = false;
    seekDirectionRef.current = 'back';

    // Show skip preview immediately
    setSeekingState({ isActive: true, direction: 'back', amount: skipBackInterval });

    // Start continuous seeking after 300ms hold
    seekDelayRef.current = setTimeout(() => {
      beginContinuousSeeking('back');
    }, 300);
  }, [beginContinuousSeeking, skipBackInterval]);

  const handleFastForwardPressIn = useCallback(() => {
    didStartSeekingRef.current = false;
    seekDirectionRef.current = 'forward';

    // Show skip preview immediately
    setSeekingState({ isActive: true, direction: 'forward', amount: skipForwardInterval });

    // Start continuous seeking after 300ms hold
    seekDelayRef.current = setTimeout(() => {
      beginContinuousSeeking('forward');
    }, 300);
  }, [beginContinuousSeeking, skipForwardInterval]);

  // Handle press out - stop seeking
  const handleSeekPressOut = useCallback(() => {
    // Clear the delay timer
    if (seekDelayRef.current) {
      clearTimeout(seekDelayRef.current);
      seekDelayRef.current = null;
    }

    // Stop continuous seeking
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
      // Re-enable SmartRewind now that seeking is done
      audioService.setScrubbing(false);
    }

    seekDirectionRef.current = null;

    // Clear seeking state
    setSeekingState({ isActive: false, direction: null, amount: 0 });
  }, []);

  // Modified skip handlers - only skip if we didn't start continuous seeking
  const handleSkipBackWithCheck = useCallback(() => {
    if (didStartSeekingRef.current) return; // Was holding, don't skip
    handleSkipBack();
  }, [handleSkipBack]);

  const handleSkipForwardWithCheck = useCallback(() => {
    if (didStartSeekingRef.current) return; // Was holding, don't skip
    handleSkipForward();
  }, [handleSkipForward]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (seekIntervalRef.current) clearInterval(seekIntervalRef.current);
      if (seekDelayRef.current) clearTimeout(seekDelayRef.current);
    };
  }, []);

  return {
    handleRewindPressIn,
    handleFastForwardPressIn,
    handleSeekPressOut,
    handleSkipBackWithCheck,
    handleSkipForwardWithCheck,
    seekingState,
  };
}
