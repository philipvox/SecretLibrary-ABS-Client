/**
 * src/features/player/stores/playerSettingsStore.ts
 *
 * Player UI and behavior settings store.
 * Extracted from playerStore.ts for modularity (Phase 2 refactor).
 *
 * Settings managed:
 * - Control mode (rewind vs chapter skip)
 * - Progress display mode (bar vs chapters)
 * - Skip intervals (forward/back seconds)
 * - Player appearance (disc animation, standard player)
 * - Smart rewind settings
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@/shared/utils/logger';

const log = createLogger('PlayerSettingsStore');

// =============================================================================
// CONSTANTS
// =============================================================================

const CONTROL_MODE_KEY = 'playerControlMode';
const PROGRESS_MODE_KEY = 'playerProgressMode';
const SKIP_FORWARD_INTERVAL_KEY = 'playerSkipForwardInterval';
const SKIP_BACK_INTERVAL_KEY = 'playerSkipBackInterval';
const DISC_ANIMATION_KEY = 'playerDiscAnimation';
const STANDARD_PLAYER_KEY = 'playerStandardMode';
const SMART_REWIND_ENABLED_KEY = 'playerSmartRewindEnabled';
const SMART_REWIND_MAX_SECONDS_KEY = 'playerSmartRewindMaxSeconds';
const BLUETOOTH_AUTO_RESUME_KEY = 'playerBluetoothAutoResume';
const SHOW_TIME_REMAINING_KEY = 'playerShowTimeRemaining';

// =============================================================================
// TYPES
// =============================================================================

export type ControlMode = 'rewind' | 'chapter';
export type ProgressMode = 'bar' | 'chapters';

interface PlayerSettingsState {
  // Control behavior
  controlMode: ControlMode;           // Skip buttons: time skip or chapter skip
  progressMode: ProgressMode;         // Progress display: full book or chapter-based

  // Skip intervals
  skipForwardInterval: number;        // Seconds to skip forward (default 30)
  skipBackInterval: number;           // Seconds to skip back (default 15)

  // Player appearance
  discAnimationEnabled: boolean;      // Whether CD spins during playback (default true)
  useStandardPlayer: boolean;         // Show static cover instead of disc UI (default true)

  // Smart rewind
  smartRewindEnabled: boolean;        // Auto-rewind on resume based on pause duration (default true)
  smartRewindMaxSeconds: number;      // Maximum rewind amount in seconds (default 30)

  // Bluetooth
  bluetoothAutoResume: boolean;       // Resume playback when Bluetooth device connects (default false)

  // Display
  showTimeRemaining: boolean;         // Show remaining time instead of elapsed (default false)
}

interface PlayerSettingsActions {
  // Setters
  setControlMode: (mode: ControlMode) => void;
  setProgressMode: (mode: ProgressMode) => void;
  setSkipForwardInterval: (seconds: number) => Promise<void>;
  setSkipBackInterval: (seconds: number) => Promise<void>;
  setDiscAnimationEnabled: (enabled: boolean) => Promise<void>;
  setUseStandardPlayer: (enabled: boolean) => Promise<void>;
  setSmartRewindEnabled: (enabled: boolean) => Promise<void>;
  setSmartRewindMaxSeconds: (seconds: number) => Promise<void>;
  setBluetoothAutoResume: (enabled: boolean) => Promise<void>;
  setShowTimeRemaining: (enabled: boolean) => Promise<void>;

  // Bulk load
  loadSettings: () => Promise<void>;
}

// =============================================================================
// STORE
// =============================================================================

export const usePlayerSettingsStore = create<PlayerSettingsState & PlayerSettingsActions>()(
  subscribeWithSelector((set) => ({
    // =========================================================================
    // INITIAL STATE
    // =========================================================================

    controlMode: 'rewind',
    progressMode: 'bar',
    skipForwardInterval: 30,
    skipBackInterval: 15,
    discAnimationEnabled: true,
    useStandardPlayer: true,
    smartRewindEnabled: true,
    smartRewindMaxSeconds: 30,
    bluetoothAutoResume: false,
    showTimeRemaining: false,

    // =========================================================================
    // ACTIONS
    // =========================================================================

    setControlMode: (mode: ControlMode) => {
      set({ controlMode: mode });
      AsyncStorage.setItem(CONTROL_MODE_KEY, mode).catch((err) => {
        // Fix Low #4: Log storage errors
        log.debug('Failed to persist controlMode:', err);
      });
    },

    setProgressMode: (mode: ProgressMode) => {
      set({ progressMode: mode });
      AsyncStorage.setItem(PROGRESS_MODE_KEY, mode).catch((err) => {
        // Fix Low #4: Log storage errors
        log.debug('Failed to persist progressMode:', err);
      });
    },

    setSkipForwardInterval: async (seconds: number) => {
      set({ skipForwardInterval: seconds });
      try {
        await AsyncStorage.setItem(SKIP_FORWARD_INTERVAL_KEY, seconds.toString());
      } catch (err) {
        // Fix Low #4: Log storage errors
        log.debug('Failed to persist skipForwardInterval:', err);
      }
    },

    setSkipBackInterval: async (seconds: number) => {
      set({ skipBackInterval: seconds });
      try {
        await AsyncStorage.setItem(SKIP_BACK_INTERVAL_KEY, seconds.toString());
      } catch (err) {
        // Fix Low #4: Log storage errors
        log.debug('Failed to persist skipBackInterval:', err);
      }
    },

    setDiscAnimationEnabled: async (enabled: boolean) => {
      set({ discAnimationEnabled: enabled });
      try {
        await AsyncStorage.setItem(DISC_ANIMATION_KEY, enabled.toString());
      } catch (err) {
        // Fix Low #4: Log storage errors
        log.debug('Failed to persist discAnimationEnabled:', err);
      }
    },

    setUseStandardPlayer: async (enabled: boolean) => {
      set({ useStandardPlayer: enabled });
      try {
        await AsyncStorage.setItem(STANDARD_PLAYER_KEY, enabled.toString());
      } catch (err) {
        // Fix Low #4: Log storage errors
        log.debug('Failed to persist useStandardPlayer:', err);
      }
    },

    setSmartRewindEnabled: async (enabled: boolean) => {
      set({ smartRewindEnabled: enabled });
      try {
        await AsyncStorage.setItem(SMART_REWIND_ENABLED_KEY, enabled.toString());
      } catch (err) {
        // Fix Low #4: Log storage errors
        log.debug('Failed to persist smartRewindEnabled:', err);
      }
    },

    setSmartRewindMaxSeconds: async (seconds: number) => {
      set({ smartRewindMaxSeconds: seconds });
      try {
        await AsyncStorage.setItem(SMART_REWIND_MAX_SECONDS_KEY, seconds.toString());
      } catch (err) {
        // Fix Low #4: Log storage errors
        log.debug('Failed to persist smartRewindMaxSeconds:', err);
      }
    },

    setBluetoothAutoResume: async (enabled: boolean) => {
      set({ bluetoothAutoResume: enabled });
      try {
        await AsyncStorage.setItem(BLUETOOTH_AUTO_RESUME_KEY, enabled.toString());
      } catch (err) {
        log.debug('Failed to persist bluetoothAutoResume:', err);
      }
    },

    setShowTimeRemaining: async (enabled: boolean) => {
      set({ showTimeRemaining: enabled });
      try {
        await AsyncStorage.setItem(SHOW_TIME_REMAINING_KEY, enabled.toString());
      } catch (err) {
        log.debug('Failed to persist showTimeRemaining:', err);
      }
    },

    loadSettings: async () => {
      try {
        const [
          controlMode,
          progressMode,
          skipForwardStr,
          skipBackStr,
          discAnimationStr,
          standardPlayerStr,
          smartRewindEnabledStr,
          smartRewindMaxSecondsStr,
          bluetoothAutoResumeStr,
          showTimeRemainingStr,
        ] = await Promise.all([
          AsyncStorage.getItem(CONTROL_MODE_KEY),
          AsyncStorage.getItem(PROGRESS_MODE_KEY),
          AsyncStorage.getItem(SKIP_FORWARD_INTERVAL_KEY),
          AsyncStorage.getItem(SKIP_BACK_INTERVAL_KEY),
          AsyncStorage.getItem(DISC_ANIMATION_KEY),
          AsyncStorage.getItem(STANDARD_PLAYER_KEY),
          AsyncStorage.getItem(SMART_REWIND_ENABLED_KEY),
          AsyncStorage.getItem(SMART_REWIND_MAX_SECONDS_KEY),
          AsyncStorage.getItem(BLUETOOTH_AUTO_RESUME_KEY),
          AsyncStorage.getItem(SHOW_TIME_REMAINING_KEY),
        ]);

        const skipForwardInterval = skipForwardStr ? parseInt(skipForwardStr, 10) : 30;
        const skipBackInterval = skipBackStr ? parseInt(skipBackStr, 10) : 15;
        const discAnimationEnabled = discAnimationStr !== 'false'; // Default true
        const useStandardPlayer = standardPlayerStr !== 'false'; // Default true
        const smartRewindEnabled = smartRewindEnabledStr !== 'false'; // Default true
        const smartRewindMaxSeconds = smartRewindMaxSecondsStr ? parseInt(smartRewindMaxSecondsStr, 10) : 30;
        const bluetoothAutoResume = bluetoothAutoResumeStr === 'true'; // Default false
        const showTimeRemaining = showTimeRemainingStr === 'true'; // Default false

        set({
          controlMode: (controlMode as ControlMode) || 'rewind',
          progressMode: (progressMode as ProgressMode) || 'bar',
          skipForwardInterval,
          skipBackInterval,
          discAnimationEnabled,
          useStandardPlayer,
          smartRewindEnabled,
          smartRewindMaxSeconds,
          bluetoothAutoResume,
          showTimeRemaining,
        });
      } catch (error) {
        // Use defaults on error
      }
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get current control mode setting
 */
export const useControlMode = () => usePlayerSettingsStore((s) => s.controlMode);

/**
 * Get current progress mode setting
 */
export const useProgressMode = () => usePlayerSettingsStore((s) => s.progressMode);

/**
 * Get skip intervals
 */
export const useSkipIntervals = () =>
  usePlayerSettingsStore((s) => ({
    forward: s.skipForwardInterval,
    back: s.skipBackInterval,
  }));

/**
 * Get player appearance settings
 */
export const usePlayerAppearance = () =>
  usePlayerSettingsStore((s) => ({
    discAnimationEnabled: s.discAnimationEnabled,
    useStandardPlayer: s.useStandardPlayer,
  }));

/**
 * Get smart rewind settings
 */
export const useSmartRewindSettings = () =>
  usePlayerSettingsStore((s) => ({
    enabled: s.smartRewindEnabled,
    maxSeconds: s.smartRewindMaxSeconds,
  }));
