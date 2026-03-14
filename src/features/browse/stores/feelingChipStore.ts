/**
 * src/features/browse/stores/feelingChipStore.ts
 *
 * Ephemeral (NOT persisted) state for feeling chip selection on Discover tab.
 * One chip active at a time; tap again to deselect.
 */

import { create } from 'zustand';

export type FeelingChip =
  | 'thrilling'
  | 'funny'
  | 'dark'
  | 'heartwarming'
  | 'escapist'
  | 'thought-provoking'
  | 'cozy'
  | 'intense';

interface FeelingChipState {
  activeChip: FeelingChip | null;
  setChip: (chip: FeelingChip) => void;
  clearChip: () => void;
  toggleChip: (chip: FeelingChip) => void;
}

export const useFeelingChipStore = create<FeelingChipState>((set, get) => ({
  activeChip: null,
  setChip: (chip) => set({ activeChip: chip }),
  clearChip: () => set({ activeChip: null }),
  toggleChip: (chip) => {
    if (get().activeChip === chip) {
      set({ activeChip: null });
    } else {
      set({ activeChip: chip });
    }
  },
}));
