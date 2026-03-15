/**
 * src/features/browse/stores/browseTabStore.ts
 *
 * Persisted Zustand store for browse tab selection.
 * Tracks which tab is active: For You, Discover, or Collections.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BrowseTab = 'forYou' | 'discover' | 'collections';

interface BrowseTabState {
  activeTab: BrowseTab;
  setActiveTab: (tab: BrowseTab) => void;
}

export const useBrowseTabStore = create<BrowseTabState>()(
  persist(
    (set) => ({
      activeTab: 'forYou',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'browse-tab-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
