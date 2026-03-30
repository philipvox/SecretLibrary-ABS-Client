/**
 * src/shared/stores/myLibraryStore.ts
 *
 * Zustand store for managing user's personal library
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibrarySyncStore } from './librarySyncStore';

type ViewMode = 'shelf' | 'grid' | 'list';

interface MyLibraryState {
  // Library items (book IDs)
  libraryIds: string[];

  // Favorite series (series names)
  favoriteSeriesNames: string[];

  // Preferences
  hideSingleBookSeries: boolean;
  defaultViewMode: ViewMode;

  // Actions
  addToLibrary: (bookId: string) => void;
  removeFromLibrary: (bookId: string) => void;
  isInLibrary: (bookId: string) => boolean;

  // Series favorites
  addSeriesToFavorites: (seriesName: string) => void;
  removeSeriesFromFavorites: (seriesName: string) => void;
  isSeriesFavorite: (seriesName: string) => boolean;

  // Preferences
  setHideSingleBookSeries: (hide: boolean) => void;
  setDefaultViewMode: (mode: ViewMode) => void;

  clearAll: () => void;
}

export const useMyLibraryStore = create<MyLibraryState>()(
  persist(
    (set, get) => ({
      libraryIds: [],
      favoriteSeriesNames: [],
      hideSingleBookSeries: true, // Default to hiding single-book series
      defaultViewMode: 'shelf' as ViewMode,

      addToLibrary: (bookId: string) => {
        const { libraryIds } = get();
        if (!libraryIds.includes(bookId)) {
          set({ libraryIds: [...libraryIds, bookId] });
          // Sync: clear tombstone and push to server
          useLibrarySyncStore.getState().clearBookTombstone(bookId);
          import('@/core/services/librarySyncService').then(({ librarySyncService }) => {
            librarySyncService.pushBookChange(bookId, 'add');
          }).catch(err => console.warn('Failed to sync library add:', err));
        }
      },

      removeFromLibrary: (bookId: string) => {
        const { libraryIds } = get();
        set({
          libraryIds: libraryIds.filter(id => id !== bookId),
        });
        // Sync: record tombstone and push to server
        useLibrarySyncStore.getState().addBookTombstone(bookId);
        import('@/core/services/librarySyncService').then(({ librarySyncService }) => {
          librarySyncService.pushBookChange(bookId, 'remove');
        }).catch(err => console.warn('Failed to sync library remove:', err));
      },

      isInLibrary: (bookId: string) => {
        return get().libraryIds.includes(bookId);
      },

      // Series favorites
      addSeriesToFavorites: (seriesName: string) => {
        const { favoriteSeriesNames } = get();
        if (!favoriteSeriesNames.includes(seriesName)) {
          set({ favoriteSeriesNames: [...favoriteSeriesNames, seriesName] });
          // Sync: clear tombstone and push to server
          useLibrarySyncStore.getState().clearSeriesTombstone(seriesName);
          import('@/core/services/librarySyncService').then(({ librarySyncService }) => {
            librarySyncService.pushSeriesChange(seriesName, 'add');
          }).catch(err => console.warn('Failed to sync series add:', err));
        }
      },

      removeSeriesFromFavorites: (seriesName: string) => {
        const { favoriteSeriesNames } = get();
        set({ favoriteSeriesNames: favoriteSeriesNames.filter(name => name !== seriesName) });
        // Sync: record tombstone and push to server
        useLibrarySyncStore.getState().addSeriesTombstone(seriesName);
        import('@/core/services/librarySyncService').then(({ librarySyncService }) => {
          librarySyncService.pushSeriesChange(seriesName, 'remove');
        }).catch(err => console.warn('Failed to sync series remove:', err));
      },

      isSeriesFavorite: (seriesName: string) => {
        return get().favoriteSeriesNames.includes(seriesName);
      },

      // Preferences
      setHideSingleBookSeries: (hide: boolean) => {
        set({ hideSingleBookSeries: hide });
      },
      setDefaultViewMode: (mode: ViewMode) => {
        set({ defaultViewMode: mode });
      },

      clearAll: () => {
        const { libraryIds } = get();
        // Batch remove from server playlist FIRST, then clear tombstones on success
        // If we clear tombstones before the server remove completes, a sync could
        // re-add books from the server before the remove finishes
        const playlistId = useLibrarySyncStore.getState().libraryPlaylistId;
        if (playlistId && libraryIds.length > 0) {
          import('@/core/api/endpoints/playlists').then(({ playlistsApi }) => {
            playlistsApi.batchRemove(playlistId, libraryIds).then(() => {
              // Only clear tombstones after server confirms removal
              useLibrarySyncStore.setState({ bookTombstones: [], seriesTombstones: [] });
            }).catch((err: any) =>
              console.warn('Failed to clear server playlist:', err)
            );
          }).catch(err => console.warn('Failed to import playlists API:', err));
        } else {
          // No server playlist — safe to clear tombstones immediately
          useLibrarySyncStore.setState({ bookTombstones: [], seriesTombstones: [] });
        }
        set({
          libraryIds: [],
          favoriteSeriesNames: [],
        });
        // Clear progressStore librarySet + SQLite
        import('@/core/stores/progressStore').then(({ useProgressStore }) => {
          const state = useProgressStore.getState();
          // Update progressMap: set isInLibrary = false for all
          const newMap = new Map(state.progressMap);
          newMap.forEach((data, bookId) => {
            newMap.set(bookId, { ...data, isInLibrary: false });
          });
          useProgressStore.setState({
            librarySet: new Set(),
            progressMap: newMap,
            version: state.version + 1,
          });
        }).catch(() => { /* silently ignore cleanup failure */ });
        // Clear is_in_library in SQLite for all books
        import('@/core/services/sqliteCache').then(({ sqliteCache }) => {
          (sqliteCache as any).ensureReady().then((db: any) => {
            db.runAsync(
              `UPDATE user_books SET is_in_library = 0, local_updated_at = ?`,
              [new Date().toISOString()]
            ).catch((err: any) => console.warn('Failed to clear SQLite library:', err));
          });
        }).catch(() => { /* silently ignore cleanup failure */ });
      },

    }),
    {
      name: 'my-library-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        libraryIds: state.libraryIds,
        favoriteSeriesNames: state.favoriteSeriesNames,
        hideSingleBookSeries: state.hideSingleBookSeries,
        defaultViewMode: state.defaultViewMode,
      }),
    }
  )
);