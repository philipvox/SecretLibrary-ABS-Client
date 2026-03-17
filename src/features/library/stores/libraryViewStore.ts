/**
 * src/features/library/stores/libraryViewStore.ts
 *
 * Persisted store for My Library view preferences (sort order).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SortOption } from '../components/SortPicker';

interface LibraryViewState {
  sort: SortOption;
  setSort: (sort: SortOption) => void;
}

export const useLibraryViewStore = create<LibraryViewState>()(
  persist(
    (set) => ({
      sort: 'recently-played',
      setSort: (sort) => set({ sort }),
    }),
    {
      name: 'library-view-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
