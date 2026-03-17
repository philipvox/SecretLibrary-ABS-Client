/**
 * Zustand store for Chromecast state.
 *
 * Manages device discovery, session lifecycle, and remote playback state.
 * Integrates with playerStore — when casting, playback commands route
 * through castService instead of local audio.
 */

import { create } from 'zustand';
import { castService, CastDevice, MediaStatus } from '../services/castService';
import { logger } from '@/shared/utils/logger';

interface CastState {
  /** Whether the Cast SDK is available on this device */
  isAvailable: boolean;
  /** Whether currently connected to a Cast device */
  isConnected: boolean;
  /** Name of the connected Cast device */
  deviceName: string | null;
  /** Session ID of the active Cast session */
  sessionId: string | null;
  /** Current playback position on the Cast device (seconds) */
  position: number;
  /** Total duration of media on Cast device (seconds) */
  duration: number;
  /** Whether Cast device is currently playing */
  isPlaying: boolean;
  /** Available Cast devices */
  devices: CastDevice[];

  // Actions
  initialize: () => void;
  cleanup: () => void;
  showPicker: () => Promise<void>;
  loadMedia: (url: string, title: string, author: string, coverUrl: string, position: number) => Promise<boolean>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  stop: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useCastStore = create<CastState>((set, get) => {
  const unsubscribes: (() => void)[] = [];

  return {
    isAvailable: castService.isAvailable,
    isConnected: false,
    deviceName: null,
    sessionId: null,
    position: 0,
    duration: 0,
    isPlaying: false,
    devices: [],

    initialize: () => {
      if (!castService.isAvailable) return;

      castService.initialize();

      // Listen for session events
      unsubscribes.push(
        castService.on('onSessionStarted', (data) => {
          logger.info('[Cast] Session started:', data.deviceName);
          set({
            isConnected: true,
            deviceName: data.deviceName,
            sessionId: data.sessionId,
          });
        })
      );

      unsubscribes.push(
        castService.on('onSessionEnded', () => {
          logger.info('[Cast] Session ended');
          set({
            isConnected: false,
            deviceName: null,
            sessionId: null,
            isPlaying: false,
            position: 0,
            duration: 0,
          });
        })
      );

      unsubscribes.push(
        castService.on('onSessionStartFailed', (data) => {
          logger.error('[Cast] Session start failed:', data.error);
        })
      );

      unsubscribes.push(
        castService.on('onMediaStatusUpdate', (data: MediaStatus) => {
          set({
            position: data.position,
            duration: data.duration,
            isPlaying: data.isPlaying,
          });
        })
      );

      // Start discovery
      castService.startDiscovery().catch(() => {});

      // Check initial connection state
      castService.isConnected().then((connected) => {
        if (connected) {
          set({ isConnected: true });
        }
      });
    },

    cleanup: () => {
      for (const unsub of unsubscribes) {
        unsub();
      }
      unsubscribes.length = 0;
      castService.destroy();
    },

    showPicker: async () => {
      await castService.showCastPicker();
    },

    loadMedia: async (url, title, author, coverUrl, position) => {
      try {
        return await castService.loadMedia({ url, title, author, coverUrl, position });
      } catch (err) {
        logger.error('[Cast] Failed to load media:', err);
        return false;
      }
    },

    play: async () => {
      try {
        await castService.play();
        set({ isPlaying: true });
      } catch (err) {
        logger.error('[Cast] Failed to play:', err);
      }
    },

    pause: async () => {
      try {
        await castService.pause();
        set({ isPlaying: false });
      } catch (err) {
        logger.error('[Cast] Failed to pause:', err);
      }
    },

    seek: async (position) => {
      try {
        await castService.seek(position);
        set({ position });
      } catch (err) {
        logger.error('[Cast] Failed to seek:', err);
      }
    },

    stop: async () => {
      try {
        await castService.stop();
        set({ isPlaying: false });
      } catch (err) {
        logger.error('[Cast] Failed to stop:', err);
      }
    },

    disconnect: async () => {
      try {
        // Capture last position before disconnecting
        const lastPosition = get().position;
        await castService.disconnect();
        set({
          isConnected: false,
          deviceName: null,
          sessionId: null,
          isPlaying: false,
          position: lastPosition, // Preserved for local resume
        });
      } catch (err) {
        logger.error('[Cast] Failed to disconnect:', err);
      }
    },
  };
});
