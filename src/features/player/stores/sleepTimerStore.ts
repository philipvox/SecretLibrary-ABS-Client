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
import { createLogger } from '@/shared/utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const SHAKE_TO_EXTEND_KEY = 'playerShakeToExtend';
const SLEEP_TIMER_SHAKE_THRESHOLD = 60; // Start shake detection when < 60 seconds remaining
const SLEEP_TIMER_EXTEND_MINUTES = 15;  // Add 15 minutes on shake

// Fix HIGH: Track timer ID to prevent race conditions when timer expires while being cleared
let currentTimerId = 0;

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

const log = createLogger('SleepTimerStore');

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
      const { sleepTimerInterval, _shakeToExtendEnabled } = get();

      // Fix MEDIUM: Validate timer duration
      if (!Number.isFinite(minutes) || minutes <= 0) {
        log.warn(`[SleepTimer] Invalid duration: ${minutes} minutes`);
        return;
      }

      // Fix HIGH: Increment timer ID to invalidate any in-progress timer callbacks
      const timerId = ++currentTimerId;

      // Import shake detector lazily to avoid circular deps
      import('../services/shakeDetector').then(({ shakeDetector }) => {
        // Stop any existing shake detection
        shakeDetector.stop();
        set({ isShakeDetectionActive: false });
      }).catch((err) => {
        log.warn('[SleepTimer] Shake detector stop error:', err);
      });

      if (sleepTimerInterval) {
        clearInterval(sleepTimerInterval);
      }

      // Set initial timer value
      const initialSeconds = Math.floor(minutes * 60); // Ensure integer seconds
      set({ sleepTimer: initialSeconds });

      // Track last remaining for warning detection
      let lastRemaining = initialSeconds;

      // IMPORTANT: Use state-based countdown, not fixed endTime
      // This allows extendSleepTimer to work correctly by updating state
      const interval = setInterval(async () => {
        try {
          // Fix HIGH: Check if this timer is still the active one (prevents race condition)
          if (timerId !== currentTimerId) {
            clearInterval(interval);
            log.debug(`[SleepTimer] Timer ${timerId} superseded by ${currentTimerId}, stopping`);
            return;
          }

          // Read current timer value from state (allows extensions to work)
          const currentTimer = get().sleepTimer;
          if (currentTimer === null) {
            clearInterval(interval);
            return;
          }

          // Decrement by 1 second
          const remaining = Math.max(0, currentTimer - 1);

          if (remaining <= 0) {
            clearInterval(interval);

            // Fix HIGH: Double-check timer ID before expiration actions (race condition guard)
            if (timerId !== currentTimerId) {
              log.debug(`[SleepTimer] Timer ${timerId} was cleared before expiration`);
              return;
            }

            log.debug('Sleep timer expired - calling onExpire callback');

            // Haptic feedback for timer expiration
            haptics.sleepTimerExpired();

            // Call the onExpire callback (e.g., pause playback)
            try {
              onExpire();
            } catch (err) {
              log.warn('[SleepTimer] onExpire callback error:', err);
            }

            // Stop shake detection
            try {
              const { shakeDetector } = await import('../services/shakeDetector');
              shakeDetector.stop();
            } catch (err) {
              log.warn('[SleepTimer] Shake detector stop error:', err);
            }

            // Always clean up timer state even if callbacks failed
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
                log.debug('Shake detection started - timer low');
              } catch (err) {
                log.error('Failed to start shake detection:', err);
              }
            }
          }
        } catch (err) {
          // Catch-all: prevent interval from dying on any unhandled error
          log.error('[SleepTimer] Interval error:', err);
        }
      }, 1000);

      set({ sleepTimerInterval: interval });
    },

    extendSleepTimer: (minutes: number) => {
      const { sleepTimer, sleepTimerInterval } = get();

      if (!sleepTimer || !sleepTimerInterval) {
        log.debug('extendSleepTimer: No active timer');
        return;
      }

      // Add time to current remaining
      const newRemaining = sleepTimer + (minutes * 60);
      log.debug(`Sleep timer extended by ${minutes} minutes. New remaining: ${newRemaining}s`);

      // Haptic feedback for extension
      haptics.sleepTimerWarning();

      // Stop shake detection after extension (will restart when < 60s again)
      import('../services/shakeDetector').then(({ shakeDetector }) => {
        shakeDetector.stop();
        set({ isShakeDetectionActive: false });
      }).catch((err) => {
        log.warn('[SleepTimer] Shake detector stop error:', err);
      });

      // Update the timer - the interval will continue with the new value
      set({ sleepTimer: newRemaining });
    },

    clearSleepTimer: () => {
      const { sleepTimerInterval } = get();

      // Fix HIGH: Increment timer ID to invalidate any in-progress callbacks
      currentTimerId++;

      if (sleepTimerInterval) {
        clearInterval(sleepTimerInterval);
      }

      // Stop shake detection
      import('../services/shakeDetector').then(({ shakeDetector }) => {
        shakeDetector.stop();
      }).catch((err) => {
        log.warn('[SleepTimer] Shake detector stop error:', err);
      });

      set({ sleepTimer: null, sleepTimerInterval: null, isShakeDetectionActive: false });
    },

    setShakeToExtendEnabled: async (enabled: boolean) => {
      set({ shakeToExtendEnabled: enabled });
      try {
        await AsyncStorage.setItem(SHAKE_TO_EXTEND_KEY, enabled.toString());
      } catch (err) {
        // Fix Low #1: Log storage errors
        log.debug('Failed to persist shake-to-extend setting:', err);
      }

      // If disabling while detection is active, stop it
      if (!enabled) {
        try {
          const { shakeDetector } = await import('../services/shakeDetector');
          shakeDetector.stop();
          set({ isShakeDetectionActive: false });
        } catch (err) {
          // Fix Low #1: Log import/stop errors
          log.debug('Failed to stop shake detector:', err);
        }
      }
    },

    loadShakeToExtendSetting: async () => {
      try {
        const value = await AsyncStorage.getItem(SHAKE_TO_EXTEND_KEY);
        const enabled = value !== 'false'; // Default true
        set({ shakeToExtendEnabled: enabled });
      } catch (err) {
        // Fix Low #1: Log but use default
        log.debug('Failed to load shake-to-extend setting, using default:', err);
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
