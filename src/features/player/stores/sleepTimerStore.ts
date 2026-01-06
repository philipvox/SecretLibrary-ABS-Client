/**
 * src/features/player/stores/sleepTimerStore.ts
 *
 * Sleep timer store for audiobook playback.
 * Extracted from playerStore.ts for modularity (Phase 4 refactor).
 *
 * Features:
 * - Countdown timer that pauses playback when expired
 * - Shake-to-extend functionality when timer is low
 * - Haptic feedback at 60s warning and expiration
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptics } from '@/core/native/haptics';

// =============================================================================
// CONSTANTS
// =============================================================================

const SHAKE_TO_EXTEND_KEY = 'playerShakeToExtend';
const SLEEP_TIMER_SHAKE_THRESHOLD = 60; // Start shake detection when < 60 seconds remaining
const SLEEP_TIMER_EXTEND_MINUTES = 15;  // Add 15 minutes on shake

// =============================================================================
// TYPES
// =============================================================================

interface SleepTimerState {
  sleepTimer: number | null;            // Remaining seconds (null = no timer)
  sleepTimerInterval: NodeJS.Timeout | null;
  shakeToExtendEnabled: boolean;        // User preference
  isShakeDetectionActive: boolean;      // Currently listening for shakes
}

interface SleepTimerActions {
  /**
   * Set and start the sleep timer
   * @param minutes - Duration in minutes
   * @param onExpire - Callback when timer expires (e.g., pause playback)
   */
  setSleepTimer: (minutes: number, onExpire: () => void) => void;

  /**
   * Extend the current timer by additional minutes
   */
  extendSleepTimer: (minutes: number) => void;

  /**
   * Clear and stop the sleep timer
   */
  clearSleepTimer: () => void;

  /**
   * Toggle shake-to-extend feature
   */
  setShakeToExtendEnabled: (enabled: boolean) => Promise<void>;

  /**
   * Load shake-to-extend setting from storage
   */
  loadShakeToExtendSetting: () => Promise<void>;
}

// =============================================================================
// LOGGING
// =============================================================================

const DEBUG = __DEV__;
const log = (msg: string, ...args: any[]) => {
  if (DEBUG) console.log(`[SleepTimerStore] ${msg}`, ...args);
};
const logError = (msg: string, ...args: any[]) => {
  console.error(`[SleepTimerStore] ${msg}`, ...args);
};

// =============================================================================
// STORE
// =============================================================================

export const useSleepTimerStore = create<SleepTimerState & SleepTimerActions>()(
  subscribeWithSelector((set, get) => ({
    // =========================================================================
    // INITIAL STATE
    // =========================================================================

    sleepTimer: null,
    sleepTimerInterval: null,
    shakeToExtendEnabled: true, // Default enabled
    isShakeDetectionActive: false,

    // =========================================================================
    // ACTIONS
    // =========================================================================

    setSleepTimer: (minutes: number, onExpire: () => void) => {
      const { sleepTimerInterval, shakeToExtendEnabled } = get();

      // Import shake detector lazily to avoid circular deps
      import('../services/shakeDetector').then(({ shakeDetector }) => {
        // Stop any existing shake detection
        shakeDetector.stop();
        set({ isShakeDetectionActive: false });
      }).catch(() => {});

      if (sleepTimerInterval) {
        clearInterval(sleepTimerInterval);
      }

      let endTime = Date.now() + minutes * 60 * 1000;

      // Track last remaining for warning detection
      let lastRemaining = minutes * 60;

      const interval = setInterval(async () => {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

        if (remaining <= 0) {
          clearInterval(interval);

          // Haptic feedback for timer expiration
          haptics.sleepTimerExpired();

          // Call the onExpire callback (e.g., pause playback)
          onExpire();

          // Stop shake detection
          try {
            const { shakeDetector } = await import('../services/shakeDetector');
            shakeDetector.stop();
          } catch {}

          set({ sleepTimer: null, sleepTimerInterval: null, isShakeDetectionActive: false });
        } else {
          // Trigger warning haptic when crossing 60 second threshold
          if (lastRemaining > 60 && remaining <= 60) {
            haptics.sleepTimerWarning();
          }
          lastRemaining = remaining;

          set({ sleepTimer: remaining });

          // Start shake detection when timer is low and feature is enabled
          const { shakeToExtendEnabled: enabled, isShakeDetectionActive } = get();
          if (enabled && remaining <= SLEEP_TIMER_SHAKE_THRESHOLD && !isShakeDetectionActive) {
            try {
              const { shakeDetector } = await import('../services/shakeDetector');
              shakeDetector.start(() => {
                // On shake, extend the timer
                get().extendSleepTimer(SLEEP_TIMER_EXTEND_MINUTES);
              });
              set({ isShakeDetectionActive: true });
              log('Shake detection started - timer low');
            } catch (err) {
              logError('Failed to start shake detection:', err);
            }
          }
        }
      }, 1000);

      set({ sleepTimer: minutes * 60, sleepTimerInterval: interval });
    },

    extendSleepTimer: (minutes: number) => {
      const { sleepTimer, sleepTimerInterval } = get();

      if (!sleepTimer || !sleepTimerInterval) {
        log('extendSleepTimer: No active timer');
        return;
      }

      // Add time to current remaining
      const newRemaining = sleepTimer + (minutes * 60);
      log(`Sleep timer extended by ${minutes} minutes. New remaining: ${newRemaining}s`);

      // Haptic feedback for extension
      haptics.sleepTimerWarning();

      // Stop shake detection after extension (will restart when < 60s again)
      import('../services/shakeDetector').then(({ shakeDetector }) => {
        shakeDetector.stop();
        set({ isShakeDetectionActive: false });
      }).catch(() => {});

      // Update the timer - the interval will continue with the new value
      set({ sleepTimer: newRemaining });
    },

    clearSleepTimer: () => {
      const { sleepTimerInterval } = get();
      if (sleepTimerInterval) {
        clearInterval(sleepTimerInterval);
      }

      // Stop shake detection
      import('../services/shakeDetector').then(({ shakeDetector }) => {
        shakeDetector.stop();
      }).catch(() => {});

      set({ sleepTimer: null, sleepTimerInterval: null, isShakeDetectionActive: false });
    },

    setShakeToExtendEnabled: async (enabled: boolean) => {
      set({ shakeToExtendEnabled: enabled });
      try {
        await AsyncStorage.setItem(SHAKE_TO_EXTEND_KEY, enabled.toString());
      } catch {}

      // If disabling while detection is active, stop it
      if (!enabled) {
        try {
          const { shakeDetector } = await import('../services/shakeDetector');
          shakeDetector.stop();
          set({ isShakeDetectionActive: false });
        } catch {}
      }
    },

    loadShakeToExtendSetting: async () => {
      try {
        const value = await AsyncStorage.getItem(SHAKE_TO_EXTEND_KEY);
        const enabled = value !== 'false'; // Default true
        set({ shakeToExtendEnabled: enabled });
      } catch {
        // Use default
      }
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get remaining sleep timer seconds (null if no timer)
 */
export const useSleepTimer = () => useSleepTimerStore((s) => s.sleepTimer);

/**
 * Check if sleep timer is active
 */
export const useIsSleepTimerActive = () => useSleepTimerStore((s) => s.sleepTimer !== null);

/**
 * Get shake-to-extend enabled status
 */
export const useShakeToExtendEnabled = () => useSleepTimerStore((s) => s.shakeToExtendEnabled);

/**
 * Check if shake detection is currently active
 */
export const useIsShakeDetectionActive = () => useSleepTimerStore((s) => s.isShakeDetectionActive);

/**
 * Get full sleep timer state for display
 * Uses useShallow to prevent unnecessary re-renders when object reference changes
 */
export const useSleepTimerState = () =>
  useSleepTimerStore(
    useShallow((s) => ({
      sleepTimer: s.sleepTimer,
      isActive: s.sleepTimer !== null,
      shakeToExtendEnabled: s.shakeToExtendEnabled,
      isShakeDetectionActive: s.isShakeDetectionActive,
    }))
  );
