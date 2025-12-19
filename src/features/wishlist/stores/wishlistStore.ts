/**
 * src/features/wishlist/stores/wishlistStore.ts
 *
 * Zustand store for wishlist state management.
 * Persisted to AsyncStorage for offline-first experience.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid';
import {
  WishlistItem,
  FollowedAuthor,
  TrackedSeries,
  WishlistPriority,
  WishlistSource,
  WishlistStatus,
  WishlistSortOption,
  WishlistFilters,
  ExternalBookResult,
} from '../types';

interface WishlistState {
  // Data
  items: WishlistItem[];
  followedAuthors: FollowedAuthor[];
  trackedSeries: TrackedSeries[];

  // UI State
  sortBy: WishlistSortOption;
  filters: WishlistFilters;

  // Actions - Wishlist Items
  addItem: (item: Omit<WishlistItem, 'id' | 'addedAt' | 'updatedAt' | 'status'>) => string;
  addFromLibraryItem: (libraryItemId: string, priority?: WishlistPriority, notes?: string) => string;
  addFromManualEntry: (manual: WishlistItem['manual'], priority?: WishlistPriority, notes?: string) => string;
  addFromExternalSearch: (result: ExternalBookResult, priority?: WishlistPriority, notes?: string) => string;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<WishlistItem>) => void;
  updatePriority: (id: string, priority: WishlistPriority) => void;
  updateNotes: (id: string, notes: string) => void;
  updateStatus: (id: string, status: WishlistStatus) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;

  // Actions - Authors
  followAuthor: (author: Omit<FollowedAuthor, 'id' | 'followedAt'>) => string;
  unfollowAuthor: (id: string) => void;
  updateAuthor: (id: string, updates: Partial<FollowedAuthor>) => void;

  // Actions - Series
  trackSeries: (series: Omit<TrackedSeries, 'id' | 'trackedAt'>) => string;
  untrackSeries: (id: string) => void;
  updateSeries: (id: string, updates: Partial<TrackedSeries>) => void;

  // Actions - UI
  setSortBy: (sort: WishlistSortOption) => void;
  setFilters: (filters: WishlistFilters) => void;
  clearFilters: () => void;

  // Queries
  isOnWishlist: (libraryItemId: string) => boolean;
  getWishlistItem: (id: string) => WishlistItem | undefined;
  getWishlistItemByLibraryId: (libraryItemId: string) => WishlistItem | undefined;
  isAuthorFollowed: (authorId: string) => boolean;
  isSeriesTracked: (seriesId: string) => boolean;
  getFilteredItems: () => WishlistItem[];
  getSortedItems: (items: WishlistItem[]) => WishlistItem[];
  getAllTags: () => string[];
  getItemCount: () => number;
}

// Helper: generate nano ID compatible with React Native
function generateId(): string {
  return `wl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Helper: get current ISO timestamp
function now(): string {
  return new Date().toISOString();
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      // Initial data
      items: [],
      followedAuthors: [],
      trackedSeries: [],

      // Initial UI state
      sortBy: 'date-added',
      filters: {},

      // ========== Wishlist Item Actions ==========

      addItem: (item) => {
        const id = generateId();
        const timestamp = now();
        const newItem: WishlistItem = {
          ...item,
          id,
          addedAt: timestamp,
          updatedAt: timestamp,
          status: 'wishlist',
        };
        set((state) => ({
          items: [newItem, ...state.items],
        }));
        return id;
      },

      addFromLibraryItem: (libraryItemId, priority = 'want-to-read', notes) => {
        return get().addItem({
          libraryItemId,
          priority,
          notes,
          source: 'server-search',
        });
      },

      addFromManualEntry: (manual, priority = 'want-to-read', notes) => {
        return get().addItem({
          manual,
          priority,
          notes,
          source: 'manual',
        });
      },

      addFromExternalSearch: (result, priority = 'want-to-read', notes) => {
        return get().addItem({
          manual: {
            title: result.title,
            author: result.author,
            narrator: result.narrator,
            series: result.series,
            seriesSequence: result.seriesSequence,
            coverUrl: result.coverUrl,
            isbn: result.isbn,
            asin: result.asin,
            description: result.description,
            estimatedDuration: result.duration,
            genres: result.genres,
          },
          priority,
          notes,
          source: 'external-search',
          expectedReleaseDate: result.releaseDate,
        });
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, ...updates, updatedAt: now() }
              : item
          ),
        }));
      },

      updatePriority: (id, priority) => {
        get().updateItem(id, { priority });
      },

      updateNotes: (id, notes) => {
        get().updateItem(id, { notes });
      },

      updateStatus: (id, status) => {
        get().updateItem(id, { status });
      },

      addTag: (id, tag) => {
        const item = get().getWishlistItem(id);
        if (item) {
          const tags = item.tags || [];
          if (!tags.includes(tag)) {
            get().updateItem(id, { tags: [...tags, tag] });
          }
        }
      },

      removeTag: (id, tag) => {
        const item = get().getWishlistItem(id);
        if (item && item.tags) {
          get().updateItem(id, { tags: item.tags.filter((t) => t !== tag) });
        }
      },

      // ========== Author Actions ==========

      followAuthor: (author) => {
        const id = generateId();
        const newAuthor: FollowedAuthor = {
          ...author,
          id,
          followedAt: now(),
        };
        set((state) => ({
          followedAuthors: [newAuthor, ...state.followedAuthors],
        }));
        return id;
      },

      unfollowAuthor: (id) => {
        set((state) => ({
          followedAuthors: state.followedAuthors.filter((a) => a.id !== id),
        }));
      },

      updateAuthor: (id, updates) => {
        set((state) => ({
          followedAuthors: state.followedAuthors.map((author) =>
            author.id === id ? { ...author, ...updates } : author
          ),
        }));
      },

      // ========== Series Actions ==========

      trackSeries: (series) => {
        const id = generateId();
        const newSeries: TrackedSeries = {
          ...series,
          id,
          trackedAt: now(),
        };
        set((state) => ({
          trackedSeries: [newSeries, ...state.trackedSeries],
        }));
        return id;
      },

      untrackSeries: (id) => {
        set((state) => ({
          trackedSeries: state.trackedSeries.filter((s) => s.id !== id),
        }));
      },

      updateSeries: (id, updates) => {
        set((state) => ({
          trackedSeries: state.trackedSeries.map((series) =>
            series.id === id ? { ...series, ...updates } : series
          ),
        }));
      },

      // ========== UI Actions ==========

      setSortBy: (sortBy) => set({ sortBy }),

      setFilters: (filters) => set({ filters }),

      clearFilters: () => set({ filters: {} }),

      // ========== Queries ==========

      isOnWishlist: (libraryItemId) => {
        return get().items.some((item) => item.libraryItemId === libraryItemId);
      },

      getWishlistItem: (id) => {
        return get().items.find((item) => item.id === id);
      },

      getWishlistItemByLibraryId: (libraryItemId) => {
        return get().items.find((item) => item.libraryItemId === libraryItemId);
      },

      isAuthorFollowed: (authorId) => {
        return get().followedAuthors.some(
          (a) => a.libraryAuthorId === authorId || a.id === authorId
        );
      },

      isSeriesTracked: (seriesId) => {
        return get().trackedSeries.some(
          (s) => s.librarySeriesId === seriesId || s.id === seriesId
        );
      },

      getFilteredItems: () => {
        const { items, filters } = get();
        let filtered = [...items];

        if (filters.priority?.length) {
          filtered = filtered.filter((item) =>
            filters.priority!.includes(item.priority)
          );
        }

        if (filters.status?.length) {
          filtered = filtered.filter((item) =>
            filters.status!.includes(item.status)
          );
        }

        if (filters.source?.length) {
          filtered = filtered.filter((item) =>
            filters.source!.includes(item.source)
          );
        }

        if (filters.tags?.length) {
          filtered = filtered.filter((item) =>
            item.tags?.some((tag) => filters.tags!.includes(tag))
          );
        }

        if (filters.hasNotes) {
          filtered = filtered.filter((item) => item.notes && item.notes.length > 0);
        }

        return filtered;
      },

      getSortedItems: (items) => {
        const { sortBy } = get();
        const sorted = [...items];

        switch (sortBy) {
          case 'date-added':
            return sorted.sort(
              (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
            );

          case 'priority':
            const priorityOrder = { 'must-read': 0, 'want-to-read': 1, 'maybe': 2 };
            return sorted.sort(
              (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
            );

          case 'title':
            return sorted.sort((a, b) => {
              const titleA = a.manual?.title || '';
              const titleB = b.manual?.title || '';
              return titleA.localeCompare(titleB);
            });

          case 'author':
            return sorted.sort((a, b) => {
              const authorA = a.manual?.author || '';
              const authorB = b.manual?.author || '';
              return authorA.localeCompare(authorB);
            });

          case 'release-date':
            return sorted.sort((a, b) => {
              const dateA = a.expectedReleaseDate || '9999';
              const dateB = b.expectedReleaseDate || '9999';
              return dateA.localeCompare(dateB);
            });

          default:
            return sorted;
        }
      },

      getAllTags: () => {
        const { items } = get();
        const tagSet = new Set<string>();
        items.forEach((item) => {
          item.tags?.forEach((tag) => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
      },

      getItemCount: () => get().items.length,
    }),
    {
      name: 'wishlist-store',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        items: state.items,
        followedAuthors: state.followedAuthors,
        trackedSeries: state.trackedSeries,
        sortBy: state.sortBy,
        // Don't persist filters - reset on app restart
      }),
    }
  )
);

// ========== Convenience Hooks ==========

/**
 * Hook to check if a specific library item is on the wishlist
 */
export function useIsOnWishlist(libraryItemId: string): boolean {
  return useWishlistStore((state) =>
    state.items.some((item) => item.libraryItemId === libraryItemId)
  );
}

/**
 * Hook to get wishlist item by library ID
 */
export function useWishlistItemByLibraryId(libraryItemId: string): WishlistItem | undefined {
  return useWishlistStore((state) =>
    state.items.find((item) => item.libraryItemId === libraryItemId)
  );
}

/**
 * Hook to get total wishlist count for badges
 */
export function useWishlistCount(): number {
  return useWishlistStore((state) => state.items.length);
}

/**
 * Hook to get followed authors count
 */
export function useFollowedAuthorsCount(): number {
  return useWishlistStore((state) => state.followedAuthors.length);
}

/**
 * Hook to get tracked series count
 */
export function useTrackedSeriesCount(): number {
  return useWishlistStore((state) => state.trackedSeries.length);
}

/**
 * Hook to check if an author is followed
 */
export function useIsAuthorFollowed(authorId: string): boolean {
  return useWishlistStore((state) =>
    state.followedAuthors.some(
      (a) => a.libraryAuthorId === authorId || a.id === authorId
    )
  );
}

/**
 * Hook to check if a series is tracked
 */
export function useIsSeriesTracked(seriesId: string): boolean {
  return useWishlistStore((state) =>
    state.trackedSeries.some(
      (s) => s.librarySeriesId === seriesId || s.id === seriesId
    )
  );
}
