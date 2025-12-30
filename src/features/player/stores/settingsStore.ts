/**
 * src/features/player/stores/settingsStore.ts
 *
 * Persistent player settings store.
 * Extracted from playerStore for better separation of concerns.
 *
 * Contains:
 * - Playback speed settings (per-book and global)
 * - Skip interval settings
 * - Smart rewind settings
 * - Sleep timer preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// Types
// =============================================================================

export interface PlaybackSettings {
  // Per-book playback speeds
  bookSpeedMap: Record<string, number>;

  // Global default playback rate
  globalDefaultRate: number;

  // Skip intervals
  skipForwardInterval: number;
  skipBackInterval: number;

  // Smart rewind settings
  smartRewindEnabled: boolean;
  smartRewindMaxSeconds: number;

  // Sleep timer preferences
  shakeToExtendEnabled: boolean;

  // Timeline scrub settings
  snapToChapterEnabled: boolean;
  snapToChapterThreshold: number; // seconds from chapter boundary to snap
}

export interface SettingsActions {
  // Playback rate
  setBookSpeed: (bookId: string, rate: number) => void;
  getBookSpeed: (bookId: string) => number;
  setGlobalDefaultRate: (rate: number) => void;
  clearBookSpeed: (bookId: string) => void;

  // Skip intervals
  setSkipForwardInterval: (seconds: number) => void;
  setSkipBackInterval: (seconds: number) => void;

  // Smart rewind
  setSmartRewindEnabled: (enabled: boolean) => void;
  setSmartRewindMaxSeconds: (seconds: number) => void;

  // Sleep timer
  setShakeToExtendEnabled: (enabled: boolean) => void;

  // Timeline scrub
  setSnapToChapterEnabled: (enabled: boolean) => void;
  setSnapToChapterThreshold: (seconds: number) => void;

  // Bulk operations
  resetToDefaults: () => void;
  importSettings: (settings: Partial<PlaybackSettings>) => void;
  exportSettings: () => PlaybackSettings;
}

export type SettingsStore = PlaybackSettings & SettingsActions;

// =============================================================================
// Constants
// =============================================================================

export const MIN_PLAYBACK_RATE = 0.5;
export const MAX_PLAYBACK_RATE = 3.0;
export const DEFAULT_PLAYBACK_RATE = 1.0;

export const MIN_SKIP_INTERVAL = 5;
export const MAX_SKIP_INTERVAL = 120;
export const DEFAULT_SKIP_FORWARD = 30;
export const DEFAULT_SKIP_BACK = 15;

export const MIN_SMART_REWIND = 5;
export const MAX_SMART_REWIND = 120;
export const DEFAULT_SMART_REWIND_MAX = 30;

export const MIN_SNAP_THRESHOLD = 1;
export const MAX_SNAP_THRESHOLD = 10;
export const DEFAULT_SNAP_THRESHOLD = 2;

// =============================================================================
// Default State
// =============================================================================

const defaultSettings: PlaybackSettings = {
  bookSpeedMap: {},
  globalDefaultRate: DEFAULT_PLAYBACK_RATE,
  skipForwardInterval: DEFAULT_SKIP_FORWARD,
  skipBackInterval: DEFAULT_SKIP_BACK,
  smartRewindEnabled: true,
  smartRewindMaxSeconds: DEFAULT_SMART_REWIND_MAX,
  shakeToExtendEnabled: true,
  snapToChapterEnabled: true,
  snapToChapterThreshold: DEFAULT_SNAP_THRESHOLD,
};

// =============================================================================
// Helper Functions
// =============================================================================

function clampRate(rate: number): number {
  return Math.max(MIN_PLAYBACK_RATE, Math.min(MAX_PLAYBACK_RATE, rate));
}

function clampSkipInterval(seconds: number): number {
  return Math.max(MIN_SKIP_INTERVAL, Math.min(MAX_SKIP_INTERVAL, seconds));
}

function clampSmartRewind(seconds: number): number {
  return Math.max(MIN_SMART_REWIND, Math.min(MAX_SMART_REWIND, seconds));
}

function clampSnapThreshold(seconds: number): number {
  return Math.max(MIN_SNAP_THRESHOLD, Math.min(MAX_SNAP_THRESHOLD, seconds));
}

// =============================================================================
// Store
// =============================================================================

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...defaultSettings,

      // Playback rate actions
      setBookSpeed: (bookId: string, rate: number) => {
        const clampedRate = clampRate(rate);
        set((state) => ({
          bookSpeedMap: {
            ...state.bookSpeedMap,
            [bookId]: clampedRate,
          },
        }));
      },

      getBookSpeed: (bookId: string): number => {
        const { bookSpeedMap, globalDefaultRate } = get();
        return bookSpeedMap[bookId] ?? globalDefaultRate;
      },

      setGlobalDefaultRate: (rate: number) => {
        set({ globalDefaultRate: clampRate(rate) });
      },

      clearBookSpeed: (bookId: string) => {
        set((state) => {
          const { [bookId]: _, ...rest } = state.bookSpeedMap;
          return { bookSpeedMap: rest };
        });
      },

      // Skip interval actions
      setSkipForwardInterval: (seconds: number) => {
        set({ skipForwardInterval: clampSkipInterval(seconds) });
      },

      setSkipBackInterval: (seconds: number) => {
        set({ skipBackInterval: clampSkipInterval(seconds) });
      },

      // Smart rewind actions
      setSmartRewindEnabled: (enabled: boolean) => {
        set({ smartRewindEnabled: enabled });
      },

      setSmartRewindMaxSeconds: (seconds: number) => {
        set({ smartRewindMaxSeconds: clampSmartRewind(seconds) });
      },

      // Sleep timer actions
      setShakeToExtendEnabled: (enabled: boolean) => {
        set({ shakeToExtendEnabled: enabled });
      },

      // Timeline scrub actions
      setSnapToChapterEnabled: (enabled: boolean) => {
        set({ snapToChapterEnabled: enabled });
      },

      setSnapToChapterThreshold: (seconds: number) => {
        set({ snapToChapterThreshold: clampSnapThreshold(seconds) });
      },

      // Bulk operations
      resetToDefaults: () => {
        set(defaultSettings);
      },

      importSettings: (settings: Partial<PlaybackSettings>) => {
        set((state) => ({
          ...state,
          ...settings,
          // Ensure values are clamped
          globalDefaultRate: settings.globalDefaultRate
            ? clampRate(settings.globalDefaultRate)
            : state.globalDefaultRate,
          skipForwardInterval: settings.skipForwardInterval
            ? clampSkipInterval(settings.skipForwardInterval)
            : state.skipForwardInterval,
          skipBackInterval: settings.skipBackInterval
            ? clampSkipInterval(settings.skipBackInterval)
            : state.skipBackInterval,
          smartRewindMaxSeconds: settings.smartRewindMaxSeconds
            ? clampSmartRewind(settings.smartRewindMaxSeconds)
            : state.smartRewindMaxSeconds,
        }));
      },

      exportSettings: (): PlaybackSettings => {
        const state = get();
        return {
          bookSpeedMap: state.bookSpeedMap,
          globalDefaultRate: state.globalDefaultRate,
          skipForwardInterval: state.skipForwardInterval,
          skipBackInterval: state.skipBackInterval,
          smartRewindEnabled: state.smartRewindEnabled,
          smartRewindMaxSeconds: state.smartRewindMaxSeconds,
          shakeToExtendEnabled: state.shakeToExtendEnabled,
          snapToChapterEnabled: state.snapToChapterEnabled,
          snapToChapterThreshold: state.snapToChapterThreshold,
        };
      },
    }),
    {
      name: 'player-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        bookSpeedMap: state.bookSpeedMap,
        globalDefaultRate: state.globalDefaultRate,
        skipForwardInterval: state.skipForwardInterval,
        skipBackInterval: state.skipBackInterval,
        smartRewindEnabled: state.smartRewindEnabled,
        smartRewindMaxSeconds: state.smartRewindMaxSeconds,
        shakeToExtendEnabled: state.shakeToExtendEnabled,
        snapToChapterEnabled: state.snapToChapterEnabled,
        snapToChapterThreshold: state.snapToChapterThreshold,
      }),
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const selectBookSpeed = (bookId: string) => (state: SettingsStore) =>
  state.bookSpeedMap[bookId] ?? state.globalDefaultRate;

export const selectSkipIntervals = (state: SettingsStore) => ({
  forward: state.skipForwardInterval,
  back: state.skipBackInterval,
});

export const selectSmartRewindSettings = (state: SettingsStore) => ({
  enabled: state.smartRewindEnabled,
  maxSeconds: state.smartRewindMaxSeconds,
});

// =============================================================================
// Hooks for common patterns
// =============================================================================

/**
 * Get playback rate for a specific book.
 * Uses book-specific rate if available, otherwise global default.
 */
export function useBookSpeed(bookId: string | null): number {
  const bookSpeedMap = useSettingsStore((state) => state.bookSpeedMap);
  const globalDefaultRate = useSettingsStore((state) => state.globalDefaultRate);
  return bookId ? bookSpeedMap[bookId] ?? globalDefaultRate : globalDefaultRate;
}

/**
 * Get skip forward interval.
 */
export function useSkipForwardInterval(): number {
  return useSettingsStore((state) => state.skipForwardInterval);
}

/**
 * Get skip back interval.
 */
export function useSkipBackInterval(): number {
  return useSettingsStore((state) => state.skipBackInterval);
}

/**
 * Get smart rewind enabled state.
 */
export function useSmartRewindEnabled(): boolean {
  return useSettingsStore((state) => state.smartRewindEnabled);
}

/**
 * Get smart rewind max seconds.
 */
export function useSmartRewindMaxSeconds(): number {
  return useSettingsStore((state) => state.smartRewindMaxSeconds);
}

/**
 * Get snap-to-chapter enabled state.
 */
export function useSnapToChapterEnabled(): boolean {
  return useSettingsStore((state) => state.snapToChapterEnabled);
}

/**
 * Get snap-to-chapter threshold in seconds.
 */
export function useSnapToChapterThreshold(): number {
  return useSettingsStore((state) => state.snapToChapterThreshold);
}

/**
 * Get snap-to-chapter settings as an object.
 */
export function useSnapToChapterSettings(): { enabled: boolean; threshold: number } {
  const enabled = useSettingsStore((state) => state.snapToChapterEnabled);
  const threshold = useSettingsStore((state) => state.snapToChapterThreshold);
  return { enabled, threshold };
}
