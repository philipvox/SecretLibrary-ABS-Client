/**
 * src/features/profile/stores/hapticSettingsStore.ts
 *
 * Store for haptic feedback preferences.
 * Allows users to customize which haptic feedback categories are enabled.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export interface HapticSettings {
  /** Master toggle - disables all haptics when false */
  enabled: boolean;
  /** Play/pause, skip forward/back */
  playbackControls: boolean;
  /** Timeline scrubbing, chapter detents */
  scrubberFeedback: boolean;
  /** Speed changes */
  speedControl: boolean;
  /** Timer set/warning/expiration */
  sleepTimer: boolean;
  /** Download start/complete */
  downloads: boolean;
  /** Bookmark create/delete/jump */
  bookmarks: boolean;
  /** Book/series completion celebrations */
  completions: boolean;
  /** Generic buttons, toggles, long press */
  uiInteractions: boolean;
}

interface HapticSettingsState extends HapticSettings {
  // Actions
  setEnabled: (enabled: boolean) => void;
  setPlaybackControls: (enabled: boolean) => void;
  setScrubberFeedback: (enabled: boolean) => void;
  setSpeedControl: (enabled: boolean) => void;
  setSleepTimer: (enabled: boolean) => void;
  setDownloads: (enabled: boolean) => void;
  setBookmarks: (enabled: boolean) => void;
  setCompletions: (enabled: boolean) => void;
  setUiInteractions: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default settings - all enabled by default */
const DEFAULT_SETTINGS: HapticSettings = {
  enabled: true,
  playbackControls: true,
  scrubberFeedback: true,
  speedControl: true,
  sleepTimer: true,
  downloads: true,
  bookmarks: true,
  completions: true,
  uiInteractions: true,
};

// ============================================================================
// STORE
// ============================================================================

export const useHapticSettingsStore = create<HapticSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setEnabled: (enabled) => set({ enabled }),
      setPlaybackControls: (playbackControls) => set({ playbackControls }),
      setScrubberFeedback: (scrubberFeedback) => set({ scrubberFeedback }),
      setSpeedControl: (speedControl) => set({ speedControl }),
      setSleepTimer: (sleepTimer) => set({ sleepTimer }),
      setDownloads: (downloads) => set({ downloads }),
      setBookmarks: (bookmarks) => set({ bookmarks }),
      setCompletions: (completions) => set({ completions }),
      setUiInteractions: (uiInteractions) => set({ uiInteractions }),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'haptic-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Get all settings as a plain object */
export const useHapticSettings = () =>
  useHapticSettingsStore(
    useShallow((s) => ({
      enabled: s.enabled,
      playbackControls: s.playbackControls,
      scrubberFeedback: s.scrubberFeedback,
      speedControl: s.speedControl,
      sleepTimer: s.sleepTimer,
      downloads: s.downloads,
      bookmarks: s.bookmarks,
      completions: s.completions,
      uiInteractions: s.uiInteractions,
    }))
  );

/** Check if a specific category is enabled (respects master toggle) */
export function isHapticEnabled(category: keyof Omit<HapticSettings, 'enabled'>): boolean {
  const state = useHapticSettingsStore.getState();
  return state.enabled && state[category];
}

/** Get master enabled state (for use outside React components) */
export function getHapticEnabled(): boolean {
  return useHapticSettingsStore.getState().enabled;
}
