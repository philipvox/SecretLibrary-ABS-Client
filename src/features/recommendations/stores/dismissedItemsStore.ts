/**
 * src/features/recommendations/stores/dismissedItemsStore.ts
 *
 * Zustand store for tracking dismissed recommendations.
 * Users can swipe-to-dismiss books they're not interested in.
 * Persisted to AsyncStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';

interface DismissedItem {
  id: string;
  dismissedAt: number;
  reason?: 'not_interested' | 'already_read' | 'dislike_author';
}

interface DismissedItemsState {
  // Map of bookId -> dismissal info
  dismissedItems: Record<string, DismissedItem>;

  // Most recently dismissed item (for undo)
  lastDismissed: DismissedItem | null;

  // Actions
  dismissItem: (id: string, reason?: DismissedItem['reason']) => void;
  undoLastDismissal: () => void;
  undismissItem: (id: string) => void;
  isDismissed: (id: string) => boolean;
  getDismissedIds: () => string[];
  clearAllDismissals: () => void;
}

export const useDismissedItemsStore = create<DismissedItemsState>()(
  persist(
    (set, get) => ({
      dismissedItems: {},
      lastDismissed: null,

      dismissItem: (id: string, reason?: DismissedItem['reason']) => {
        const item: DismissedItem = {
          id,
          dismissedAt: Date.now(),
          reason,
        };

        set((state) => ({
          dismissedItems: {
            ...state.dismissedItems,
            [id]: item,
          },
          lastDismissed: item,
        }));
      },

      undoLastDismissal: () => {
        const { lastDismissed } = get();
        if (!lastDismissed) return;

        set((state) => {
          const { [lastDismissed.id]: _, ...rest } = state.dismissedItems;
          return {
            dismissedItems: rest,
            lastDismissed: null,
          };
        });
      },

      undismissItem: (id: string) => {
        set((state) => {
          const { [id]: _, ...rest } = state.dismissedItems;
          return { dismissedItems: rest };
        });
      },

      isDismissed: (id: string) => {
        return id in get().dismissedItems;
      },

      getDismissedIds: () => {
        return Object.keys(get().dismissedItems);
      },

      clearAllDismissals: () => {
        set({ dismissedItems: {}, lastDismissed: null });
      },
    }),
    {
      name: 'dismissed-items-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Selector hooks for optimized re-renders
// Use useShallow for array/object returns to prevent infinite loops
export const useDismissedIds = () => {
  const dismissedItems = useDismissedItemsStore(
    useShallow((state) => state.dismissedItems)
  );
  return useMemo(() => Object.keys(dismissedItems), [dismissedItems]);
};

export const useIsDismissed = (id: string) =>
  useDismissedItemsStore((state) => id in state.dismissedItems);

export const useLastDismissed = () =>
  useDismissedItemsStore((state) => state.lastDismissed);

export const useDismissedCount = () => {
  const dismissedItems = useDismissedItemsStore(
    useShallow((state) => state.dismissedItems)
  );
  // No need for useMemo - Object.keys().length is cheap
  return Object.keys(dismissedItems).length;
};
