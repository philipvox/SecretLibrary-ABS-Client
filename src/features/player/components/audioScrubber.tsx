/**
 * src/features/player/components/AudioScrubber.tsx
 *
 * Audio scrubber hook for seek-based scrubbing.
 * Uses standard seek operations via react-native-track-player.
 */

import { useCallback, useState, useRef } from 'react';

interface UseScrubberOptions {
  currentPosition: number;
  onSeek: (position: number) => Promise<void>;
  onPlay: () => Promise<void>;
  onPause: () => Promise<void>;
}

export function useAudioScrubber({
  currentPosition,
  onSeek,
  onPlay,
  onPause,
}: UseScrubberOptions) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubDelta, setScrubDelta] = useState(0);

  const scrubStartPosRef = useRef(0);
  const scrubIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start scrubbing
  const startScrub = useCallback(
    async (direction: 'forward' | 'backward', speed: number) => {
      setIsScrubbing(true);
      scrubStartPosRef.current = currentPosition;
      setScrubDelta(0);

      await onPause();

      // Update position at interval
      const startTime = Date.now();
      scrubIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const delta = elapsed * (direction === 'backward' ? -speed : speed);
        setScrubDelta(delta);
      }, 50);

      return true;
    },
    [currentPosition, onPause]
  );

  // Stop scrubbing
  const stopScrub = useCallback(
    async (resumePlayback: boolean) => {
      if (scrubIntervalRef.current) {
        clearInterval(scrubIntervalRef.current);
        scrubIntervalRef.current = null;
      }

      // Seek to new position
      const newPosition = Math.max(0, scrubStartPosRef.current + scrubDelta);
      await onSeek(newPosition);

      setIsScrubbing(false);
      setScrubDelta(0);

      if (resumePlayback) {
        await onPlay();
      }
    },
    [scrubDelta, onSeek, onPlay]
  );

  return {
    isScrubbing,
    scrubDelta,
    startScrub,
    stopScrub,
  };
}
