/**
 * Hook for managing Cast session lifecycle.
 * Initializes Cast on mount and cleans up on unmount.
 */

import { useEffect } from 'react';
import { useCastStore } from '../stores/castStore';

export function useCastSession() {
  const initialize = useCastStore((s) => s.initialize);
  const cleanup = useCastStore((s) => s.cleanup);
  const isAvailable = useCastStore((s) => s.isAvailable);
  const isConnected = useCastStore((s) => s.isConnected);
  const deviceName = useCastStore((s) => s.deviceName);
  const isPlaying = useCastStore((s) => s.isPlaying);
  const position = useCastStore((s) => s.position);
  const duration = useCastStore((s) => s.duration);

  useEffect(() => {
    initialize();
    return () => cleanup();
  }, []);

  return {
    isAvailable,
    isConnected,
    deviceName,
    isPlaying,
    position,
    duration,
  };
}
