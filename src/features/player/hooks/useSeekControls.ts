/**
 * src/features/player/hooks/useSeekControls.ts
 * 
 * Bulletproof hold-to-seek with failsafe cleanup
 * Fixes Android issues where onPressOut doesn't fire
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';
import { REWIND_STEP, REWIND_INTERVAL, FF_STEP } from '../constants';

interface UseSeekControlsReturn {
  isRewinding: boolean;
  isFastForwarding: boolean;
  seekDelta: number;
  
  // Tap handlers (for chapter mode)
  onPrevChapter: () => void;
  onNextChapter: () => void;
  
  // Press handlers (for rewind mode)
  onRewindPressIn: () => void;
  onRewindPressOut: () => void;
  onFFPressIn: () => void;
  onFFPressOut: () => void;
  
  // Emergency stop (call if gesture gets stuck)
  forceStop: () => void;
}

export function useSeekControls(): UseSeekControlsReturn {
  const [isRewinding, setIsRewinding] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [seekDelta, setSeekDelta] = useState(0);
  
  // Store refs
  const position = usePlayerStore(s => s.position);
  const duration = usePlayerStore(s => s.duration);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const seekTo = usePlayerStore(s => s.seekTo);
  const pause = usePlayerStore(s => s.pause);
  const play = usePlayerStore(s => s.play);
  const prevChapter = usePlayerStore(s => s.prevChapter);
  const nextChapter = usePlayerStore(s => s.nextChapter);
  
  // Refs for tracking state without re-renders
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const failsafeRef = useRef<NodeJS.Timeout | null>(null);
  const seekDeltaRef = useRef(0);
  const startPositionRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const durationRef = useRef(duration);
  const isMountedRef = useRef(true);
  
  // Keep duration up to date
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  
  // Mark unmounted
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Force stop everything
  const forceStop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (failsafeRef.current) {
      clearTimeout(failsafeRef.current);
      failsafeRef.current = null;
    }
    
    if (isMountedRef.current) {
      setIsRewinding(false);
      setIsFastForwarding(false);
      setSeekDelta(0);
    }
    
    seekDeltaRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return forceStop;
  }, [forceStop]);

  // Stop seeking if app goes to background
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state !== 'active') {
        forceStop();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [forceStop]);

  // Start seeking in a direction
  const startSeeking = useCallback(async (direction: 'back' | 'forward') => {
    // Stop any existing seek
    forceStop();
    
    // Save state
    wasPlayingRef.current = isPlaying;
    startPositionRef.current = position;
    seekDeltaRef.current = 0;
    
    if (direction === 'back') {
      setIsRewinding(true);
    } else {
      setIsFastForwarding(true);
    }
    setSeekDelta(0);
    
    // Pause during seek
    await pause();
    
    const step = direction === 'forward' ? FF_STEP : -REWIND_STEP;
    
    // Start interval
    intervalRef.current = setInterval(() => {
      seekDeltaRef.current += step;
      
      const newPosition = Math.max(0, Math.min(
        durationRef.current,
        startPositionRef.current + seekDeltaRef.current
      ));
      
      if (isMountedRef.current) {
        setSeekDelta(seekDeltaRef.current);
      }
      
      seekTo(newPosition);
      
      // Stop at boundaries
      if (newPosition <= 0 || newPosition >= durationRef.current) {
        forceStop();
      }
    }, REWIND_INTERVAL);
    
    // Failsafe: auto-stop after 60 seconds max
    failsafeRef.current = setTimeout(() => {
      console.warn('[SeekControls] Failsafe triggered - stopping seek');
      forceStop();
    }, 60000);
    
  }, [isPlaying, position, pause, seekTo, forceStop]);

  // Stop seeking
  const stopSeeking = useCallback(async () => {
    const wasSeeking = isRewinding || isFastForwarding;
    const shouldResume = wasPlayingRef.current;
    
    forceStop();
    
    if (wasSeeking && shouldResume) {
      await play();
    }
  }, [isRewinding, isFastForwarding, play, forceStop]);

  // Handler functions
  const onRewindPressIn = useCallback(() => {
    startSeeking('back');
  }, [startSeeking]);

  const onRewindPressOut = useCallback(() => {
    stopSeeking();
  }, [stopSeeking]);

  const onFFPressIn = useCallback(() => {
    startSeeking('forward');
  }, [startSeeking]);

  const onFFPressOut = useCallback(() => {
    stopSeeking();
  }, [stopSeeking]);

  const onPrevChapter = useCallback(() => {
    prevChapter();
  }, [prevChapter]);

  const onNextChapter = useCallback(() => {
    nextChapter();
  }, [nextChapter]);

  return {
    isRewinding,
    isFastForwarding,
    seekDelta,
    onPrevChapter,
    onNextChapter,
    onRewindPressIn,
    onRewindPressOut,
    onFFPressIn,
    onFFPressOut,
    forceStop,
  };
}