/**
 * src/features/player/stores/speedStore.ts
 *
 * Playback speed management store.
 * Extracted from playerStore.ts for modularity (Phase 5 refactor).
 *
 * Features:
 * - Per-book speed memory (remembers speed for each book)
 * - Global default speed for new books
 * - Active playback rate persistence for app restart
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import audioService for applying rate changes
import { audioService } from '@/features/player/services/audioService';
import { createLogger } from '@/shared/utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const BOOK_SPEED_MAP_KEY = 'playerBookSpeedMap';
const GLOBAL_DEFAULT_RATE_KEY = 'playerGlobalDefaultRate';
const ACTIVE_PLAYBACK_RATE_KEY = 'playerActivePlaybackRate';
const SPEED_PRESETS_KEY = 'playerSpeedPresets';

// =============================================================================
// TYPES
// =============================================================================

interface SpeedState {
  playbackRate: number;                  // Current playback rate
  bookSpeedMap: Record<string, number>;  // bookId → playback speed
  globalDefaultRate: number;             // Default speed for new books
  speedPresets: number[];                // User-saved speed presets
}

interface SpeedActions {
  /**
   * Set playback rate and persist for current book
   * @param rate - The playback rate (e.g., 1.0, 1.5, 2.0)
   * @param bookId - Optional book ID to save per-book speed
   */
  setPlaybackRate: (rate: number, bookId?: string) => Promise<void>;

  /**
   * Set the global default rate for new books
   */
  setGlobalDefaultRate: (rate: number) => Promise<void>;

  /**
   * Get speed for a specific book (returns book speed or global default)
   */
  getBookSpeed: (bookId: string) => number;

  /**
   * Apply a book's speed when loading it
   * Returns the rate that was applied
   */
  applyBookSpeed: (bookId: string) => Promise<number>;

  /**
   * Load speed settings from storage
   */
  loadSpeedSettings: () => Promise<void>;

  /**
   * Save current speed as a preset
   */
  saveSpeedPreset: (speed: number) => Promise<void>;

  /**
   * Remove a speed preset
   */
  removeSpeedPreset: (speed: number) => Promise<void>;
}

// =============================================================================
// LOGGING
// =============================================================================

const log = createLogger('SpeedStore');

// =============================================================================
// STORE
// =============================================================================

export const useSpeedStore = create<SpeedState & SpeedActions>()(
  subscribeWithSelector((set, get) => ({
    // =========================================================================
    // INITIAL STATE
    // =========================================================================

    playbackRate: 1.0,
    bookSpeedMap: {},
    globalDefaultRate: 1.0,
    speedPresets: [],

    // =========================================================================
    // ACTIONS
    // =========================================================================

    setPlaybackRate: async (rate: number, bookId?: string) => {
      const { bookSpeedMap } = get();

      log.debug(`setPlaybackRate: rate=${rate}, bookId=${bookId || 'none'}`);

      // Apply rate to audio service
      await audioService.setPlaybackRate(rate);
      set({ playbackRate: rate });

      // Always persist the active playback rate for app restart recovery
      try {
        await AsyncStorage.setItem(ACTIVE_PLAYBACK_RATE_KEY, rate.toString());
      } catch {}

      // Save per-book speed if a book ID is provided
      if (bookId) {
        const updatedMap = { ...bookSpeedMap, [bookId]: rate };
        set({ bookSpeedMap: updatedMap });
        log.debug(`Saved per-book speed: ${bookId} → ${rate}x (map has ${Object.keys(updatedMap).length} entries)`);

        try {
          await AsyncStorage.setItem(BOOK_SPEED_MAP_KEY, JSON.stringify(updatedMap));
        } catch (err) {
          log.warn('Error saving bookSpeedMap:', err);
        }
      } else {
        log.debug('No bookId provided - per-book speed NOT saved');
      }
    },

    setGlobalDefaultRate: async (rate: number) => {
      set({ globalDefaultRate: rate });
      try {
        await AsyncStorage.setItem(GLOBAL_DEFAULT_RATE_KEY, rate.toString());
      } catch {}
    },

    getBookSpeed: (bookId: string) => {
      const { bookSpeedMap, globalDefaultRate } = get();
      const savedSpeed = bookSpeedMap[bookId];
      const resultSpeed = savedSpeed ?? globalDefaultRate;
      log.debug(`getBookSpeed: bookId=${bookId}, saved=${savedSpeed ?? 'none'}, default=${globalDefaultRate}, result=${resultSpeed}`);
      return resultSpeed;
    },

    applyBookSpeed: async (bookId: string) => {
      const bookSpeed = get().getBookSpeed(bookId);
      set({ playbackRate: bookSpeed });

      if (bookSpeed !== 1.0) {
        await audioService.setPlaybackRate(bookSpeed).catch(() => {});
      }

      return bookSpeed;
    },

    loadSpeedSettings: async () => {
      try {
        const [
          bookSpeedMapStr,
          globalDefaultRateStr,
          activePlaybackRateStr,
          speedPresetsStr,
        ] = await Promise.all([
          AsyncStorage.getItem(BOOK_SPEED_MAP_KEY),
          AsyncStorage.getItem(GLOBAL_DEFAULT_RATE_KEY),
          AsyncStorage.getItem(ACTIVE_PLAYBACK_RATE_KEY),
          AsyncStorage.getItem(SPEED_PRESETS_KEY),
        ]);

        const bookSpeedMap = bookSpeedMapStr ? JSON.parse(bookSpeedMapStr) : {};
        const globalDefaultRate = globalDefaultRateStr ? parseFloat(globalDefaultRateStr) : 1.0;
        const speedPresets = speedPresetsStr ? JSON.parse(speedPresetsStr) : [];

        // Restore playback rate from active rate if available
        let playbackRate = globalDefaultRate;
        if (activePlaybackRateStr) {
          playbackRate = parseFloat(activePlaybackRateStr);
          log.debug(`Restored active playback rate: ${playbackRate}x`);
        }

        // Apply the restored rate to audioService immediately
        if (playbackRate !== 1.0) {
          log.debug(`Applying restored playback rate to audioService: ${playbackRate}x`);
          audioService.setPlaybackRate(playbackRate).catch(() => {
            // Audio service may not be loaded yet - rate will be applied when book loads
          });
        }

        set({
          bookSpeedMap,
          globalDefaultRate,
          playbackRate,
          speedPresets,
        });
      } catch (error) {
        log.warn('Error loading speed settings:', error);
        // Use defaults
      }
    },

    saveSpeedPreset: async (speed: number) => {
      const { speedPresets } = get();
      // Round to 2 decimal places
      const roundedSpeed = Math.round(speed * 100) / 100;

      // Don't add duplicates
      if (speedPresets.some(p => Math.abs(p - roundedSpeed) < 0.01)) {
        log.debug(`Preset ${roundedSpeed}x already exists`);
        return;
      }

      // Add and sort presets
      const updatedPresets = [...speedPresets, roundedSpeed].sort((a, b) => a - b);
      set({ speedPresets: updatedPresets });

      try {
        await AsyncStorage.setItem(SPEED_PRESETS_KEY, JSON.stringify(updatedPresets));
        log.debug(`Saved preset: ${roundedSpeed}x`);
      } catch (error) {
        log.warn('Error saving preset:', error);
      }
    },

    removeSpeedPreset: async (speed: number) => {
      const { speedPresets } = get();
      const updatedPresets = speedPresets.filter(p => Math.abs(p - speed) >= 0.01);
      set({ speedPresets: updatedPresets });

      try {
        await AsyncStorage.setItem(SPEED_PRESETS_KEY, JSON.stringify(updatedPresets));
        log.debug(`Removed preset: ${speed}x`);
      } catch (error) {
        log.warn('Error removing preset:', error);
      }
    },
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get current playback rate
 */
export const usePlaybackRate = () => useSpeedStore((s) => s.playbackRate);

/**
 * Get global default rate
 */
export const useGlobalDefaultRate = () => useSpeedStore((s) => s.globalDefaultRate);

/**
 * Get book-specific speed (uses global default if not set)
 */
export const useBookSpeed = (bookId: string) =>
  useSpeedStore((s) => s.bookSpeedMap[bookId] ?? s.globalDefaultRate);

/**
 * Check if a book has a custom speed set
 */
export const useHasCustomSpeed = (bookId: string) =>
  useSpeedStore((s) => bookId in s.bookSpeedMap);

/**
 * Get user-saved speed presets
 */
export const useSpeedPresets = () => useSpeedStore((s) => s.speedPresets);
