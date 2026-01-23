/**
 * src/features/user/hooks/useFavorites.ts
 *
 * Favorites hooks with optimistic updates and offline support.
 * Uses React Query for caching and Zustand (myLibraryStore) as backing store.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryClient';
import { sqliteCache } from '@/core/services/sqliteCache';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { FavoriteItem } from '../types';

/**
 * Get all favorites
 */
export function useFavorites() {
  const libraryIds = useMyLibraryStore((state) => state.libraryIds);

  return useQuery({
    queryKey: queryKeys.user.favorites(),
    queryFn: async (): Promise<FavoriteItem[]> => {
      // First try SQLite cache for metadata
      const cachedFavorites = await sqliteCache.getFavorites();

      // Merge with Zustand store (source of truth)
      const favorites: FavoriteItem[] = libraryIds.map((itemId) => {
        const cached = cachedFavorites.find((f) => f.itemId === itemId);
        return {
          itemId,
          addedAt: cached?.addedAt || new Date().toISOString(),
        };
      });

      return favorites;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Check if specific item is favorite
 */
export function useIsFavorite(itemId: string): boolean {
  const isInLibrary = useMyLibraryStore((state) => state.isInLibrary);
  return isInLibrary(itemId);
}

/**
 * Toggle favorite status with optimistic update
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const addToLibrary = useMyLibraryStore((state) => state.addToLibrary);
  const removeFromLibrary = useMyLibraryStore((state) => state.removeFromLibrary);

  return useMutation({
    mutationFn: async ({
      itemId,
      isFavorite,
    }: {
      itemId: string;
      isFavorite: boolean;
    }) => {
      // Update SQLite cache
      if (isFavorite) {
        await sqliteCache.addFavorite(itemId);
      } else {
        await sqliteCache.removeFavorite(itemId);
      }

      return { itemId, isFavorite };
    },

    // Optimistic update
    onMutate: async ({ itemId, isFavorite }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.user.favorites() });

      // Get previous state for rollback
      const previousFavorites = queryClient.getQueryData<FavoriteItem[]>(
        queryKeys.user.favorites()
      );

      // Update Zustand store (immediate)
      if (isFavorite) {
        addToLibrary(itemId);
      } else {
        removeFromLibrary(itemId);
      }

      // Update React Query cache
      queryClient.setQueryData<FavoriteItem[]>(queryKeys.user.favorites(), (old = []) => {
        if (isFavorite) {
          // Check if already in list
          if (old.some((f) => f.itemId === itemId)) return old;
          return [...old, { itemId, addedAt: new Date().toISOString() }];
        } else {
          return old.filter((f) => f.itemId !== itemId);
        }
      });

      return { previousFavorites };
    },

    onError: (_err, { itemId, isFavorite }, context) => {
      // Rollback Zustand store
      if (isFavorite) {
        removeFromLibrary(itemId);
      } else {
        addToLibrary(itemId);
      }

      // Rollback React Query cache
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKeys.user.favorites(), context.previousFavorites);
      }
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.user.favorites() });
    },
  });
}

/**
 * Add to favorites (convenience hook)
 */
export function useAddFavorite() {
  const { mutate, mutateAsync, isPending } = useToggleFavorite();

  return {
    addFavorite: (itemId: string) => mutate({ itemId, isFavorite: true }),
    addFavoriteAsync: (itemId: string) => mutateAsync({ itemId, isFavorite: true }),
    isPending,
  };
}

/**
 * Remove from favorites (convenience hook)
 */
export function useRemoveFavorite() {
  const { mutate, mutateAsync, isPending } = useToggleFavorite();

  return {
    removeFavorite: (itemId: string) => mutate({ itemId, isFavorite: false }),
    removeFavoriteAsync: (itemId: string) => mutateAsync({ itemId, isFavorite: false }),
    isPending,
  };
}

/**
 * Get favorites count
 */
export function useFavoritesCount(): number {
  const libraryIds = useMyLibraryStore((state) => state.libraryIds);
  return libraryIds.length;
}
