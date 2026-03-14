/**
 * src/features/book-detail/stores/starPositionStore.ts
 *
 * Persisted store for gold star sticker positions on book covers.
 * Each book can have multiple stars placed by double-tapping.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StarPosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  rotation: number; // degrees
  variant: number; // 0-3, which star PNG to use
}

interface StarPositionState {
  /** Map of bookId -> array of star positions on cover */
  positions: Record<string, StarPosition[]>;

  /** Add a star to a book cover */
  addStar: (bookId: string, star: StarPosition) => void;

  /** Remove a star by index */
  removeStarAt: (bookId: string, index: number) => void;

  /** Get stars for a book */
  getStars: (bookId: string) => StarPosition[];
}

/** Hit-test radius in percentage points for removing a star */
export const STAR_HIT_RADIUS = 8;

export const useStarPositionStore = create<StarPositionState>()(
  persist(
    (set, get) => ({
      positions: {},

      addStar: (bookId, star) =>
        set((state) => {
          const existing = Array.isArray(state.positions[bookId]) ? state.positions[bookId] : [];
          return {
            positions: {
              ...state.positions,
              [bookId]: [...existing, star],
            },
          };
        }),

      removeStarAt: (bookId, index) =>
        set((state) => {
          const raw = state.positions[bookId];
          const stars = Array.isArray(raw) ? raw : null;
          if (!stars) return state;
          const updated = stars.filter((_, i) => i !== index);
          if (updated.length === 0) {
            const { [bookId]: _, ...rest } = state.positions;
            return { positions: rest };
          }
          return { positions: { ...state.positions, [bookId]: updated } };
        }),

      getStars: (bookId) => get().positions[bookId] || [],
    }),
    {
      name: 'star-positions',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
