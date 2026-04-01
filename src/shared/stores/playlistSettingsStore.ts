/**
 * src/shared/stores/playlistSettingsStore.ts
 *
 * Zustand store for playlist display preferences in the Library screen.
 * Persisted to AsyncStorage.
 *
 * Moved from features/playlists to shared because it's consumed by
 * profile (DisplaySettingsScreen, PlaylistSettingsScreen) and home (LibraryScreen).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default view type - 'library', 'lastPlayed', 'finished', or playlist ID prefixed with 'playlist:'
export type DefaultViewType = 'library' | 'lastPlayed' | 'finished' | string;

// Built-in view keys that can be hidden/reordered
export type BuiltInViewKey = 'library' | 'mySeries' | 'lastPlayed' | 'finished';
const ALL_BUILT_IN_KEYS: BuiltInViewKey[] = ['library', 'mySeries', 'lastPlayed', 'finished'];

interface PlaylistSettingsState {
  // Which playlists to show in VIEW dropdown (by ID)
  visiblePlaylistIds: string[];
  // Playlists explicitly hidden by user (not shown, won't auto-re-add)
  hiddenPlaylistIds: string[];
  // Order of playlists in dropdown (subset of visiblePlaylistIds)
  playlistOrder: string[];
  // Default view when opening Library screen
  defaultView: DefaultViewType;
  // Built-in views that are hidden (empty = all visible)
  hiddenBuiltInViews: BuiltInViewKey[];
  // Order of all items: built-in keys + playlist IDs interleaved
  // e.g. ['library', 'mySeries', 'playlist-abc', 'lastPlayed', 'finished']
  allItemOrder: string[];

  // Actions
  setVisiblePlaylists: (ids: string[]) => void;
  togglePlaylistVisibility: (playlistId: string) => void;
  toggleBuiltInVisibility: (key: BuiltInViewKey) => void;
  setPlaylistOrder: (order: string[]) => void;
  setAllItemOrder: (order: string[]) => void;
  setDefaultView: (view: DefaultViewType) => void;
  movePlaylist: (fromIndex: number, toIndex: number) => void;
  isBuiltInVisible: (key: BuiltInViewKey) => boolean;

  // Sync visible playlists with available playlists (removes deleted, auto-adds new)
  syncWithAvailablePlaylists: (availableIds: string[]) => void;
}

export const usePlaylistSettingsStore = create<PlaylistSettingsState>()(
  persist(
    (set, get) => ({
      visiblePlaylistIds: [],
      hiddenPlaylistIds: [],
      playlistOrder: [],
      defaultView: 'library',
      hiddenBuiltInViews: [],
      allItemOrder: [],

      setVisiblePlaylists: (ids) => {
        set({
          visiblePlaylistIds: ids,
          // Keep order in sync - remove any that are no longer visible
          playlistOrder: get().playlistOrder.filter(id => ids.includes(id)),
        });
      },

      togglePlaylistVisibility: (playlistId) => {
        const { visiblePlaylistIds, hiddenPlaylistIds, playlistOrder } = get();
        const isVisible = visiblePlaylistIds.includes(playlistId);

        if (isVisible) {
          set({
            visiblePlaylistIds: visiblePlaylistIds.filter(id => id !== playlistId),
            hiddenPlaylistIds: [...hiddenPlaylistIds.filter(id => id !== playlistId), playlistId],
            playlistOrder: playlistOrder.filter(id => id !== playlistId),
          });
        } else {
          set({
            visiblePlaylistIds: [...visiblePlaylistIds, playlistId],
            hiddenPlaylistIds: hiddenPlaylistIds.filter(id => id !== playlistId),
            playlistOrder: [...playlistOrder, playlistId],
          });
        }
      },

      toggleBuiltInVisibility: (key) => {
        const { hiddenBuiltInViews, defaultView } = get();
        const isHidden = hiddenBuiltInViews.includes(key);

        if (isHidden) {
          // Show it
          set({ hiddenBuiltInViews: hiddenBuiltInViews.filter(k => k !== key) });
        } else {
          // Hide it — reset default view if this was the default
          const newHidden = [...hiddenBuiltInViews, key];
          let newDefault = defaultView;
          if (defaultView === key) {
            // Pick first visible built-in, or 'library'
            const firstVisible = ALL_BUILT_IN_KEYS.find(k => !newHidden.includes(k));
            newDefault = firstVisible || 'library';
          }
          set({ hiddenBuiltInViews: newHidden, defaultView: newDefault });
        }
      },

      isBuiltInVisible: (key) => {
        return !get().hiddenBuiltInViews.includes(key);
      },

      setPlaylistOrder: (order) => set({ playlistOrder: order }),

      setAllItemOrder: (order) => set({ allItemOrder: order }),

      setDefaultView: (view) => set({ defaultView: view }),

      movePlaylist: (fromIndex, toIndex) => {
        const { playlistOrder, allItemOrder } = get();
        const newOrder = [...playlistOrder];
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);

        // Also update allItemOrder if the moved playlist is in it
        if (allItemOrder.length > 0 && allItemOrder.includes(removed)) {
          const newAllOrder = [...allItemOrder];
          const allIdx = newAllOrder.indexOf(removed);
          newAllOrder.splice(allIdx, 1);

          // Find target position: look at the playlist BEFORE the target in newOrder
          // and find its position in allItemOrder, then insert after it
          if (toIndex === 0) {
            // Moving to first position — find the first playlist in allItemOrder and insert before it
            const firstPlaylistIdx = newAllOrder.findIndex(id => newOrder.includes(id));
            newAllOrder.splice(firstPlaylistIdx >= 0 ? firstPlaylistIdx : 0, 0, removed);
          } else {
            const prevPlaylist = newOrder[toIndex - 1];
            const prevAllIdx = prevPlaylist ? newAllOrder.indexOf(prevPlaylist) : -1;
            newAllOrder.splice(prevAllIdx >= 0 ? prevAllIdx + 1 : newAllOrder.length, 0, removed);
          }
          set({ playlistOrder: newOrder, allItemOrder: newAllOrder });
        } else {
          set({ playlistOrder: newOrder });
        }
      },

      syncWithAvailablePlaylists: (availableIds) => {
        const { visiblePlaylistIds, hiddenPlaylistIds, playlistOrder, allItemOrder, defaultView } = get();
        const availableSet = new Set(availableIds);
        const visibleSet = new Set(visiblePlaylistIds);
        const hiddenSet = new Set(hiddenPlaylistIds);

        // Remove deleted playlists
        const newVisibleIds = visiblePlaylistIds.filter(id => availableSet.has(id));
        const newHiddenIds = hiddenPlaylistIds.filter(id => availableSet.has(id));
        const newOrder = playlistOrder.filter(id => availableSet.has(id));
        const newAllOrder = allItemOrder.filter(id =>
          ALL_BUILT_IN_KEYS.includes(id as BuiltInViewKey) ||
          ALL_BUILT_IN_KEYS.includes(id.replace('__', '') as BuiltInViewKey) ||
          availableSet.has(id)
        );

        // Auto-add newly created playlists (not previously visible or explicitly hidden)
        for (const id of availableIds) {
          if (!visibleSet.has(id) && !hiddenSet.has(id)) {
            newVisibleIds.push(id);
            newOrder.push(id);
            newAllOrder.push(id);
          }
        }

        let newDefaultView = defaultView;
        if (defaultView.startsWith('playlist:')) {
          const playlistId = defaultView.replace('playlist:', '');
          if (!availableSet.has(playlistId)) {
            newDefaultView = 'library';
          }
        }

        set({
          visiblePlaylistIds: newVisibleIds,
          hiddenPlaylistIds: newHiddenIds,
          playlistOrder: newOrder,
          allItemOrder: newAllOrder,
          defaultView: newDefaultView,
        });
      },
    }),
    {
      name: 'playlist-settings-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Selector hooks for specific state
export const useVisiblePlaylistIds = () =>
  usePlaylistSettingsStore((s) => s.visiblePlaylistIds);

export const usePlaylistOrder = () =>
  usePlaylistSettingsStore((s) => s.playlistOrder);

export const useDefaultView = () =>
  usePlaylistSettingsStore((s) => s.defaultView);
