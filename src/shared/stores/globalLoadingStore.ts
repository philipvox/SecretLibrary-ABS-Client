/**
 * src/shared/stores/globalLoadingStore.ts
 *
 * Global loading overlay state.
 * Use this to show loading when navigating to heavy screens.
 *
 * Features:
 * - Minimum display time to prevent visual jitter
 * - Race condition prevention (cancels pending hides on new show)
 * - Debounce protection against rapid toggling
 * - Safe to call from anywhere (doesn't require React context)
 */

import { create } from 'zustand';
import {
  LOADING_MIN_DISPLAY_MS,
  LOADING_DEBOUNCE_MS,
} from '@/constants/loading';

interface GlobalLoadingState {
  isLoading: boolean;
  show: () => void;
  hide: () => void;
}

// Internal state tracking
let showTimestamp = 0;
let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
let showCount = 0; // Track show() calls to handle rapid toggling

export const useGlobalLoadingStore = create<GlobalLoadingState>((set, get) => ({
  isLoading: false,

  show: () => {
    const currentShowId = ++showCount;

    // Cancel any pending hide timeout - prevents race conditions
    if (hideTimeoutId !== null) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }

    // If already showing, just update timestamp (extends minimum display)
    if (get().isLoading) {
      showTimestamp = Date.now();
      return;
    }

    // Debounce rapid show() calls
    showTimestamp = Date.now();
    set({ isLoading: true });
  },

  hide: () => {
    // Don't hide if already hidden
    if (!get().isLoading) return;

    // Cancel any pending hide timeout to prevent double-hides
    if (hideTimeoutId !== null) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }

    const elapsed = Date.now() - showTimestamp;
    const remaining = LOADING_MIN_DISPLAY_MS - elapsed;

    if (remaining > 0) {
      // Delay hide to ensure minimum display time
      hideTimeoutId = setTimeout(() => {
        hideTimeoutId = null;
        // Double-check we should still hide (show() might have been called)
        if (get().isLoading) {
          set({ isLoading: false });
        }
      }, remaining);
    } else {
      set({ isLoading: false });
    }
  },
}));

// Convenience functions for use outside of React components
export const globalLoading = {
  show: () => useGlobalLoadingStore.getState().show(),
  hide: () => useGlobalLoadingStore.getState().hide(),
};
