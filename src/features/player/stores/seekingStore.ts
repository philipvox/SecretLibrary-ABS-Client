/**
 * src/features/player/stores/seekingStore.ts
 *
 * Seeking state and operations store.
 * Extracted from playerStore.ts for modularity (Phase 7 refactor).
 *
 * CRITICAL: This store manages the isSeeking flag which is checked by playerStore
 * to block position updates from audioService during seeking operations.
 *
 * Features:
 * - Seeking state (isSeeking, seekPosition, seekStartPosition, seekDirection)
 * - Basic seek operations (startSeeking, updateSeekPosition, commitSeek, cancelSeek)
 * - Instant seek (seekTo)
 * - Continuous seeking for rewind/FF buttons
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { audioService } from '@/features/player/services/audioService';
import { backgroundSyncService } from '@/features/player/services/backgroundSyncService';
import { REWIND_STEP, REWIND_INTERVAL, FF_STEP } from '../constants';
import { clampPosition } from '../utils/progressCalculator';
import { createLogger } from '@/shared/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export type SeekDirection = 'backward' | 'forward';

interface SeekingState {
  isSeeking: boolean;
  seekPosition: number;        // Position during seek (UI displays this)
  seekStartPosition: number;   // Where seek started (for delta display)
  seekDirection: SeekDirection | null;
  lastSeekTime: number | null; // Timestamp of last seek completion (for debouncing progress saves)
}

interface SeekingActions {
  /**
   * Start a seek operation. Blocks position updates from audioService.
   * @param position - Current position to start from
   * @param direction - Optional seek direction for UI
   */
  startSeeking: (position: number, direction?: SeekDirection) => void;

  /**
   * Update seek position during drag/hold. Updates seekPosition and
   * sends seek command to audio service.
   * @param position - New position
   * @param duration - Book duration (for clamping)
   */
  updateSeekPosition: (position: number, duration: number) => Promise<void>;

  /**
   * Finalize seek operation. Commits seekPosition to audio service and
   * exits seeking mode.
   */
  commitSeek: () => Promise<void>;

  /**
   * Cancel seek without committing. Returns to original position.
   */
  cancelSeek: () => Promise<void>;

  /**
   * Convenience: instant seek (start + update + commit in one call).
   * Use this for tap-to-seek or chapter jumps.
   * @param position - Target position
   * @param duration - Book duration (for clamping)
   * @param bookId - Optional book ID for local progress save
   * @returns The clamped position that was sought to
   */
  seekTo: (position: number, duration: number, bookId?: string) => Promise<number>;

  /**
   * Start continuous seek in direction. Automatically increments/decrements
   * seekPosition on interval until stopContinuousSeeking is called.
   * @param direction - 'forward' or 'backward'
   * @param position - Current position
   * @param duration - Book duration
   * @param onPause - Callback to pause playback
   */
  startContinuousSeeking: (
    direction: SeekDirection,
    position: number,
    duration: number,
    onPause: () => Promise<void>
  ) => Promise<void>;

  /**
   * Stop continuous seek and commit final position.
   */
  stopContinuousSeeking: () => Promise<void>;

  /**
   * Clear the seek interval (for cleanup)
   */
  clearSeekInterval: () => void;

  /**
   * Reset seeking state to defaults (for cleanup/book switch)
   */
  resetSeekingState: () => void;
}

// =============================================================================
// LOGGING
// =============================================================================

const log = createLogger('SeekingStore');

// =============================================================================
// MODULE-LEVEL STATE
// =============================================================================

let seekInterval: NodeJS.Timeout | null = null;
// Fix MEDIUM: Track if an interval callback is in progress to prevent overlapping
let seekIntervalInProgress = false;
// Safety timeout: auto-reset isSeeking if stuck for more than 10 seconds
let seekingSafetyTimeout: NodeJS.Timeout | null = null;
const MAX_SEEKING_DURATION_MS = 10000;

// =============================================================================
// STORE
// =============================================================================

export const useSeekingStore = create<SeekingState & SeekingActions>()(
  subscribeWithSelector((set, get) => ({
    // =========================================================================
    // INITIAL STATE
    // =========================================================================

    isSeeking: false,
    seekPosition: 0,
    seekStartPosition: 0,
    seekDirection: null,
    lastSeekTime: null,

    // =========================================================================
    // ACTIONS
    // =========================================================================

    startSeeking: (position: number, direction?: SeekDirection) => {
      log.debug(`startSeeking: position=${position.toFixed(1)}, direction=${direction || 'none'}`);

      // Safety: auto-reset if seeking gets stuck (prevents blocking all position updates)
      if (seekingSafetyTimeout) clearTimeout(seekingSafetyTimeout);
      seekingSafetyTimeout = setTimeout(() => {
        if (get().isSeeking) {
          log.warn('Seeking stuck for >10s — auto-resetting');
          get().resetSeekingState();
        }
        seekingSafetyTimeout = null;
      }, MAX_SEEKING_DURATION_MS);

      set({
        isSeeking: true,
        seekPosition: position,
        seekStartPosition: position,
        seekDirection: direction || null,
      });
    },

    updateSeekPosition: async (newPosition: number, duration: number) => {
      const { isSeeking } = get();

      if (!isSeeking) {
        log.debug('updateSeekPosition called but not seeking - calling startSeeking first');
        get().startSeeking(newPosition);
      }

      const clampedPosition = Math.max(0, Math.min(duration, newPosition));
      set({ seekPosition: clampedPosition });

      // Send seek command to audio service
      await audioService.seekTo(clampedPosition);
    },

    commitSeek: async () => {
      const { seekPosition, isSeeking } = get();

      if (!isSeeking) {
        log.debug('commitSeek called but not seeking - ignoring');
        return;
      }

      log.debug(`commitSeek: finalPosition=${seekPosition.toFixed(1)}`);

      // Clear safety timeout
      if (seekingSafetyTimeout) { clearTimeout(seekingSafetyTimeout); seekingSafetyTimeout = null; }

      // Ensure audio is at final position - audioService owns position
      await audioService.seekTo(seekPosition);

      // Exit seeking mode (position will be synced via audioService callback)
      set({
        isSeeking: false,
        seekDirection: null,
        lastSeekTime: Date.now(),
      });
    },

    cancelSeek: async () => {
      const { seekStartPosition, isSeeking } = get();

      if (!isSeeking) {
        log.debug('cancelSeek called but not seeking - ignoring');
        return;
      }

      log.debug(`cancelSeek: returning to ${seekStartPosition.toFixed(1)}`);

      // Clear safety timeout
      if (seekingSafetyTimeout) { clearTimeout(seekingSafetyTimeout); seekingSafetyTimeout = null; }

      // Return to original position - audioService owns position
      await audioService.seekTo(seekStartPosition);

      // Exit seeking mode (position will be synced via audioService callback)
      set({
        isSeeking: false,
        seekDirection: null,
        lastSeekTime: Date.now(),
      });
    },

    seekTo: async (position: number, duration: number, bookId?: string) => {
      const clampedPos = clampPosition(position, duration);

      log.debug(`seekTo: ${clampedPos.toFixed(1)}`);

      // Fix: Clear safety timeout from any prior startSeeking call to prevent interference
      if (seekingSafetyTimeout) { clearTimeout(seekingSafetyTimeout); seekingSafetyTimeout = null; }

      // CRITICAL: Set isSeeking BEFORE the seek so the 100ms polling in playerStore
      // doesn't overwrite position/isPlaying with stale native values during the seek window.
      // Without this, skipForward/skipBackward/jumpToChapter cause a glitch where the
      // native player briefly reports the OLD position and isPlaying=false, which gets
      // pushed to the UI causing a play-stop-play stutter.
      set({
        isSeeking: true,
        seekPosition: clampedPos,
      });

      // AWAIT seek to prevent race condition where playback continues
      // while seeking is still in progress (caused skip back bug)
      await audioService.seekTo(clampedPos).catch((err) => {
        log.warn(`seekTo failed: ${err}`);
      });

      // Save position locally only - server sync happens on pause
      if (bookId) {
        backgroundSyncService.saveProgressLocal(
          bookId,
          clampedPos,
          duration
        ).catch(() => {});
      }

      // Fix: Update playerStore's position to the clamped value before clearing isSeeking
      // This prevents the next playback state callback from flashing the old position
      const { usePlayerStore } = require('./playerStore');
      usePlayerStore.setState({ position: clampedPos });

      // Clear isSeeking and record seek time
      set({
        isSeeking: false,
        lastSeekTime: Date.now(),
      });

      // Return the clamped position for callers that need it
      return clampedPos;
    },

    startContinuousSeeking: async (
      direction: SeekDirection,
      position: number,
      duration: number,
      onPause: () => Promise<void>
    ) => {
      log.debug(`startContinuousSeeking: direction=${direction}, position=${position.toFixed(1)}`);

      // Clear any existing interval
      if (seekInterval) {
        clearInterval(seekInterval);
        seekInterval = null;
      }

      // Pause playback during continuous seek
      await onPause();

      // Enter seeking mode
      set({
        isSeeking: true,
        seekPosition: position,
        seekStartPosition: position,
        seekDirection: direction,
      });

      const step = direction === 'backward' ? -REWIND_STEP : FF_STEP;

      // Immediate first step
      const firstNewPosition = Math.max(0, Math.min(duration, position + step));
      set({ seekPosition: firstNewPosition });
      await audioService.seekTo(firstNewPosition).catch(err => {
        log.warn('Continuous seek initial step failed:', err);
      });

      // Start interval
      // Fix MEDIUM: Reset in-progress flag
      seekIntervalInProgress = false;

      seekInterval = setInterval(async () => {
        // Fix MEDIUM: Prevent overlapping interval callbacks
        if (seekIntervalInProgress) {
          log.debug('Skipping interval - previous callback still in progress');
          return;
        }
        seekIntervalInProgress = true;

        try {
          const state = get();

          if (!state.isSeeking) {
            // Seeking was stopped externally
            if (seekInterval) {
              clearInterval(seekInterval);
              seekInterval = null;
            }
            return;
          }

          // Fix: Read duration from playerStore inside interval to avoid stale closure
          const { usePlayerStore } = require('./playerStore');
          const currentDuration = usePlayerStore.getState().duration;
          const newPosition = Math.max(0, Math.min(currentDuration, state.seekPosition + step));

          // Stop at boundaries
          if ((direction === 'backward' && newPosition <= 0) ||
              (direction === 'forward' && newPosition >= currentDuration)) {
            set({ seekPosition: newPosition });
            await audioService.seekTo(newPosition).catch(err => {
              log.warn('Continuous seek boundary step failed:', err);
            });
            await get().stopContinuousSeeking();
            return;
          }

          // Fix MEDIUM: Set position AFTER successful seek to prevent state inconsistency
          await audioService.seekTo(newPosition).catch(err => {
            log.warn('Continuous seek step failed:', err);
            // Stop seeking on repeated errors to prevent stuck UI
            if (seekInterval) {
              clearInterval(seekInterval);
              seekInterval = null;
            }
            set({ isSeeking: false, seekDirection: null, lastSeekTime: Date.now() });
          });
          // Fix: Guard against state update after error handler reset isSeeking
          if (get().isSeeking) {
            set({ seekPosition: newPosition });
          }
        } finally {
          seekIntervalInProgress = false;
        }
      }, REWIND_INTERVAL);
    },

    stopContinuousSeeking: async () => {
      log.debug('stopContinuousSeeking');

      // Clear interval
      if (seekInterval) {
        clearInterval(seekInterval);
        seekInterval = null;
      }

      // Commit final position
      await get().commitSeek();
    },

    clearSeekInterval: () => {
      if (seekInterval) {
        clearInterval(seekInterval);
        seekInterval = null;
      }
      // Fix MEDIUM: Reset in-progress flag
      seekIntervalInProgress = false;
    },

    resetSeekingState: () => {
      // Clear interval first
      if (seekInterval) {
        clearInterval(seekInterval);
        seekInterval = null;
      }
      // Fix MEDIUM: Reset in-progress flag
      seekIntervalInProgress = false;
      // Clear safety timeout
      if (seekingSafetyTimeout) { clearTimeout(seekingSafetyTimeout); seekingSafetyTimeout = null; }

      set({
        isSeeking: false,
        seekPosition: 0,
        seekStartPosition: 0,
        seekDirection: null,
        lastSeekTime: null,
      });
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Returns whether the user is currently seeking (for UI state and position blocking).
 */
export const useIsSeeking = () => useSeekingStore((s) => s.isSeeking);

/**
 * Returns the seek position (position during seek operation).
 */
export const useSeekPosition = () => useSeekingStore((s) => s.seekPosition);

/**
 * Returns the seek start position (for delta calculation).
 */
export const useSeekStartPosition = () => useSeekingStore((s) => s.seekStartPosition);

/**
 * Returns the seek direction if seeking, null otherwise.
 */
export const useSeekDirection = () => useSeekingStore((s) => s.seekDirection);

/**
 * Returns the seek delta (difference from start position during seek).
 * Returns 0 when not seeking.
 */
export const useSeekDelta = () =>
  useSeekingStore((s) => s.isSeeking ? s.seekPosition - s.seekStartPosition : 0);

/**
 * Get full seeking state for display
 * Uses useShallow to prevent unnecessary re-renders when object reference changes
 */
export const useSeekingState = () =>
  useSeekingStore(
    useShallow((s) => ({
      isSeeking: s.isSeeking,
      seekPosition: s.seekPosition,
      seekStartPosition: s.seekStartPosition,
      seekDirection: s.seekDirection,
    }))
  );
